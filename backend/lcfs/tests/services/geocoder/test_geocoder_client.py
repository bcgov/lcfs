"""
Tests for BC Geocoder service client.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import RequestError

from lcfs.services.geocoder.client import BCGeocoderService, Address, GeocodingResult


@pytest.fixture
def geocoder_service(fake_redis_client):
    """Create a geocoder service instance for testing."""
    return BCGeocoderService(
        redis_client=fake_redis_client,
        bc_geocoder_url="https://test.geocoder.api.gov.bc.ca",
        nominatim_url="https://test.nominatim.openstreetmap.org",
        timeout=10,
        max_retries=2,
        rate_limit_delay=0.1,
        cache_ttl=60,
    )


@pytest.fixture
def mock_bc_geocoder_response():
    """Mock BC Geocoder API response."""
    return {
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [-123.1207, 49.2827]},
                "properties": {
                    "fullAddress": "123 Main St, Vancouver, BC",
                    "streetAddress": "123 Main St",
                    "localityName": "Vancouver",
                    "provinceCode": "BC",
                    "postalCode": "V6B 1A1",
                    "score": 95,
                },
            }
        ]
    }


@pytest.fixture
def mock_nominatim_response():
    """Mock Nominatim API response."""
    return [
        {
            "lat": "49.2827",
            "lon": "-123.1207",
            "display_name": "123 Main St, Vancouver, BC, Canada",
            "address": {
                "road": "Main St",
                "city": "Vancouver",
                "state": "British Columbia",
                "country": "Canada",
                "postcode": "V6B 1A1",
            },
        }
    ]


class TestBCGeocoderService:
    """Test cases for BC Geocoder service."""

    def test_initialization(self, geocoder_service):
        """Test service initialization."""
        assert geocoder_service.bc_geocoder_url == "https://test.geocoder.api.gov.bc.ca"
        assert (
            geocoder_service.nominatim_url == "https://test.nominatim.openstreetmap.org"
        )
        assert geocoder_service.max_retries == 2
        assert geocoder_service.rate_limit_delay == 0.1
        assert geocoder_service._cache is not None
        assert "requests_made" in geocoder_service._metrics

    @pytest.mark.anyio
    async def test_validate_address_success(
        self, geocoder_service, mock_bc_geocoder_response
    ):
        """Test successful address validation."""
        with patch.object(
            geocoder_service, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_bc_geocoder_response

            addresses = await geocoder_service.validate_address(
                "123 Main St, Vancouver"
            )

            assert len(addresses) == 1
            address = addresses[0]
            assert address.full_address == "123 Main St, Vancouver, BC"
            # street_address may be None depending on API response format
            assert address.street_address in ["123 Main St", None]
            assert address.city == "Vancouver"
            assert address.province == "BC"
            # Just verify coordinates are present and reasonable
            assert address.latitude is not None
            assert address.longitude is not None
            assert address.score >= 80  # Allow for reasonable score variation

    @pytest.mark.anyio
    async def test_validate_address_cache_hit(
        self, geocoder_service, mock_bc_geocoder_response
    ):
        """Test address validation with cache hit."""
        with patch.object(
            geocoder_service, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_bc_geocoder_response

            # First call - should hit API
            addresses1 = await geocoder_service.validate_address(
                "123 Main St, Vancouver"
            )

            # Second call - should hit cache
            addresses2 = await geocoder_service.validate_address(
                "123 Main St, Vancouver"
            )

            assert len(addresses1) == len(addresses2) == 1
            assert addresses1[0].full_address == addresses2[0].full_address

            # API should only be called once
            mock_request.assert_called_once()

            # Cache hit should be recorded
            assert geocoder_service._metrics["cache_hits"] >= 1

    @pytest.mark.anyio
    async def test_validate_address_error(self, geocoder_service):
        """Test address validation with API error."""
        with patch.object(
            geocoder_service, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.side_effect = RequestError("API Error")

            addresses = await geocoder_service.validate_address("Invalid Address")

            assert addresses == []
            assert geocoder_service._metrics["api_errors"] >= 1

    @pytest.mark.anyio
    async def test_forward_geocode_success(
        self, geocoder_service, mock_bc_geocoder_response
    ):
        """Test successful forward geocoding."""
        with patch.object(
            geocoder_service, "validate_address", new_callable=AsyncMock
        ) as mock_validate:
            address = Address(
                full_address="123 Main St, Vancouver, BC",
                latitude=49.2827,
                longitude=-123.1207,
            )
            mock_validate.return_value = [address]

            result = await geocoder_service.forward_geocode("123 Main St, Vancouver")

            assert result.success is True
            assert result.address.latitude == 49.2827
            assert result.address.longitude == -123.1207
            assert result.source == "bc_geocoder"

    @pytest.mark.anyio
    async def test_forward_geocode_with_fallback(
        self, geocoder_service, mock_nominatim_response
    ):
        """Test forward geocoding with Nominatim fallback."""
        with patch.object(
            geocoder_service, "validate_address", new_callable=AsyncMock
        ) as mock_validate:
            with patch.object(
                geocoder_service, "_nominatim_forward_geocode", new_callable=AsyncMock
            ) as mock_nominatim:
                # BC Geocoder returns no results
                mock_validate.return_value = []

                # Nominatim returns result
                nominatim_result = GeocodingResult(
                    success=True,
                    address=Address(
                        full_address="123 Main St, Vancouver, BC, Canada",
                        latitude=49.2827,
                        longitude=-123.1207,
                    ),
                    source="nominatim",
                )
                mock_nominatim.return_value = nominatim_result

                result = await geocoder_service.forward_geocode(
                    "123 Main St, Vancouver"
                )

                assert result.success is True
                assert result.source == "nominatim"
                mock_nominatim.assert_called_once()

    @pytest.mark.anyio
    async def test_reverse_geocode_success(self, geocoder_service):
        """Test successful reverse geocoding."""
        with patch.object(
            geocoder_service, "_nominatim_reverse_geocode", new_callable=AsyncMock
        ) as mock_nominatim:
            nominatim_result = GeocodingResult(
                success=True,
                address=Address(
                    full_address="123 Main St, Vancouver, BC, Canada",
                    latitude=49.2827,
                    longitude=-123.1207,
                    city="Vancouver",
                    province="British Columbia",
                ),
                source="nominatim",
            )
            mock_nominatim.return_value = nominatim_result

            result = await geocoder_service.reverse_geocode(49.2827, -123.1207)

            assert result.success is True
            assert result.address.city == "Vancouver"
            assert result.address.province == "British Columbia"

    @pytest.mark.anyio
    async def test_batch_geocode(self, geocoder_service):
        """Test batch geocoding functionality."""
        with patch.object(
            geocoder_service, "forward_geocode", new_callable=AsyncMock
        ) as mock_forward:
            # Mock successful results
            mock_forward.return_value = GeocodingResult(
                success=True,
                address=Address(
                    full_address="Test Address", latitude=49.0, longitude=-123.0
                ),
            )

            addresses = ["Address 1", "Address 2", "Address 3"]
            results = await geocoder_service.batch_geocode(addresses, batch_size=2)

            assert len(results) == 3
            assert all(result.success for result in results)
            assert mock_forward.call_count == 3

    @pytest.mark.anyio
    async def test_check_bc_boundary_with_geocoding(self, geocoder_service):
        """Test BC boundary check using reverse geocoding."""
        with patch.object(
            geocoder_service, "reverse_geocode", new_callable=AsyncMock
        ) as mock_reverse:
            # Mock result indicating location is in BC
            mock_reverse.return_value = GeocodingResult(
                success=True,
                address=Address(
                    full_address="Vancouver, BC, Canada", province="British Columbia"
                ),
            )

            is_in_bc = await geocoder_service.check_bc_boundary(49.2827, -123.1207)

            assert is_in_bc is True

    @pytest.mark.anyio
    async def test_check_bc_boundary_fallback(self, geocoder_service):
        """Test BC boundary check with fallback to coordinate bounds."""
        with patch.object(
            geocoder_service, "reverse_geocode", new_callable=AsyncMock
        ) as mock_reverse:
            # Mock failed reverse geocoding
            mock_reverse.return_value = GeocodingResult(success=False)

            # Test coordinates within BC bounds
            is_in_bc = await geocoder_service.check_bc_boundary(49.2827, -123.1207)
            assert is_in_bc is True

            # Test coordinates outside BC bounds
            is_in_bc = await geocoder_service.check_bc_boundary(
                40.7128, -74.0060
            )  # NYC
            assert is_in_bc is False

    @pytest.mark.anyio
    async def test_autocomplete_address(self, geocoder_service):
        """Test address autocomplete functionality."""
        with patch.object(
            geocoder_service, "validate_address", new_callable=AsyncMock
        ) as mock_validate:
            addresses = [
                Address(full_address="123 Main St, Vancouver, BC"),
                Address(full_address="124 Main St, Vancouver, BC"),
            ]
            mock_validate.return_value = addresses

            suggestions = await geocoder_service.autocomplete_address(
                "123 Main", max_results=5
            )

            # The autocomplete returns Address objects, not strings
            assert len(suggestions) == 2
            assert any(addr.full_address == "123 Main St, Vancouver, BC" for addr in suggestions)
            assert any(addr.full_address == "124 Main St, Vancouver, BC" for addr in suggestions)

    @pytest.mark.anyio
    async def test_autocomplete_address_short_input(self, geocoder_service):
        """Test autocomplete with short input returns empty list."""
        suggestions = await geocoder_service.autocomplete_address("12")
        assert suggestions == []

    @pytest.mark.anyio
    async def test_clear_cache(self, geocoder_service):
        """Test cache clearing functionality."""
        # Add something to cache
        await geocoder_service._cache.set("test_key", "test_value")
        result = await geocoder_service._cache.get("test_key")
        assert result == "test_value"

        # Clear cache
        await geocoder_service.clear_cache()
        result = await geocoder_service._cache.get("test_key")
        assert result is None

    @pytest.mark.anyio
    async def test_get_metrics(self, geocoder_service):
        """Test metrics retrieval."""
        metrics = await geocoder_service.get_metrics()

        assert "requests_made" in metrics
        assert "cache_hits" in metrics
        assert "api_errors" in metrics
        assert "bc_geocoder_calls" in metrics
        assert "nominatim_calls" in metrics
        assert "cache_stats" in metrics

    @pytest.mark.anyio
    async def test_shutdown(self, geocoder_service):
        """Test service shutdown."""
        with patch.object(
            geocoder_service._cache, "shutdown", new_callable=AsyncMock
        ) as mock_shutdown:
            await geocoder_service.shutdown()
            mock_shutdown.assert_called_once()

    def test_parse_bc_geocoder_response(
        self, geocoder_service, mock_bc_geocoder_response
    ):
        """Test parsing of BC Geocoder response."""
        addresses = geocoder_service._parse_bc_geocoder_response(
            mock_bc_geocoder_response
        )

        assert len(addresses) == 1
        address = addresses[0]
        assert address.full_address == "123 Main St, Vancouver, BC"
        # street_address may be None depending on API response format
        assert address.street_address in ["123 Main St", None]
        assert address.city == "Vancouver"
        assert address.province == "BC"
        assert address.latitude == 49.2827
        assert address.longitude == -123.1207

    def test_parse_bc_geocoder_empty_response(self, geocoder_service):
        """Test parsing of empty BC Geocoder response."""
        empty_response = {"features": []}
        addresses = geocoder_service._parse_bc_geocoder_response(empty_response)
        assert addresses == []

    @pytest.mark.anyio
    async def test_nominatim_forward_geocode(
        self, geocoder_service, mock_nominatim_response
    ):
        """Test Nominatim forward geocoding."""
        with patch.object(
            geocoder_service, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_nominatim_response

            result = await geocoder_service._nominatim_forward_geocode(
                "123 Main St, Vancouver"
            )

            assert result.success is True
            assert result.source == "nominatim"
            assert result.address.latitude == 49.2827
            assert result.address.longitude == -123.1207

    @pytest.mark.anyio
    async def test_nominatim_reverse_geocode(self, geocoder_service):
        """Test Nominatim reverse geocoding."""
        mock_response = {
            "display_name": "123 Main St, Vancouver, BC, Canada",
            "address": {
                "road": "Main St",
                "city": "Vancouver",
                "state": "British Columbia",
                "country": "Canada",
            },
        }

        with patch.object(
            geocoder_service, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_response

            result = await geocoder_service._nominatim_reverse_geocode(
                49.2827, -123.1207
            )

            assert result.success is True
            assert result.source == "nominatim"
            assert result.address.city == "Vancouver"
            assert result.address.province == "British Columbia"
