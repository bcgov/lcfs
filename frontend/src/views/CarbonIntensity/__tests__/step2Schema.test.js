import { describe, expect, it } from 'vitest'

import {
  apiToRow,
  isRenewalRow,
  rowToApiPayload,
  validatePathwayRow
} from '@/views/CarbonIntensity/components/_step2Schema'

const APPLICATION_TYPES = [
  { pathwayApplicationTypeId: 1, type: 'New' },
  { pathwayApplicationTypeId: 2, type: 'Renewal' }
]

const validRow = {
  id: 'r1',
  pathwayId: null,
  applicationTypeId: 1,
  fuelCodeTypeId: 1,
  operatingDataFrom: '2025-01-01',
  operatingDataTo: '2025-12-31',
  fuelCodeId: null,
  proposedCi: 5.61,
  fuelTypeId: 1,
  feedstock: 'Canola',
  feedstockRegion: 'Saskatchewan',
  feedstockTransportMode: 'Truck',
  feedstockTransportDistance: 100,
  coproducts: '',
  finishedFuelTransportMode: 'Rail',
  finishedFuelTransportDistance: 200
}

describe('isRenewalRow', () => {
  it('returns true when application type matches Renewal', () => {
    expect(
      isRenewalRow({ applicationTypeId: 2 }, APPLICATION_TYPES)
    ).toBe(true)
  })
  it('returns false for New rows', () => {
    expect(
      isRenewalRow({ applicationTypeId: 1 }, APPLICATION_TYPES)
    ).toBe(false)
  })
  it('returns false for unset rows', () => {
    expect(isRenewalRow({}, APPLICATION_TYPES)).toBe(false)
  })
})

describe('validatePathwayRow', () => {
  it('returns no errors for a complete New row', () => {
    expect(validatePathwayRow(validRow, APPLICATION_TYPES)).toEqual([])
  })

  it('flags every required field on an empty row', () => {
    const errs = validatePathwayRow(
      { id: 'x', applicationTypeId: 1 },
      APPLICATION_TYPES
    )
    expect(errs).toContain('fuelCodeTypeId')
    expect(errs).toContain('operatingDataFrom')
    expect(errs).toContain('operatingDataTo')
    expect(errs).toContain('proposedCi')
    expect(errs).toContain('fuelTypeId')
    expect(errs).toContain('feedstock')
    expect(errs).toContain('feedstockRegion')
    expect(errs).toContain('feedstockTransportMode')
    expect(errs).toContain('finishedFuelTransportMode')
  })

  it('requires fuelCodeId on Renewal rows', () => {
    const renewal = { ...validRow, applicationTypeId: 2, fuelCodeId: null }
    expect(validatePathwayRow(renewal, APPLICATION_TYPES)).toContain('fuelCodeId')
  })

  it('does not require fuelCodeId on New rows', () => {
    expect(validatePathwayRow(validRow, APPLICATION_TYPES)).not.toContain(
      'fuelCodeId'
    )
  })

  it('flags inverted operating dates', () => {
    const inverted = {
      ...validRow,
      operatingDataFrom: '2025-12-31',
      operatingDataTo: '2025-01-01'
    }
    expect(validatePathwayRow(inverted, APPLICATION_TYPES)).toContain(
      'operatingDataTo'
    )
  })
})

describe('rowToApiPayload', () => {
  it('coerces numeric fields and strips empty coproducts', () => {
    const payload = rowToApiPayload({
      ...validRow,
      proposedCi: '5.61',
      feedstockTransportDistance: '100',
      finishedFuelTransportDistance: '200',
      coproducts: '   '
    })
    expect(payload.proposedCi).toBe(5.61)
    expect(payload.feedstockTransportDistance).toBe(100)
    expect(payload.finishedFuelTransportDistance).toBe(200)
    expect(payload.coproducts).toBeNull()
  })

  it('passes through fuelCodeId for renewals', () => {
    const payload = rowToApiPayload({ ...validRow, fuelCodeId: 99 })
    expect(payload.fuelCodeId).toBe(99)
  })
})

describe('apiToRow', () => {
  it('maps a server pathway back to grid shape', () => {
    const row = apiToRow({
      pathwayId: 7,
      applicationTypeId: 2,
      fuelCodeTypeId: 1,
      operatingDataFrom: '2025-01-01',
      operatingDataTo: '2025-12-31',
      fuelCodeId: 42,
      proposedCi: '23.23',
      fuelTypeId: 1,
      feedstock: 'Corn',
      feedstockRegion: 'Ontario',
      feedstockTransportMode: 'Truck',
      feedstockTransportDistance: 50,
      coproducts: null,
      finishedFuelTransportMode: 'Rail',
      finishedFuelTransportDistance: 75
    })
    expect(row.pathwayId).toBe(7)
    expect(row.proposedCi).toBe(23.23)
    expect(row.id).toBe('pathway-7')
  })
})
