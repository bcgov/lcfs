"""
API endpoints for BC Geocoder service.
"""

import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse

from lcfs.services.geocoder.client import BCGeocoderService
from lcfs.services.geocoder.dependency import get_geocoder_service_async
from lcfs.services.geocoder.schema import (
    AddressRequest,
    ForwardGeocodeRequest,
    ReverseGeocodeRequest,
    BatchGeocodeRequest,
    BoundaryCheckRequest,
    AutocompleteRequest,
    ValidationResponse,
    GeocodingResultSchema,
    AutocompleteResponse,
    BoundaryCheckResponse,
    BatchGeocodeResponse,
    HealthCheckResponse,
    AddressSchema
)
from lcfs.web.core.decorators import view_handler

logger = logging.getLogger(__name__)
router = APIRouter()


def _convert_address_to_schema(address) -> AddressSchema:
    """Convert Address dataclass to AddressSchema pydantic model."""
    return AddressSchema(
        full_address=address.full_address,
        street_address=address.street_address,
        city=address.city,
        province=address.province,
        postal_code=address.postal_code,
        country=address.country,
        latitude=address.latitude,
        longitude=address.longitude,
        score=address.score
    )


def _convert_geocoding_result_to_schema(result) -> GeocodingResultSchema:
    """Convert GeocodingResult dataclass to GeocodingResultSchema pydantic model."""
    return GeocodingResultSchema(
        success=result.success,
        address=_convert_address_to_schema(result.address) if result.address else None,
        error=result.error,
        source=result.source
    )


@router.post(
    "/validate",
    response_model=ValidationResponse,
    status_code=status.HTTP_200_OK,
    summary="Validate and standardize an address",
    description="Validate an address string using the BC Geocoder API and return standardized address information."
)
@view_handler(["*"])
async def validate_address(
    request: Request,
    address_request: AddressRequest,
    geocoder_service: BCGeocoderService = Depends(get_geocoder_service_async)
) -> ValidationResponse:
    """Validate and standardize an address."""
    try:
        addresses = await geocoder_service.validate_address(
            address_request.address_string,
            address_request.min_score,
            address_request.max_results
        )
        
        # Convert Address dataclass objects to AddressSchema pydantic models
        address_schemas = [_convert_address_to_schema(addr) for addr in addresses]
        
        return ValidationResponse(addresses=address_schemas)
        
    except Exception as e:
        logger.error(f"Address validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Address validation failed: {str(e)}"
        )


@router.post(
    "/forward",
    response_model=GeocodingResultSchema,
    status_code=status.HTTP_200_OK,
    summary="Forward geocode an address",
    description="Convert an address string to geographic coordinates (latitude/longitude)."
)
@view_handler(["*"])
async def forward_geocode(
    request: Request,
    geocode_request: ForwardGeocodeRequest,
    geocoder_service: BCGeocoderService = Depends(get_geocoder_service_async)
) -> GeocodingResultSchema:
    """Convert address to coordinates."""
    try:
        result = await geocoder_service.forward_geocode(
            geocode_request.address_string,
            geocode_request.use_fallback
        )
        
        return _convert_geocoding_result_to_schema(result)
        
    except Exception as e:
        logger.error(f"Forward geocoding failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Forward geocoding failed: {str(e)}"
        )


@router.post(
    "/reverse",
    response_model=GeocodingResultSchema,
    status_code=status.HTTP_200_OK,
    summary="Reverse geocode coordinates",
    description="Convert geographic coordinates (latitude/longitude) to an address."
)
@view_handler(["*"])
async def reverse_geocode(
    request: Request,
    geocode_request: ReverseGeocodeRequest,
    geocoder_service: BCGeocoderService = Depends(get_geocoder_service_async)
) -> GeocodingResultSchema:
    """Convert coordinates to address."""
    try:
        result = await geocoder_service.reverse_geocode(
            geocode_request.latitude,
            geocode_request.longitude,
            geocode_request.use_fallback
        )
        
        return _convert_geocoding_result_to_schema(result)
        
    except Exception as e:
        logger.error(f"Reverse geocoding failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reverse geocoding failed: {str(e)}"
        )


@router.post(
    "/batch",
    response_model=BatchGeocodeResponse,
    status_code=status.HTTP_200_OK,
    summary="Batch geocode multiple addresses",
    description="Geocode multiple addresses in a single request with rate limiting and batch processing."
)
@view_handler(["*"])
async def batch_geocode(
    request: Request,
    batch_request: BatchGeocodeRequest,
    geocoder_service: BCGeocoderService = Depends(get_geocoder_service_async)
) -> BatchGeocodeResponse:
    """Batch geocode multiple addresses."""
    try:
        results = await geocoder_service.batch_geocode(
            batch_request.addresses,
            batch_request.batch_size
        )
        
        # Convert GeocodingResult dataclass objects to schemas
        result_schemas = [_convert_geocoding_result_to_schema(r) for r in results]
        
        successful_count = sum(1 for r in results if r.success)
        failed_count = len(results) - successful_count
        
        return BatchGeocodeResponse(
            results=result_schemas,
            total_processed=len(results),
            successful_count=successful_count,
            failed_count=failed_count
        )
        
    except Exception as e:
        logger.error(f"Batch geocoding failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch geocoding failed: {str(e)}"
        )


@router.post(
    "/boundary-check",
    response_model=BoundaryCheckResponse,
    status_code=status.HTTP_200_OK,
    summary="Check if coordinates are within BC",
    description="Determine if given coordinates fall within British Columbia boundaries."
)
@view_handler(["*"])
async def check_bc_boundary(
    request: Request,
    boundary_request: BoundaryCheckRequest,
    geocoder_service: BCGeocoderService = Depends(get_geocoder_service_async)
) -> BoundaryCheckResponse:
    """Check if coordinates are within BC boundaries."""
    try:
        is_in_bc = await geocoder_service.check_bc_boundary(
            boundary_request.latitude,
            boundary_request.longitude
        )
        
        return BoundaryCheckResponse(is_in_bc=is_in_bc)
        
    except Exception as e:
        logger.error(f"BC boundary check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"BC boundary check failed: {str(e)}"
        )


@router.post(
    "/autocomplete",
    response_model=AutocompleteResponse,
    status_code=status.HTTP_200_OK,
    summary="Get address autocomplete suggestions",
    description="Get address autocomplete suggestions for partial address input."
)
@view_handler(["*"])
async def autocomplete_address(
    request: Request,
    autocomplete_request: AutocompleteRequest,
    geocoder_service: BCGeocoderService = Depends(get_geocoder_service_async)
) -> AutocompleteResponse:
    """Get address autocomplete suggestions."""
    try:
        suggestions = await geocoder_service.autocomplete_address(
            autocomplete_request.partial_address,
            autocomplete_request.max_results
        )
        
        # Convert Address dataclass objects to AddressSchema pydantic models
        suggestion_schemas = [_convert_address_to_schema(addr) for addr in suggestions]
        
        return AutocompleteResponse(suggestions=suggestion_schemas)
        
    except Exception as e:
        logger.error(f"Address autocomplete failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Address autocomplete failed: {str(e)}"
        )


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    status_code=status.HTTP_200_OK,
    summary="Check geocoder service health",
    description="Check the health and availability of the geocoder service and its dependencies."
)
@view_handler(["*"])
async def health_check(
    request: Request,
    geocoder_service: BCGeocoderService = Depends(get_geocoder_service_async)
) -> HealthCheckResponse:
    """Check service health and dependencies."""
    try:
        # Test BC Geocoder availability
        bc_available = True
        try:
            await geocoder_service.validate_address("Vancouver, BC", max_results=1)
        except Exception:
            bc_available = False

        # Test Nominatim availability  
        nominatim_available = True
        try:
            await geocoder_service.reverse_geocode(49.2827, -123.1207)
        except Exception:
            nominatim_available = False

        return HealthCheckResponse(
            status="healthy" if bc_available or nominatim_available else "unhealthy",
            bc_geocoder_available=bc_available,
            nominatim_available=nominatim_available,
            cache_size=len(geocoder_service._cache)
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthCheckResponse(
            status="unhealthy",
            bc_geocoder_available=False,
            nominatim_available=False,
            cache_size=0
        )


