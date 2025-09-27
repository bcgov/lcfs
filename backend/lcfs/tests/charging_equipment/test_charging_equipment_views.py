import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient
from fastapi import status

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.charging_equipment.schema import (
    ChargingEquipmentListSchema,
    ChargingEquipmentBaseSchema,
    BulkActionResponseSchema,
)
from lcfs.web.api.charging_equipment.services import ChargingEquipmentServices


@pytest.mark.anyio
async def test_get_charging_equipment_list_success(
    client: AsyncClient,
    fastapi_app,
    set_mock_user,
    valid_charging_equipment_base_schema,
):
    """Test GET /charging-equipment/list endpoint successfully."""
    # Mock user with supplier role
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    # Mock service response
    mock_list_schema = {
        "items": [
            {
                "charging_equipment_id": 1,
                "charging_site_id": 1,
                "status": "Draft",
                "site_name": "Test Charging Site",
                "registration_number": "TEST1-001",
                "version": 1,
                "allocating_organization_name": "Test Organization",
                "serial_number": "ABC123456",
                "manufacturer": "Tesla",
                "model": "Supercharger V3",
                "level_of_equipment_name": "Level 2",
                "created_date": "2024-01-01T00:00:00Z",
                "updated_date": "2024-01-02T00:00:00Z",
            }
        ],
        "total_count": 1,
        "current_page": 1,
        "total_pages": 1,
        "page_size": 10,
    }

    # Mock the service dependency
    mock_service = AsyncMock()
    mock_service.get_charging_equipment_list.return_value = mock_list_schema

    # Override the dependency
    fastapi_app.dependency_overrides[ChargingEquipmentServices] = lambda: mock_service

    try:
        # Make request
        response = await client.post(
            "/api/charging-equipment/list",
            json={"page": 1, "size": 10, "sort_orders": []},
        )

        # Verify response
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["charging_equipment_id"] == 1
    finally:
        # Clean up the dependency override
        fastapi_app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_get_charging_equipment_by_id_success(
    client: AsyncClient,
    fastapi_app,
    set_mock_user,
    valid_charging_equipment_base_schema,
):
    """Test GET /charging-equipment/{id} endpoint successfully."""
    # Mock user with supplier role
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    # Mock the service dependency
    mock_service = AsyncMock()
    mock_service.get_charging_equipment_by_id.return_value = (
        valid_charging_equipment_base_schema
    )

    # Override the dependency
    fastapi_app.dependency_overrides[ChargingEquipmentServices] = lambda: mock_service

    try:
        # Make request
        response = await client.get("/api/charging-equipment/1")

        # Verify response
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["charging_equipment_id"] == 1
        assert data["serial_number"] == "ABC123456"
    finally:
        # Clean up the dependency override
        fastapi_app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_create_charging_equipment_success(
    client: AsyncClient,
    fastapi_app,
    set_mock_user,
    valid_charging_equipment_base_schema,
    valid_charging_equipment_create_schema,
):
    """Test POST /charging-equipment/ endpoint successfully."""
    # Mock user with supplier role
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    # Mock the service dependency
    mock_service = AsyncMock()
    mock_service.create_charging_equipment.return_value = (
        valid_charging_equipment_base_schema
    )

    # Override the dependency
    fastapi_app.dependency_overrides[ChargingEquipmentServices] = lambda: mock_service

    try:
        # Make request
        response = await client.post(
            "/api/charging-equipment/",
            json=valid_charging_equipment_create_schema.model_dump(),
        )

        # Verify response
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["charging_equipment_id"] == 1
        assert data["serial_number"] == "ABC123456"
    finally:
        # Clean up the dependency override
        fastapi_app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_update_charging_equipment_success(
    client: AsyncClient,
    fastapi_app,
    set_mock_user,
    valid_charging_equipment_base_schema,
    valid_charging_equipment_update_schema,
):
    """Test PUT /charging-equipment/{id} endpoint successfully."""
    # Mock user with supplier role
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    # Mock the service dependency
    mock_service = AsyncMock()
    mock_service.update_charging_equipment.return_value = (
        valid_charging_equipment_base_schema
    )

    # Override the dependency
    fastapi_app.dependency_overrides[ChargingEquipmentServices] = lambda: mock_service

    try:
        # Make request
        response = await client.put(
            "/api/charging-equipment/1",
            json=valid_charging_equipment_update_schema.model_dump(exclude_unset=True),
        )

        # Verify response
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["charging_equipment_id"] == 1
    finally:
        # Clean up the dependency override
        fastapi_app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_delete_charging_equipment_success(
    client: AsyncClient, fastapi_app, set_mock_user
):
    """Test DELETE /charging-equipment/{id} endpoint successfully."""
    # Mock user with supplier role
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    # Mock the service dependency
    mock_service = AsyncMock()
    mock_service.delete_charging_equipment.return_value = True

    # Override the dependency
    fastapi_app.dependency_overrides[ChargingEquipmentServices] = lambda: mock_service

    try:
        # Make request
        response = await client.delete("/api/charging-equipment/1")

        # Verify response
        assert response.status_code == status.HTTP_204_NO_CONTENT
    finally:
        # Clean up the dependency override
        fastapi_app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_bulk_submit_equipment_success(
    client: AsyncClient, fastapi_app, set_mock_user
):
    """Test POST /charging-equipment/bulk/submit endpoint successfully."""
    # Mock user with supplier role
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    mock_response = BulkActionResponseSchema(
        success=True,
        message="Successfully submitted 2 equipment",
        affected_count=2,
        errors=[],
    )

    # Mock the service dependency
    mock_service = AsyncMock()
    mock_service.bulk_submit_equipment.return_value = mock_response

    # Override the dependency
    fastapi_app.dependency_overrides[ChargingEquipmentServices] = lambda: mock_service

    try:
        # Make request
        response = await client.post(
            "/api/charging-equipment/bulk/submit",
            json={"charging_equipment_ids": [1, 2]},
        )

        # Verify response
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["affected_count"] == 2
    finally:
        # Clean up the dependency override
        fastapi_app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_bulk_decommission_equipment_success(
    client: AsyncClient, fastapi_app, set_mock_user
):
    """Test POST /charging-equipment/bulk/decommission endpoint successfully."""
    # Mock user with supplier role
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    mock_response = BulkActionResponseSchema(
        success=True,
        message="Successfully decommissioned 1 equipment",
        affected_count=1,
        errors=[],
    )

    # Mock the service dependency
    mock_service = AsyncMock()
    mock_service.bulk_decommission_equipment.return_value = mock_response

    # Override the dependency
    fastapi_app.dependency_overrides[ChargingEquipmentServices] = lambda: mock_service

    try:
        # Make request
        response = await client.post(
            "/api/charging-equipment/bulk/decommission",
            json={"charging_equipment_ids": [1]},
        )

        # Verify response
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["affected_count"] == 1
    finally:
        # Clean up the dependency override
        fastapi_app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_get_equipment_statuses_success(
    client: AsyncClient, fastapi_app, set_mock_user
):
    """Test GET /charging-equipment/statuses/list endpoint successfully."""
    # Mock user with supplier role
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    mock_statuses = [
        {"status_id": 1, "status": "Draft"},
        {"status_id": 2, "status": "Submitted"},
    ]

    # Mock the service dependency
    mock_service = AsyncMock()
    mock_service.get_equipment_statuses.return_value = mock_statuses

    # Override the dependency
    fastapi_app.dependency_overrides[ChargingEquipmentServices] = lambda: mock_service

    try:
        # Make request
        response = await client.get("/api/charging-equipment/statuses/list")

        # Verify response
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2
        assert data[0]["status"] == "Draft"
    finally:
        # Clean up the dependency override
        fastapi_app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_get_levels_of_equipment_success(
    client: AsyncClient, fastapi_app, set_mock_user
):
    """Test GET /charging-equipment/levels/list endpoint successfully."""
    # Mock user with supplier role
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    mock_levels = [
        {"level_of_equipment_id": 1, "name": "Level 1", "description": "Fast charging"},
        {
            "level_of_equipment_id": 2,
            "name": "Level 2",
            "description": "Standard charging",
        },
    ]

    # Mock the service dependency
    mock_service = AsyncMock()
    mock_service.get_levels_of_equipment.return_value = mock_levels

    # Override the dependency
    fastapi_app.dependency_overrides[ChargingEquipmentServices] = lambda: mock_service

    try:
        # Make request
        response = await client.get("/api/charging-equipment/levels/list")

        # Verify response
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2
        assert data[0]["name"] == "Level 1"
    finally:
        # Clean up the dependency override
        fastapi_app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_get_end_use_types_success(
    client: AsyncClient, fastapi_app, set_mock_user
):
    """Test GET /charging-equipment/end-use-types/list endpoint successfully."""
    # Mock user with supplier role
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    mock_end_use_types = [
        {"end_use_type_id": 1, "type": "Commercial", "sub_type": "Fleet"},
        {"end_use_type_id": 2, "type": "Residential", "sub_type": "Private"},
    ]

    # Mock the service dependency
    mock_service = AsyncMock()
    mock_service.get_end_use_types.return_value = mock_end_use_types

    # Override the dependency
    fastapi_app.dependency_overrides[ChargingEquipmentServices] = lambda: mock_service

    try:
        # Make request
        response = await client.get("/api/charging-equipment/end-use-types/list")

        # Verify response
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2
        assert data[0]["type"] == "Commercial"
    finally:
        # Clean up the dependency override
        fastapi_app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_unauthorized_access_government_role(
    client: AsyncClient, fastapi_app, set_mock_user
):
    """Test that only authorized roles can access supplier-only endpoints."""
    # Mock user with government role (should fail for supplier-only endpoints)
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

    # Test create endpoint (supplier only)
    response = await client.post(
        "/api/charging-equipment/",
        json={
            "charging_site_id": 1,
            "serial_number": "TEST123",
            "manufacturer": "Tesla",
            "level_of_equipment_id": 1,
        },
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN

    # Test bulk submit endpoint (supplier only)
    response = await client.post(
        "/api/charging-equipment/bulk/submit", json={"charging_equipment_ids": [1, 2]}
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
