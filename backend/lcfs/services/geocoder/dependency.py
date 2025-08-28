"""
Dependency injection for BC Geocoder service.
"""

from functools import lru_cache
from typing import Optional
import os
from fastapi import Depends
from redis.asyncio import Redis

from .client import BCGeocoderService
from lcfs.services.redis.dependency import get_redis_client


def get_geocoder_service(redis_client: Redis) -> BCGeocoderService:
    """
    Get or create a BC Geocoder service instance with Redis cache.
    
    Args:
        redis_client: Redis client for caching
        
    Returns:
        BCGeocoderService: The geocoder service instance
    """
    return BCGeocoderService(
        redis_client=redis_client,
        bc_geocoder_url=os.getenv(
            "BC_GEOCODER_URL", 
            "https://geocoder.api.gov.bc.ca"
        ),
        nominatim_url=os.getenv(
            "NOMINATIM_URL", 
            "https://nominatim.openstreetmap.org"
        ),
        timeout=int(os.getenv("GEOCODER_TIMEOUT", "30")),
        max_retries=int(os.getenv("GEOCODER_MAX_RETRIES", "3")),
        rate_limit_delay=float(os.getenv("GEOCODER_RATE_LIMIT_DELAY", "0.1")),
        user_agent=os.getenv(
            "GEOCODER_USER_AGENT", 
            "LCFS/1.0 (lcfs@gov.bc.ca)"
        ),
        cache_ttl=int(os.getenv("GEOCODER_CACHE_TTL", "3600")),
        api_key=os.getenv("BC_GEOCODER_API_KEY")
    )


async def get_geocoder_service_async(
    redis_client: Redis = Depends(get_redis_client)
) -> BCGeocoderService:
    """
    Async dependency for FastAPI routes with Redis injection.
    
    Args:
        redis_client: Redis client injected by FastAPI
        
    Returns:
        BCGeocoderService: The geocoder service instance
    """
    return get_geocoder_service(redis_client)