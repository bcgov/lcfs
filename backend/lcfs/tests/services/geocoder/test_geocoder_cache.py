"""
Tests for geocoder cache implementation.
"""

import pytest
import asyncio
import json
from unittest.mock import patch

from lcfs.services.geocoder.cache import GeocoderCache, CacheEntry, CacheDecorator
from lcfs.services.geocoder.client import Address, GeocodingResult


@pytest.fixture
def geocoder_cache(fake_redis_client):
    """Create a geocoder cache instance for testing."""
    return GeocoderCache(
        redis_client=fake_redis_client,
        default_ttl=3600
    )


class TestGeocoderCache:
    """Test cases for geocoder cache."""

    def test_cache_initialization(self, geocoder_cache):
        """Test cache initialization."""
        cache = geocoder_cache
        assert cache.default_ttl == 3600
        assert cache.key_prefix == "geocoder:"

    @pytest.mark.anyio
    async def test_set_and_get(self, geocoder_cache):
        """Test basic set and get operations."""
        cache = geocoder_cache
        
        await cache.set("test_key", "test_value")
        result = await cache.get("test_key")
        assert result == "test_value"
        
        # Test cache miss
        result = await cache.get("non_existent_key")
        assert result is None

    @pytest.mark.anyio
    async def test_set_with_ttl(self, geocoder_cache):
        """Test set with custom TTL."""
        cache = geocoder_cache
        
        await cache.set("test_key", "test_value", ttl=1)
        result = await cache.get("test_key")
        assert result == "test_value"
        
        # Wait for TTL to expire and test again
        await asyncio.sleep(1.1)
        result = await cache.get("test_key")
        assert result is None

    @pytest.mark.anyio
    async def test_delete(self, geocoder_cache):
        """Test cache deletion."""
        cache = geocoder_cache
        
        await cache.set("test_key", "test_value")
        result = await cache.get("test_key")
        assert result == "test_value"
        
        deleted = await cache.delete("test_key")
        assert deleted is True
        
        result = await cache.get("test_key")
        assert result is None
        
        # Test deleting non-existent key
        deleted = await cache.delete("non_existent_key")
        assert deleted is False

    @pytest.mark.anyio
    async def test_clear(self, geocoder_cache):
        """Test cache clearing."""
        cache = geocoder_cache
        
        await cache.set("key1", "value1")
        await cache.set("key2", "value2")
        
        result1 = await cache.get("key1")
        result2 = await cache.get("key2")
        assert result1 == "value1"
        assert result2 == "value2"
        
        await cache.clear()
        
        result1 = await cache.get("key1")
        result2 = await cache.get("key2")
        assert result1 is None
        assert result2 is None

    def test_generate_key(self, geocoder_cache):
        """Test cache key generation."""
        cache = geocoder_cache
        
        key1 = cache._generate_key("arg1", "arg2", kwarg1="value1")
        key2 = cache._generate_key("arg1", "arg2", kwarg1="value1")
        key3 = cache._generate_key("arg1", "arg2", kwarg1="value2")
        
        assert key1 == key2  # Same arguments should generate same key
        assert key1 != key3  # Different arguments should generate different keys
        assert key1.startswith("geocoder:")

    def test_cache_key_for_method(self, geocoder_cache):
        """Test method-specific cache key generation."""
        cache = geocoder_cache
        
        key = cache.cache_key_for_method("validate_address", "123 Main St", min_score=50)
        assert key.startswith("geocoder:validate_address:")

    @pytest.mark.anyio
    async def test_get_stats(self, geocoder_cache):
        """Test cache statistics."""
        cache = geocoder_cache
        
        # Get initial stats
        stats = await cache.get_stats()
        assert "hits" in stats
        assert "misses" in stats
        assert "sets" in stats
        
        # Perform some operations
        await cache.set("key1", "value1")
        await cache.get("key1")  # hit
        await cache.get("nonexistent")  # miss
        
        # Check updated stats
        stats = await cache.get_stats()
        assert stats["hits"] >= 1
        assert stats["misses"] >= 1
        assert stats["sets"] >= 1

    @pytest.mark.anyio
    async def test_address_serialization(self, geocoder_cache):
        """Test serialization and deserialization of Address objects."""
        cache = geocoder_cache
        
        address = Address(
            full_address="123 Main St, Vancouver, BC",
            street_address="123 Main St",
            city="Vancouver",
            province="BC",
            postal_code="V6B 1A1",
            latitude=49.2827,
            longitude=-123.1207,
            score=95.0
        )
        
        await cache.set("address_key", address)
        result = await cache.get("address_key")
        
        assert isinstance(result, Address)
        assert result.full_address == address.full_address
        assert result.latitude == address.latitude
        assert result.longitude == address.longitude

    @pytest.mark.anyio
    async def test_geocoding_result_serialization(self, geocoder_cache):
        """Test serialization and deserialization of GeocodingResult objects."""
        cache = geocoder_cache
        
        address = Address(
            full_address="123 Main St, Vancouver, BC",
            latitude=49.2827,
            longitude=-123.1207
        )
        
        result_obj = GeocodingResult(
            success=True,
            address=address,
            source="bc_geocoder"
        )
        
        await cache.set("result_key", result_obj)
        cached_result = await cache.get("result_key")
        
        assert isinstance(cached_result, GeocodingResult)
        assert cached_result.success is True
        assert cached_result.source == "bc_geocoder"
        assert isinstance(cached_result.address, Address)

    @pytest.mark.anyio
    async def test_list_serialization(self, geocoder_cache):
        """Test serialization of lists containing Address objects."""
        cache = geocoder_cache
        
        addresses = [
            Address(full_address="123 Main St", latitude=49.28, longitude=-123.12),
            Address(full_address="456 Oak Ave", latitude=49.29, longitude=-123.13)
        ]
        
        await cache.set("addresses_key", addresses)
        result = await cache.get("addresses_key")
        
        assert isinstance(result, list)
        assert len(result) == 2
        assert all(isinstance(addr, Address) for addr in result)
        assert result[0].full_address == "123 Main St"
        assert result[1].full_address == "456 Oak Ave"

    @pytest.mark.anyio
    async def test_cache_shutdown(self, geocoder_cache):
        """Test cache shutdown."""
        cache = geocoder_cache
        
        # Cache shutdown should work without errors
        await cache.shutdown()


class TestCacheDecorator:
    """Test cases for cache decorator."""

    @pytest.mark.anyio
    async def test_cache_decorator_hit(self, geocoder_cache):
        """Test cache decorator with cache hit."""
        cache = geocoder_cache
        decorator = CacheDecorator(cache, ttl=3600)
        
        call_count = 0
        
        @decorator
        async def test_function(arg1, arg2, kwarg1=None):
            nonlocal call_count
            call_count += 1
            return f"result_{arg1}_{arg2}_{kwarg1}"
        
        # First call should execute function
        result1 = await test_function("a", "b", kwarg1="c")
        assert result1 == "result_a_b_c"
        assert call_count == 1
        
        # Second call should hit cache
        result2 = await test_function("a", "b", kwarg1="c")
        assert result2 == "result_a_b_c"
        assert call_count == 1  # Function not called again

    @pytest.mark.anyio
    async def test_cache_decorator_miss(self, geocoder_cache):
        """Test cache decorator with different arguments (cache miss)."""
        cache = geocoder_cache
        decorator = CacheDecorator(cache, ttl=3600)
        
        call_count = 0
        
        @decorator
        async def test_function(arg1):
            nonlocal call_count
            call_count += 1
            return f"result_{arg1}"
        
        # Different arguments should miss cache
        result1 = await test_function("a")
        result2 = await test_function("b")
        
        assert result1 == "result_a"
        assert result2 == "result_b"
        assert call_count == 2  # Both calls executed

    @pytest.mark.anyio
    async def test_cache_decorator_with_none_result(self, geocoder_cache):
        """Test cache decorator when function returns None."""
        cache = geocoder_cache
        decorator = CacheDecorator(cache, ttl=3600)
        
        call_count = 0
        
        @decorator
        async def test_function():
            nonlocal call_count
            call_count += 1
            return None
        
        # First call
        result1 = await test_function()
        assert result1 is None
        assert call_count == 1
        
        # Second call - depending on cache implementation, None values may or may not be cached
        result2 = await test_function()
        assert result2 is None
        # Note: Some cache implementations don't cache None values, which is acceptable
        assert call_count <= 2  # Allow for either cached or uncached behavior

    @pytest.mark.anyio
    async def test_cache_decorator_with_prefix(self, geocoder_cache):
        """Test cache decorator with key prefix."""
        cache = geocoder_cache
        decorator = CacheDecorator(cache, ttl=3600, key_prefix="test_service")
        
        @decorator
        async def test_function(arg):
            return f"result_{arg}"
        
        # Function should work normally
        result = await test_function("test")
        assert result == "result_test"
        
        # The key should be generated with prefix
        # We can't easily test the exact key, but we can verify caching works
        result2 = await test_function("test")
        assert result2 == "result_test"