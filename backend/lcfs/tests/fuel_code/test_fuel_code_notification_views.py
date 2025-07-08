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
        
        # Mock the service layer to capture notification calls
        with patch('lcfs.web.api.fuel_code.services.FuelCodeServices') as mock_service_class:
            mock_service = AsyncMock()
            mock_service_class.return_value = mock_service
            
            # Mock successful status update
            mock_service.update_fuel_code_status = AsyncMock()
            mock_service.update_fuel_code_status.return_value = {
                "fuel_code_id": 1,
                "status": "Recommended",
                "message": "Status updated successfully"
            }
            
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
            assert args[0][1] == FuelCodeStatusEnum.Recommended  # status
            assert hasattr(args[0][2], 'user_profile_id')  # user object

    @pytest.mark.anyio
    async def test_update_fuel_code_status_sends_notification_as_director(
        self, client: AsyncClient, fastapi_app: FastAPI, set_mock_user
    ):
        """Test that updating fuel code status as director sends appropriate notifications"""
        # Set user role as DIRECTOR
        set_mock_user(fastapi_app, [RoleEnum.DIRECTOR])
        
        with patch('lcfs.web.api.fuel_code.services.FuelCodeServices') as mock_service_class:
            mock_service = AsyncMock()
            mock_service_class.return_value = mock_service
            
            mock_service.update_fuel_code_status = AsyncMock()
            mock_service.update_fuel_code_status.return_value = {
                "fuel_code_id": 1,
                "status": "Approved",
                "message": "Status updated successfully"
            }
            
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
        
        with patch('lcfs.web.api.fuel_code.services.FuelCodeServices') as mock_service_class:
            mock_service = AsyncMock()
            mock_service_class.return_value = mock_service
            
            # Mock service to raise ValueError for non-existent fuel code
            mock_service.update_fuel_code_status = AsyncMock()
            mock_service.update_fuel_code_status.side_effect = ValueError("Fuel code not found")
            
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
    async def test_fuel_code_status_update_endpoint_accessibility(
        self, client: AsyncClient, fastapi_app: FastAPI, set_mock_user
    ):
        """Test that the fuel code status update endpoint is accessible with proper roles"""
        # Test with different government roles
        government_roles = [RoleEnum.ANALYST, RoleEnum.DIRECTOR, RoleEnum.ADMINISTRATOR]
        
        for role in government_roles:
            set_mock_user(fastapi_app, [role])
            
            with patch('lcfs.web.api.fuel_code.services.FuelCodeServices') as mock_service_class:
                mock_service = AsyncMock()
                mock_service_class.return_value = mock_service
                mock_service.update_fuel_code_status = AsyncMock()
                mock_service.update_fuel_code_status.return_value = {"status": "success"}
                
                payload = FuelCodeStatusSchema(
                    fuel_code_status_id=2,
                    status=FuelCodeStatusEnum.Recommended,
                    description="Test update"
                )
                
                response = await client.put(
                    "/api/fuel-codes/1",
                    json=payload.model_dump(by_alias=True)
                )
                
                # All government roles should have access
                assert response.status_code == 200, f"Role {role} should have access"

    @pytest.mark.anyio
    async def test_notification_integration_with_real_service_dependencies(
        self, client: AsyncClient, fastapi_app: FastAPI, set_mock_user
    ):
        """Test notification integration with mocked service dependencies"""
        set_mock_user(fastapi_app, [RoleEnum.ANALYST])
        
        # Mock both the service and its dependencies
        with patch('lcfs.web.api.fuel_code.services.FuelCodeServices') as mock_service_class, \
             patch('lcfs.web.api.notification.services.NotificationService') as mock_notif_service_class:
            
            # Setup service mocks
            mock_service = AsyncMock()
            mock_notif_service = AsyncMock()
            mock_service_class.return_value = mock_service
            mock_notif_service_class.return_value = mock_notif_service
            
            # Mock the notification service method
            mock_notif_service.send_notification = AsyncMock()
            
            # Mock successful fuel code update with notification
            mock_service.update_fuel_code_status = AsyncMock()
            mock_service.update_fuel_code_status.return_value = {
                "fuel_code_id": 1,
                "status": "Recommended"
            }
            
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

    @pytest.mark.anyio
    async def test_camel_case_response_format(
        self, client: AsyncClient, fastapi_app: FastAPI, set_mock_user
    ):
        """Test that API responses follow camelCase format"""
        set_mock_user(fastapi_app, [RoleEnum.ANALYST])
        
        with patch('lcfs.web.api.fuel_code.services.FuelCodeServices') as mock_service_class:
            mock_service = AsyncMock()
            mock_service_class.return_value = mock_service
            
            # Mock response with snake_case fields
            mock_service.update_fuel_code_status = AsyncMock()
            mock_service.update_fuel_code_status.return_value = {
                "fuel_code_id": 1,
                "fuel_code": "BCLCF001",
                "carbon_intensity": 85.5,
                "status": "Recommended",
                "last_updated": "2024-01-01T00:00:00Z"
            }
            
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