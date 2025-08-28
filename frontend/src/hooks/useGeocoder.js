/**
 * Hook for accessing the consolidated BC Geocoder service.
 * Provides address validation, geocoding, and autocomplete functionality.
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useApiService } from '@/services/useApiService'
import { apiRoutes } from '@/constants/routes'

export const useGeocoder = () => {
  const apiService = useApiService()

  /**
   * Validate and standardize an address
   */
  const validateAddress = useMutation({
    mutationFn: async ({ addressString, minScore = 50, maxResults = 5 }) => {
      const response = await apiService.post(apiRoutes.geocoderValidate, {
        address_string: addressString,
        min_score: minScore,
        max_results: maxResults
      })
      return response.data
    }
  })

  /**
   * Forward geocode an address to coordinates
   */
  const forwardGeocode = useMutation({
    mutationFn: async ({ addressString, useFallback = true }) => {
      const response = await apiService.post(apiRoutes.geocoderForward, {
        address_string: addressString,
        use_fallback: useFallback
      })
      return response.data
    }
  })

  /**
   * Reverse geocode coordinates to address
   */
  const reverseGeocode = useMutation({
    mutationFn: async ({ latitude, longitude, useFallback = true }) => {
      const response = await apiService.post(apiRoutes.geocoderReverse, {
        latitude,
        longitude,
        use_fallback: useFallback
      })
      return response.data
    }
  })

  /**
   * Get address autocomplete suggestions
   */
  const autocompleteAddress = useMutation({
    mutationFn: async ({ partialAddress, maxResults = 5 }) => {
      const response = await apiService.post(apiRoutes.geocoderAutocomplete, {
        partial_address: partialAddress,
        max_results: maxResults
      })
      return response.data
    }
  })

  /**
   * Batch geocode multiple addresses
   */
  const batchGeocode = useMutation({
    mutationFn: async ({ addresses, batchSize = 5 }) => {
      const response = await apiService.post(apiRoutes.geocoderBatch, {
        addresses,
        batch_size: batchSize
      })
      return response.data
    }
  })

  /**
   * Check if coordinates are within BC boundaries
   */
  const checkBCBoundary = useMutation({
    mutationFn: async ({ latitude, longitude }) => {
      const response = await apiService.post(apiRoutes.geocoderBoundaryCheck, {
        latitude,
        longitude
      })
      return response.data
    }
  })

  /**
   * Get geocoder service health status
   */
  const useHealthCheck = () => {
    return useQuery({
      queryKey: ['geocoder', 'health'],
      queryFn: async () => {
        const response = await apiService.get(apiRoutes.geocoderHealth)
        return response.data
      },
      refetchInterval: 60000, // Check every minute
      staleTime: 30000 // Cache for 30 seconds
    })
  }

  return {
    validateAddress,
    forwardGeocode,
    reverseGeocode,
    autocompleteAddress,
    batchGeocode,
    checkBCBoundary,
    useHealthCheck
  }
}

export default useGeocoder