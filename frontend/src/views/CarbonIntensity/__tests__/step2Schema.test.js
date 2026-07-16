import { describe, expect, it } from 'vitest'

import {
  apiToRow,
  buildPathwayColDefs,
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
    expect(isRenewalRow({ applicationTypeId: 2 }, APPLICATION_TYPES)).toBe(true)
  })
  it('returns false for New rows', () => {
    expect(isRenewalRow({ applicationTypeId: 1 }, APPLICATION_TYPES)).toBe(
      false
    )
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
    expect(validatePathwayRow(renewal, APPLICATION_TYPES)).toContain(
      'fuelCodeId'
    )
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

describe('buildPathwayColDefs — fuel code iteration empty state', () => {
  const fuelCodeCol = (fuelCodes) =>
    buildPathwayColDefs({
      optionsData: { pathwayApplicationTypes: APPLICATION_TYPES, fuelCodes },
      canEdit: true
    }).find((c) => c.field === 'fuelCodeId')

  const renewalRow = { data: { applicationTypeId: 2 } }
  const newRow = { data: { applicationTypeId: 1 } }

  it('gives renewal rows an explanatory tooltip when no iterations are available', () => {
    const tip = fuelCodeCol([]).tooltipValueGetter(renewalRow)
    expect(typeof tip).toBe('string')
    expect(tip.length).toBeGreaterThan(0)
  })

  it('shows no tooltip when the org owns renewable iterations', () => {
    const col = fuelCodeCol([{ fuelCodeId: 1, fuelCode: 'BCLCF101.4' }])
    expect(col.tooltipValueGetter(renewalRow)).toBeNull()
  })

  it('shows no tooltip on New rows even with an empty iteration list', () => {
    expect(fuelCodeCol([]).tooltipValueGetter(newRow)).toBeNull()
  })
})

describe('buildPathwayColDefs — Renewal CI carry-over prevention', () => {
  const fuelCodes = [
    {
      fuelCodeId: 42,
      fuelCode: 'C-BCLCF100.4',
      carbonIntensity: 23.23,
      fuelTypeId: 1,
      feedstock: 'Corn',
      feedstockLocation: 'Ontario'
    }
  ]

  const colDefs = buildPathwayColDefs({
    optionsData: { pathwayApplicationTypes: APPLICATION_TYPES, fuelCodes },
    canEdit: true
  })
  const applicationTypeCol = colDefs.find((c) => c.field === 'applicationTypeId')
  const fuelCodeCol = colDefs.find((c) => c.field === 'fuelCodeId')

  it('blanks proposedCi when the applicant selects Renewal', () => {
    const data = { applicationTypeId: 1, proposedCi: 5.61 }
    applicationTypeCol.valueSetter({ data, newValue: 'Renewal' })
    expect(data.proposedCi).toBeNull()
  })

  it('leaves proposedCi untouched when switching between non-Renewal types', () => {
    const data = { applicationTypeId: 1, proposedCi: 5.61 }
    applicationTypeCol.valueSetter({ data, newValue: 'New' })
    expect(data.proposedCi).toBe(5.61)
  })

  it('does not populate proposedCi from the selected fuel code iteration', () => {
    const data = { applicationTypeId: 2, proposedCi: null }
    fuelCodeCol.valueSetter({ data, newValue: 'C-BCLCF100.4' })
    expect(data.fuelCodeId).toBe(42)
    expect(data.proposedCi).toBeNull()
  })
})
