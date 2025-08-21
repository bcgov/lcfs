"""
Redis-based caching implementation for BC Geocoder service.
"""

import time
import asyncio
import json
import hashlib
from typing import Any, Optional, Dict, Union, List
from dataclasses import dataclass, asdict, is_dataclass
from datetime import datetime, timedelta
import logging
from redis.asyncio import Redis
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """Cache entry with metadata."""
    value: Any
    created_at: float
    expires_at: Optional[float] = None
    access_count: int = 0
    last_accessed: Optional[float] = None


class GeocoderCache:
    """
    Redis-based caching implementation for geocoder service.
    
    Features:
    - TTL (Time-To-Live) support with Redis expiration
    - Distributed cache shared across service instances
    - Statistics tracking
    - JSON-serializable cache entries for better compatibility
    - Redis connection management with fallback
    """
    
    def __init__(
        self,
        redis_client: Redis,
        default_ttl: int = 3600,  # 1 hour
        key_prefix: str = "geocoder:"
    ):
        """
        Initialize the Redis-based cache.
        
        Args:
            redis_client: Redis client instance
            default_ttl: Default TTL in seconds
            key_prefix: Prefix for Redis keys
        """
        self.redis_client = redis_client
        self.default_ttl = default_ttl
        self.key_prefix = key_prefix
        
        # Stats are kept in Redis for persistence and sharing
        self.stats_key = f"{self.key_prefix}stats"
    
    def _generate_key(self, *args, **kwargs) -> str:
        """Generate a cache key from arguments."""
        key_data = {
            "args": args,
            "kwargs": kwargs
        }
        key_string = json.dumps(key_data, sort_keys=True, default=str)
        hash_key = hashlib.md5(key_string.encode()).hexdigest()
        return f"{self.key_prefix}{hash_key}"
    
    async def _increment_stat(self, stat_name: str, amount: int = 1) -> None:
        """Increment a statistic in Redis."""
        try:
            await self.redis_client.hincrby(self.stats_key, stat_name, amount)
        except RedisError as e:
            logger.warning(f"Failed to update stat {stat_name}: {e}")
    
    def _serialize_value(self, value: Any) -> str:
        """Serialize a value to JSON string, handling dataclasses."""
        # Import here to avoid circular dependency
        from .client import Address, GeocodingResult
        
        if isinstance(value, list):
            # Handle list of Address objects
            serialized_list = []
            for item in value:
                if isinstance(item, Address):
                    serialized_list.append({
                        "type": "Address",
                        "data": asdict(item)
                    })
                else:
                    serialized_list.append(item)
            return json.dumps(serialized_list)
        elif isinstance(value, Address):
            return json.dumps({
                "type": "Address",
                "data": asdict(value)
            })
        elif isinstance(value, GeocodingResult):
            return json.dumps({
                "type": "GeocodingResult",
                "data": {
                    "success": value.success,
                    "address": asdict(value.address) if value.address else None,
                    "error": value.error,
                    "source": value.source
                }
            })
        elif is_dataclass(value):
            return json.dumps({
                "type": "dataclass",
                "data": asdict(value)
            })
        else:
            return json.dumps(value, default=str)
    
    def _deserialize_value(self, serialized: str) -> Any:
        """Deserialize a JSON string back to original type."""
        # Import here to avoid circular dependency
        from .client import Address, GeocodingResult
        
        try:
            data = json.loads(serialized)
            
            # Handle list of objects
            if isinstance(data, list):
                result = []
                for item in data:
                    if isinstance(item, dict) and "type" in item:
                        if item["type"] == "Address":
                            result.append(Address(**item["data"]))
                        else:
                            result.append(item)
                    else:
                        result.append(item)
                return result
            
            # Handle single objects
            if isinstance(data, dict) and "type" in data:
                if data["type"] == "Address":
                    return Address(**data["data"])
                elif data["type"] == "GeocodingResult":
                    address_data = data["data"].get("address")
                    return GeocodingResult(
                        success=data["data"]["success"],
                        address=Address(**address_data) if address_data else None,
                        error=data["data"].get("error"),
                        source=data["data"].get("source")
                    )
                elif data["type"] == "dataclass":
                    return data["data"]
            
            return data
            
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to deserialize JSON: {e}")
            return None
    
    async def get(self, key: str) -> Optional[Any]:
        """Get a value from Redis cache."""
        try:
            redis_key = f"{self.key_prefix}{key}" if not key.startswith(self.key_prefix) else key
            
            # Get JSON data from Redis
            cached_data = await self.redis_client.get(redis_key)
            
            if cached_data is None:
                await self._increment_stat("misses")
                return None
            
            # Deserialize the cache entry
            try:
                # Redis returns bytes, decode to string
                if isinstance(cached_data, bytes):
                    cached_data = cached_data.decode('utf-8')
                
                entry_data = json.loads(cached_data)
                
                # Reconstruct the CacheEntry
                entry = CacheEntry(
                    value=self._deserialize_value(entry_data["value"]),
                    created_at=entry_data["created_at"],
                    expires_at=entry_data.get("expires_at"),
                    access_count=entry_data.get("access_count", 0),
                    last_accessed=entry_data.get("last_accessed")
                )
                
                # Update access metadata and store back in Redis
                current_time = time.time()
                entry.access_count += 1
                entry.last_accessed = current_time
                
                # Update the entry in Redis with new metadata
                updated_entry = {
                    "value": entry_data["value"],  # Keep original serialized value
                    "created_at": entry.created_at,
                    "expires_at": entry.expires_at,
                    "access_count": entry.access_count,
                    "last_accessed": entry.last_accessed
                }
                await self.redis_client.set(
                    redis_key, 
                    json.dumps(updated_entry), 
                    ex=self.default_ttl
                )
                
                await self._increment_stat("hits")
                return entry.value
                
            except (json.JSONDecodeError, KeyError, TypeError) as e:
                logger.warning(f"Failed to deserialize cache entry for key {redis_key}: {e}")
                await self.redis_client.delete(redis_key)
                await self._increment_stat("misses")
                return None
                
        except RedisError as e:
            logger.warning(f"Redis error during get operation for key {key}: {e}")
            await self._increment_stat("misses")
            return None
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ) -> None:
        """Set a value in Redis cache."""
        try:
            redis_key = f"{self.key_prefix}{key}" if not key.startswith(self.key_prefix) else key
            ttl = ttl or self.default_ttl
            current_time = time.time()
            
            # Create cache entry with metadata
            entry_data = {
                "value": self._serialize_value(value),
                "created_at": current_time,
                "expires_at": current_time + ttl if ttl > 0 else None,
                "access_count": 1,
                "last_accessed": current_time
            }
            
            # Store as JSON in Redis with TTL
            await self.redis_client.set(
                redis_key, 
                json.dumps(entry_data), 
                ex=ttl if ttl > 0 else None
            )
            
            await self._increment_stat("sets")
            logger.debug(f"Cached entry for key {redis_key} with TTL {ttl}s")
            
        except RedisError as e:
            logger.warning(f"Redis error during set operation for key {key}: {e}")
        except Exception as e:
            logger.warning(f"Failed to serialize value for key {key}: {e}")
    
    async def delete(self, key: str) -> bool:
        """Delete a key from Redis cache."""
        try:
            redis_key = f"{self.key_prefix}{key}" if not key.startswith(self.key_prefix) else key
            result = await self.redis_client.delete(redis_key)
            return result > 0
        except RedisError as e:
            logger.warning(f"Redis error during delete operation for key {key}: {e}")
            return False
    
    async def clear(self) -> None:
        """Clear all geocoder cache entries."""
        try:
            # Use pattern matching to delete all keys with our prefix
            pattern = f"{self.key_prefix}*"
            keys = []
            
            # Scan for keys with our prefix
            async for key in self.redis_client.scan_iter(match=pattern):
                keys.append(key)
            
            if keys:
                await self.redis_client.delete(*keys)
                logger.info(f"Cleared {len(keys)} cache entries")
            
            # Reset stats
            await self.redis_client.delete(self.stats_key)
            logger.info("Cache cleared and stats reset")
            
        except RedisError as e:
            logger.error(f"Redis error during clear operation: {e}")
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics from Redis."""
        try:
            # Get all stats from Redis hash
            redis_stats = await self.redis_client.hgetall(self.stats_key)
            
            # Convert bytes to strings if needed, then to integers
            stats = {}
            for key, value in redis_stats.items():
                if isinstance(key, bytes):
                    key = key.decode('utf-8')
                if isinstance(value, bytes):
                    value = value.decode('utf-8')
                stats[key] = int(value) if value.isdigit() else 0
            
            # Ensure we have the basic stats
            stats = {
                "hits": stats.get("hits", 0),
                "misses": stats.get("misses", 0),
                "sets": stats.get("sets", 0),
            }
            
            # Calculate derived metrics
            total_requests = stats["hits"] + stats["misses"]
            hit_rate = stats["hits"] / total_requests if total_requests > 0 else 0
            
            # Get approximate cache size (expensive operation, use sparingly)
            pattern = f"{self.key_prefix}*"
            cache_size = 0
            async for _ in self.redis_client.scan_iter(match=pattern):
                cache_size += 1
            
            return {
                **stats,
                "size": cache_size,
                "hit_rate": hit_rate,
                "cache_type": "redis"
            }
            
        except RedisError as e:
            logger.warning(f"Redis error getting stats: {e}")
            return {
                "hits": 0,
                "misses": 0,
                "sets": 0,
                "size": 0,
                "hit_rate": 0.0,
                "cache_type": "redis",
                "error": str(e)
            }
    
    def cache_key_for_method(self, method_name: str, *args, **kwargs) -> str:
        """Generate cache key for a method call."""
        key_without_prefix = self._generate_key(*args, **kwargs)
        # Remove prefix if already added by _generate_key
        if key_without_prefix.startswith(self.key_prefix):
            key_without_prefix = key_without_prefix[len(self.key_prefix):]
        return f"{method_name}:{key_without_prefix}"
    
    async def shutdown(self) -> None:
        """Shutdown the cache - Redis connection managed elsewhere."""
        logger.info("Geocoder cache shutdown complete")


class CacheDecorator:
    """Decorator for caching method results with Redis."""
    
    def __init__(
        self,
        cache: GeocoderCache,
        ttl: Optional[int] = None,
        key_prefix: Optional[str] = None
    ):
        self.cache = cache
        self.ttl = ttl
        self.key_prefix = key_prefix
    
    def __call__(self, func):
        """Decorator implementation for async Redis cache."""
        async def wrapper(*args, **kwargs):
            # Generate cache key
            method_name = func.__name__
            if self.key_prefix:
                method_name = f"{self.key_prefix}:{method_name}"
            
            cache_key = self.cache.cache_key_for_method(method_name, *args, **kwargs)
            
            # Try to get from Redis cache
            cached_result = await self.cache.get(cache_key)
            if cached_result is not None:
                logger.debug(f"Redis cache hit for {method_name}")
                return cached_result
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            
            if result is not None:
                await self.cache.set(cache_key, result, self.ttl)
                logger.debug(f"Cached result in Redis for {method_name}")
            
            return result
        
        return wrapper