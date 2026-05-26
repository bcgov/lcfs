import { describe, expect, it, vi } from 'vitest'

import {
  ciApplicationsColDefs,
  defaultSortModel,
  getResumeStep
} from '@/views/CarbonIntensity/_schema'

vi.mock('@/hooks/useCIApplication', () => ({
  useCIApplicationStatuses: () => ({ data: [] })
}))

const t = (key) => key

describe('ciApplicationsColDefs (BCeID)', () => {
  it('returns exactly five columns in the wireframe order', () => {
    const cols = ciApplicationsColDefs(t, { isGovernment: false })
    expect(cols.map((c) => c.field)).toEqual([
      'status.status',
      'ciApplicationId',
      'proposedFuelCodeEffectiveDate',
      'productionFacilityLocation',
      'updateDate'
    ])
  })

  it('drops IDIR-only triage columns', () => {
    const cols = ciApplicationsColDefs(t, { isGovernment: false })
    const fields = cols.map((c) => c.field)
    for (const idirField of [
      'organization.name',
      'priorityScore',
      'verificationLevel',
      'assignedAnalyst',
      'lastComment'
    ]) {
      expect(fields).not.toContain(idirField)
    }
  })

  it('omitting the options object defaults to the BCeID layout', () => {
    expect(ciApplicationsColDefs(t)).toHaveLength(5)
  })
})

describe('ciApplicationsColDefs (IDIR)', () => {
  it('returns the full ten-column inbox in wireframe order', () => {
    const cols = ciApplicationsColDefs(t, { isGovernment: true })
    expect(cols.map((c) => c.field)).toEqual([
      'status.status',
      'ciApplicationId',
      'organization.name',
      'priorityScore',
      'verificationLevel',
      'assignedAnalyst',
      'lastComment',
      'proposedFuelCodeEffectiveDate',
      'productionFacilityLocation',
      'updateDate'
    ])
  })

  it('renders the Status column with a select-based floating filter', () => {
    const cols = ciApplicationsColDefs(t, { isGovernment: true })
    const status = cols.find((c) => c.field === 'status.status')
    expect(status).toBeDefined()
    expect(status.floatingFilterComponent).toBeDefined()
    expect(status.floatingFilterComponentParams).toMatchObject({
      valueKey: 'status',
      labelKey: 'status'
    })
    expect(status.sortable).toBe(false)
  })

  it('Assigned analyst / Last comment columns are non-sortable display pills', () => {
    const cols = ciApplicationsColDefs(t, { isGovernment: true })
    const analyst = cols.find((c) => c.field === 'assignedAnalyst')
    const comment = cols.find((c) => c.field === 'lastComment')
    expect(analyst.sortable).toBe(false)
    expect(comment.sortable).toBe(false)
    expect(typeof analyst.cellRenderer).toBe('function')
    expect(typeof comment.cellRenderer).toBe('function')
  })
})

describe('productionFacilityLocation column', () => {
  const getter = ciApplicationsColDefs(t, { isGovernment: false }).find(
    (c) => c.field === 'productionFacilityLocation'
  ).valueGetter

  const call = (data) => getter({ data })

  it('joins city, province/state, and country in the expected layout', () => {
    expect(
      call({
        facilityCity: 'San Martin',
        facilityProvinceState: 'Santa Fe',
        facilityCountry: 'Argentina'
      })
    ).toBe('San Martin Santa Fe, Argentina')
  })

  it('drops the province segment when not provided', () => {
    expect(
      call({
        facilityCity: 'Vancouver',
        facilityProvinceState: null,
        facilityCountry: 'Canada'
      })
    ).toBe('Vancouver, Canada')
  })

  it('handles a country-only row without a leading comma', () => {
    expect(
      call({
        facilityCity: null,
        facilityProvinceState: null,
        facilityCountry: 'Argentina'
      })
    ).toBe('Argentina')
  })

  it('returns empty string for an empty row', () => {
    expect(call(undefined)).toBe('')
    expect(call({})).toBe('')
  })
})

describe('defaultSortModel', () => {
  it('sorts by update date descending so the inbox is newest-first', () => {
    expect(defaultSortModel).toEqual([
      { field: 'updateDate', direction: 'desc' }
    ])
  })
})

describe('getResumeStep', () => {
  it('routes drafts to the Step 2 fuel-pathways editor', () => {
    expect(getResumeStep({ status: { status: 'Draft' } })).toBe(2)
  })

  it.each(['Submitted', 'Completed', 'Withdrawn'])(
    'routes %s applications to the Step 5 decision panel',
    (status) => {
      expect(getResumeStep({ status: { status } })).toBe(5)
    }
  )

  it('falls back to Step 1 for unknown / missing status', () => {
    expect(getResumeStep({})).toBe(1)
    expect(getResumeStep({ status: { status: 'Unknown' } })).toBe(1)
    expect(getResumeStep(null)).toBe(1)
  })
})
