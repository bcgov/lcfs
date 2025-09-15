import pytest
import json
from fastapi import FastAPI
from httpx import AsyncClient
from unittest.mock import patch, MagicMock
from lcfs.db.models import Organization, ChargingSite, ChargingSiteStatus
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import PaginationResponseSchema
from lcfs.web.api.charging_site.schema import (
    ChargingSiteCreateSchema,
    ChargingSiteSchema,
    ChargingSiteStatusSchema,
    ChargingSitesSchema,
    DeleteChargingSiteResponseSchema,
)
from lcfs.web.api.fuel_code.schema import EndUserTypeSchema


@pytest.fixture
def valid_charging_site_create_schema() -> ChargingSiteCreateSchema:
    return ChargingSiteCreateSchema(
        charging_site_id=1,
        organization_id=3,
        status="Draft",
        site_name="Test Charging Site",
        site_code="TST01",
        street_address="123 Test Street",
        city="Test City",
        postal_code="V1A 2B3",
        latitude=49.2827,
        longitude=-123.1207,
        intended_users=[
            EndUserTypeSchema(
                end_user_type_id=1, type_name="Multi-unit residential building"
            )
        ],
        notes="Test charging site notes",
        deleted=False,
    )


@pytest.fixture
def valid_charging_site_schema() -> ChargingSiteSchema:
    return ChargingSiteSchema(
        charging_site_id=1,
        organization_id=3,
        status=ChargingSiteStatusSchema(charging_site_status_id=1, status="Draft"),
        status_id=1,
        site_name="Test Charging Site",
        site_code="TST01",
        street_address="123 Test Street",
        city="Test City",
        postal_code="V1A 2B3",
        latitude=49.2827,
        longitude=-123.1207,
        intended_users=[
            EndUserTypeSchema(
                end_user_type_id=1, type_name="Multi-unit residential building"
            )
        ],
        notes="Test charging site notes",
        deleted=False,
    )


@pytest.mark.anyio
async def test_get_intended_users_success(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test successful retrieval of intended users"""
    with patch(
        "lcfs.web.api.charging_site.services.ChargingSiteService.get_intended_user_types"
    ) as mock_get_intended_users:
        mock_get_intended_users.return_value = [
            EndUserTypeSchema(
                end_user_type_id=1, type_name="Multi-unit residential building"
            ),
            EndUserTypeSchema(end_user_type_id=2, type_name="Fleet"),
        ]

        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("get_intended_users")
        response = await client.get(url)

        assert response.status_code == 200
        assert isinstance(response.json(), list)
        assert len(response.json()) == 2
        assert response.json()[0]["endUserTypeId"] == 1
        assert response.json()[0]["typeName"] == "Multi-unit residential building"


@pytest.mark.anyio
async def test_get_intended_users_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test unauthorized access to intended users"""
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    url = fastapi_app.url_path_for("get_intended_users")
    response = await client.get(url)
    assert response.status_code == 403


# @pytest.mark.anyio
# async def test_get_charging_sites_list_all_success( 
#     client: AsyncClient, fastapi_app: FastAPI, set_mock_user, valid_charging_site_schema
# ):
#     """Test successful retrieval of all charging sites (no pagination)"""
#     with patch(
#         "lcfs.web.api.charging_site.services.ChargingSiteService.get_cs_list"
#     ) as mock_get_list:
#         mock_get_list.return_value = ChargingSitesSchema(
#             charging_sites=[valid_charging_site_schema], pagination=PaginationResponseSchema(page=1, total_pages=1, size=1, total=1)
#         )

#         set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
#         url = fastapi_app.url_path_for("get_charging_sites", organization_id=3)
#         payload = {}  # No pagination parameters
#         response = await client.post(url, json=payload)

#         assert response.status_code == 200
#         assert "chargingSites" in response.json()
#         assert len(response.json()["chargingSites"]) == 1


@pytest.mark.anyio
async def test_get_charging_sites_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test unauthorized access to charging sites"""
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    url = fastapi_app.url_path_for("get_charging_sites", organization_id=3)
    payload = {"page": 1, "size": 10}
    response = await client.post(url, json=payload)
    assert response.status_code == 403


# @pytest.mark.anyio
# async def test_create_charging_site_success(
#     client: AsyncClient, fastapi_app: FastAPI, set_mock_user, valid_charging_site_schema
# ):
#     """Test successful creation of charging site"""
#     with patch(
#         "lcfs.web.api.charging_site.services.ChargingSiteService.create_charging_site"
#     ) as mock_create:
#         mock_create.return_value = valid_charging_site_schema

#         set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
#         url = fastapi_app.url_path_for("create_charging_site_row", organization_id=3)
#         payload = {
#             "organizationId": 3,
#             "status": "Draft",
#             "siteName": "New Charging Site",
#             "streetAddress": "456 New Street",
#             "city": "New City",
#             "postalCode": "V2B 3C4",
#             "latitude": 50.1234,
#             "longitude": -124.5678,
#             "intendedUsers": [
#                 {"endUserTypeId": 1, "typeName": "Multi-unit residential building"}
#             ],
#             "notes": "New charging site",
#         }
#         response = await client.post(url, json=payload)

#         assert response.status_code == 201
#         assert "chargingSiteId" in response.json()
#         assert response.json()["siteName"] == "Test Charging Site"


@pytest.mark.anyio
async def test_create_charging_site_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test unauthorized creation of charging site"""
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    url = fastapi_app.url_path_for("create_charging_site_row", organization_id=3)
    payload = {
        "organizationId": 3,
        "status": "Draft",
        "siteName": "New Charging Site",
        "streetAddress": "456 New Street",
        "city": "New City",
        "postalCode": "V2B 3C4",
        "latitude": 50.1234,
        "longitude": -124.5678,
        "intendedUsers": [],
        "notes": "New charging site",
    }
    response = await client.post(url, json=payload)
    assert response.status_code == 403


# @pytest.mark.anyio
# async def test_update_charging_site_success(
#     client: AsyncClient, fastapi_app: FastAPI, set_mock_user, valid_charging_site_schema
# ):
#     """Test successful update of charging site"""
#     with patch(
#         "lcfs.web.api.charging_site.services.ChargingSiteService.update_charging_site"
#     ) as mock_update:
#         updated_schema = valid_charging_site_schema.copy()
#         updated_schema.site_name = "Updated Charging Site"
#         mock_update.return_value = updated_schema

#         set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
#         url = fastapi_app.url_path_for(
#             "update_charging_site_row", organization_id=3, chargingSiteId=1
#         )
#         payload = {
#             "chargingSiteId": 1,
#             "organizationId": 3,
#             "status": "Draft",
#             "siteName": "Updated Charging Site",
#             "streetAddress": "123 Test Street",
#             "city": "Test City",
#             "postalCode": "V1A 2B3",
#             "latitude": 49.2827,
#             "longitude": -123.1207,
#             "intendedUsers": [
#                 {"endUserTypeId": 1, "typeName": "Multi-unit residential building"}
#             ],
#             "notes": "Updated notes",
#         }
#         response = await client.put(url, json=payload)

#         assert response.status_code == 201
#         assert response.json()["siteName"] == "Updated Charging Site"


# @pytest.mark.anyio
# async def test_update_charging_site_unauthorized(
#     client: AsyncClient, fastapi_app: FastAPI, set_mock_user
# ):
#     """Test unauthorized update of charging site"""
#     set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
#     url = fastapi_app.url_path_for(
#         "update_charging_site_row", organization_id=3, chargingSiteId=1
#     )
#     payload = {
#         "chargingSiteId": 1,
#         "organizationId": 3,
#         "status": "Draft",
#         "siteName": "Updated Charging Site",
#     }
#     response = await client.put(url, json=payload)
#     assert response.status_code == 403


# @pytest.mark.anyio
# async def test_delete_charging_site_success(
#     client: AsyncClient, fastapi_app: FastAPI, set_mock_user
# ):
#     """Test successful deletion of charging site"""
#     with patch(
#         "lcfs.web.api.charging_site.services.ChargingSiteService.delete_charging_site"
#     ) as mock_delete:
#         mock_delete.return_value = None

#         set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
#         url = fastapi_app.url_path_for(
#             "delete_charging_site_row", organization_id=3, charging_site_id=1
#         )
#         payload = {"chargingSiteId": 1, "organizationId": 3, "deleted": True}
#         response = await client.delete(url, json=payload)

#         assert response.status_code == 201
#         assert response.json()["message"] == "Charging site deleted successfully"
#         mock_delete.assert_called_once_with(1)


# @pytest.mark.anyio
# async def test_delete_charging_site_invalid_request(
#     client: AsyncClient, fastapi_app: FastAPI, set_mock_user
# ):
#     """Test deletion with invalid request (deleted=False)"""
#     set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
#     url = fastapi_app.url_path_for(
#         "delete_charging_site_row", organization_id=3, charging_site_id=1
#     )
#     payload = {
#         "chargingSiteId": 1,
#         "organizationId": 3,
#         "deleted": False,  # Invalid for delete operation
#     }
#     response = await client.delete(url, json=payload)

#     assert response.status_code == 400
#     assert "Invalid request" in response.json()["detail"]


# @pytest.mark.anyio
# async def test_delete_charging_site_unauthorized(
#     client: AsyncClient, fastapi_app: FastAPI, set_mock_user
# ):
#     """Test unauthorized deletion of charging site"""
#     set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
#     url = fastapi_app.url_path_for(
#         "delete_charging_site_row", organization_id=3, charging_site_id=1
#     )
#     payload = {"chargingSiteId": 1, "organizationId": 3, "deleted": True}
#     response = await client.delete(url, json=payload)
#     assert response.status_code == 403


# @pytest.mark.anyio
# async def test_create_charging_site_service_exception(
#     client: AsyncClient, fastapi_app: FastAPI, set_mock_user
# ):
#     """Test handling of service exceptions during creation"""
#     with patch(
#         "lcfs.web.api.charging_site.services.ChargingSiteService.create_charging_site"
#     ) as mock_create:
#         mock_create.side_effect = Exception("Database error")

#         set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
#         url = fastapi_app.url_path_for("create_charging_site_row", organization_id=3)
#         payload = {
#             "organizationId": 3,
#             "status": "Draft",
#             "siteName": "New Charging Site",
#             "streetAddress": "456 New Street",
#             "city": "New City",
#             "postalCode": "V2B 3C4",
#             "latitude": 50.1234,
#             "longitude": -124.5678,
#             "intendedUsers": [],
#             "notes": "New charging site",
#         }
#         response = await client.post(url, json=payload)

#         assert response.status_code == 500
#         assert "Internal Server Error" in response.json()["detail"]


# @pytest.mark.anyio
# async def test_get_charging_sites_with_different_roles(
#     client: AsyncClient, fastapi_app: FastAPI, set_mock_user
# ):
#     """Test that different authorized roles can access charging sites"""
#     with patch(
#         "lcfs.web.api.charging_site.services.ChargingSiteService.get_cs_list"
#     ) as mock_get_list:
#         mock_get_list.return_value = ChargingSitesSchema(
#             charging_sites=[], pagination=None
#         )

#         # Test with SIGNING_AUTHORITY role
#         set_mock_user(fastapi_app, [RoleEnum.SIGNING_AUTHORITY])
#         url = fastapi_app.url_path_for("get_charging_sites", organization_id=3)
#         response = await client.post(url, json={})
#         assert response.status_code == 200

#         # Test with GOVERNMENT role
#         set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
#         response = await client.post(url, json={})
#         assert response.status_code == 200

#         # Test with ANALYST role for create/update/delete
#         set_mock_user(fastapi_app, [RoleEnum.ANALYST])
#         create_url = fastapi_app.url_path_for(
#             "create_charging_site_row", organization_id=3
#         )
#         with patch(
#             "lcfs.web.api.charging_site.services.ChargingSiteService.create_charging_site"
#         ):
#             response = await client.post(
#                 create_url,
#                 json={
#                     "organizationId": 3,
#                     "status": "Draft",
#                     "siteName": "Test Site",
#                     "streetAddress": "123 Street",
#                     "city": "City",
#                     "postalCode": "V1A 1A1",
#                     "latitude": 49.0,
#                     "longitude": -123.0,
#                     "intendedUsers": [],
#                 },
#             )
#             assert response.status_code == 201
