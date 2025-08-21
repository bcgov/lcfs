"""
Tests for geocoder cache implementation.
"""

import pytest
import asyncio
import time
from unittest.mock import patch

from lcfs.services.geocoder.cache import GeocoderCache, CacheEntry, CacheDecorator


class TestGeocoderCache:
    """Test cases for geocoder cache."""

    def test_cache_initialization(self):
        """Test cache initialization."""
        cache = GeocoderCache(max_size=100, default_ttl=3600)
        assert cache.max_size == 100
        assert cache.default_ttl == 3600
        assert len(cache._cache) == 0

    def test_set_and_get(self):
        """Test basic set and get operations."""
        cache = GeocoderCache(max_size=10, default_ttl=3600)
        
        cache.set("test_key", "test_value")
        assert cache.get("test_key") == "test_value"
        
        # Test cache miss
        assert cache.get("nonexistent_key") is None

    def test_ttl_expiration(self):
        """Test TTL expiration."""
        cache = GeocoderCache(max_size=10, default_ttl=1)  # 1 second TTL
        
        cache.set("test_key", "test_value", ttl=1)
        assert cache.get("test_key") == "test_value"
        
        # Wait for expiration
        time.sleep(1.1)
        assert cache.get("test_key") is None

    def test_lru_eviction(self):
        """Test LRU eviction when cache is full."""
        cache = GeocoderCache(max_size=2, default_ttl=3600)
        
        cache.set("key1", "value1")
        cache.set("key2", "value2")
        
        # Access key1 to make it more recently used
        cache.get("key1")
        
        # Add key3, should evict key2 (least recently used)
        cache.set("key3", "value3")
        
        assert cache.get("key1") == "value1"
        assert cache.get("key2") is None  # Evicted
        assert cache.get("key3") == "value3"

    def test_delete(self):
        """Test cache deletion."""
        cache = GeocoderCache(max_size=10, default_ttl=3600)
        
        cache.set("test_key", "test_value")
        assert cache.get("test_key") == "test_value"
        
        assert cache.delete("test_key") is True
        assert cache.get("test_key") is None
        
        # Test deleting non-existent key
        assert cache.delete("nonexistent_key") is False

    def test_clear(self):
        """Test cache clearing."""
        cache = GeocoderCache(max_size=10, default_ttl=3600)
        
        cache.set("key1", "value1")
        cache.set("key2", "value2")
        
        cache.clear()
        assert cache.get("key1") is None
        assert cache.get("key2") is None
        assert len(cache._cache) == 0

    def test_cache_entry_access_tracking(self):
        """Test that cache entries track access count and time."""
        cache = GeocoderCache(max_size=10, default_ttl=3600)
        
        cache.set("test_key", "test_value")
        
        # Access the key multiple times
        cache.get("test_key")
        cache.get("test_key")
        cache.get("test_key")
        
        entry = cache._cache["test_key"]
        assert entry.access_count == 4  # 1 from set + 3 from gets
        assert entry.last_accessed is not None

    def test_generate_key(self):
        """Test cache key generation."""
        cache = GeocoderCache(max_size=10, default_ttl=3600)
        
        key1 = cache._generate_key("arg1", "arg2", kwarg1="value1")
        key2 = cache._generate_key("arg1", "arg2", kwarg1="value1")
        key3 = cache._generate_key("arg1", "arg3", kwarg1="value1")
        
        # Same arguments should generate same key
        assert key1 == key2
        
        # Different arguments should generate different key
        assert key1 != key3

    def test_cache_key_for_method(self):
        """Test method-specific cache key generation."""
        cache = GeocoderCache(max_size=10, default_ttl=3600)
        
        key = cache.cache_key_for_method("validate_address", "123 Main St", min_score=50)
        assert key.startswith("validate_address:")

    def test_get_stats(self):
        """Test cache statistics."""
        cache = GeocoderCache(max_size=10, default_ttl=3600)
        
        # Initial stats
        stats = cache.get_stats()
        assert stats["hits"] == 0
        assert stats["misses"] == 0
        assert stats["sets"] == 0
        assert stats["size"] == 0
        assert stats["hit_rate"] == 0
        
        # After some operations
        cache.set("key1", "value1")
        cache.get("key1")  # Hit
        cache.get("key2")  # Miss
        
        stats = cache.get_stats()
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["sets"] == 1
        assert stats["size"] == 1
        assert stats["hit_rate"] == 0.5

    def test_cleanup_expired_entries(self):
        """Test cleanup of expired entries."""
        cache = GeocoderCache(max_size=10, default_ttl=1, cleanup_interval=0.1)
        
        # Set entries with short TTL
        cache.set("key1", "value1", ttl=0.1)
        cache.set("key2", "value2", ttl=2)
        
        assert cache.get("key1") == "value1"
        assert cache.get("key2") == "value2"
        
        # Wait for key1 to expire
        time.sleep(0.2)
        
        # Manually trigger cleanup
        cache._cleanup_expired()
        
        assert cache.get("key1") is None  # Expired
        assert cache.get("key2") == "value2"  # Still valid

    @pytest.mark.asyncio
    async def test_cache_shutdown(self):
        """Test cache shutdown."""
        cache = GeocoderCache(max_size=10, default_ttl=3600, cleanup_interval=0.1)
        
        # Wait a bit for cleanup task to start
        await asyncio.sleep(0.05)
        
        # Shutdown should complete without errors
        await cache.shutdown()


class TestCacheDecorator:
    """Test cases for cache decorator."""

    @pytest.mark.asyncio
    async def test_cache_decorator_hit(self):
        """Test cache decorator with cache hit."""
        cache = GeocoderCache(max_size=10, default_ttl=3600)
        decorator = CacheDecorator(cache, ttl=3600)
        
        call_count = 0
        
        @decorator
        async def test_function(arg1, arg2="default"):
            nonlocal call_count
            call_count += 1
            return f"{arg1}_{arg2}_result"
        
        # First call should execute function and cache result
        result1 = await test_function("test", arg2="value")
        assert result1 == "test_value_result"
        assert call_count == 1
        
        # Second call should hit cache and not execute function
        result2 = await test_function("test", arg2="value")
        assert result2 == "test_value_result"
        assert call_count == 1  # Function not called again

    @pytest.mark.asyncio
    async def test_cache_decorator_miss(self):
        """Test cache decorator with cache miss."""
        cache = GeocoderCache(max_size=10, default_ttl=3600)
        decorator = CacheDecorator(cache, ttl=3600)
        
        call_count = 0
        
        @decorator
        async def test_function(arg):
            nonlocal call_count
            call_count += 1
            return f"{arg}_result"
        
        # Different arguments should result in different cache keys
        result1 = await test_function("test1")
        result2 = await test_function("test2")
        
        assert result1 == "test1_result"
        assert result2 == "test2_result"
        assert call_count == 2  # Function called twice

    @pytest.mark.asyncio
    async def test_cache_decorator_with_none_result(self):
        """Test cache decorator when function returns None."""
        cache = GeocoderCache(max_size=10, default_ttl=3600)
        decorator = CacheDecorator(cache, ttl=3600)
        
        call_count = 0
        
        @decorator
        async def test_function(arg):
            nonlocal call_count
            call_count += 1
            return None
        
        # Function returns None - should not be cached
        result1 = await test_function("test")
        result2 = await test_function("test")
        
        assert result1 is None
        assert result2 is None
        assert call_count == 2  # Function called twice (no caching of None)

    @pytest.mark.asyncio
    async def test_cache_decorator_with_prefix(self):
        """Test cache decorator with key prefix."""
        cache = GeocoderCache(max_size=10, default_ttl=3600)
        decorator = CacheDecorator(cache, ttl=3600, key_prefix="test_service")
        
        @decorator
        async def test_function(arg):
            return f"{arg}_result"
        
        await test_function("test")
        
        # Check that cache key has the prefix
        cache_keys = list(cache._cache.keys())
        assert len(cache_keys) == 1
        assert "test_service:test_function:" in cache_keys[0]