# BC Geocoder Service

A comprehensive geocoding service for the LCFS application that provides standardized access to address validation, geocoding, and location-based operations using the BC Geocoder API.

## Features

- **Address Validation**: Validate and standardize addresses using BC Geocoder API
- **Forward Geocoding**: Convert addresses to geographic coordinates
- **Reverse Geocoding**: Convert coordinates to addresses
- **Batch Processing**: Handle multiple addresses efficiently with rate limiting
- **BC Boundary Checking**: Determine if coordinates fall within British Columbia
- **Address Autocomplete**: Provide address suggestions for partial input
- **Advanced Caching**: LRU cache with TTL support for improved performance
- **Retry Logic**: Automatic retry with exponential backoff for failed requests
- **Comprehensive Logging**: Detailed logging for monitoring and debugging
- **Performance Metrics**: Track usage statistics and cache performance

## Architecture

### Core Components

1. **BCGeocoderService**: Main service class providing all geocoding functionality
2. **GeocoderCache**: Advanced caching system with LRU eviction and TTL support
3. **API Views**: FastAPI endpoints for HTTP access to geocoding services
4. **Schemas**: Pydantic models for request/response validation

### Data Sources

- **Primary**: BC Geocoder API (`https://geocoder.api.gov.bc.ca`)
- **Fallback**: OpenStreetMap Nominatim API for reverse geocoding and fallback scenarios

## Configuration

The service can be configured via environment variables:

```bash
# BC Geocoder API settings (REQUIRED)
BC_GEOCODER_URL=https://geocoder.api.gov.bc.ca
BC_GEOCODER_API_KEY=your_api_key_here  # Optional but recommended
GEOCODER_USER_AGENT="LCFS/1.0 (lcfs@gov.bc.ca)"

# Performance settings
GEOCODER_TIMEOUT=30
GEOCODER_MAX_RETRIES=3
GEOCODER_RATE_LIMIT_DELAY=0.1  # BC Geocoder recommends rate limiting

# Cache settings
GEOCODER_CACHE_SIZE=10000
GEOCODER_CACHE_TTL=3600

# Fallback API (for reverse geocoding only)
NOMINATIM_URL=https://nominatim.openstreetmap.org
```

### API Key Access

To get a BC Geocoder API key:
1. Visit the [BC Geocoder API access page](https://catalogue.data.gov.bc.ca/dataset/bc-address-geocoder-web-service)
2. Open a ticket with the Data Systems and Services Request System
3. Government and non-government organizations can request access

## Usage

### Basic Service Usage

```python
from lcfs.services.geocoder.client import BCGeocoderService

# Initialize service
geocoder = BCGeocoderService()

# Validate an address
addresses = await geocoder.validate_address("123 Main St, Vancouver, BC")

# Forward geocode
result = await geocoder.forward_geocode("123 Main St, Vancouver, BC")
if result.success:
    print(f"Coordinates: {result.address.latitude}, {result.address.longitude}")

# Reverse geocode
result = await geocoder.reverse_geocode(49.2827, -123.1207)
if result.success:
    print(f"Address: {result.address.full_address}")

# Check BC boundary
is_in_bc = await geocoder.check_bc_boundary(49.2827, -123.1207)

# Batch geocode
addresses = ["123 Main St, Vancouver", "456 Oak St, Victoria"]
results = await geocoder.batch_geocode(addresses, batch_size=5)
```

### API Endpoints

The service exposes RESTful API endpoints:

#### Address Validation
```http
POST /api/geocoder/validate
Content-Type: application/json

{
    "address_string": "123 Main St, Vancouver",
    "min_score": 50,
    "max_results": 5
}
```

#### Forward Geocoding
```http
POST /api/geocoder/forward
Content-Type: application/json

{
    "address_string": "123 Main St, Vancouver",
    "use_fallback": true
}
```

#### Reverse Geocoding
```http
POST /api/geocoder/reverse
Content-Type: application/json

{
    "latitude": 49.2827,
    "longitude": -123.1207,
    "use_fallback": true
}
```

#### Batch Geocoding
```http
POST /api/geocoder/batch
Content-Type: application/json

{
    "addresses": ["123 Main St, Vancouver", "456 Oak St, Victoria"],
    "batch_size": 5
}
```

#### BC Boundary Check
```http
POST /api/geocoder/boundary-check
Content-Type: application/json

{
    "latitude": 49.2827,
    "longitude": -123.1207
}
```

#### Address Autocomplete
```http
POST /api/geocoder/autocomplete
Content-Type: application/json

{
    "partial_address": "123 Main",
    "max_results": 5
}
```

#### Health Check
```http
GET /api/geocoder/health
```

#### Clear Cache (Admin only)
```http
DELETE /api/geocoder/cache
```

## Caching Strategy

The service implements a sophisticated caching system:

### Cache Features
- **LRU Eviction**: Least Recently Used items are evicted when cache is full
- **TTL Support**: Entries expire after a configurable time period
- **Background Cleanup**: Expired entries are automatically removed
- **Statistics Tracking**: Hit/miss ratios and performance metrics
- **Method-specific Keys**: Cache keys are generated per method and arguments

### Cache Configuration
```python
cache = GeocoderCache(
    max_size=10000,      # Maximum cache entries
    default_ttl=3600,    # Default TTL in seconds (1 hour)
    cleanup_interval=300 # Cleanup every 5 minutes
)
```

## Performance Considerations

### Rate Limiting
- Configurable delay between API requests
- Batch processing with concurrent limits
- Automatic retry with exponential backoff

### Optimization Features
- Response caching for frequently requested addresses
- Batch processing for multiple addresses
- Connection pooling for HTTP requests
- Automatic fallback to secondary data sources

## Error Handling

The service implements comprehensive error handling:

### Error Types
- **Network Errors**: Connection timeouts, DNS failures
- **API Errors**: Service unavailable, rate limiting
- **Validation Errors**: Invalid coordinates, malformed addresses
- **Cache Errors**: Memory issues, corruption

### Error Response Format
```json
{
    "success": false,
    "error": "Description of the error",
    "address": null,
    "source": null
}
```

## Monitoring and Metrics

### Available Metrics
- Request counts by API endpoint
- Cache hit/miss ratios
- API response times
- Error rates by type
- Cache size and eviction rates

### Accessing Metrics
```python
metrics = geocoder.get_metrics()
print(f"Cache hit rate: {metrics['cache_stats']['hit_rate']:.2%}")
print(f"Total requests: {metrics['requests_made']}")
```

## Testing

The service includes comprehensive test coverage:

### Running Tests
```bash
# Run all geocoder tests
pytest lcfs/tests/services/geocoder/

# Run specific test files
pytest lcfs/tests/services/geocoder/test_geocoder_client.py
pytest lcfs/tests/services/geocoder/test_geocoder_cache.py
pytest lcfs/tests/services/geocoder/test_geocoder_views.py

# Run with coverage
pytest lcfs/tests/services/geocoder/ --cov=lcfs.services.geocoder
```

### Test Categories
- **Unit Tests**: Individual component testing
- **Integration Tests**: API endpoint testing
- **Performance Tests**: Cache and rate limiting
- **Error Handling Tests**: Exception scenarios

## Migration from Existing Code

### Consolidation Benefits

This service consolidates existing geocoding functionality:

1. **Frontend Address Autocomplete**: Replaces direct BC Geocoder API calls
2. **ETL Geocoding Scripts**: Provides programmatic access with caching
3. **Geofencing Utils**: Centralized boundary checking logic

### Migration Steps

1. **Update Frontend Components**:
   ```javascript
   // Before: Direct API call
   const response = await fetch(ADDRESS_SEARCH_URL + address);
   
   // After: Use consolidated service
   const response = await fetch('/api/geocoder/autocomplete', {
       method: 'POST',
       body: JSON.stringify({ partial_address: address })
   });
   ```

2. **Update ETL Scripts**:
   ```python
   # Before: Direct API calls in scripts
   # After: Use geocoder service
   from lcfs.services.geocoder.dependency import get_geocoder_service
   
   geocoder = get_geocoder_service()
   result = await geocoder.forward_geocode(address)
   ```

3. **Update Geofencing Logic**:
   ```python
   # Before: Custom boundary checking
   # After: Use service boundary check
   is_in_bc = await geocoder.check_bc_boundary(lat, lng)
   ```

## API Documentation

The service automatically generates OpenAPI documentation available at:
- Swagger UI: `/docs#/geocoder`
- ReDoc: `/redoc#tag/geocoder`

## Security Considerations

- **Rate Limiting**: Prevents abuse of external APIs
- **Input Validation**: All inputs are validated using Pydantic schemas
- **Error Sanitization**: Error messages don't expose sensitive information
- **Cache Security**: Cache keys are hashed to prevent injection attacks

## Future Enhancements

Potential improvements for future versions:

1. **Persistent Caching**: Redis/database backing for cache persistence
2. **Geographic Clustering**: Group nearby addresses for bulk processing
3. **Address Standardization**: Enhanced address formatting and validation
4. **Analytics Dashboard**: Real-time monitoring and usage analytics
5. **Multi-region Support**: Support for other provinces/territories
6. **Performance Optimization**: Further caching strategies and connection pooling

## Support and Maintenance

For issues or questions related to the geocoder service:

1. Check the health endpoint: `GET /api/geocoder/health`
2. Review service logs for error details
3. Monitor cache performance via metrics
4. Verify external API availability

The service is designed to be self-monitoring and will automatically handle most error conditions gracefully with fallback mechanisms.