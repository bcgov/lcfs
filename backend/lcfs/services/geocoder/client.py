"""
BC Geocoder service client for handling all geocoding operations.

This service provides a unified interface for:
- Address validation and standardization
- Forward geocoding (address to coordinates)
- Reverse geocoding (coordinates to address)
- Batch geocoding operations
- Address autocomplete functionality
"""

import asyncio
import logging
from typing import List, Optional, Dict, Any, Union, Tuple
from dataclasses import dataclass
from urllib.parse import urlencode
import httpx

from .cache import GeocoderCache, CacheDecorator
from redis.asyncio import Redis

logger = logging.getLogger(__name__)


@dataclass
class Address:
    """Standardized address representation."""
    full_address: str
    street_address: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    score: Optional[float] = None


@dataclass
class GeocodingResult:
    """Result of a geocoding operation."""
    success: bool
    address: Optional[Address] = None
    error: Optional[str] = None
    source: Optional[str] = None


class BCGeocoderService:
    """
    BC Geocoder service client for handling all geocoding operations in LCFS.
    
    This service consolidates access to the BC Geocoder API and provides:
    - Address validation and standardization
    - Forward and reverse geocoding
    - Batch processing capabilities
    - Caching and retry logic
    """

    def __init__(
        self,
        redis_client: Redis,
        bc_geocoder_url: str = "https://geocoder.api.gov.bc.ca",
        nominatim_url: str = "https://nominatim.openstreetmap.org",
        timeout: int = 30,
        max_retries: int = 3,
        rate_limit_delay: float = 1.0,
        user_agent: str = "LCFS/1.0 (lcfs@gov.bc.ca)",
        cache_ttl: int = 3600,
        api_key: Optional[str] = None
    ):
        """
        Initialize the BC Geocoder service.
        
        Args:
            redis_client: Redis client for caching
            bc_geocoder_url: Base URL for BC Geocoder API
            nominatim_url: Base URL for Nominatim API (fallback)
            timeout: Request timeout in seconds
            max_retries: Maximum number of retry attempts
            rate_limit_delay: Delay between requests in seconds
            user_agent: User agent string for API requests
            cache_ttl: Cache TTL in seconds
            api_key: Optional BC Geocoder API key for authenticated access
        """
        self.bc_geocoder_url = bc_geocoder_url.rstrip('/')
        self.nominatim_url = nominatim_url.rstrip('/')
        self.timeout = timeout
        self.max_retries = max_retries
        self.rate_limit_delay = rate_limit_delay
        self.user_agent = user_agent
        
        # Store API key for BC Geocoder requests
        self.api_key = api_key
        
        # Initialize Redis-based caching
        self._cache = GeocoderCache(
            redis_client=redis_client,
            default_ttl=cache_ttl
        )
        
        # Performance metrics
        self._metrics = {
            "requests_made": 0,
            "cache_hits": 0,
            "api_errors": 0,
            "bc_geocoder_calls": 0,
            "nominatim_calls": 0
        }
        
        logger.info(
            f"Initialized BC Geocoder service with Redis cache: "
            f"ttl={cache_ttl}s, api_key={'set' if api_key else 'none'}"
        )

    async def validate_address(
        self,
        address_string: str,
        min_score: int = 50,
        max_results: int = 5
    ) -> List[Address]:
        """
        Validate and standardize an address using BC Geocoder API.
        
        Args:
            address_string: The address string to validate
            min_score: Minimum confidence score (0-100)
            max_results: Maximum number of results to return
            
        Returns:
            List of validated Address objects
        """
        cache_key = self._cache.cache_key_for_method(
            "validate_address", address_string, min_score, max_results
        )
        
        cached_result = await self._cache.get(cache_key)
        if cached_result is not None:
            self._metrics["cache_hits"] += 1
            logger.debug(f"Cache hit for address validation: {address_string[:50]}...")
            return cached_result

        self._metrics["requests_made"] += 1
        self._metrics["bc_geocoder_calls"] += 1
        
        # Build proper BC Geocoder API parameters
        params = {
            "addressString": address_string,
            "minScore": min_score,
            "maxResults": max_results,
            "echo": "true",
            "brief": "false",
            "autoComplete": "true",
            "locationDescriptor": "any",
            "setBack": "0",
            "outputSRS": "4326",
            "interpolation": "adaptive"
        }
        
        # Add API key if available
        if self.api_key:
            params["apikey"] = self.api_key

        url = f"{self.bc_geocoder_url}/addresses.json"
        
        try:
            logger.debug(f"Validating address: {address_string[:50]}... (score>={min_score})")
            result = await self._make_request(url, params)
            addresses = self._parse_bc_geocoder_response(result)
            
            # Cache successful results
            if addresses:
                await self._cache.set(cache_key, addresses)
                logger.debug(f"Cached {len(addresses)} addresses for: {address_string[:50]}...")
            
            return addresses
        except Exception as e:
            self._metrics["api_errors"] += 1
            logger.error(f"Address validation failed for '{address_string}': {e}")
            return []

    async def forward_geocode(
        self,
        address_string: str,
        use_fallback: bool = True
    ) -> GeocodingResult:
        """
        Convert an address to coordinates (forward geocoding).
        
        Args:
            address_string: The address to geocode
            use_fallback: Whether to use Nominatim as fallback
            
        Returns:
            GeocodingResult with coordinates
        """
        cache_key = f"forward:{address_string}"
        cached_result = await self._cache.get(cache_key)
        if cached_result is not None:
            return cached_result

        # Try BC Geocoder first
        addresses = await self.validate_address(address_string, min_score=50, max_results=1)
        
        if addresses and addresses[0].latitude and addresses[0].longitude:
            result = GeocodingResult(
                success=True,
                address=addresses[0],
                source="bc_geocoder"
            )
            await self._cache.set(cache_key, result)
            return result

        # Fallback to Nominatim if enabled
        if use_fallback:
            try:
                result = await self._nominatim_forward_geocode(address_string)
                await self._cache.set(cache_key, result)
                return result
            except Exception as e:
                logger.warning(f"Nominatim fallback failed for '{address_string}': {e}")

        result = GeocodingResult(
            success=False,
            error=f"No coordinates found for address: {address_string}"
        )
        self._cache[cache_key] = result
        return result

    async def reverse_geocode(
        self,
        latitude: float,
        longitude: float,
        use_fallback: bool = True
    ) -> GeocodingResult:
        """
        Convert coordinates to an address (reverse geocoding).
        
        Args:
            latitude: Latitude coordinate
            longitude: Longitude coordinate
            use_fallback: Whether to use Nominatim as fallback
            
        Returns:
            GeocodingResult with address information
        """
        cache_key = f"reverse:{latitude}:{longitude}"
        cached_result = await self._cache.get(cache_key)
        if cached_result is not None:
            return cached_result

        # BC Geocoder doesn't have a reverse geocoding endpoint
        # Use Nominatim for reverse geocoding
        try:
            result = await self._nominatim_reverse_geocode(latitude, longitude)
            await self._cache.set(cache_key, result)
            return result
        except Exception as e:
            logger.error(f"Reverse geocoding failed: {e}")
            result = GeocodingResult(
                success=False,
                error=f"Reverse geocoding failed: {e}"
            )
            await self._cache.set(cache_key, result)
            return result

    async def batch_geocode(
        self,
        addresses: List[str],
        batch_size: int = 5
    ) -> List[GeocodingResult]:
        """
        Perform batch geocoding of multiple addresses.
        
        Args:
            addresses: List of address strings to geocode
            batch_size: Number of addresses to process concurrently
            
        Returns:
            List of GeocodingResult objects
        """
        results = []
        
        for i in range(0, len(addresses), batch_size):
            batch = addresses[i:i + batch_size]
            
            # Process batch concurrently
            batch_tasks = [self.forward_geocode(addr) for addr in batch]
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            
            for result in batch_results:
                if isinstance(result, Exception):
                    results.append(GeocodingResult(
                        success=False,
                        error=str(result)
                    ))
                else:
                    results.append(result)
            
            # Rate limiting
            if i + batch_size < len(addresses):
                await asyncio.sleep(self.rate_limit_delay)
        
        return results

    async def check_bc_boundary(
        self,
        latitude: float,
        longitude: float
    ) -> bool:
        """
        Check if coordinates are within BC boundaries.
        
        Args:
            latitude: Latitude coordinate
            longitude: Longitude coordinate
            
        Returns:
            True if coordinates are within BC, False otherwise
        """
        # First try reverse geocoding to get precise location
        result = await self.reverse_geocode(latitude, longitude)
        
        if result.success and result.address:
            province = result.address.province or ""
            return "british columbia" in province.lower()
        
        # Fallback to rough boundary check
        # BC approximate boundaries: 48°N to 60°N, 114°W to 139°W
        return (48.0 <= latitude <= 60.0 and 
                -139.0 <= longitude <= -114.0)

    async def autocomplete_address(
        self,
        partial_address: str,
        max_results: int = 5
    ) -> List[Address]:
        """
        Get address autocomplete suggestions.
        
        Args:
            partial_address: Partial address string
            max_results: Maximum number of suggestions
            
        Returns:
            List of Address objects
        """
        if len(partial_address) < 3:
            return []

        addresses = await self.validate_address(
            partial_address,
            min_score=25,  # Lower score for autocomplete
            max_results=max_results
        )
        
        return addresses

    async def clear_cache(self):
        """Clear the internal cache."""
        await self._cache.clear()
        logger.info("Geocoder cache cleared")
    
    async def get_metrics(self) -> Dict[str, Any]:
        """Get service performance metrics."""
        cache_stats = await self._cache.get_stats()
        return {
            **self._metrics,
            "cache_stats": cache_stats
        }
    
    async def shutdown(self):
        """Shutdown the service and cleanup resources."""
        await self._cache.shutdown()
        logger.info("BC Geocoder service shutdown complete")

    def _build_street_address_from_properties(self, properties: Dict[str, Any]) -> Optional[str]:
        """Build street address from BC Geocoder response properties."""
        parts = []
        
        # Add civic number
        civic_number = properties.get("civicNumber")
        if civic_number:
            civic = str(civic_number)
            civic_suffix = properties.get("civicNumberSuffix")
            if civic_suffix:
                civic += civic_suffix
            parts.append(civic)
        
        # Add street name and type
        street_parts = []
        street_name = properties.get("streetName")
        if street_name:
            street_parts.append(street_name)
        
        street_type = properties.get("streetType")
        if street_type:
            street_parts.append(street_type)
        
        street_direction = properties.get("streetDirection")
        if street_direction:
            street_parts.append(street_direction)
            
        if street_parts:
            parts.append(' '.join(street_parts))
        
        return ' '.join(parts) if parts else None

    async def _make_request(
        self,
        url: str,
        params: Dict[str, Any],
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Make an HTTP request with retry logic."""
        default_headers = {"User-Agent": self.user_agent}
        if headers:
            default_headers.update(headers)

        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.get(
                        url,
                        params=params,
                        headers=default_headers
                    )
                    response.raise_for_status()
                    return response.json()
            except Exception as e:
                if attempt == self.max_retries - 1:
                    raise e
                await asyncio.sleep(self.rate_limit_delay * (attempt + 1))

    def _parse_bc_geocoder_response(self, response: Dict[str, Any]) -> List[Address]:
        """Parse BC Geocoder API response into Address objects."""
        addresses = []
        
        features = response.get("features", [])
        for feature in features:
            properties = feature.get("properties", {})
            geometry = feature.get("geometry", {})
            coordinates = geometry.get("coordinates", [])
            
            # Build street address from components (BC Geocoder provides detailed breakdown)
            street_address = self._build_street_address_from_properties(properties)
            
            address = Address(
                full_address=properties.get("fullAddress", ""),
                street_address=street_address,
                city=properties.get("localityName"),
                province=properties.get("provinceCode"),
                postal_code=properties.get("postalCode") or properties.get("postal_code"),
                country="Canada",
                latitude=coordinates[1] if len(coordinates) >= 2 else None,
                longitude=coordinates[0] if len(coordinates) >= 2 else None,
                score=float(properties.get("score", 0))
            )
            
            if address.full_address:
                addresses.append(address)
        
        return addresses

    async def _nominatim_forward_geocode(self, address_string: str) -> GeocodingResult:
        """Forward geocode using Nominatim API."""
        self._metrics["nominatim_calls"] += 1
        logger.debug(f"Using Nominatim fallback for: {address_string[:50]}...")
        
        params = {
            "q": address_string,
            "format": "json",
            "limit": 1,
            "addressdetails": 1
        }
        
        url = f"{self.nominatim_url}/search"
        response = await self._make_request(url, params)
        
        if not response:
            return GeocodingResult(
                success=False,
                error="No results from Nominatim"
            )
        
        result = response[0]
        address = Address(
            full_address=result.get("display_name", ""),
            latitude=float(result.get("lat", 0)),
            longitude=float(result.get("lon", 0)),
            city=result.get("address", {}).get("city"),
            province=result.get("address", {}).get("state"),
            country=result.get("address", {}).get("country")
        )
        
        return GeocodingResult(
            success=True,
            address=address,
            source="nominatim"
        )

    async def _nominatim_reverse_geocode(
        self,
        latitude: float,
        longitude: float
    ) -> GeocodingResult:
        """Reverse geocode using Nominatim API."""
        self._metrics["nominatim_calls"] += 1
        logger.debug("Reverse geocoding with Nominatim invoked.")
        
        params = {
            "lat": latitude,
            "lon": longitude,
            "format": "json",
            "zoom": 10,
            "addressdetails": 1
        }
        
        url = f"{self.nominatim_url}/reverse"
        response = await self._make_request(url, params)
        
        if not response:
            return GeocodingResult(
                success=False,
                error="No results from Nominatim reverse geocoding"
            )
        
        addr_details = response.get("address", {})
        address = Address(
            full_address=response.get("display_name", ""),
            latitude=latitude,
            longitude=longitude,
            street_address=addr_details.get("road"),
            city=addr_details.get("city") or addr_details.get("town") or addr_details.get("village"),
            province=addr_details.get("state") or addr_details.get("province"),
            country=addr_details.get("country"),
            postal_code=addr_details.get("postcode")
        )
        
        return GeocodingResult(
            success=True,
            address=address,
            source="nominatim"
        )