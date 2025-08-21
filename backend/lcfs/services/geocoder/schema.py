"""
Pydantic schemas for BC Geocoder service.
"""

from typing import Optional, List
from pydantic import BaseModel, Field, validator


class AddressRequest(BaseModel):
    """Request schema for address validation."""
    address_string: str = Field(..., description="The address string to validate")
    min_score: int = Field(50, ge=0, le=100, description="Minimum confidence score")
    max_results: int = Field(5, ge=1, le=20, description="Maximum number of results")


class ForwardGeocodeRequest(BaseModel):
    """Request schema for forward geocoding."""
    address_string: str = Field(..., description="The address to geocode")
    use_fallback: bool = Field(True, description="Whether to use Nominatim as fallback")


class ReverseGeocodeRequest(BaseModel):
    """Request schema for reverse geocoding."""
    latitude: float = Field(..., ge=-90, le=90, description="Latitude coordinate")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude coordinate")
    use_fallback: bool = Field(True, description="Whether to use Nominatim as fallback")


class BatchGeocodeRequest(BaseModel):
    """Request schema for batch geocoding."""
    addresses: List[str] = Field(..., description="List of addresses to geocode")
    batch_size: int = Field(5, ge=1, le=20, description="Batch processing size")


class BoundaryCheckRequest(BaseModel):
    """Request schema for BC boundary checking."""
    latitude: float = Field(..., ge=-90, le=90, description="Latitude coordinate")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude coordinate")


class AutocompleteRequest(BaseModel):
    """Request schema for address autocomplete."""
    partial_address: str = Field(..., min_length=1, description="Partial address string")
    max_results: int = Field(5, ge=1, le=20, description="Maximum number of suggestions")


class AddressSchema(BaseModel):
    """Schema for standardized address representation."""
    full_address: str = Field(..., description="Complete formatted address")
    street_address: Optional[str] = Field(None, description="Street address component")
    city: Optional[str] = Field(None, description="City name")
    province: Optional[str] = Field(None, description="Province or state")
    postal_code: Optional[str] = Field(None, description="Postal or ZIP code")
    country: Optional[str] = Field(None, description="Country name")
    latitude: Optional[float] = Field(None, ge=-90, le=90, description="Latitude coordinate")
    longitude: Optional[float] = Field(None, ge=-180, le=180, description="Longitude coordinate")
    score: Optional[float] = Field(None, ge=0, le=100, description="Confidence score")


class GeocodingResultSchema(BaseModel):
    """Schema for geocoding operation results."""
    success: bool = Field(..., description="Whether the operation was successful")
    address: Optional[AddressSchema] = Field(None, description="Address information")
    error: Optional[str] = Field(None, description="Error message if unsuccessful")
    source: Optional[str] = Field(None, description="Data source used")


class ValidationResponse(BaseModel):
    """Response schema for address validation."""
    addresses: List[AddressSchema] = Field(..., description="List of validated addresses")


class AutocompleteResponse(BaseModel):
    """Response schema for address autocomplete."""
    suggestions: List[AddressSchema] = Field(..., description="List of address suggestions with detailed information")


class BoundaryCheckResponse(BaseModel):
    """Response schema for BC boundary checking."""
    is_in_bc: bool = Field(..., description="Whether coordinates are within BC")


class BatchGeocodeResponse(BaseModel):
    """Response schema for batch geocoding."""
    results: List[GeocodingResultSchema] = Field(..., description="Geocoding results")
    total_processed: int = Field(..., description="Total number of addresses processed")
    successful_count: int = Field(..., description="Number of successful geocoding operations")
    failed_count: int = Field(..., description="Number of failed geocoding operations")


class HealthCheckResponse(BaseModel):
    """Response schema for health check."""
    status: str = Field(..., description="Service health status")
    bc_geocoder_available: bool = Field(..., description="BC Geocoder API availability")
    nominatim_available: bool = Field(..., description="Nominatim API availability")
    cache_size: int = Field(..., description="Current cache size")