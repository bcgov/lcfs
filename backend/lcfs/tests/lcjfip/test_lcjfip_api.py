"""API tests for the LCJFIP application form (#5532), against the migrated test DB."""

import datetime

import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient
from sqlalchemy import func, select

from lcfs.db.models.comment.InternalComment import InternalComment
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.FuelCodePrefix import FuelCodePrefix
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatus
from lcfs.db.models.fuel.FuelType import FuelType
from lcfs.db.models.lcjfip import (
    LCJFIPApplication,
    LCJFIPApplicationHistory,
    LCJFIPApplicationPeriod,
    LCJFIPCarType,
    LCJFIPCertificateType,
    LCJFIPFeedstockSource,
    LCJFIPIncentiveOption,
    LCJFIPPurchaseDetail,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.user.UserProfile import UserProfile

APPLICANT = [RoleEnum.LCJFIP_APPLICANT]
IDIR_IA_ANALYST = [RoleEnum.IA_ANALYST, RoleEnum.GOVERNMENT]
GOVERNMENT_USER = {"organization_id": None}

CASH = "Cash incentive"
CREDIT = "LCFS credit option"
CREDIT_TRANSFER = "LCFS credit option - Fuel supplier incentive transfer"
DECLARATIONS = {
    "declarationAuthority": True,
    "declarationDocumentation": True,
    "declarationPublicRecognition": True,
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _id(dbsession, model, name):
    result = await dbsession.execute(select(model).where(model.name == name))
    row = result.scalars().one()
    return getattr(row, model.__mapper__.primary_key[0].key)


def _url(fastapi_app, name, **params):
    return fastapi_app.url_path_for(name, **params)


async def _purchase(dbsession, **overrides):
    row = {
        "estimatedVolume": 600_000,
        "anticipatedDeliveryDate": "2027-03-31",
        "feedstockSourceIds": [
            await _id(dbsession, LCJFIPFeedstockSource, "Used cooking oil (UCO)")
        ],
        "estimatedBlendPercentage": 30,
        "assumedJetAPrice": 0.9,
        "pricePremiumFrom": 1.5,
        "pricePremiumTo": 1.7,
    }
    row.update(overrides)
    return row


async def _complete_form(dbsession, **overrides):
    form = {
        "carTypeIds": [
            await _id(dbsession, LCJFIPCarType, "CAR 705 - Airline operations")
        ],
        "certificateTypeId": await _id(dbsession, LCJFIPCertificateType, "Domestic"),
        "incentiveOptionId": await _id(dbsession, LCJFIPIncentiveOption, CASH),
        "estimatedCarbonIntensity": 8.5,
        "requestedIncentiveVolume": 1_000_000,
        "purchaseDetails": [
            await _purchase(dbsession),
            await _purchase(dbsession, estimatedVolume=400_000),
        ],
    }
    form.update(overrides)
    return form


async def _create(client, fastapi_app, form):
    response = await client.post(
        _url(fastapi_app, "create_lcjfip_application"), json=form
    )
    assert response.status_code == status.HTTP_201_CREATED, response.text
    return response.json()


async def _submit(client, fastapi_app, application_id, declarations=DECLARATIONS):
    return await client.post(
        _url(fastapi_app, "submit_lcjfip_application", application_id=application_id),
        json=declarations,
    )


def _error_fields(response):
    return [field for error in response.json()["errors"] for field in error["fields"]]


def _switch_user(fastapi_app, roles, details=None):
    """
    Change the signed-in user mid-test. set_mock_user can only add the auth
    middleware before the app first handles a request, so this updates that
    middleware's backend in place.
    """
    from starlette.middleware.authentication import AuthenticationMiddleware

    middleware = next(
        m for m in fastapi_app.user_middleware if m.cls is AuthenticationMiddleware
    )
    backend = middleware.kwargs["backend"]
    backend.user_roles_enum = roles
    backend.organization_id = (details or {}).get("organization_id", 1)


async def _open_period(dbsession, description="Test intake"):
    today = datetime.date.today()
    period = LCJFIPApplicationPeriod(
        description=description,
        open_date=today - datetime.timedelta(days=30),
        close_date=today + datetime.timedelta(days=30),
    )
    dbsession.add(period)
    await dbsession.flush()
    return period


# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_reference_data_lists_options_and_current_rates(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, APPLICANT)
    response = await client.get(_url(fastapi_app, "get_lcjfip_reference_data"))
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data["carTypes"]) == 4
    assert len(data["certificateTypes"]) == 5
    assert len(data["feedstockSources"]) == 12
    assert [o["name"] for o in data["incentiveOptions"]] == [
        CASH,
        CREDIT,
        CREDIT_TRANSFER,
    ]
    assert [o["requiresFuelSupplier"] for o in data["incentiveOptions"]] == [
        False,
        False,
        True,
    ]
    assert sorted(r["maxRatePerLitre"] for r in data["incentiveRates"]) == [
        0.005,
        0.0075,
        0.75,
        1.125,
    ]
    assert data["maxPricePremiumRange"] == 0.25


@pytest.mark.anyio
async def test_supplier_without_lcjfip_role_cannot_use_the_api(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING])
    response = await client.get(_url(fastapi_app, "get_lcjfip_reference_data"))
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_fuel_codes_lists_only_approved_alternative_jet_fuel(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    statuses = {
        s.status.value: s.fuel_code_status_id
        for s in (await dbsession.execute(select(FuelCodeStatus))).scalars()
    }
    types = {
        t.fuel_type: t.fuel_type_id
        for t in (await dbsession.execute(select(FuelType))).scalars()
    }
    prefix = (await dbsession.execute(select(FuelCodePrefix))).scalars().first()

    def code(suffix, fuel_type, status_name):
        return FuelCode(
            fuel_status_id=statuses[status_name],
            prefix_id=prefix.fuel_code_prefix_id,
            fuel_suffix=suffix,
            company="Test producer",
            carbon_intensity=8.5,
            edrms="TEST",
            application_date=datetime.date(2026, 1, 1),
            fuel_type_id=types[fuel_type],
            feedstock="Test feedstock",
            feedstock_location="Test location",
        )

    dbsession.add_all(
        [
            code("901.0", "Alternative jet fuel", "Approved"),
            code("902.0", "Alternative jet fuel", "Draft"),
            code("903.0", "Biodiesel", "Approved"),
        ]
    )
    await dbsession.flush()

    set_mock_user(fastapi_app, APPLICANT)
    response = await client.get(_url(fastapi_app, "get_lcjfip_fuel_codes"))
    assert response.status_code == status.HTTP_200_OK
    labels = {option["fuelCode"] for option in response.json()}
    assert f"{prefix.prefix}901.0" in labels
    assert f"{prefix.prefix}902.0" not in labels
    assert f"{prefix.prefix}903.0" not in labels


# ---------------------------------------------------------------------------
# Draft create and save
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_create_draft_saves_the_form_and_calculates_the_incentive(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    set_mock_user(fastapi_app, APPLICANT)
    created = await _create(client, fastapi_app, await _complete_form(dbsession))

    assert created["status"] == "Draft"
    assert created["applicationNumber"] == f"LCJFIP-{created['lcjfipApplicationId']}"
    assert created["organization"]["organizationId"] == 1
    assert created["contact"]["userProfileId"] == 1
    assert created["incentiveType"] == "Cash"
    # 600,000 + 400,000 litres, and CI 8.5 earns the "10 or less" cash rate.
    assert created["totalEstimatedVolume"] == 1_000_000
    assert created["maxIncentiveRatePerLitre"] == 1.125
    assert created["estimatedIncentiveAmount"] == 1_125_000.0
    assert len(created["purchaseDetails"]) == 2
    assert created["applicationPeriod"] is None


@pytest.mark.anyio
async def test_draft_saves_with_every_field_empty(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, APPLICANT)
    created = await _create(client, fastapi_app, {})
    assert created["status"] == "Draft"
    assert created["estimatedIncentiveAmount"] is None
    assert created["totalEstimatedVolume"] is None


@pytest.mark.anyio
async def test_without_a_carbon_intensity_the_baseline_rate_applies(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    set_mock_user(fastapi_app, APPLICANT)
    created = await _create(
        client,
        fastapi_app,
        await _complete_form(
            dbsession,
            incentiveOptionId=await _id(dbsession, LCJFIPIncentiveOption, CREDIT),
            estimatedCarbonIntensity=None,
        ),
    )
    assert created["incentiveType"] == "Credit"
    assert created["maxIncentiveRatePerLitre"] == 0.005
    assert created["estimatedIncentiveAmount"] == 5_000.0


@pytest.mark.anyio
async def test_client_cannot_set_the_calculated_amount(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    set_mock_user(fastapi_app, APPLICANT)
    form = await _complete_form(dbsession)
    form["estimatedIncentiveAmount"] = 1
    created = await _create(client, fastapi_app, form)
    assert created["estimatedIncentiveAmount"] == 1_125_000.0


@pytest.mark.anyio
async def test_save_updates_adds_and_removes_purchase_rows(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    set_mock_user(fastapi_app, APPLICANT)
    created = await _create(client, fastapi_app, await _complete_form(dbsession))
    first, second = created["purchaseDetails"]

    kept = {**first, "estimatedVolume": 700_000}
    added = await _purchase(dbsession, estimatedVolume=50_000)
    response = await client.put(
        _url(
            fastapi_app,
            "save_lcjfip_application",
            application_id=created["lcjfipApplicationId"],
        ),
        json={**await _complete_form(dbsession), "purchaseDetails": [kept, added]},
    )
    assert response.status_code == status.HTTP_200_OK, response.text
    rows = response.json()["purchaseDetails"]
    assert [r["estimatedVolume"] for r in rows] == [700_000, 50_000]
    # The kept row keeps its id; the dropped row is gone.
    assert rows[0]["lcjfipPurchaseDetailId"] == first["lcjfipPurchaseDetailId"]
    remaining = (
        await dbsession.execute(
            select(func.count()).where(
                LCJFIPPurchaseDetail.lcjfip_purchase_detail_id
                == second["lcjfipPurchaseDetailId"]
            )
        )
    ).scalar_one()
    assert remaining == 0
    assert response.json()["totalEstimatedVolume"] == 750_000


@pytest.mark.anyio
async def test_switching_away_from_the_transfer_option_clears_the_fuel_supplier(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    set_mock_user(fastapi_app, APPLICANT)
    supplier_fields = {
        "fuelSupplierLegalName": "Unregistered supplier",
        "fuelSupplierContactFirstName": "Test",
        "fuelSupplierContactLastName": "Contact",
        "fuelSupplierContactEmail": "contact@example.com",
    }
    created = await _create(
        client,
        fastapi_app,
        await _complete_form(
            dbsession,
            incentiveOptionId=await _id(
                dbsession, LCJFIPIncentiveOption, CREDIT_TRANSFER
            ),
            **supplier_fields,
        ),
    )
    assert created["fuelSupplierLegalName"] == "Unregistered supplier"

    response = await client.put(
        _url(
            fastapi_app,
            "save_lcjfip_application",
            application_id=created["lcjfipApplicationId"],
        ),
        json=await _complete_form(dbsession, **supplier_fields),
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["fuelSupplierLegalName"] is None
    assert data["fuelSupplierContactEmail"] is None


@pytest.mark.anyio
async def test_a_linked_fuel_supplier_carries_the_legal_name(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    set_mock_user(fastapi_app, APPLICANT)
    created = await _create(
        client,
        fastapi_app,
        await _complete_form(
            dbsession,
            incentiveOptionId=await _id(
                dbsession, LCJFIPIncentiveOption, CREDIT_TRANSFER
            ),
            fuelSupplierOrganizationId=2,
            fuelSupplierLegalName="Typed name",
        ),
    )
    assert created["fuelSupplierOrganization"]["organizationId"] == 2
    assert created["fuelSupplierLegalName"] is None


@pytest.mark.anyio
async def test_the_applicant_cannot_name_itself_as_fuel_supplier(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    set_mock_user(fastapi_app, APPLICANT)
    response = await client.post(
        _url(fastapi_app, "create_lcjfip_application"),
        json=await _complete_form(
            dbsession,
            incentiveOptionId=await _id(
                dbsession, LCJFIPIncentiveOption, CREDIT_TRANSFER
            ),
            fuelSupplierOrganizationId=1,
        ),
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert _error_fields(response) == ["fuelSupplierLegalName"]


@pytest.mark.anyio
async def test_save_rejects_unknown_options(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    set_mock_user(fastapi_app, APPLICANT)
    response = await client.post(
        _url(fastapi_app, "create_lcjfip_application"),
        json=await _complete_form(
            dbsession, carTypeIds=[999_999], certificateTypeId=999_999
        ),
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert sorted(_error_fields(response)) == ["carTypeIds", "certificateTypeId"]


@pytest.mark.anyio
async def test_save_rejects_a_premium_range_that_runs_backwards(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    set_mock_user(fastapi_app, APPLICANT)
    form = await _complete_form(
        dbsession,
        purchaseDetails=[
            await _purchase(dbsession, pricePremiumFrom=1.8, pricePremiumTo=1.6)
        ],
    )
    response = await client.post(
        _url(fastapi_app, "create_lcjfip_application"), json=form
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


# ---------------------------------------------------------------------------
# Access
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_another_organization_cannot_read_the_application(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    set_mock_user(fastapi_app, APPLICANT)
    created = await _create(client, fastapi_app, {})

    _switch_user(fastapi_app, APPLICANT, {"organization_id": 2})
    response = await client.get(
        _url(
            fastapi_app,
            "get_lcjfip_application",
            application_id=created["lcjfipApplicationId"],
        )
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.anyio
async def test_government_cannot_see_a_draft(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    set_mock_user(fastapi_app, APPLICANT)
    created = await _create(client, fastapi_app, {})

    _switch_user(fastapi_app, IDIR_IA_ANALYST, GOVERNMENT_USER)
    response = await client.get(
        _url(
            fastapi_app,
            "get_lcjfip_application",
            application_id=created["lcjfipApplicationId"],
        )
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# Submit
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_submit_reports_every_missing_field(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    set_mock_user(fastapi_app, APPLICANT)
    created = await _create(
        client,
        fastapi_app,
        {"purchaseDetails": [{"feedstockSourceIds": []}]},
    )
    response = await _submit(
        client,
        fastapi_app,
        created["lcjfipApplicationId"],
        {"declarationAuthority": True},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert set(_error_fields(response)) == {
        "incentiveOptionId",
        "requestedIncentiveVolume",
        "purchaseDetails.0.estimatedVolume",
        "purchaseDetails.0.anticipatedDeliveryDate",
        "purchaseDetails.0.assumedJetAPrice",
        "purchaseDetails.0.pricePremiumFrom",
        "purchaseDetails.0.pricePremiumTo",
        "declarations",
    }


@pytest.mark.anyio
async def test_submit_checks_premium_width_and_requested_volume(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    set_mock_user(fastapi_app, APPLICANT)
    created = await _create(
        client,
        fastapi_app,
        await _complete_form(
            dbsession,
            requestedIncentiveVolume=2_000_000,
            purchaseDetails=[
                await _purchase(dbsession, pricePremiumFrom=1.5, pricePremiumTo=1.76),
                await _purchase(dbsession, pricePremiumFrom=1.5, pricePremiumTo=1.75),
            ],
        ),
    )
    response = await _submit(client, fastapi_app, created["lcjfipApplicationId"])
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    # A $0.26 range is too wide; $0.25 is allowed. 2,000,000 L requested
    # exceeds the 1,200,000 L of purchases.
    assert sorted(_error_fields(response)) == [
        "purchaseDetails.0.pricePremiumTo",
        "requestedIncentiveVolume",
    ]


@pytest.mark.anyio
async def test_submit_requires_fuel_supplier_details_for_a_transfer(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    set_mock_user(fastapi_app, APPLICANT)
    created = await _create(
        client,
        fastapi_app,
        await _complete_form(
            dbsession,
            incentiveOptionId=await _id(
                dbsession, LCJFIPIncentiveOption, CREDIT_TRANSFER
            ),
            fuelSupplierContactEmail="not-an-email",
        ),
    )
    response = await _submit(client, fastapi_app, created["lcjfipApplicationId"])
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert sorted(_error_fields(response)) == [
        "fuelSupplierContactEmail",
        "fuelSupplierContactFirstName",
        "fuelSupplierContactLastName",
        "fuelSupplierLegalName",
    ]


@pytest.mark.anyio
async def test_submit_moves_the_application_into_review(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    period = await _open_period(dbsession)
    set_mock_user(fastapi_app, APPLICANT)
    created = await _create(client, fastapi_app, await _complete_form(dbsession))
    application_id = created["lcjfipApplicationId"]

    response = await _submit(client, fastapi_app, application_id)
    assert response.status_code == status.HTTP_200_OK, response.text
    submitted = response.json()
    assert submitted["status"] == "Submitted"
    assert submitted["applicationPeriod"] == period.description
    signer = await dbsession.get(UserProfile, 1)
    assert submitted["signedBy"] == f"{signer.first_name} {signer.last_name}"
    assert submitted["signedDate"] is not None
    assert submitted["estimatedIncentiveAmount"] == 1_125_000.0

    history = (
        (
            await dbsession.execute(
                select(LCJFIPApplicationHistory)
                .where(LCJFIPApplicationHistory.lcjfip_application_id == application_id)
                .order_by(LCJFIPApplicationHistory.lcjfip_application_history_id)
            )
        )
        .scalars()
        .all()
    )
    assert [h.status.status for h in history] == ["Draft", "Submitted"]
    assert history[-1].application_snapshot["estimatedIncentiveAmount"] == 1_125_000.0

    # The applicant can no longer change or delete it.
    save = await client.put(
        _url(fastapi_app, "save_lcjfip_application", application_id=application_id),
        json={},
    )
    assert save.status_code == status.HTTP_403_FORBIDDEN
    delete = await client.delete(
        _url(fastapi_app, "delete_lcjfip_application", application_id=application_id)
    )
    assert delete.status_code == status.HTTP_403_FORBIDDEN

    # Government can now read it, but not edit it.
    _switch_user(fastapi_app, IDIR_IA_ANALYST, GOVERNMENT_USER)
    read = await client.get(
        _url(fastapi_app, "get_lcjfip_application", application_id=application_id)
    )
    assert read.status_code == status.HTTP_200_OK
    assert read.json()["status"] == "Submitted"


@pytest.mark.anyio
async def test_submit_without_an_open_period_leaves_the_period_empty(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    set_mock_user(fastapi_app, APPLICANT)
    created = await _create(client, fastapi_app, await _complete_form(dbsession))
    response = await _submit(client, fastapi_app, created["lcjfipApplicationId"])
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["applicationPeriod"] is None


# ---------------------------------------------------------------------------
# Delete and comments
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_deleting_a_draft_removes_it_with_its_comments(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    set_mock_user(fastapi_app, APPLICANT)
    created = await _create(client, fastapi_app, await _complete_form(dbsession))
    application_id = created["lcjfipApplicationId"]
    comment = await client.post(
        "/api/internal_comments/",
        json={
            "entityType": "lcjfipApplication",
            "entityId": application_id,
            "comment": "Gathering requirements",
            "visibility": "Public",
        },
    )
    assert comment.status_code == status.HTTP_201_CREATED, comment.text
    comment_id = comment.json()["internalCommentId"]

    response = await client.delete(
        _url(fastapi_app, "delete_lcjfip_application", application_id=application_id)
    )
    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert await dbsession.get(LCJFIPApplication, application_id) is None
    remaining_comments = (
        await dbsession.execute(
            select(func.count()).where(
                InternalComment.internal_comment_id == comment_id
            )
        )
    ).scalar_one()
    assert remaining_comments == 0


@pytest.mark.anyio
async def test_comment_thread_follows_the_application_visibility(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user, dbsession
):
    # The thread lists comments by their author's profile, so sign in as a
    # seeded organization 1 user rather than the default mock profile.
    author = (
        (
            await dbsession.execute(
                select(UserProfile)
                .where(UserProfile.organization_id == 1)
                .order_by(UserProfile.user_profile_id)
            )
        )
        .scalars()
        .first()
    )
    set_mock_user(
        fastapi_app,
        APPLICANT,
        {
            "user_profile_id": author.user_profile_id,
            "keycloak_username": author.keycloak_username,
        },
    )
    created = await _create(client, fastapi_app, await _complete_form(dbsession))
    application_id = created["lcjfipApplicationId"]
    thread_url = f"/api/internal_comments/lcjfipApplication/{application_id}"
    posted = await client.post(
        "/api/internal_comments/",
        json={
            "entityType": "lcjfipApplication",
            "entityId": application_id,
            "comment": "A question for program staff",
            "visibility": "Public",
        },
    )
    assert posted.status_code == status.HTTP_201_CREATED, posted.text
    attachments_url = (
        f"/api/documents/internal_comment/{posted.json()['internalCommentId']}"
    )
    own_thread = await client.get(thread_url)
    assert [c["comment"] for c in own_thread.json()] == ["A question for program staff"]
    assert (await client.get(attachments_url)).status_code == status.HTTP_200_OK

    # Another organization cannot read it.
    _switch_user(fastapi_app, APPLICANT, {"organization_id": 2})
    assert (await client.get(thread_url)).status_code == status.HTTP_403_FORBIDDEN

    # Government reads the thread, and the files on its comments, only once
    # the application is submitted.
    _switch_user(fastapi_app, IDIR_IA_ANALYST, GOVERNMENT_USER)
    assert (await client.get(thread_url)).status_code == status.HTTP_404_NOT_FOUND
    assert (await client.get(attachments_url)).status_code == status.HTTP_404_NOT_FOUND

    _switch_user(fastapi_app, APPLICANT)
    assert (
        await _submit(client, fastapi_app, application_id)
    ).status_code == status.HTTP_200_OK

    _switch_user(fastapi_app, IDIR_IA_ANALYST, GOVERNMENT_USER)
    government_thread = await client.get(thread_url)
    assert government_thread.status_code == status.HTTP_200_OK
    assert len(government_thread.json()) == 1
    assert (await client.get(attachments_url)).status_code == status.HTTP_200_OK
