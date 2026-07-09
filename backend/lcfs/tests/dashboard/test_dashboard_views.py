"""HTTP-level tests for the dashboard org-fuel-code-counts endpoint (#4579)."""

from unittest.mock import patch

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from starlette import status

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.dashboard.schema import OrgFuelCodeCountsSchema


@pytest.fixture
def set_user_role(fastapi_app, set_mock_user):
    def _set(role):
        set_mock_user(fastapi_app, [role])

    return _set


@pytest.mark.anyio
async def test_org_fuel_code_counts_success_for_ci_applicant(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    """A CI applicant gets their organization's in-progress (draft) count."""
    set_user_role(RoleEnum.CI_APPLICANT)
    with patch(
        "lcfs.web.api.dashboard.services.DashboardServices.get_org_fuel_code_counts"
    ) as mock:
        mock.return_value = OrgFuelCodeCountsSchema(draft=4, submitted=2)
        response = await client.get("/api/dashboard/org-fuel-code-counts")

        assert response.status_code == status.HTTP_200_OK
        assert response.json() == {"draft": 4, "submitted": 2}
        # Org is resolved from the caller, not a query param. Patching the
        # class method with a mock does not pass ``self``, so the resolved
        # organization_id is the first positional arg.
        assert mock.await_args.args[0] is not None


@pytest.mark.anyio
async def test_org_fuel_code_counts_forbidden_for_non_applicant(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    """The endpoint is gated to CI applicant / signing authority — a
    government analyst must not reach it."""
    set_user_role(RoleEnum.ANALYST)
    response = await client.get("/api/dashboard/org-fuel-code-counts")
    assert response.status_code == status.HTTP_403_FORBIDDEN
