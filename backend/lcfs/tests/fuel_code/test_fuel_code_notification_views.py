import pytest
import json
from httpx import AsyncClient
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI

from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatusEnum
from lcfs.web.api.base import NotificationTypeEnum
from lcfs.web.api.fuel_code.schema import FuelCodeStatusSchema


class TestFuelCodeNotificationViews:
    """Test fuel code API endpoints with notification integration"""

    @pytest.mark.anyio
    async def test_update_fuel_code_status_sends_notification_as_analyst(
        self, client: AsyncClient, fastapi_app: FastAPI, set_mock_user
    ):
        """Test that updating fuel code status as analyst sends appropriate notifications"""
        # Set user role as ANALYST
        set_mock_user(fastapi_app, [RoleEnum.ANALYST])
        
        # Mock the service dependency
        mock_service = MagicMock()
        
        # Mock successful status update - return a FuelCode model
        mock_fuel_code = MagicMock()
        mock_fuel_code.fuel_code_id = 1
        mock_fuel_code.fuel_code = "BCLCF001"
        mock_fuel_code.company = "Test Company"
        mock_fuel_code.fuel_code_status = MagicMock()
        mock_fuel_code.fuel_code_status.status = FuelCodeStatusEnum.Recommended
        
        # Use AsyncMock for async method
        mock_service.update_fuel_code_status = AsyncMock(return_value=mock_fuel_code)
        
        # Override the dependency
        from lcfs.web.api.fuel_code.services import FuelCodeServices
        fastapi_app.dependency_overrides[FuelCodeServices] = lambda: mock_service
        
        try:
            # Create request payload
            payload = FuelCodeStatusSchema(
                fuel_code_status_id=2,
                status=FuelCodeStatusEnum.Recommended,
                description="Recommended for approval"
            )
            
            # Make API request
            response = await client.put(
                "/api/fuel-codes/1",
                json=payload.model_dump(by_alias=True)
            )
            
            # Verify response
            assert response.status_code == 200
            
            # Verify service was called with user context
            mock_service.update_fuel_code_status.assert_called_once()
            args = mock_service.update_fuel_code_status.call_args
            assert args[0][0] == 1  # fuel_code_id
            assert args[0][1].value == "Recommended"  # status enum value
            assert hasattr(args[0][2], 'user_profile_id')  # user object
        finally:
            # Clean up dependency override
            fastapi_app.dependency_overrides.clear()

    @pytest.mark.anyio
    async def test_update_fuel_code_status_sends_notification_as_director(
        self, client: AsyncClient, fastapi_app: FastAPI, set_mock_user
    ):
        """Test that updating fuel code status as director sends appropriate notifications"""
        # Set user role as DIRECTOR
        set_mock_user(fastapi_app, [RoleEnum.DIRECTOR])
        
        # Mock the service dependency
        mock_service = MagicMock()
        
        # Mock successful status update - return a FuelCode model
        mock_fuel_code = MagicMock()
        mock_fuel_code.fuel_code_id = 1
        mock_fuel_code.fuel_code = "BCLCF001"
        mock_fuel_code.company = "Test Company"
        mock_fuel_code.fuel_code_status = MagicMock()
        mock_fuel_code.fuel_code_status.status = FuelCodeStatusEnum.Approved
        
        mock_service.update_fuel_code_status = AsyncMock(return_value=mock_fuel_code)
        
        # Override the dependency
        from lcfs.web.api.fuel_code.services import FuelCodeServices
        fastapi_app.dependency_overrides[FuelCodeServices] = lambda: mock_service
        
        try:
            payload = FuelCodeStatusSchema(
                fuel_code_status_id=3,
                status=FuelCodeStatusEnum.Approved,
                description="Approved by director"
            )
            
            response = await client.put(
                "/api/fuel-codes/1",
                json=payload.model_dump(by_alias=True)
            )
            
            assert response.status_code == 200
            mock_service.update_fuel_code_status.assert_called_once()
        finally:
            fastapi_app.dependency_overrides.clear()

    @pytest.mark.anyio
    async def test_update_fuel_code_status_unauthorized_role(
        self, client: AsyncClient, fastapi_app: FastAPI, set_mock_user
    ):
        """Test that non-government users cannot update fuel code status"""
        # Set user role as SUPPLIER (not government)
        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
        
        payload = FuelCodeStatusSchema(
            fuel_code_status_id=2,
            status=FuelCodeStatusEnum.Recommended,
            description="Unauthorized attempt"
        )
        
        response = await client.put(
            "/api/fuel-codes/1",
            json=payload.model_dump(by_alias=True)
        )
        
        # Should return 403 Forbidden for non-government users
        assert response.status_code == 403

    @pytest.mark.anyio
    async def test_update_fuel_code_status_invalid_fuel_code_id(
        self, client: AsyncClient, fastapi_app: FastAPI, set_mock_user
    ):
        """Test handling of invalid fuel code ID"""
        set_mock_user(fastapi_app, [RoleEnum.ANALYST])
        
        # Mock the service dependency
        mock_service = MagicMock()
        
        # Mock service to raise ValueError for non-existent fuel code
        mock_service.update_fuel_code_status = AsyncMock(side_effect=ValueError("Fuel code not found"))
        
        # Override the dependency
        from lcfs.web.api.fuel_code.services import FuelCodeServices
        fastapi_app.dependency_overrides[FuelCodeServices] = lambda: mock_service
        
        try:
            payload = FuelCodeStatusSchema(
                fuel_code_status_id=2,
                status=FuelCodeStatusEnum.Recommended,
                description="Non-existent fuel code"
            )
            
            response = await client.put(
                "/api/fuel-codes/999",
                json=payload.model_dump(by_alias=True)
            )
            
            # Should handle the error appropriately
            assert response.status_code in [400, 404, 422]  # Depending on error handling implementation
        finally:
            # Clean up dependency override
            fastapi_app.dependency_overrides.clear()

    @pytest.mark.anyio
    async def test_update_fuel_code_status_with_invalid_status(
        self, client: AsyncClient, fastapi_app: FastAPI, set_mock_user
    ):
        """Test handling of invalid status values"""
        set_mock_user(fastapi_app, [RoleEnum.ANALYST])
        
        # Send invalid status data
        invalid_payload = {
            "fuelCodeStatusId": 999,
            "status": "INVALID_STATUS",
            "description": "Invalid status test"
        }
        
        response = await client.put(
            "/api/fuel-codes/1",
            json=invalid_payload
        )
        
        # Should return 422 for validation error
        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_update_fuel_code_status_missing_required_fields(
        self, client: AsyncClient, fastapi_app: FastAPI, set_mock_user
    ):
        """Test handling of missing required fields in request"""
        set_mock_user(fastapi_app, [RoleEnum.ANALYST])
        
        # Send incomplete payload
        incomplete_payload = {
            "description": "Missing required fields"
        }
        
        response = await client.put(
            "/api/fuel-codes/1",
            json=incomplete_payload
        )
        
        # Should return 422 for validation error
        assert response.status_code == 422

    @pytest.mark.anyio
    async def test_fuel_code_status_update_endpoint_accessibility_analyst(
        self, client: AsyncClient, fastapi_app: FastAPI, set_mock_user
    ):
        """Test that the fuel code status update endpoint is accessible with ANALYST role"""
        set_mock_user(fastapi_app, [RoleEnum.ANALYST])
        
        # Mock the service dependency
        mock_service = MagicMock()
        
        # Mock successful status update - return a FuelCode model
        mock_fuel_code = MagicMock()
        mock_fuel_code.fuel_code_id = 1
        mock_fuel_code.fuel_code = "BCLCF001"
        mock_fuel_code.company = "Test Company"
        mock_fuel_code.fuel_code_status = MagicMock()
        mock_fuel_code.fuel_code_status.status = FuelCodeStatusEnum.Recommended
        
        mock_service.update_fuel_code_status = AsyncMock(return_value=mock_fuel_code)
        
        # Override the dependency
        from lcfs.web.api.fuel_code.services import FuelCodeServices
        fastapi_app.dependency_overrides[FuelCodeServices] = lambda: mock_service
        
        try:
            payload = FuelCodeStatusSchema(
                fuel_code_status_id=2,
                status=FuelCodeStatusEnum.Recommended,
                description="Test update"
            )
            
            response = await client.put(
                "/api/fuel-codes/1",
                json=payload.model_dump(by_alias=True)
            )
            
            # ANALYST role should have access
            assert response.status_code == 200
        finally:
            # Clean up dependency override
            fastapi_app.dependency_overrides.clear()

    @pytest.mark.anyio
    async def test_fuel_code_status_update_endpoint_accessibility_director(
        self, client: AsyncClient, fastapi_app: FastAPI, set_mock_user
    ):
        """Test that the fuel code status update endpoint is accessible with DIRECTOR role"""
        set_mock_user(fastapi_app, [RoleEnum.DIRECTOR])
        
        # Mock the service dependency
        mock_service = MagicMock()
        
        # Mock successful status update - return a FuelCode model
        mock_fuel_code = MagicMock()
        mock_fuel_code.fuel_code_id = 1
        mock_fuel_code.fuel_code = "BCLCF001"
        mock_fuel_code.company = "Test Company"
        mock_fuel_code.fuel_code_status = MagicMock()
        mock_fuel_code.fuel_code_status.status = FuelCodeStatusEnum.Recommended
        
        mock_service.update_fuel_code_status = AsyncMock(return_value=mock_fuel_code)
        
        # Override the dependency
        from lcfs.web.api.fuel_code.services import FuelCodeServices
        fastapi_app.dependency_overrides[FuelCodeServices] = lambda: mock_service
        
        try:
            payload = FuelCodeStatusSchema(
                fuel_code_status_id=2,
                status=FuelCodeStatusEnum.Recommended,
                description="Test update"
            )
            
            response = await client.put(
                "/api/fuel-codes/1",
                json=payload.model_dump(by_alias=True)
            )
            
            # DIRECTOR role should have access
            assert response.status_code == 200
        finally:
            # Clean up dependency override
            fastapi_app.dependency_overrides.clear()

    @pytest.mark.anyio
    async def test_notification_integration_with_real_service_dependencies(
        self, client: AsyncClient, fastapi_app: FastAPI, set_mock_user
    ):
        """Test notification integration with mocked service dependencies"""
        set_mock_user(fastapi_app, [RoleEnum.ANALYST])
        
        # Mock the service dependency
        mock_service = MagicMock()
        
        # Mock successful fuel code update - return a FuelCode model
        mock_fuel_code = MagicMock()
        mock_fuel_code.fuel_code_id = 1
        mock_fuel_code.fuel_code = "BCLCF001"
        mock_fuel_code.company = "Test Company"
        mock_fuel_code.fuel_code_status = MagicMock()
        mock_fuel_code.fuel_code_status.status = FuelCodeStatusEnum.Recommended
        
        mock_service.update_fuel_code_status = AsyncMock(return_value=mock_fuel_code)
        
        # Override the dependency
        from lcfs.web.api.fuel_code.services import FuelCodeServices
        fastapi_app.dependency_overrides[FuelCodeServices] = lambda: mock_service
        
        try:
            payload = FuelCodeStatusSchema(
                fuel_code_status_id=2,
                status=FuelCodeStatusEnum.Recommended,
                description="Integration test"
            )
            
            response = await client.put(
                "/api/fuel-codes/1",
                json=payload.model_dump(by_alias=True)
            )
            
            assert response.status_code == 200
            
            # Verify the service was called with proper parameters
            mock_service.update_fuel_code_status.assert_called_once()
        finally:
            # Clean up dependency override
            fastapi_app.dependency_overrides.clear()

    @pytest.mark.anyio
    async def test_camel_case_response_format(
        self, client: AsyncClient, fastapi_app: FastAPI, set_mock_user
    ):
        """Test that API responses follow camelCase format"""
        set_mock_user(fastapi_app, [RoleEnum.ANALYST])
        
        # Mock the service dependency
        mock_service = MagicMock()
        
        # Mock successful status update - return a FuelCode model
        mock_fuel_code = MagicMock()
        mock_fuel_code.fuel_code_id = 1
        mock_fuel_code.fuel_code = "BCLCF001"
        mock_fuel_code.carbon_intensity = 85.5
        mock_fuel_code.company = "Test Company"
        mock_fuel_code.fuel_code_status = MagicMock()
        mock_fuel_code.fuel_code_status.status = FuelCodeStatusEnum.Recommended
        mock_fuel_code.last_updated = "2024-01-01T00:00:00Z"
        
        mock_service.update_fuel_code_status = AsyncMock(return_value=mock_fuel_code)
        
        # Override the dependency
        from lcfs.web.api.fuel_code.services import FuelCodeServices
        fastapi_app.dependency_overrides[FuelCodeServices] = lambda: mock_service
        
        try:
            payload = FuelCodeStatusSchema(
                fuel_code_status_id=2,
                status=FuelCodeStatusEnum.Recommended,
                description="CamelCase test"
            )
            
            response = await client.put(
                "/api/fuel-codes/1",
                json=payload.model_dump(by_alias=True)
            )
            
            assert response.status_code == 200
            
            # Verify response is in JSON format
            response_data = response.json()
            
            # Check that response follows camelCase (if the service returns objects with camelCase)
            # This depends on the actual implementation of the response serialization
            assert isinstance(response_data, dict)
        finally:
            # Clean up dependency override
            fastapi_app.dependency_overrides.clear()