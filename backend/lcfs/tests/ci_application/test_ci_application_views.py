"""HTTP-level tests for the CI application FastAPI router."""

from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from starlette import status

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.ci_application.schema import (
    CIApplicationBaseSchema,
    CIApplicationSchema,
    CIApplicationsListSchema,
    CIApplicationStatusEnum,
    CIApplicationStatusSchema,
    CITableOptionsSchema,
    OrganizationInfoSchema,
    UnitOfMeasureSchema,
)
from lcfs.web.api.base import PaginationResponseSchema


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _table_options() -> CITableOptionsSchema:
    return CITableOptionsSchema(
        statuses=[
            CIApplicationStatusSchema(
                ci_application_status_id=1,
                status=CIApplicationStatusEnum.Draft,
                description="Draft",
            ),
            CIApplicationStatusSchema(
                ci_application_status_id=2,
                status=CIApplicationStatusEnum.Submitted,
                description="Submitted",
            ),
        ],
        units_of_measure=[
            UnitOfMeasureSchema(uom_id=1, name="Litres", description="Litres"),
            UnitOfMeasureSchema(uom_id=2, name="Kilograms", description="Kilograms"),
        ],
    )


def _ci_full_schema(ci_application_id: int = 10) -> CIApplicationSchema:
    return CIApplicationSchema(
        ci_application_id=ci_application_id,
        organization_id=1,
        organization=OrganizationInfoSchema(
            organization_id=1,
            name="Fuel Producer Ltd.",
            operating_name="Fuel Producer",
            email="hello@example.com",
            phone="+1 555 0100",
        ),
        status=CIApplicationStatusSchema(
            ci_application_status_id=1,
            status=CIApplicationStatusEnum.Draft,
        ),
        facility_city="San Martin",
        facility_province_state="Santa Fe",
        facility_country="Argentina",
        facility_iso="AR",
        facility_nameplate_capacity=1000,
        facility_nameplate_capacity_unit_id=1,
        facility_nameplate_capacity_unit=UnitOfMeasureSchema(
            uom_id=1, name="Litres", description="Litres"
        ),
        proposed_fuel_code_effective_date=date(2026, 6, 1),
    )


def _ci_list_schema() -> CIApplicationsListSchema:
    return CIApplicationsListSchema(
        ci_applications=[
            CIApplicationBaseSchema(
                ci_application_id=10,
                organization_id=1,
                status=CIApplicationStatusSchema(
                    ci_application_status_id=1,
                    status=CIApplicationStatusEnum.Draft,
                ),
                facility_country="Argentina",
                facility_nameplate_capacity=1000,
                facility_nameplate_capacity_unit_id=1,
                proposed_fuel_code_effective_date=date(2026, 6, 1),
                update_date=datetime(2026, 5, 1, tzinfo=timezone.utc).isoformat(),
                create_date=datetime(2026, 4, 1, tzinfo=timezone.utc).isoformat(),
            )
        ],
        pagination=PaginationResponseSchema(
            total=1,
            page=1,
            size=10,
            total_pages=1,
        ),
    )


@pytest.fixture
def set_user_role(fastapi_app, set_mock_user):
    def _set(role):
        set_mock_user(fastapi_app, [role])

    return _set


def _step1_payload():
    return {
        "facilityCity": "San Martin",
        "facilityProvinceState": "Santa Fe",
        "facilityCountry": "Argentina",
        "facilityIso": "AR",
        "facilityNameplateCapacity": 1000,
        "facilityNameplateCapacityUnitId": 1,
        "proposedFuelCodeEffectiveDate": "2026-06-01",
    }


# ---------------------------------------------------------------------------
# /table-options
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_table_options_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.CI_APPLICANT)
    with patch(
        "lcfs.web.api.ci_application.services.CIApplicationServices.get_table_options"
    ) as mock:
        mock.return_value = _table_options()
        response = await client.get("/api/ci-applications/table-options")
        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert "statuses" in body
        assert "unitsOfMeasure" in body
        assert {s["status"] for s in body["statuses"]} == {"Draft", "Submitted"}


# ---------------------------------------------------------------------------
# POST /list
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_list_returns_org_scoped_for_supplier(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.CI_APPLICANT)
    with patch(
        "lcfs.web.api.ci_application.services.CIApplicationServices.list_ci_applications"
    ) as mock:
        mock.return_value = _ci_list_schema()
        response = await client.post(
            "/api/ci-applications/list", json={"page": 1, "size": 10}
        )
        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["pagination"]["total"] == 1
        # Supplier scope: organization_id should be passed through (not None)
        called_args = mock.await_args
        assert called_args.args[1] == 1


@pytest.mark.anyio
async def test_list_returns_all_for_government(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.GOVERNMENT)
    with patch(
        "lcfs.web.api.ci_application.services.CIApplicationServices.list_ci_applications"
    ) as mock:
        mock.return_value = _ci_list_schema()
        response = await client.post(
            "/api/ci-applications/list", json={"page": 1, "size": 10}
        )
        assert response.status_code == status.HTTP_200_OK
        # Government scope: organization_id should be None
        assert mock.await_args.args[1] is None


# ---------------------------------------------------------------------------
# GET /{id}
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_get_application_supplier_owns_record(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.CI_APPLICANT)
    with patch(
        "lcfs.web.api.ci_application.validation.CIApplicationValidation.validate_access",
        new=AsyncMock(return_value=None),
    ), patch(
        "lcfs.web.api.ci_application.services.CIApplicationServices.get_ci_application"
    ) as svc:
        svc.return_value = _ci_full_schema(10)
        response = await client.get("/api/ci-applications/10")
        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["ciApplicationId"] == 10
        assert body["facilityCountry"] == "Argentina"
        assert body["status"]["status"] == "Draft"


# ---------------------------------------------------------------------------
# POST "" (create draft)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_create_application_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.CI_APPLICANT)
    with patch(
        "lcfs.web.api.ci_application.services.CIApplicationServices.create_draft"
    ) as svc:
        svc.return_value = _ci_full_schema(10)
        response = await client.post("/api/ci-applications", json=_step1_payload())
        assert response.status_code == status.HTTP_201_CREATED
        body = response.json()
        assert body["ciApplicationId"] == 10
        # service was called with org_id from the mock user (1)
        assert svc.await_args.args[0] == 1


@pytest.mark.anyio
async def test_create_application_forbidden_for_government(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.GOVERNMENT)
    response = await client.post("/api/ci-applications", json=_step1_payload())
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_create_application_validation_error_missing_required(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.CI_APPLICANT)
    payload = _step1_payload()
    del payload["facilityCountry"]
    response = await client.post("/api/ci-applications", json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.anyio
async def test_create_application_capacity_must_be_positive(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.CI_APPLICANT)
    payload = _step1_payload()
    payload["facilityNameplateCapacity"] = 0
    response = await client.post("/api/ci-applications", json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# ---------------------------------------------------------------------------
# PUT /{id}/step1
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_update_step1_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.CI_APPLICANT)
    with patch(
        "lcfs.web.api.ci_application.validation.CIApplicationValidation.validate_access",
        new=AsyncMock(return_value=None),
    ), patch(
        "lcfs.web.api.ci_application.services.CIApplicationServices.update_step1"
    ) as svc:
        svc.return_value = _ci_full_schema(10)
        response = await client.put(
            "/api/ci-applications/10/step1", json=_step1_payload()
        )
        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["ciApplicationId"] == 10


@pytest.mark.anyio
async def test_update_step1_forbidden_for_government(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.GOVERNMENT)
    response = await client.put(
        "/api/ci-applications/10/step1", json=_step1_payload()
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# DELETE /{id}
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_delete_application_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.CI_APPLICANT)
    with patch(
        "lcfs.web.api.ci_application.validation.CIApplicationValidation.validate_access",
        new=AsyncMock(return_value=None),
    ), patch(
        "lcfs.web.api.ci_application.services.CIApplicationServices.delete_draft",
        new=AsyncMock(return_value=None),
    ):
        response = await client.delete("/api/ci-applications/10")
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == {"message": "CI application deleted."}


# ---------------------------------------------------------------------------
# Stubbed steps 2-5 — surface reserved, returns 501
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@pytest.mark.parametrize(
    "method,url",
    [
        ("put", "/api/ci-applications/10/step2"),
        ("put", "/api/ci-applications/10/step3"),
        ("post", "/api/ci-applications/10/submit"),
    ],
)
async def test_stub_endpoints_return_not_implemented(
    method,
    url,
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    # Both ci_applicant and signing_authority can hit the supplier-side stubs
    set_user_role(RoleEnum.SIGNING_AUTHORITY)
    response = await getattr(client, method)(url, json={})
    assert response.status_code == status.HTTP_501_NOT_IMPLEMENTED
    body = response.json()
    assert "not yet implemented" in body["message"].lower()


@pytest.mark.anyio
async def test_government_decision_stub_forbidden_for_non_government(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.CI_APPLICANT)
    response = await client.post("/api/ci-applications/10/decision", json={})
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_government_decision_stub_returns_not_implemented_for_government(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.GOVERNMENT)
    response = await client.post("/api/ci-applications/10/decision", json={})
    assert response.status_code == status.HTTP_501_NOT_IMPLEMENTED
