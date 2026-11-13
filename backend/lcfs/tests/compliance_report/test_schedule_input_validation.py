"""
Schedule saves cannot change compliance units with inputs that are not real:
negative quantities, fuel codes the row may not claim, and energy densities
the supplier sets for a recognized fuel.

- Quantities are bounded at the API (422) and by CHECK constraints. Rows
  saved before the CHECK still read back; only saves are bounded.
- A fuel code must be Approved, for the row's fuel type, and effective in the
  report's compliance year. A row that keeps the code it already had is not
  date-checked again (reports from before 2024 carry codes that expired).
- A recognized fuel is calculated with its standard energy density. A value
  sent with the row is discarded, not rejected: the grids send every row back
  with the density the server returned. A value is used only for an
  unrecognized ("Other") fuel, within range.

These run against the database through the API.
"""

from datetime import date

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

from lcfs.db.models.compliance.AllocationAgreement import AllocationAgreement
from lcfs.db.models.compliance.FuelExport import FuelExport
from lcfs.db.models.compliance.FuelSupply import FuelSupply
from lcfs.db.models.compliance.NotionalTransfer import NotionalTransfer
from lcfs.db.models.compliance.OtherUses import OtherUses
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatusEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.tests.compliance_report.report_write_seed import (
    FUEL_CODE_PROVISION,
    YEAR,
    fuel_reference,
    organization_ids,
    seed_allocation_agreement,
    seed_fuel_code,
    seed_fuel_supply,
    seed_notional_transfer,
    seed_report,
)


@pytest.fixture
async def org_ids(dbsession):
    return await organization_ids(dbsession)


@pytest.fixture
async def ref(dbsession):
    return await fuel_reference(dbsession)


@pytest.fixture
async def report(dbsession, add_models, org_ids):
    return await seed_report(dbsession, add_models, org_ids[0])


@pytest.fixture(autouse=True)
def as_supplier(fastapi_app: FastAPI, set_mock_user, org_ids):
    set_mock_user(
        fastapi_app,
        [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY],
        {"organization_id": org_ids[0]},
    )


async def _rows(dbsession, model, compliance_report_id):
    return (
        (
            await dbsession.execute(
                select(model)
                .where(model.compliance_report_id == compliance_report_id)
                .execution_options(populate_existing=True)
            )
        )
        .scalars()
        .all()
    )


async def _save(client, fastapi_app, route_name, body):
    return await client.post(fastapi_app.url_path_for(route_name), json=body)


def _fuel_supply_body(report, ref, **overrides):
    body = {
        "complianceReportId": report.compliance_report_id,
        "fuelTypeId": ref.fuel_type.fuel_type_id,
        "fuelCategoryId": ref.fuel_category.fuel_category_id,
        "endUseId": ref.end_use.end_use_type_id,
        "provisionOfTheActId": ref.default_ci_provision_id,
        "quantity": 1000,
        "units": "L",
    }
    body.update(overrides)
    return body


def _fuel_export_body(report, ref, **overrides):
    body = {
        "complianceReportId": report.compliance_report_id,
        "fuelTypeId": ref.fuel_type.fuel_type_id,
        "fuelCategoryId": ref.fuel_category.fuel_category_id,
        "endUseId": ref.end_use.end_use_type_id,
        "provisionOfTheActId": ref.default_ci_provision_id,
        "exportDate": f"{YEAR}-06-01",
        "quantity": 1000,
        "units": "L",
    }
    body.update(overrides)
    return body


def _notional_transfer_body(report, ref, **overrides):
    body = {
        "complianceReportId": report.compliance_report_id,
        "legalName": "Trading partner",
        "addressForService": "1 Partner Street, Victoria, BC",
        "fuelCategory": ref.fuel_category.category,
        "receivedOrTransferred": "Received",
        "quantity": 1000,
    }
    body.update(overrides)
    return body


def _allocation_agreement_body(report, ref, **overrides):
    body = {
        "complianceReportId": report.compliance_report_id,
        "allocationTransactionType": "Allocated from",
        "transactionPartner": "Trading partner",
        "postalAddress": "1 Partner Street, Victoria, BC",
        "fuelType": ref.fuel_type.fuel_type,
        "fuelCategory": ref.fuel_category.category,
        "provisionOfTheAct": "Default carbon intensity - section 19 (b) (ii)",
        "quantity": 1000,
    }
    body.update(overrides)
    return body


def _other_use_body(report, ref, **overrides):
    body = {
        "complianceReportId": report.compliance_report_id,
        "fuelType": ref.fuel_type.fuel_type,
        "fuelCategory": ref.fuel_category.category,
        "provisionOfTheAct": "Default carbon intensity - section 19 (b) (ii)",
        "quantitySupplied": 1000,
        "units": "L",
        "expectedUse": "Heating oil",
    }
    body.update(overrides)
    return body


# --- Negative quantities ------------------------------------------------------


@pytest.mark.anyio
@pytest.mark.parametrize(
    "overrides",
    [
        {"quantity": -1000},
        {"quantity": None, "q1Quantity": 500, "q2Quantity": -400},
    ],
)
async def test_fuel_supply_rejects_negative_quantities(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, report, ref, overrides
):
    response = await _save(
        client,
        fastapi_app,
        "save_fuel_supply_row",
        _fuel_supply_body(report, ref, **overrides),
    )

    assert response.status_code == 422
    assert await _rows(dbsession, FuelSupply, report.compliance_report_id) == []


@pytest.mark.anyio
@pytest.mark.parametrize(
    "route_name, model, body_builder, quantity_field",
    [
        (
            "save_notional_transfer_row",
            NotionalTransfer,
            _notional_transfer_body,
            "quantity",
        ),
        (
            "save_allocation_agreements_row",
            AllocationAgreement,
            _allocation_agreement_body,
            "quantity",
        ),
        ("save_other_uses_row", OtherUses, _other_use_body, "quantitySupplied"),
    ],
)
async def test_other_schedules_reject_negative_quantities(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    report,
    ref,
    route_name,
    model,
    body_builder,
    quantity_field,
):
    response = await _save(
        client,
        fastapi_app,
        route_name,
        body_builder(report, ref, **{quantity_field: -1000}),
    )

    assert response.status_code == 422
    assert await _rows(dbsession, model, report.compliance_report_id) == []


@pytest.mark.anyio
@pytest.mark.parametrize("seed", [seed_fuel_supply, seed_notional_transfer])
async def test_database_rejects_negative_quantities(
    dbsession, add_models, report, ref, seed
):
    with pytest.raises(IntegrityError):
        async with dbsession.begin_nested():
            await seed(add_models, ref, report.compliance_report_id, quantity=-1)


async def _seed_row_saved_before_the_check(dbsession, model, seed):
    """Store a negative quantity the way the migration can leave one.

    When existing rows break the quantity CHECK, the migration adds it
    NOT VALID: those rows stay, and only new writes are checked. The test
    transaction is rolled back, so the constraint is restored afterwards.
    """
    table = model.__tablename__
    constraint = f"ck_{table}_quantities_non_negative"
    definition = (
        await dbsession.execute(
            text(
                "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
                "WHERE conname = :name"
            ),
            {"name": constraint},
        )
    ).scalar_one()
    await dbsession.execute(text(f"ALTER TABLE {table} DROP CONSTRAINT {constraint}"))
    row = await seed()
    await dbsession.execute(
        text(f"ALTER TABLE {table} ADD CONSTRAINT {constraint} {definition} NOT VALID")
    )
    return row


@pytest.mark.anyio
@pytest.mark.parametrize(
    "model, seed, route_name, list_key, extra_body",
    [
        # The same list requests the schedule grids make.
        (
            FuelSupply,
            seed_fuel_supply,
            "get_fuel_supply",
            "fuelSupplies",
            {"filters": [], "page": 1, "size": 10, "sortOrders": []},
        ),
        (
            NotionalTransfer,
            seed_notional_transfer,
            "get_notional_transfers",
            "notionalTransfers",
            {},
        ),
        pytest.param(
            AllocationAgreement,
            seed_allocation_agreement,
            "get_allocation_agreements",
            "allocationAgreements",
            {},
            # list-all leaves `pagination` at its {} default, which pydantic
            # warns about when serializing; that is unrelated to quantities.
            marks=pytest.mark.filterwarnings(
                "ignore:Pydantic serializer warnings:UserWarning"
            ),
        ),
    ],
)
async def test_rows_saved_before_the_quantity_check_still_list(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    add_models,
    report,
    ref,
    model,
    seed,
    route_name,
    list_key,
    extra_body,
):
    await _seed_row_saved_before_the_check(
        dbsession,
        model,
        lambda: seed(add_models, ref, report.compliance_report_id, quantity=-500),
    )

    response = await client.post(
        fastapi_app.url_path_for(route_name),
        json={"complianceReportId": report.compliance_report_id, **extra_body},
    )

    assert response.status_code == 200
    assert [row["quantity"] for row in response.json()[list_key]] == [-500]


# --- Fuel codes ---------------------------------------------------------------


@pytest.mark.anyio
@pytest.mark.parametrize(
    "code_overrides",
    [
        pytest.param({"status": FuelCodeStatusEnum.Draft}, id="not-approved"),
        pytest.param({"status": FuelCodeStatusEnum.Deleted}, id="deleted"),
        pytest.param(
            {
                "effective_date": date(YEAR - 3, 1, 1),
                "expiration_date": date(YEAR - 1, 6, 30),
            },
            id="expired-before-year",
        ),
        pytest.param(
            {
                "effective_date": date(YEAR + 1, 2, 1),
                "expiration_date": date(YEAR + 3, 12, 31),
            },
            id="effective-after-year",
        ),
    ],
)
async def test_fuel_supply_rejects_fuel_code_it_may_not_claim(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    add_models,
    report,
    ref,
    code_overrides,
):
    fuel_code = await seed_fuel_code(
        dbsession,
        add_models,
        fuel_type_id=ref.fuel_type.fuel_type_id,
        carbon_intensity=1.0,
        **code_overrides,
    )

    response = await _save(
        client,
        fastapi_app,
        "save_fuel_supply_row",
        _fuel_supply_body(
            report,
            ref,
            provisionOfTheActId=ref.fuel_code_provision_id,
            fuelCodeId=fuel_code.fuel_code_id,
        ),
    )

    assert response.status_code == 422
    assert response.json()["errors"][0]["fields"] == ["fuelCode"]
    assert await _rows(dbsession, FuelSupply, report.compliance_report_id) == []


@pytest.mark.anyio
async def test_fuel_supply_rejects_fuel_code_for_another_fuel_type(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, add_models, report, ref
):
    fuel_code = await seed_fuel_code(
        dbsession,
        add_models,
        fuel_type_id=ref.different_fuel_type.fuel_type_id,
        carbon_intensity=1.0,
    )

    response = await _save(
        client,
        fastapi_app,
        "save_fuel_supply_row",
        _fuel_supply_body(
            report,
            ref,
            provisionOfTheActId=ref.fuel_code_provision_id,
            fuelCodeId=fuel_code.fuel_code_id,
        ),
    )

    assert response.status_code == 422
    assert await _rows(dbsession, FuelSupply, report.compliance_report_id) == []


@pytest.mark.anyio
async def test_fuel_supply_accepts_approved_effective_fuel_code(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, add_models, report, ref
):
    fuel_code = await seed_fuel_code(
        dbsession,
        add_models,
        fuel_type_id=ref.fuel_type.fuel_type_id,
        carbon_intensity=12.34,
    )

    response = await _save(
        client,
        fastapi_app,
        "save_fuel_supply_row",
        _fuel_supply_body(
            report,
            ref,
            provisionOfTheActId=ref.fuel_code_provision_id,
            fuelCodeId=fuel_code.fuel_code_id,
        ),
    )

    assert response.status_code == 201
    [row] = await _rows(dbsession, FuelSupply, report.compliance_report_id)
    assert row.fuel_code_id == fuel_code.fuel_code_id
    assert float(row.ci_of_fuel) == pytest.approx(12.34)


@pytest.mark.anyio
async def test_fuel_supply_row_keeping_an_expired_code_still_saves(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, add_models, report, ref
):
    """Rows from before 2024 carry codes that expired before their year; editing
    another field must keep working."""
    expired = await seed_fuel_code(
        dbsession,
        add_models,
        fuel_type_id=ref.fuel_type.fuel_type_id,
        effective_date=date(YEAR - 3, 1, 1),
        expiration_date=date(YEAR - 1, 6, 30),
    )
    row = await seed_fuel_supply(
        add_models, ref, report.compliance_report_id, fuel_code_id=expired.fuel_code_id
    )

    response = await _save(
        client,
        fastapi_app,
        "save_fuel_supply_row",
        _fuel_supply_body(
            report,
            ref,
            fuelSupplyId=row.fuel_supply_id,
            groupUuid=row.group_uuid,
            version=row.version,
            provisionOfTheActId=ref.fuel_code_provision_id,
            fuelCodeId=expired.fuel_code_id,
            quantity=2500,
        ),
    )

    assert response.status_code == 201
    [saved] = await _rows(dbsession, FuelSupply, report.compliance_report_id)
    assert saved.quantity == 2500


@pytest.mark.anyio
async def test_fuel_supply_row_cannot_switch_to_an_expired_code(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, add_models, report, ref
):
    current = await seed_fuel_code(
        dbsession, add_models, fuel_type_id=ref.fuel_type.fuel_type_id
    )
    expired = await seed_fuel_code(
        dbsession,
        add_models,
        fuel_type_id=ref.fuel_type.fuel_type_id,
        effective_date=date(YEAR - 3, 1, 1),
        expiration_date=date(YEAR - 1, 6, 30),
    )
    row = await seed_fuel_supply(
        add_models, ref, report.compliance_report_id, fuel_code_id=current.fuel_code_id
    )

    response = await _save(
        client,
        fastapi_app,
        "save_fuel_supply_row",
        _fuel_supply_body(
            report,
            ref,
            fuelSupplyId=row.fuel_supply_id,
            groupUuid=row.group_uuid,
            version=row.version,
            provisionOfTheActId=ref.fuel_code_provision_id,
            fuelCodeId=expired.fuel_code_id,
        ),
    )

    assert response.status_code == 422
    [saved] = await _rows(dbsession, FuelSupply, report.compliance_report_id)
    assert saved.fuel_code_id == current.fuel_code_id


@pytest.mark.anyio
async def test_fuel_export_rejects_unapproved_fuel_code(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, add_models, report, ref
):
    fuel_code = await seed_fuel_code(
        dbsession,
        add_models,
        fuel_type_id=ref.fuel_type.fuel_type_id,
        status=FuelCodeStatusEnum.Draft,
    )

    response = await _save(
        client,
        fastapi_app,
        "save_fuel_export_row",
        _fuel_export_body(
            report,
            ref,
            provisionOfTheActId=ref.fuel_code_provision_id,
            provisionOfTheAct=FUEL_CODE_PROVISION,
            fuelCodeId=fuel_code.fuel_code_id,
        ),
    )

    assert response.status_code == 422
    assert await _rows(dbsession, FuelExport, report.compliance_report_id) == []


@pytest.mark.anyio
async def test_allocation_agreement_rejects_unapproved_fuel_code_by_name(
    client: AsyncClient, fastapi_app: FastAPI, dbsession, add_models, report, ref
):
    fuel_code = await seed_fuel_code(
        dbsession,
        add_models,
        fuel_type_id=ref.fuel_type.fuel_type_id,
        status=FuelCodeStatusEnum.Draft,
    )

    response = await _save(
        client,
        fastapi_app,
        "save_allocation_agreements_row",
        _allocation_agreement_body(
            report,
            ref,
            provisionOfTheAct=FUEL_CODE_PROVISION,
            fuelCode=f"BCLCF{fuel_code.fuel_suffix}",
        ),
    )

    assert response.status_code == 422
    assert (
        await _rows(dbsession, AllocationAgreement, report.compliance_report_id) == []
    )


# --- Energy density -----------------------------------------------------------


@pytest.mark.anyio
@pytest.mark.parametrize(
    "route_name, body_builder, model",
    [
        ("save_fuel_supply_row", _fuel_supply_body, FuelSupply),
        ("save_fuel_export_row", _fuel_export_body, FuelExport),
    ],
)
async def test_energy_density_sent_for_a_recognized_fuel_is_discarded(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    report,
    ref,
    route_name,
    body_builder,
    model,
):
    response = await _save(
        client,
        fastapi_app,
        route_name,
        body_builder(report, ref, energyDensity=99.0),
    )

    assert response.status_code == 201
    assert response.json()["energyDensity"] == pytest.approx(ref.energy_density)
    [row] = await _rows(dbsession, model, report.compliance_report_id)
    assert float(row.energy_density) == pytest.approx(ref.energy_density)
    assert float(row.energy) == pytest.approx(ref.energy_density * 1000, abs=0.01)


@pytest.mark.anyio
@pytest.mark.parametrize(
    "route_name, body_builder, model",
    [
        ("save_fuel_supply_row", _fuel_supply_body, FuelSupply),
        ("save_fuel_export_row", _fuel_export_body, FuelExport),
    ],
)
async def test_other_fuel_energy_density_is_bounded(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    report,
    ref,
    route_name,
    body_builder,
    model,
):
    response = await _save(
        client,
        fastapi_app,
        route_name,
        body_builder(
            report,
            ref,
            fuelTypeId=ref.other_fuel_type.fuel_type_id,
            fuelTypeOther="Test fuel",
            energyDensity=500.0,
        ),
    )

    assert response.status_code == 422
    assert response.json()["errors"][0]["fields"] == ["energyDensity"]
    assert await _rows(dbsession, model, report.compliance_report_id) == []
