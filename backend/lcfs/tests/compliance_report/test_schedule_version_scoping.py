"""
Schedule saves look rows up only within the caller's report chain.

A group_uuid, version or row ID from another report chain reads as missing
(404): the update and delete branches that write a new version into the
caller's report copy nothing from elsewhere. Within the chain, supplemental
versions work as before. A row keeps its stored group_uuid and version
whatever the body says, and (group_uuid, version) is unique per schedule.

These run against the database through the API.
"""

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.compliance.AllocationAgreement import AllocationAgreement
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatusEnum,
)
from lcfs.db.models.compliance.FuelExport import FuelExport
from lcfs.db.models.compliance.FuelSupply import FuelSupply
from lcfs.db.models.compliance.NotionalTransfer import NotionalTransfer
from lcfs.db.models.compliance.OtherUses import OtherUses
from lcfs.db.models.user.Role import RoleEnum
from lcfs.tests.compliance_report.report_write_seed import (
    YEAR,
    fuel_reference,
    organization_ids,
    seed_allocation_agreement,
    seed_fuel_export,
    seed_fuel_supply,
    seed_notional_transfer,
    seed_other_use,
    seed_report,
)

Status = ComplianceReportStatusEnum
DEFAULT_CI_PROVISION = "Default carbon intensity - section 19 (b) (ii)"


@pytest.fixture
async def org_ids(dbsession):
    return await organization_ids(dbsession)


@pytest.fixture
async def ref(dbsession):
    return await fuel_reference(dbsession)


@pytest.fixture
async def own_report(dbsession, add_models, org_ids):
    return await seed_report(dbsession, add_models, org_ids[0])


@pytest.fixture
async def other_report(dbsession, add_models, org_ids):
    return await seed_report(dbsession, add_models, org_ids[1])


@pytest.fixture
def as_supplier(fastapi_app: FastAPI, set_mock_user, org_ids):
    set_mock_user(
        fastapi_app,
        [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY],
        {"organization_id": org_ids[0]},
    )


def _fuel_supply_body(report_id, ref, row=None, **overrides):
    body = {
        "complianceReportId": report_id,
        "fuelTypeId": ref.fuel_type.fuel_type_id,
        "fuelCategoryId": ref.fuel_category.fuel_category_id,
        "endUseId": ref.end_use.end_use_type_id,
        "provisionOfTheActId": ref.default_ci_provision_id,
        "quantity": 2000,
        "units": "L",
    }
    if row is not None:
        body.update(
            fuelSupplyId=row.fuel_supply_id,
            groupUuid=row.group_uuid,
            version=row.version,
        )
    body.update(overrides)
    return body


def _fuel_export_body(report_id, ref, row=None, **overrides):
    body = {
        "complianceReportId": report_id,
        "fuelTypeId": ref.fuel_type.fuel_type_id,
        "fuelCategoryId": ref.fuel_category.fuel_category_id,
        "endUseId": ref.end_use.end_use_type_id,
        "provisionOfTheActId": ref.default_ci_provision_id,
        "exportDate": f"{YEAR}-06-01",
        "quantity": 2000,
        "units": "L",
    }
    if row is not None:
        body.update(
            fuelExportId=row.fuel_export_id,
            groupUuid=row.group_uuid,
            version=row.version,
        )
    body.update(overrides)
    return body


def _other_use_body(report_id, ref, row=None, **overrides):
    body = {
        "complianceReportId": report_id,
        "fuelType": ref.fuel_type.fuel_type,
        "fuelCategory": ref.fuel_category.category,
        "provisionOfTheAct": DEFAULT_CI_PROVISION,
        "quantitySupplied": 2000,
        "units": "L",
        "expectedUse": "Heating oil",
    }
    if row is not None:
        body.update(
            otherUsesId=row.other_uses_id, groupUuid=row.group_uuid, version=row.version
        )
    body.update(overrides)
    return body


def _notional_transfer_body(report_id, ref, row=None, **overrides):
    body = {
        "complianceReportId": report_id,
        "legalName": "Trading partner",
        "addressForService": "1 Partner Street, Victoria, BC",
        "fuelCategory": ref.fuel_category.category,
        "receivedOrTransferred": "Received",
        "quantity": 2000,
    }
    if row is not None:
        body.update(
            notionalTransferId=row.notional_transfer_id,
            groupUuid=row.group_uuid,
            version=row.version,
        )
    body.update(overrides)
    return body


def _allocation_agreement_body(report_id, ref, row=None, **overrides):
    body = {
        "complianceReportId": report_id,
        "allocationTransactionType": "Allocated from",
        "transactionPartner": "Trading partner",
        "postalAddress": "1 Partner Street, Victoria, BC",
        "fuelType": ref.fuel_type.fuel_type,
        "fuelCategory": ref.fuel_category.category,
        "provisionOfTheAct": DEFAULT_CI_PROVISION,
        "quantity": 2000,
    }
    if row is not None:
        body.update(
            allocationAgreementId=row.allocation_agreement_id,
            groupUuid=row.group_uuid,
            version=row.version,
        )
    body.update(overrides)
    return body


SCHEDULES = [
    pytest.param(
        "save_fuel_supply_row",
        FuelSupply,
        seed_fuel_supply,
        _fuel_supply_body,
        id="fuel_supply",
    ),
    pytest.param(
        "save_fuel_export_row",
        FuelExport,
        seed_fuel_export,
        _fuel_export_body,
        id="fuel_export",
    ),
    pytest.param(
        "save_other_uses_row",
        OtherUses,
        seed_other_use,
        _other_use_body,
        id="other_uses",
    ),
    pytest.param(
        "save_notional_transfer_row",
        NotionalTransfer,
        seed_notional_transfer,
        _notional_transfer_body,
        id="notional_transfer",
    ),
    pytest.param(
        "save_allocation_agreements_row",
        AllocationAgreement,
        seed_allocation_agreement,
        _allocation_agreement_body,
        id="allocation_agreement",
    ),
]


async def _rows(dbsession, model, **where):
    return (
        (
            await dbsession.execute(
                select(model)
                .where(*(getattr(model, key) == value for key, value in where.items()))
                .order_by(model.version)
                .execution_options(populate_existing=True)
            )
        )
        .scalars()
        .all()
    )


async def _save(client, fastapi_app, route_name, body):
    return await client.post(fastapi_app.url_path_for(route_name), json=body)


# --- Rows from another report chain -----------------------------------------


@pytest.mark.anyio
@pytest.mark.parametrize("route_name, model, seed, body_builder", SCHEDULES)
async def test_update_naming_another_chains_row_returns_404_and_copies_nothing(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    add_models,
    as_supplier,
    ref,
    own_report,
    other_report,
    route_name,
    model,
    seed,
    body_builder,
):
    foreign = await seed(add_models, ref, other_report.compliance_report_id)

    response = await _save(
        client,
        fastapi_app,
        route_name,
        body_builder(own_report.compliance_report_id, ref, row=foreign),
    )

    assert response.status_code == 404
    assert (
        await _rows(
            dbsession, model, compliance_report_id=own_report.compliance_report_id
        )
        == []
    )
    [unchanged] = await _rows(dbsession, model, group_uuid=foreign.group_uuid)
    assert unchanged.compliance_report_id == other_report.compliance_report_id


@pytest.mark.anyio
@pytest.mark.parametrize("route_name, model, seed, body_builder", SCHEDULES)
async def test_delete_naming_another_chains_row_returns_404_and_copies_nothing(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    add_models,
    as_supplier,
    ref,
    own_report,
    other_report,
    route_name,
    model,
    seed,
    body_builder,
):
    foreign = await seed(add_models, ref, other_report.compliance_report_id)

    response = await _save(
        client,
        fastapi_app,
        route_name,
        body_builder(own_report.compliance_report_id, ref, row=foreign, deleted=True),
    )

    assert response.status_code == 404
    assert (
        await _rows(
            dbsession, model, compliance_report_id=own_report.compliance_report_id
        )
        == []
    )
    assert len(await _rows(dbsession, model, group_uuid=foreign.group_uuid)) == 1


# --- Rows within the chain ----------------------------------------------------


@pytest.fixture
async def own_chain(dbsession, add_models, org_ids):
    """An assessed original and its draft supplemental."""
    original = await seed_report(dbsession, add_models, org_ids[0], Status.Assessed)
    supplemental = await seed_report(
        dbsession,
        add_models,
        org_ids[0],
        Status.Draft,
        group_uuid=original.compliance_report_group_uuid,
        version=1,
    )
    return original, supplemental


@pytest.mark.anyio
@pytest.mark.parametrize("route_name, model, seed, body_builder", SCHEDULES)
async def test_supplemental_update_writes_next_version_in_the_chain(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    add_models,
    as_supplier,
    ref,
    own_chain,
    route_name,
    model,
    seed,
    body_builder,
):
    original, supplemental = own_chain
    row = await seed(add_models, ref, original.compliance_report_id)

    response = await _save(
        client,
        fastapi_app,
        route_name,
        body_builder(supplemental.compliance_report_id, ref, row=row),
    )

    assert response.status_code in (200, 201), response.text
    versions = await _rows(dbsession, model, group_uuid=row.group_uuid)
    assert [(v.compliance_report_id, v.version) for v in versions] == [
        (original.compliance_report_id, 0),
        (supplemental.compliance_report_id, 1),
    ]


@pytest.mark.anyio
@pytest.mark.parametrize("route_name, model, seed, body_builder", SCHEDULES)
async def test_supplemental_delete_writes_delete_version_in_the_chain(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    add_models,
    as_supplier,
    ref,
    own_chain,
    route_name,
    model,
    seed,
    body_builder,
):
    original, supplemental = own_chain
    row = await seed(add_models, ref, original.compliance_report_id)

    response = await _save(
        client,
        fastapi_app,
        route_name,
        body_builder(supplemental.compliance_report_id, ref, row=row, deleted=True),
    )

    assert response.status_code in (200, 201), response.text
    versions = await _rows(dbsession, model, group_uuid=row.group_uuid)
    assert [(v.compliance_report_id, v.version, v.action_type) for v in versions] == [
        (original.compliance_report_id, 0, ActionTypeEnum.CREATE),
        (supplemental.compliance_report_id, 1, ActionTypeEnum.DELETE),
    ]


@pytest.mark.anyio
async def test_other_use_update_keeps_stored_group_and_version(
    client: AsyncClient,
    fastapi_app: FastAPI,
    dbsession,
    add_models,
    as_supplier,
    ref,
    own_report,
):
    row = await seed_other_use(add_models, ref, own_report.compliance_report_id)
    stored_group = row.group_uuid

    response = await _save(
        client,
        fastapi_app,
        "save_other_uses_row",
        _other_use_body(
            own_report.compliance_report_id,
            ref,
            row=row,
            groupUuid="00000000-0000-0000-0000-000000000000",
            version=7,
            actionType="DELETE",
            quantitySupplied=3000,
        ),
    )

    assert response.status_code == 200, response.text
    [saved] = await _rows(
        dbsession, OtherUses, compliance_report_id=own_report.compliance_report_id
    )
    assert saved.group_uuid == stored_group
    assert saved.version == 0
    assert saved.action_type == ActionTypeEnum.CREATE
    assert saved.quantity_supplied == 3000


# --- One row per group and version ----------------------------------------------


@pytest.mark.anyio
@pytest.mark.parametrize(
    "seed",
    [
        seed_fuel_supply,
        seed_fuel_export,
        seed_other_use,
        seed_notional_transfer,
        seed_allocation_agreement,
    ],
)
async def test_group_and_version_are_unique(
    dbsession, add_models, ref, own_report, seed
):
    first = await seed(add_models, ref, own_report.compliance_report_id)

    with pytest.raises(IntegrityError):
        async with dbsession.begin_nested():
            await seed(
                add_models,
                ref,
                own_report.compliance_report_id,
                group_uuid=first.group_uuid,
                version=first.version,
            )
