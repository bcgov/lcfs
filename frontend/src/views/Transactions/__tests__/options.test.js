import { describe, it, expect, vi } from 'vitest'

// useTransactionStatuses is used inside the floatingFilterComponentParams of
// the status column – mock it to avoid a real hook call at import time.
vi.mock('@/hooks/useTransactions', () => ({
  useTransactionStatuses: vi.fn()
}))

import { transactionsColDefs, defaultSortModel } from '../_schema'

const t = (key) => key
const colDefs = transactionsColDefs(t)

const makeRow = (overrides = {}) => ({
  data: {
    transactionType: 'Transfer',
    transactionId: 1,
    compliancePeriod: '2024',
    fromOrganization: 'Org A',
    toOrganization: 'Org B',
    pricePerUnit: 10,
    description: null,
    ...overrides
  }
})

// ---------------------------------------------------------------------------
// defaultSortModel
// ---------------------------------------------------------------------------
describe('defaultSortModel', () => {
  it('is an array with a single entry', () => {
    expect(Array.isArray(defaultSortModel)).toBe(true)
    expect(defaultSortModel).toHaveLength(1)
  })

  it('sorts by updateDate descending', () => {
    expect(defaultSortModel[0]).toEqual({ field: 'updateDate', direction: 'desc' })
  })
})

// ---------------------------------------------------------------------------
// transactionType column — valueFormatter
// ---------------------------------------------------------------------------
describe('transactionsColDefs — transactionType column', () => {
  const col = colDefs.find((c) => c.colId === 'transactionType')

  it('formats StandaloneTransaction as "Legacy Transaction"', () => {
    const params = makeRow({ transactionType: 'StandaloneTransaction', description: null })
    expect(col.valueFormatter(params)).toBe('Legacy Transaction')
  })

  it('adds spaces to camelCase type names', () => {
    const params = makeRow({ transactionType: 'InitiativeAgreement', description: null })
    // spacesFormatter adds spaces between camelCase words
    const formatted = col.valueFormatter(params)
    expect(formatted).toMatch(/Initiative/i)
  })

  it('appends description suffix when present', () => {
    const params = makeRow({
      transactionType: 'AdminAdjustment',
      description: 'Q1 Correction'
    })
    const formatted = col.valueFormatter(params)
    expect(formatted).toContain('Q1 Correction')
    expect(formatted).toContain(' - ')
  })

  it('does not append suffix when description is null', () => {
    const params = makeRow({ transactionType: 'Transfer', description: null })
    expect(col.valueFormatter(params)).not.toContain(' - ')
  })

  it('provides static transaction-type options via floatingFilterComponentParams', () => {
    const { data } = col.floatingFilterComponentParams.optionsQuery()
    const types = data.map((d) => d.type)
    expect(types).toContain('Transfer')
    expect(types).toContain('ComplianceReport')
    expect(types).toContain('AdminAdjustment')
    expect(types).toContain('InitiativeAgreement')
    expect(types).toContain('StandaloneTransaction')
    expect(types).toContain('AggregatorIssuance')
  })
})

// ---------------------------------------------------------------------------
// compliancePeriod column — valueGetter
// ---------------------------------------------------------------------------
describe('transactionsColDefs — compliancePeriod column', () => {
  const col = colDefs.find((c) => c.colId === 'compliancePeriod')

  it('returns the compliancePeriod when present', () => {
    expect(col.valueGetter(makeRow({ compliancePeriod: '2023' }))).toBe('2023')
  })

  it('falls back to "N/A" when compliancePeriod is absent', () => {
    expect(col.valueGetter(makeRow({ compliancePeriod: null }))).toBe('N/A')
    expect(col.valueGetter(makeRow({ compliancePeriod: undefined }))).toBe('N/A')
  })
})

// ---------------------------------------------------------------------------
// fromOrganization column — valueGetter
// ---------------------------------------------------------------------------
describe('transactionsColDefs — fromOrganization column', () => {
  const col = colDefs.find((c) => c.colId === 'fromOrganization')

  it('returns the organisation name when present', () => {
    expect(col.valueGetter(makeRow({ fromOrganization: 'Delta Fuels' }))).toBe(
      'Delta Fuels'
    )
  })

  it('falls back to "N/A" when fromOrganization is absent', () => {
    expect(col.valueGetter(makeRow({ fromOrganization: null }))).toBe('N/A')
  })
})

// ---------------------------------------------------------------------------
// pricePerUnit column — valueGetter
// ---------------------------------------------------------------------------
describe('transactionsColDefs — pricePerUnit column', () => {
  const col = colDefs.find((c) => c.colId === 'pricePerUnit')

  it('returns the numeric value when present', () => {
    expect(col.valueGetter(makeRow({ pricePerUnit: 25.5 }))).toBe(25.5)
  })

  it('returns 0 as-is', () => {
    expect(col.valueGetter(makeRow({ pricePerUnit: 0 }))).toBe(0)
  })

  it('returns "N/A" when pricePerUnit is null', () => {
    expect(col.valueGetter(makeRow({ pricePerUnit: null }))).toBe('N/A')
  })

  it('returns "N/A" when pricePerUnit is undefined', () => {
    expect(col.valueGetter(makeRow({ pricePerUnit: undefined }))).toBe('N/A')
  })
})

// ---------------------------------------------------------------------------
// updateDate column — comparator
// ---------------------------------------------------------------------------
describe('transactionsColDefs — updateDate column comparator', () => {
  const col = colDefs.find((c) => c.colId === 'updateDate')
  const comparator = col.filterParams.comparator

  it('returns -1 when cellDate is before filterDate', () => {
    const filterDate = new Date(2024, 5, 1) // local 1 Jun 2024
    const cellValue = new Date(2024, 0, 15).toISOString()
    expect(comparator(filterDate, cellValue)).toBe(-1)
  })

  it('returns 1 when cellDate is after filterDate', () => {
    const filterDate = new Date(2024, 0, 1) // local 1 Jan 2024
    const cellValue = new Date(2024, 5, 15).toISOString()
    expect(comparator(filterDate, cellValue)).toBe(1)
  })

  it('returns 0 when cellDate equals filterDate (same calendar day)', () => {
    const filterDate = new Date(2024, 2, 15) // local 15 Mar 2024
    const cellValue = new Date(2024, 2, 15, 14, 30).toISOString()
    expect(comparator(filterDate, cellValue)).toBe(0)
  })
})
