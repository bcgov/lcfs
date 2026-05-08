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
# Step 4 — Sign & submit
# ---------------------------------------------------------------------------


def _step4_payload(consultant_consent: bool = False):
    payload = {
        "declarationInformationTrue": True,
        "declarationResponse8Weeks": True,
        "declarationSection206": True,
        "consultantConsent": consultant_consent,
    }
    if consultant_consent:
        payload.update(
            {
                "consultantName": "Sam Anderson",
                "consultantCompany": "Anderson Fuel Consultants",
                "consultantEmail": "sam.anderson@afc.ar",
            }
        )
    return payload


@pytest.mark.anyio
async def test_submit_endpoint_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.SIGNING_AUTHORITY)
    with patch(
        "lcfs.web.api.ci_application.validation.CIApplicationValidation.validate_access",
        new=AsyncMock(return_value=None),
    ), patch(
        "lcfs.web.api.ci_application.services.CIApplicationServices.submit_application"
    ) as svc:
        svc.return_value = _ci_full_schema(10)
        response = await client.post(
            "/api/ci-applications/10/submit", json=_step4_payload()
        )
        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["ciApplicationId"] == 10


@pytest.mark.anyio
async def test_submit_endpoint_forbidden_for_ci_applicant_only(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.CI_APPLICANT)
    response = await client.post(
        "/api/ci-applications/10/submit", json=_step4_payload()
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_submit_endpoint_validation_error_when_declarations_incomplete(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.SIGNING_AUTHORITY)
    payload = _step4_payload()
    payload["declarationSection206"] = False
    response = await client.post("/api/ci-applications/10/submit", json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# ---------------------------------------------------------------------------
# Step 5 — Government decision & comments
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_decision_endpoint_forbidden_for_non_government(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.CI_APPLICANT)
    response = await client.post(
        "/api/ci-applications/10/decision", json={"status": "Completed"}
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_decision_endpoint_government_can_complete(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.GOVERNMENT)
    with patch(
        "lcfs.web.api.ci_application.validation.CIApplicationValidation.validate_access",
        new=AsyncMock(return_value=None),
    ), patch(
        "lcfs.web.api.ci_application.services.CIApplicationServices.record_decision"
    ) as svc:
        svc.return_value = _ci_full_schema(10)
        response = await client.post(
            "/api/ci-applications/10/decision",
            json={"status": "Completed", "comment": "ok"},
        )
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.anyio
async def test_decision_endpoint_rejects_non_terminal_status(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.GOVERNMENT)
    response = await client.post(
        "/api/ci-applications/10/decision", json={"status": "Submitted"}
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.anyio
async def test_list_comments_returns_thread(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.CI_APPLICANT)
    with patch(
        "lcfs.web.api.ci_application.validation.CIApplicationValidation.validate_access",
        new=AsyncMock(return_value=None),
    ), patch(
        "lcfs.web.api.ci_application.services.CIApplicationServices.list_comments"
    ) as svc:
        svc.return_value = []
        response = await client.get("/api/ci-applications/10/comments")
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []


@pytest.mark.anyio
async def test_add_comment_returns_201(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.CI_APPLICANT)
    from lcfs.web.api.ci_application.schema import CIApplicationCommentSchema

    with patch(
        "lcfs.web.api.ci_application.validation.CIApplicationValidation.validate_access",
        new=AsyncMock(return_value=None),
    ), patch(
        "lcfs.web.api.ci_application.services.CIApplicationServices.add_comment"
    ) as svc:
        svc.return_value = CIApplicationCommentSchema(
            comment_id=1,
            text="Hi",
            author_username="ci_applicant_user",
            author_display_name="Test User",
            is_government=False,
            create_date=datetime(2026, 5, 1, tzinfo=timezone.utc),
        )
        response = await client.post(
            "/api/ci-applications/10/comments", json={"text": "Hi"}
        )
        assert response.status_code == status.HTTP_201_CREATED
        body = response.json()
        assert body["text"] == "Hi"
        assert body["isGovernment"] is False


@pytest.mark.anyio
async def test_add_comment_rejects_empty_text(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.CI_APPLICANT)
    response = await client.post(
        "/api/ci-applications/10/comments", json={"text": ""}
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
