import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fixLeafletIcons,
  createMarkerIcon,
  markerIcons,
  datesOverlap,
  transformApiData,
  groupLocationsByCoordinates,
  findOverlappingPeriods,
  sortMixedStrings
} from '../utils'

// Mock Leaflet
vi.mock('leaflet', () => {
  const mockDefaultIcon = vi.fn().mockImplementation(() => ({
    type: 'default-icon'
  }))

  const mockIcon = vi.fn().mockImplementation((options) => ({
    options,
    iconUrl: options.iconUrl,
    shadowUrl: options.shadowUrl,
    iconSize: options.iconSize,
    iconAnchor: options.iconAnchor,
    popupAnchor: options.popupAnchor
  }))

  mockDefaultIcon.prototype = {
    _getIconUrl: vi.fn()
  }
  mockDefaultIcon.mergeOptions = vi.fn()

  mockIcon.Default = mockDefaultIcon

  const L = {
    Icon: mockIcon
  }

  return { default: L }
})

describe('FinalSupplyEquipments utils.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('fixLeafletIcons', () => {
    it('should delete _getIconUrl and merge options', async () => {
      const L = (await import('leaflet')).default

      fixLeafletIcons()

      expect(L.Icon.Default.prototype._getIconUrl).toBeUndefined()
      expect(L.Icon.Default.mergeOptions).toHaveBeenCalledWith({
        iconRetinaUrl:
          'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl:
          'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png'
      })
    })
  })

  describe('createMarkerIcon', () => {
    it('should create marker icon with correct color and properties', async () => {
      const L = (await import('leaflet')).default
      const color = 'red'

      const icon = createMarkerIcon(color)

      expect(L.Icon).toHaveBeenCalledWith({
        iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
        shadowUrl:
          'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34]
      })
    })

    it('should work with different color values', async () => {
      const L = (await import('leaflet')).default

      createMarkerIcon('blue')
      createMarkerIcon('green')

      expect(L.Icon).toHaveBeenCalledTimes(2)
    })
  })

  describe('markerIcons', () => {
    it('should have all expected marker icons', () => {
      expect(markerIcons).toHaveProperty('default')
      expect(markerIcons).toHaveProperty('red')
      expect(markerIcons).toHaveProperty('orange')
      expect(markerIcons).toHaveProperty('grey')
    })

    it('should have correct structure', () => {
      expect(typeof markerIcons).toBe('object')
      expect(Object.keys(markerIcons)).toHaveLength(4)
    })
  })

  describe('datesOverlap', () => {
    it('should detect overlapping date ranges', () => {
      expect(
        datesOverlap('2023-01-01', '2023-01-31', '2023-01-15', '2023-02-01')
      ).toBe(true)
      expect(
        datesOverlap('2023-01-01', '2023-03-31', '2023-02-01', '2023-02-28')
      ).toBe(true)
    })

    it('should detect non-overlapping date ranges', () => {
      expect(
        datesOverlap('2023-01-01', '2023-01-31', '2023-02-01', '2023-02-28')
      ).toBe(false)
      expect(
        datesOverlap('2023-03-01', '2023-03-31', '2023-01-01', '2023-02-28')
      ).toBe(false)
    })

    it('should handle edge cases with same dates', () => {
      expect(
        datesOverlap('2023-01-01', '2023-01-31', '2023-01-31', '2023-02-28')
      ).toBe(true)
      expect(
        datesOverlap('2023-01-01', '2023-01-31', '2023-02-01', '2023-01-31')
      ).toBe(false)
    })

    it('should handle identical date ranges', () => {
      expect(
        datesOverlap('2023-01-01', '2023-01-31', '2023-01-01', '2023-01-31')
      ).toBe(true)
    })
  })

  describe('transformApiData', () => {
    it('should return empty array for null data', () => {
      expect(transformApiData(null)).toEqual([])
      expect(transformApiData(undefined)).toEqual([])
    })

    it('should return empty array for data without finalSupplyEquipments', () => {
      expect(transformApiData({})).toEqual([])
      expect(transformApiData({ finalSupplyEquipments: null })).toEqual([])
    })

    it('should transform valid API data correctly', () => {
      const input = {
        finalSupplyEquipments: [
          {
            chargingEquipmentId: 1,
            serialNumber: 'SN1',
            latitude: '49.3',
            longitude: '-123.1',
            streetAddress: '123 Main St',
            city: 'Vancouver',
            postalCode: 'V6B 1A1',
            supplyFromDate: '2023-01-01',
            supplyToDate: '2023-12-31'
          }
        ]
      }

      const result = transformApiData(input)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: '1_SN1',
        uniqueId: '1_SN1_0',
        chargingEquipmentId: 1,
        serialNumber: 'SN1',
        name: '123 Main St, Vancouver, V6B 1A1',
        lat: 49.3,
        lng: -123.1,
        supplyFromDate: '2023-01-01',
        supplyToDate: '2023-12-31'
      })
    })

    it('should handle missing properties with fallbacks', () => {
      const input = {
        finalSupplyEquipments: [
          {
            chargingEquipmentId: null,
            serialNumber: null,
            latitude: null,
            longitude: null,
            streetAddress: null,
            city: null,
            postalCode: null,
            supplyFromDate: null,
            supplyToDate: null
          }
        ]
      }

      const result = transformApiData(input)

      expect(result[0]).toMatchObject({
        id: 'unknown_unknown',
        uniqueId: 'unknown_unknown_0',
        chargingEquipmentId: 'unknown',
        serialNumber: 'unknown',
        lat: 0,
        lng: 0
      })
      expect(result[0].supplyFromDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(result[0].supplyToDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should handle multiple items', () => {
      const input = {
        finalSupplyEquipments: [
          { chargingEquipmentId: 1, serialNumber: 'SN1' },
          { chargingEquipmentId: 2, serialNumber: 'SN2' }
        ]
      }

      const result = transformApiData(input)

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('1_SN1')
      expect(result[1].id).toBe('2_SN2')
    })

    it('normalizes numeric values for kwhUsage and powerOutput', () => {
      const input = {
        finalSupplyEquipments: [
          {
            chargingEquipmentId: 1,
            serialNumber: 'SN1',
            kwhUsage: '123.45',
            powerOutput: '50'
          },
          {
            chargingEquipmentId: 2,
            serialNumber: 'SN2',
            kwhUsage: null,
            powerOutput: undefined
          }
        ]
      }

      const result = transformApiData(input)

      expect(result[0].kwhUsage).toBeCloseTo(123.45)
      expect(result[0].powerOutput).toBe(50)
      expect(result[1].kwhUsage).toBeNull()
      expect(result[1].powerOutput).toBeNull()
    })
  })

  describe('groupLocationsByCoordinates', () => {
    it('should group locations by coordinates', () => {
      const locations = [
        { lat: 49.3, lng: -123.1, name: 'Location 1' },
        { lat: 49.3, lng: -123.1, name: 'Location 2' },
        { lat: 50.0, lng: -124.0, name: 'Location 3' }
      ]

      const result = groupLocationsByCoordinates(locations)

      expect(Object.keys(result)).toHaveLength(2)
      expect(result['49.300000,-123.100000']).toHaveLength(2)
      expect(result['50.000000,-124.000000']).toHaveLength(1)
    })

    it('should handle empty array', () => {
      expect(groupLocationsByCoordinates([])).toEqual({})
    })

    it('should handle precise coordinate grouping', () => {
      const locations = [
        { lat: 49.300001, lng: -123.100001 },
        { lat: 49.300002, lng: -123.100002 }
      ]

      const result = groupLocationsByCoordinates(locations)

      expect(Object.keys(result)).toHaveLength(2)
    })
  })

  describe('findOverlappingPeriods', () => {
    const mockLocations = [
      {
        id: '10_SN1',
        uniqueId: 'u1',
        supplyFromDate: '2023-01-01',
        supplyToDate: '2023-03-31',
        name: 'Location 1'
      },
      {
        id: '10_SN1', // Same FSE ID and serial number as first one
        uniqueId: 'u2',
        supplyFromDate: '2023-03-01',
        supplyToDate: '2023-04-30',
        name: 'Location 2'
      },
      {
        id: '10_SN2', // Same FSE ID but different serial number
        uniqueId: 'u3',
        supplyFromDate: '2023-02-01',
        supplyToDate: '2023-04-30',
        name: 'Location 3'
      },
      {
        id: '11_SN1', // Different FSE ID but same serial number
        uniqueId: 'u4',
        supplyFromDate: '2023-02-01',
        supplyToDate: '2023-04-30',
        name: 'Location 4'
      }
    ]

    it('should find overlapping periods for same FSE ID and serial number', () => {
      const result = findOverlappingPeriods(mockLocations[0], mockLocations)

      expect(result).toHaveLength(1)
      expect(result[0].uniqueId).toBe('u2')
      expect(result[0].fseId).toBe('10')
      expect(result[0].serialNum).toBe('SN1')
    })

    it('should return empty array when no overlaps', () => {
      const currentLoc = {
        id: '12_SN3',
        uniqueId: 'u5',
        supplyFromDate: '2023-05-01',
        supplyToDate: '2023-06-30',
        name: 'Location 5'
      }

      const result = findOverlappingPeriods(currentLoc, mockLocations)

      expect(result).toHaveLength(0)
    })

    it('should exclude same record from results', () => {
      const result = findOverlappingPeriods(mockLocations[0], mockLocations)

      expect(result.find((loc) => loc.uniqueId === 'u1')).toBeUndefined()
    })

    it('should only match same FSE ID and serial numbers', () => {
      const result = findOverlappingPeriods(mockLocations[0], mockLocations)

      // Should not match different serial number
      expect(result.find((loc) => loc.serialNum === 'SN2')).toBeUndefined()
      // Should not match different FSE ID
      expect(result.find((loc) => loc.uniqueId === 'u4')).toBeUndefined()
    })

    it('should not match if dates do not overlap', () => {
      const nonOverlappingLocations = [
        {
          id: '10_SN1',
          uniqueId: 'u1',
          supplyFromDate: '2023-01-01',
          supplyToDate: '2023-01-31',
          name: 'Location 1'
        },
        {
          id: '10_SN1',
          uniqueId: 'u2',
          supplyFromDate: '2023-02-01',
          supplyToDate: '2023-02-28',
          name: 'Location 2'
        }
      ]

      const result = findOverlappingPeriods(
        nonOverlappingLocations[0],
        nonOverlappingLocations
      )

      expect(result).toHaveLength(0)
    })
  })

  describe('sortMixedStrings', () => {
    it('should put strings with numeric prefixes first', () => {
      const input = ['banana', '2foo', '10bar', 'apple']
      const result = sortMixedStrings(input)

      expect(result.slice(0, 2)).toEqual(['2foo', '10bar'])
      expect(result.slice(2)).toEqual(['apple', 'banana'])
    })

    it('should sort numeric prefixes numerically', () => {
      const input = ['10item', '2item', '1item']
      const result = sortMixedStrings(input)

      expect(result).toEqual(['1item', '2item', '10item'])
    })

    it('should handle strings ending with numbers', () => {
      const input = ['item10', 'item2', 'item1']
      const result = sortMixedStrings(input)

      expect(result).toEqual(['item1', 'item2', 'item10'])
    })

    it('should sort alphabetically for non-numeric strings', () => {
      const input = ['zebra', 'apple', 'banana']
      const result = sortMixedStrings(input)

      expect(result).toEqual(['apple', 'banana', 'zebra'])
    })

    it('should handle mixed scenarios', () => {
      const input = ['item2', '1prefix', 'zebra', 'apple', '10prefix']
      const result = sortMixedStrings(input)

      expect(result).toEqual(['1prefix', '10prefix', 'apple', 'item2', 'zebra'])
    })

    it('should handle empty array', () => {
      expect(sortMixedStrings([])).toEqual([])
    })

    it('should handle single element', () => {
      expect(sortMixedStrings(['single'])).toEqual(['single'])
    })

    it('should not mutate original array', () => {
      const original = ['c', 'a', 'b']
      const sorted = sortMixedStrings(original)

      expect(original).toEqual(['c', 'a', 'b'])
      expect(sorted).toEqual(['a', 'b', 'c'])
    })

    it('should handle case insensitive sorting', () => {
      const input = ['Zebra', 'apple', 'Banana']
      const result = sortMixedStrings(input)

      expect(result).toEqual(['apple', 'Banana', 'Zebra'])
    })

    it('should handle numeric prefixes with same remainder', () => {
      const input = ['10item', '2item', '1item']
      const result = sortMixedStrings(input)

      expect(result).toEqual(['1item', '2item', '10item'])
    })
  })
})
