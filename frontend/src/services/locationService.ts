/**
 * Location Service
 *
 * Centralized service for location-related operations including geofencing,
 * reverse geocoding, and boundary checking. Can be imported by any component
 * that needs location functionality.
 */

import useGeocoder from '@/hooks/useGeocoder'

export interface LocationDetails {
  fullAddress: string
  streetAddress: string
  city: string
  province: string
  country: string
  postalCode: string
  latitude: number
  longitude: number
  score: number
}

export interface LocationInput {
  id: string | number
  lat: number
  lng: number
}

export interface GeofencingResults {
  [id: string]: boolean
}

export interface AddressValidationResult {
  input: string
  success: boolean
  address?: unknown
  error?: string
}

export interface UseLocationServiceReturn {
  checkLocationInBC: (lat: number, lng: number) => Promise<boolean>
  getLocationDetails: (lat: number, lng: number) => Promise<LocationDetails | null>
  batchProcessGeofencing: (locations: LocationInput[]) => Promise<GeofencingResults>
  batchValidateAddresses: (addresses: string[]) => Promise<AddressValidationResult[]>
  isLoading: boolean
  error: Error | null
}

/**
 * Enhanced geofencing service using the consolidated geocoder service.
 * This replaces direct API calls with our centralized service for better
 * caching, error handling, and consistency across the application.
 */
export const useLocationService = (): UseLocationServiceReturn => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { checkBCBoundary, reverseGeocode, validateAddress } = useGeocoder() as any

  /**
   * Check if a location is within BC boundaries using the geocoder service.
   *
   * @param lat - Latitude
   * @param lng - Longitude
   * @returns True if location is in BC
   */
  const checkLocationInBC = async (lat: number, lng: number): Promise<boolean> => {
    try {
      const result = await checkBCBoundary.mutateAsync({
        latitude: lat,
        longitude: lng
      })

      return result.is_in_bc
    } catch (error) {
      console.error('Error checking location with geocoder service:', error)
      // Fallback to simple boundary check if the API fails
      return lat > 48.0 && lat < 60.0 && lng > -139.0 && lng < -114.03
    }
  }

  /**
   * Get detailed address information for coordinates.
   *
   * @param lat - Latitude
   * @param lng - Longitude
   * @returns Address information or null if not found
   */
  const getLocationDetails = async (
    lat: number,
    lng: number
  ): Promise<LocationDetails | null> => {
    try {
      const result = await reverseGeocode.mutateAsync({
        latitude: lat,
        longitude: lng,
        useFallback: true
      })

      if (result.success && result.address) {
        return {
          fullAddress: result.address.full_address,
          streetAddress: result.address.street_address,
          city: result.address.city,
          province: result.address.province,
          country: result.address.country,
          postalCode: result.address.postal_code,
          latitude: result.address.latitude,
          longitude: result.address.longitude,
          score: result.address.score
        }
      }

      return null
    } catch (error) {
      console.error('Error getting location details:', error)
      return null
    }
  }

  /**
   * Batch process location geofencing checks using the geocoder service.
   * This provides better performance through the service's caching.
   *
   * @param locations - Array of location objects with lat/lng and id
   * @returns Map of location IDs to BC boundary status
   */
  const batchProcessGeofencing = async (
    locations: LocationInput[]
  ): Promise<GeofencingResults> => {
    const results: GeofencingResults = {}
    const batchSize = 5 // Process 5 locations at a time

    for (let i = 0; i < locations.length; i += batchSize) {
      const batch = locations.slice(i, i + batchSize)

      const batchPromises = batch.map(async (loc) => {
        const isInBC = await checkLocationInBC(loc.lat, loc.lng)
        return { id: loc.id, isInBC }
      })

      const batchResults = await Promise.all(batchPromises)

      // Add batch results to the overall results
      batchResults.forEach(({ id, isInBC }) => {
        results[id] = isInBC
      })

      // Add a small delay between batches to avoid overwhelming the service
      if (i + batchSize < locations.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    return results
  }

  /**
   * Validate multiple addresses in batch.
   *
   * @param addresses - Array of address strings
   * @returns Array of validation results
   */
  const batchValidateAddresses = async (
    addresses: string[]
  ): Promise<AddressValidationResult[]> => {
    const results: AddressValidationResult[] = []
    const batchSize = 3 // Smaller batch for validation to avoid overwhelming API

    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize)

      const batchPromises = batch.map(async (address) => {
        try {
          const result = await validateAddress.mutateAsync({
            addressString: address,
            minScore: 50,
            maxResults: 1
          })

          return {
            input: address,
            success: result.addresses && result.addresses.length > 0,
            address: result.addresses?.[0] || null
          }
        } catch (error) {
          return {
            input: address,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Add delay between batches
      if (i + batchSize < addresses.length) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }

    return results
  }

  return {
    // Core location functions
    checkLocationInBC,
    getLocationDetails,

    // Batch processing
    batchProcessGeofencing,
    batchValidateAddresses,

    // State management
    isLoading: checkBCBoundary.isPending || reverseGeocode.isPending,
    error: checkBCBoundary.error || reverseGeocode.error
  }
}

/**
 * Utility function to calculate distance between two coordinates using Haversine formula.
 *
 * @param lat1 - First latitude
 * @param lng1 - First longitude
 * @param lat2 - Second latitude
 * @param lng2 - Second longitude
 * @returns Distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371 // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Check if coordinates are valid (within reasonable bounds).
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns True if coordinates are valid
 */
export const isValidCoordinates = (lat: number, lng: number): boolean => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !isNaN(lat) &&
    !isNaN(lng)
  )
}

/**
 * Format coordinates for display.
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @param precision - Number of decimal places (default: 6)
 * @returns Formatted coordinates string
 */
export const formatCoordinates = (
  lat: number,
  lng: number,
  precision: number = 6
): string => {
  if (!isValidCoordinates(lat, lng)) {
    return 'Invalid coordinates'
  }

  return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`
}

export default useLocationService
