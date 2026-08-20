import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  useLocationService,
  calculateDistance,
  isValidCoordinates,
  formatCoordinates
} from '../locationService'

const mockCheckBCBoundary = {
  mutateAsync: vi.fn(),
  isPending: false,
  error: null
}

const mockReverseGeocode = {
  mutateAsync: vi.fn(),
  isPending: false,
  error: null
}

const mockValidateAddress = {
  mutateAsync: vi.fn()
}

vi.mock('@/hooks/useGeocoder', () => ({
  default: () => ({
    checkBCBoundary: mockCheckBCBoundary,
    reverseGeocode: mockReverseGeocode,
    validateAddress: mockValidateAddress
  })
}))

const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

const vancouverAddress = {
  full_address: '123 Main St, Vancouver, BC',
  street_address: '123 Main St',
  city: 'Vancouver',
  province: 'BC',
  country: 'Canada',
  postal_code: 'V6B 1A1',
  latitude: 49.2827,
  longitude: -123.1207,
  score: 95
}

describe('useLocationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckBCBoundary.mutateAsync.mockReset()
    mockReverseGeocode.mutateAsync.mockReset()
    mockValidateAddress.mutateAsync.mockReset()
    mockCheckBCBoundary.isPending = false
    mockReverseGeocode.isPending = false
    mockCheckBCBoundary.error = null
    mockReverseGeocode.error = null
    mockConsoleError.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('checkLocationInBC', () => {
    it('returns true when the geocoder reports the point is in BC', async () => {
      mockCheckBCBoundary.mutateAsync.mockResolvedValue({ is_in_bc: true })
      const { result } = renderHook(() => useLocationService())

      await expect(
        result.current.checkLocationInBC(49.2827, -123.1207)
      ).resolves.toBe(true)
      expect(mockCheckBCBoundary.mutateAsync).toHaveBeenCalledWith({
        latitude: 49.2827,
        longitude: -123.1207
      })
    })

    it('returns false when the geocoder reports the point is outside BC', async () => {
      mockCheckBCBoundary.mutateAsync.mockResolvedValue({ is_in_bc: false })
      const { result } = renderHook(() => useLocationService())

      await expect(
        result.current.checkLocationInBC(47.6062, -122.3321)
      ).resolves.toBe(false)
    })

    it('falls back to a simple BC bounding box when the geocoder fails', async () => {
      mockCheckBCBoundary.mutateAsync.mockRejectedValue(
        new Error('geocoder unavailable')
      )
      const { result } = renderHook(() => useLocationService())

      await expect(
        result.current.checkLocationInBC(49.2827, -123.1207)
      ).resolves.toBe(true)
      await expect(
        result.current.checkLocationInBC(43.6532, -79.3832)
      ).resolves.toBe(false)
      expect(mockConsoleError).toHaveBeenCalled()
    })

    it('treats bounding-box edges as outside BC on fallback', async () => {
      mockCheckBCBoundary.mutateAsync.mockRejectedValue(new Error('fail'))
      const { result } = renderHook(() => useLocationService())

      await expect(
        result.current.checkLocationInBC(48.0, -123.0)
      ).resolves.toBe(false)
      await expect(
        result.current.checkLocationInBC(60.0, -123.0)
      ).resolves.toBe(false)
      await expect(
        result.current.checkLocationInBC(50.0, -139.0)
      ).resolves.toBe(false)
      await expect(
        result.current.checkLocationInBC(50.0, -114.03)
      ).resolves.toBe(false)
      await expect(
        result.current.checkLocationInBC(50.0, -123.0)
      ).resolves.toBe(true)
    })
  })

  describe('getLocationDetails', () => {
    it('maps a successful reverse-geocode response', async () => {
      mockReverseGeocode.mutateAsync.mockResolvedValue({
        success: true,
        address: vancouverAddress
      })
      const { result } = renderHook(() => useLocationService())

      const details = await result.current.getLocationDetails(
        49.2827,
        -123.1207
      )

      expect(mockReverseGeocode.mutateAsync).toHaveBeenCalledWith({
        latitude: 49.2827,
        longitude: -123.1207,
        useFallback: true
      })
      expect(details).toEqual({
        fullAddress: '123 Main St, Vancouver, BC',
        streetAddress: '123 Main St',
        city: 'Vancouver',
        province: 'BC',
        country: 'Canada',
        postalCode: 'V6B 1A1',
        latitude: 49.2827,
        longitude: -123.1207,
        score: 95
      })
    })

    it('returns null when reverse geocode is unsuccessful', async () => {
      mockReverseGeocode.mutateAsync.mockResolvedValue({
        success: false,
        address: vancouverAddress
      })
      const { result } = renderHook(() => useLocationService())

      await expect(result.current.getLocationDetails(0, 0)).resolves.toBeNull()
    })

    it('returns null when reverse geocode has no address', async () => {
      mockReverseGeocode.mutateAsync.mockResolvedValue({
        success: true
      })
      const { result } = renderHook(() => useLocationService())

      await expect(result.current.getLocationDetails(0, 0)).resolves.toBeNull()
    })

    it('returns null and logs when reverse geocode throws', async () => {
      mockReverseGeocode.mutateAsync.mockRejectedValue(new Error('timeout'))
      const { result } = renderHook(() => useLocationService())

      await expect(
        result.current.getLocationDetails(49.2827, -123.1207)
      ).resolves.toBeNull()
      expect(mockConsoleError).toHaveBeenCalled()
    })
  })

  describe('batchProcessGeofencing', () => {
    it('returns an empty map for an empty input', async () => {
      const { result } = renderHook(() => useLocationService())

      await expect(result.current.batchProcessGeofencing([])).resolves.toEqual(
        {}
      )
      expect(mockCheckBCBoundary.mutateAsync).not.toHaveBeenCalled()
    })

    it('maps each location id to its BC status', async () => {
      mockCheckBCBoundary.mutateAsync
        .mockResolvedValueOnce({ is_in_bc: true })
        .mockResolvedValueOnce({ is_in_bc: false })
      const { result } = renderHook(() => useLocationService())

      const results = await result.current.batchProcessGeofencing([
        { id: 'a', lat: 49.2, lng: -123.1 },
        { id: 2, lat: 47.6, lng: -122.3 }
      ])

      expect(results).toEqual({ a: true, 2: false })
    })

    it('processes more than 5 locations in batches with a delay', async () => {
      vi.useFakeTimers()
      mockCheckBCBoundary.mutateAsync.mockResolvedValue({ is_in_bc: true })
      const { result } = renderHook(() => useLocationService())

      const locations = Array.from({ length: 6 }, (_, i) => ({
        id: `loc-${i}`,
        lat: 49.2,
        lng: -123.1
      }))

      const promise = result.current.batchProcessGeofencing(locations)
      await vi.runAllTimersAsync()
      const results = await promise

      expect(Object.keys(results)).toHaveLength(6)
      expect(results['loc-5']).toBe(true)
      expect(mockCheckBCBoundary.mutateAsync).toHaveBeenCalledTimes(6)
    })
  })

  describe('batchValidateAddresses', () => {
    it('returns an empty array for an empty input', async () => {
      const { result } = renderHook(() => useLocationService())

      await expect(result.current.batchValidateAddresses([])).resolves.toEqual(
        []
      )
      expect(mockValidateAddress.mutateAsync).not.toHaveBeenCalled()
    })

    it('returns the first match when validation succeeds', async () => {
      mockValidateAddress.mutateAsync.mockResolvedValue({
        addresses: [{ full_address: '123 Main St' }, { full_address: 'other' }]
      })
      const { result } = renderHook(() => useLocationService())

      const results = await result.current.batchValidateAddresses([
        '123 Main Street'
      ])

      expect(mockValidateAddress.mutateAsync).toHaveBeenCalledWith({
        addressString: '123 Main Street',
        minScore: 50,
        maxResults: 1
      })
      expect(results).toEqual([
        {
          input: '123 Main Street',
          success: true,
          address: { full_address: '123 Main St' }
        }
      ])
    })

    it('marks validation unsuccessful when no addresses are returned', async () => {
      mockValidateAddress.mutateAsync.mockResolvedValue({ addresses: [] })
      const { result } = renderHook(() => useLocationService())

      const results = await result.current.batchValidateAddresses(['nowhere'])

      expect(results[0]).toEqual({
        input: 'nowhere',
        success: false,
        address: null
      })
    })

    it('captures Error messages when validation throws', async () => {
      mockValidateAddress.mutateAsync.mockRejectedValue(
        new Error('rate limited')
      )
      const { result } = renderHook(() => useLocationService())

      const results = await result.current.batchValidateAddresses(['bad'])

      expect(results[0]).toEqual({
        input: 'bad',
        success: false,
        error: 'rate limited'
      })
    })

    it('uses a generic message when validation throws a non-Error', async () => {
      mockValidateAddress.mutateAsync.mockRejectedValue('boom')
      const { result } = renderHook(() => useLocationService())

      const results = await result.current.batchValidateAddresses(['bad'])

      expect(results[0]).toEqual({
        input: 'bad',
        success: false,
        error: 'Unknown error'
      })
    })

    it('processes more than 3 addresses in batches with a delay', async () => {
      vi.useFakeTimers()
      mockValidateAddress.mutateAsync.mockResolvedValue({
        addresses: [{ full_address: 'ok' }]
      })
      const { result } = renderHook(() => useLocationService())

      const addresses = ['one', 'two', 'three', 'four']
      const promise = result.current.batchValidateAddresses(addresses)
      await vi.runAllTimersAsync()
      const results = await promise

      expect(results).toHaveLength(4)
      expect(results.every((r) => r.success)).toBe(true)
      expect(mockValidateAddress.mutateAsync).toHaveBeenCalledTimes(4)
    })
  })

  describe('loading and error state', () => {
    it('exposes pending state from the geocoder mutations', () => {
      mockCheckBCBoundary.isPending = true
      const { result } = renderHook(() => useLocationService())
      expect(result.current.isLoading).toBe(true)
    })

    it('is loading when reverse geocode is pending', () => {
      mockReverseGeocode.isPending = true
      const { result } = renderHook(() => useLocationService())
      expect(result.current.isLoading).toBe(true)
    })

    it('surfaces the first geocoder error', () => {
      const boundaryError = new Error('boundary failed')
      mockCheckBCBoundary.error = boundaryError
      const { result } = renderHook(() => useLocationService())
      expect(result.current.error).toBe(boundaryError)
    })

    it('falls back to reverse-geocode error when boundary has none', () => {
      const reverseError = new Error('reverse failed')
      mockReverseGeocode.error = reverseError
      const { result } = renderHook(() => useLocationService())
      expect(result.current.error).toBe(reverseError)
    })
  })
})

describe('calculateDistance', () => {
  it('returns 0 for the same coordinates', () => {
    expect(calculateDistance(49.2827, -123.1207, 49.2827, -123.1207)).toBe(0)
  })

  it('computes haversine distance in kilometres', () => {
    // 1 degree of longitude at the equator is ~111.19 km
    expect(calculateDistance(0, 0, 0, 1)).toBeCloseTo(111.19, 1)
  })

  it('is symmetric', () => {
    const vancouverToVictoria = calculateDistance(
      49.2827,
      -123.1207,
      48.4284,
      -123.3656
    )
    const victoriaToVancouver = calculateDistance(
      48.4284,
      -123.3656,
      49.2827,
      -123.1207
    )
    expect(vancouverToVictoria).toBeCloseTo(victoriaToVancouver, 6)
    expect(vancouverToVictoria).toBeGreaterThan(90)
    expect(vancouverToVictoria).toBeLessThan(110)
  })
})

describe('isValidCoordinates', () => {
  it('accepts coordinates on the valid bounds', () => {
    expect(isValidCoordinates(0, 0)).toBe(true)
    expect(isValidCoordinates(90, 180)).toBe(true)
    expect(isValidCoordinates(-90, -180)).toBe(true)
  })

  it('rejects coordinates outside the valid bounds', () => {
    expect(isValidCoordinates(91, 0)).toBe(false)
    expect(isValidCoordinates(-91, 0)).toBe(false)
    expect(isValidCoordinates(0, 181)).toBe(false)
    expect(isValidCoordinates(0, -181)).toBe(false)
  })

  it('rejects non-numeric values', () => {
    expect(isValidCoordinates(NaN, 0)).toBe(false)
    expect(isValidCoordinates(0, NaN)).toBe(false)
    expect(isValidCoordinates('49', -123)).toBe(false)
    expect(isValidCoordinates(null, -123)).toBe(false)
  })
})

describe('formatCoordinates', () => {
  it('formats valid coordinates to 6 decimal places by default', () => {
    expect(formatCoordinates(49.2827, -123.1207)).toBe('49.282700, -123.120700')
  })

  it('respects a custom precision', () => {
    expect(formatCoordinates(49.2827, -123.1207, 2)).toBe('49.28, -123.12')
  })

  it('returns a message for invalid coordinates', () => {
    expect(formatCoordinates(99, 0)).toBe('Invalid coordinates')
    expect(formatCoordinates(NaN, -123)).toBe('Invalid coordinates')
  })
})
