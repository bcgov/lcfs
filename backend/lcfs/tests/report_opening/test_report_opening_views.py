import pytest
from unittest.mock import patch

from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.user.role_domains import ORG_ROLE_SET
from lcfs.web.api.report_opening.schema import ReportOpeningSchema

# Derived from the role domain model rather than restated here: a BCeID role
# always carries SUPPLIER, so every organization role reaches this endpoint.
# The previous hand-maintained copy drifted the moment a BCeID role was added.
SUPPLIER_LIKE_ROLES = ORG_ROLE_SET

READ_UNAUTHORIZED_ROLES = [
    role
    for role in RoleEnum
    if role is not RoleEnum.SYSTEM_ADMIN and role not in SUPPLIER_LIKE_ROLES
]

WRITE_UNAUTHORIZED_ROLES = [
    role for role in RoleEnum if role is not RoleEnum.SYSTEM_ADMIN
]


mock_report_opening = ReportOpeningSchema(
    report_opening_id=1,
    compliance_year=2025,
    compliance_reporting_enabled=True,
    early_issuance_enabled=False,
    create_supplemental_enabled=True,
)


@pytest.mark.anyio
async def test_list_report_openings_as_system_admin(client, fastapi_app, set_mock_user):
    """System Admin can read report openings."""
    with patch(
        "lcfs.web.api.report_opening.views.ReportOpeningService.get_report_openings"
    ) as mock_get:
        mock_get.return_value = [mock_report_opening]

        set_mock_user(fastapi_app, [RoleEnum.SYSTEM_ADMIN])

        url = fastapi_app.url_path_for("list_report_openings")
        response = await client.get(url)

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert data[0]["complianceYear"] == 2025


@pytest.mark.anyio
async def test_list_report_openings_as_supplier(client, fastapi_app, set_mock_user):
    """Suppliers can read report openings."""
    with patch(
        "lcfs.web.api.report_opening.views.ReportOpeningService.get_report_openings"
    ) as mock_get:
        mock_get.return_value = [mock_report_opening]

        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

        url = fastapi_app.url_path_for("list_report_openings")
        response = await client.get(url)

        assert response.status_code == 200


@pytest.mark.anyio
@pytest.mark.parametrize("role", READ_UNAUTHORIZED_ROLES)
async def test_list_report_openings_unauthorized(
    client, fastapi_app, set_mock_user, role
):
    """Other roles cannot read report openings."""
    set_mock_user(fastapi_app, [role])

    url = fastapi_app.url_path_for("list_report_openings")
    response = await client.get(url)

    assert response.status_code == 403


@pytest.mark.anyio
async def test_update_report_openings_as_system_admin(
    client, fastapi_app, set_mock_user
):
    """System Admin can update report openings."""
    with patch(
        "lcfs.web.api.report_opening.views.ReportOpeningService.update_report_openings"
    ) as mock_update:
        mock_update.return_value = [mock_report_opening]

        set_mock_user(fastapi_app, [RoleEnum.SYSTEM_ADMIN])

        url = fastapi_app.url_path_for("update_report_openings")
        response = await client.put(
            url,
            json={
                "reportOpenings": [
                    {
                        "complianceYear": 2025,
                        "complianceReportingEnabled": True,
                        "earlyIssuanceEnabled": False,
                        "createSupplementalEnabled": True,
                    }
                ]
            },
        )

        assert response.status_code == 200


@pytest.mark.anyio
@pytest.mark.parametrize("role", WRITE_UNAUTHORIZED_ROLES)
async def test_update_report_openings_unauthorized(
    client, fastapi_app, set_mock_user, role
):
    """Only System Admin can update report openings."""
    set_mock_user(fastapi_app, [role])

    url = fastapi_app.url_path_for("update_report_openings")
    response = await client.put(
        url,
        json={
            "reportOpenings": [
                {
                    "complianceYear": 2025,
                    "complianceReportingEnabled": True,
                    "earlyIssuanceEnabled": False,
                    "createSupplementalEnabled": True,
                }
            ]
        },
    )

    assert response.status_code == 403
