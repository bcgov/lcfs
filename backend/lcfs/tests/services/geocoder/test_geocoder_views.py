"""
Tests for geocoder API views.
"""

import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient
from fastapi import status

from lcfs.services.geocoder.client import BCGeocoderService, Address, GeocodingResult


@pytest.fixture
def mock_geocoder_service():
    """Create a mock geocoder service."""
    service = AsyncMock(spec=BCGeocoderService)
    return service


@pytest.fixture
def sample_address():
    """Sample address for testing."""
    return Address(
        full_address="123 Main St, Vancouver, BC",
        street_address="123 Main St",
        city="Vancouver",
        province="BC",
        postal_code="V6B 1A1",
        country="Canada",
        latitude=49.2827,
        longitude=-123.1207,
        score=95
    )


@pytest.fixture
def sample_geocoding_result(sample_address):
    """Sample geocoding result for testing."""
    return GeocodingResult(
        success=True,
        address=sample_address,
        source="bc_geocoder"
    )


class TestGeocoderViews:
    """Test cases for geocoder API views."""

    @pytest.mark.anyio
    async def test_validate_address_success(self, client, mock_geocoder_service, sample_address):
        """Test successful address validation endpoint."""
        mock_geocoder_service.validate_address.return_value = [sample_address]
        
        with patch('lcfs.web.api.geocoder.views.get_geocoder_service_async', return_value=mock_geocoder_service):
            response = await client.post(
                "/api/geocoder/validate",
                json={
                    "address_string": "123 Main St, Vancouver",
                    "min_score": 50,
                    "max_results": 5
                }
            )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "addresses" in data
        assert len(data["addresses"]) == 1
        assert data["addresses"][0]["full_address"] == "123 Main St, Vancouver, BC"

    @pytest.mark.anyio
    async def test_validate_address_invalid_request(self, client):
        """Test address validation with invalid request."""
        response = await client.post(
            "/api/geocoder/validate",
            json={
                "min_score": 150,  # Invalid score > 100
                "max_results": 5
            }
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.anyio
    async def test_forward_geocode_success(self, client, mock_geocoder_service, sample_geocoding_result):
        """Test successful forward geocoding endpoint."""
        mock_geocoder_service.forward_geocode.return_value = sample_geocoding_result
        
        with patch('lcfs.web.api.geocoder.views.get_geocoder_service_async', return_value=mock_geocoder_service):
            response = await client.post(
                "/api/geocoder/forward",
                json={
                    "address_string": "123 Main St, Vancouver",
                    "use_fallback": True
                }
            )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["address"]["latitude"] == 49.2827
        assert data["address"]["longitude"] == -123.1207

    @pytest.mark.anyio
    async def test_reverse_geocode_success(self, client, mock_geocoder_service, sample_geocoding_result):
        """Test successful reverse geocoding endpoint."""
        mock_geocoder_service.reverse_geocode.return_value = sample_geocoding_result
        
        with patch('lcfs.web.api.geocoder.views.get_geocoder_service_async', return_value=mock_geocoder_service):
            response = await client.post(
                "/api/geocoder/reverse",
                json={
                    "latitude": 49.2827,
                    "longitude": -123.1207,
                    "use_fallback": True
                }
            )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["address"]["city"] == "Vancouver"

    @pytest.mark.anyio
    async def test_reverse_geocode_invalid_coordinates(self, client):
        """Test reverse geocoding with invalid coordinates."""
        response = await client.post(
            "/api/geocoder/reverse",
            json={
                "latitude": 100,  # Invalid latitude > 90
                "longitude": -123.1207
            }
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.anyio
    async def test_batch_geocode_success(self, client, mock_geocoder_service, sample_geocoding_result):
        """Test successful batch geocoding endpoint."""
        mock_geocoder_service.batch_geocode.return_value = [
            sample_geocoding_result,
            sample_geocoding_result
        ]
        
        with patch('lcfs.web.api.geocoder.views.get_geocoder_service_async', return_value=mock_geocoder_service):
            response = await client.post(
                "/api/geocoder/batch",
                json={
                    "addresses": ["123 Main St, Vancouver", "456 Oak St, Victoria"],
                    "batch_size": 5
                }
            )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_processed"] == 2
        assert data["successful_count"] == 2
        assert data["failed_count"] == 0
        assert len(data["results"]) == 2

    @pytest.mark.anyio
    async def test_boundary_check_success(self, client, mock_geocoder_service):
        """Test successful BC boundary check endpoint."""
        mock_geocoder_service.check_bc_boundary.return_value = True
        
        with patch('lcfs.web.api.geocoder.views.get_geocoder_service_async', return_value=mock_geocoder_service):
            response = await client.post(
                "/api/geocoder/boundary-check",
                json={
                    "latitude": 49.2827,
                    "longitude": -123.1207
                }
            )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["is_in_bc"] is True

    @pytest.mark.anyio
    async def test_autocomplete_success(self, client, mock_geocoder_service):
        """Test successful address autocomplete endpoint."""
        mock_geocoder_service.autocomplete_address.return_value = [
            "123 Main St, Vancouver, BC",
            "124 Main St, Vancouver, BC"
        ]
        
        with patch('lcfs.web.api.geocoder.views.get_geocoder_service_async', return_value=mock_geocoder_service):
            response = await client.post(
                "/api/geocoder/autocomplete",
                json={
                    "partial_address": "123 Main",
                    "max_results": 5
                }
            )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["suggestions"]) == 2
        assert "123 Main St, Vancouver, BC" in data["suggestions"]

    @pytest.mark.anyio
    async def test_health_check_healthy(self, client, mock_geocoder_service):
        """Test health check endpoint when service is healthy."""
        # Mock successful validation and reverse geocoding
        mock_geocoder_service.validate_address.return_value = [Address(full_address="Test")]
        mock_geocoder_service.reverse_geocode.return_value = GeocodingResult(success=True)
        mock_geocoder_service._cache = {"size": 10}
        
        with patch('lcfs.web.api.geocoder.views.get_geocoder_service_async', return_value=mock_geocoder_service):
            response = await client.get("/api/geocoder/health")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "healthy"
        assert data["bc_geocoder_available"] is True
        assert data["nominatim_available"] is True

    @pytest.mark.anyio
    async def test_health_check_unhealthy(self, client, mock_geocoder_service):
        """Test health check endpoint when service is unhealthy."""
        # Mock failed validation and reverse geocoding
        mock_geocoder_service.validate_address.side_effect = Exception("API Error")
        mock_geocoder_service.reverse_geocode.side_effect = Exception("API Error")
        mock_geocoder_service._cache = {}
        
        with patch('lcfs.web.api.geocoder.views.get_geocoder_service_async', return_value=mock_geocoder_service):
            response = await client.get("/api/geocoder/health")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["bc_geocoder_available"] is False
        assert data["nominatim_available"] is False

    @pytest.mark.anyio
    async def test_clear_cache_success(self, client, mock_geocoder_service):
        """Test successful cache clearing endpoint."""
        mock_geocoder_service.clear_cache.return_value = None
        
        with patch('lcfs.web.api.geocoder.views.get_geocoder_service_async', return_value=mock_geocoder_service):
            response = await client.delete("/api/geocoder/cache")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Cache cleared successfully"
        mock_geocoder_service.clear_cache.assert_called_once()

    @pytest.mark.anyio
    async def test_clear_cache_error(self, client, mock_geocoder_service):
        """Test cache clearing endpoint with error."""
        mock_geocoder_service.clear_cache.side_effect = Exception("Cache error")
        
        with patch('lcfs.web.api.geocoder.views.get_geocoder_service_async', return_value=mock_geocoder_service):
            response = await client.delete("/api/geocoder/cache")
        
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    @pytest.mark.anyio
    async def test_service_error_handling(self, client, mock_geocoder_service):
        """Test error handling when geocoder service raises exceptions."""
        mock_geocoder_service.validate_address.side_effect = Exception("Service error")
        
        with patch('lcfs.web.api.geocoder.views.get_geocoder_service_async', return_value=mock_geocoder_service):
            response = await client.post(
                "/api/geocoder/validate",
                json={
                    "address_string": "Test Address",
                    "min_score": 50,
                    "max_results": 5
                }
            )
        
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Address validation failed" in response.json()["detail"]

    @pytest.mark.anyio
    async def test_batch_geocode_mixed_results(self, client, mock_geocoder_service):
        """Test batch geocoding with mixed success/failure results."""
        success_result = GeocodingResult(success=True, address=Address(full_address="Test"))
        failure_result = GeocodingResult(success=False, error="Geocoding failed")
        
        mock_geocoder_service.batch_geocode.return_value = [success_result, failure_result]
        
        with patch('lcfs.web.api.geocoder.views.get_geocoder_service_async', return_value=mock_geocoder_service):
            response = await client.post(
                "/api/geocoder/batch",
                json={
                    "addresses": ["Valid Address", "Invalid Address"],
                    "batch_size": 2
                }
            )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_processed"] == 2
        assert data["successful_count"] == 1
        assert data["failed_count"] == 1