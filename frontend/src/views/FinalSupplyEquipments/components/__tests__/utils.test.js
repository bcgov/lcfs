import { describe, it, expect } from 'vitest'
import {
  datesOverlap,
  transformApiData,
  groupLocationsByCoordinates,
  findOverlappingPeriods,
  sortMixedStrings,
  batchProcessGeofencing
} from '../utils'

describe('FinalSupplyEquipments utils.js', () => {
  it('datesOverlap correctly detects overlaps', () => {
    expect(
      datesOverlap('2023-01-01', '2023-01-31', '2023-01-15', '2023-02-01')
    ).toBe(true)
    expect(
      datesOverlap('2023-01-01', '2023-01-31', '2023-02-01', '2023-02-28')
    ).toBe(false)
  })

  it('transformApiData converts API rows and handles null', () => {
    expect(transformApiData(null)).toEqual([])
    const input = {
      finalSupplyEquipments: [
        {
          finalSupplyEquipmentId: 1,
          serialNbr: 'SN1',
          latitude: '49.3',
          longitude: '-123.1',
          streetAddress: '123 St',
          city: 'Van',
          postalCode: 'V6B',
          supplyFromDate: '2023-01-01',
          supplyToDate: '2023-12-31'
        }
      ]
    }
    const out = transformApiData(input)
    expect(out[0].id).toBe('1_SN1')
    expect(out[0].lat).toBe(49.3)
  })

  it('groupLocationsByCoordinates rounds coords for grouping', () => {
    const grouped = groupLocationsByCoordinates([
      { lat: 49.300001, lng: -123.1 },
      { lat: 49.300001, lng: -123.1 }
    ])
    expect(Object.keys(grouped)).toHaveLength(1)
  })

  it('findOverlappingPeriods detects same-serial overlaps', () => {
    const loc1 = {
      id: '10_SN1',
      uniqueId: 'u1',
      supplyFromDate: '2023-01-01',
      supplyToDate: '2023-03-31'
    }
    const loc2 = {
      id: '11_SN1',
      uniqueId: 'u2',
      supplyFromDate: '2023-03-01',
      supplyToDate: '2023-04-30'
    }
    const result = findOverlappingPeriods(loc1, [loc1, loc2])
    expect(result).toHaveLength(1)
  })

  it('sortMixedStrings puts numeric prefixes first', () => {
    const arr = ['Banana', '2foo', '10bar', 'apple']
    const sorted = sortMixedStrings(arr)
    expect(sorted.slice(0, 2)).toEqual(['2foo', '10bar'])
  })

  it('batchProcessGeofencing maps ids to results', async () => {
    // stub the internal fetch by stubbing global.fetch used by checkLocationInBC
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              address: { state: 'British Columbia', country: 'Canada' }
            })
        })
      )
    )
    const locations = [
      { id: '1', lat: 50, lng: -120 },
      { id: '2', lat: 55, lng: -130 }
    ]
    const results = await batchProcessGeofencing(locations)
    expect(results).toEqual({ 1: true, 2: true })
  })
})
