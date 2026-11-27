import { describe, it, expect, vi } from 'vite-plus/test'

import { transactionsColDefs, defaultSortModel } from '../_schema'

// useTransactionStatuses is used inside the floatingFilterComponentParams of
// the status column – mock it to avoid a real hook call at import time.
vi.mock('@/hooks/useTransactions', () => ({
  useTransactionStatuses: vi.fn()
}))

const t = (key: string) => key
const colDefs = transactionsColDefs(t)
type TransactionColDef = (typeof colDefs)[number]
const valueFormatter = (col: TransactionColDef) => {
  if (typeof col.valueFormatter !== 'function') {
    throw new Error('Expected value formatter')
  }
  return col.valueFormatter
}
const valueGetter = (col: TransactionColDef) => {
  if (typeof col.valueGetter !== 'function') {
    throw new Error('Expected value getter')
  }
  return col.valueGetter
}

const makeRow = (
  overrides: Partial<{
    transactionType: string
    transactionId: number
    compliancePeriod: string | null
    fromOrganization: string | null
    toOrganization: string
    pricePerUnit: number | null
    description: string | null
  }> = {}
) => ({
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

const formatterParams = (data: ReturnType<typeof makeRow>['data']) =>
  ({ data, value: undefined }) as Parameters<
    ReturnType<typeof valueFormatter>
  >[0]
const getterParams = (data: ReturnType<typeof makeRow>['data']) =>
  ({ data }) as Parameters<ReturnType<typeof valueGetter>>[0]

// ---------------------------------------------------------------------------
// defaultSortModel
// ---------------------------------------------------------------------------
describe('defaultSortModel', () => {
  it('is an array with a single entry', () => {
    expect(Array.isArray(defaultSortModel)).toBe(true)
    expect(defaultSortModel).toHaveLength(1)
  })

  it('sorts by updateDate descending', () => {
    expect(defaultSortModel[0]).toEqual({
      field: 'updateDate',
      direction: 'desc'
    })
  })
})

// ---------------------------------------------------------------------------
// transactionType column — valueFormatter
// ---------------------------------------------------------------------------
describe('transactionsColDefs — transactionType column', () => {
  const col = colDefs.find((c) => c.colId === 'transactionType')!

  it('formats StandaloneTransaction as "Legacy Transaction"', () => {
    const params = formatterParams(
      makeRow({
        transactionType: 'StandaloneTransaction',
        description: null
      }).data
    )
    expect(valueFormatter(col)(params)).toBe('Legacy Transaction')
  })

  it('adds spaces to camelCase type names', () => {
    const params = formatterParams(
      makeRow({
        transactionType: 'InitiativeAgreement',
        description: null
      }).data
    )
    // spacesFormatter adds spaces between camelCase words
    const formatted = valueFormatter(col)(params)
    expect(formatted).toMatch(/Initiative/i)
  })

  it('appends description suffix when present', () => {
    const params = formatterParams(
      makeRow({
        transactionType: 'AdminAdjustment',
        description: 'Q1 Correction'
      }).data
    )
    const formatted = valueFormatter(col)(params)
    expect(formatted).toContain('Q1 Correction')
    expect(formatted).toContain(' - ')
  })

  it('does not append suffix when description is null', () => {
    const params = formatterParams(
      makeRow({ transactionType: 'Transfer', description: null }).data
    )
    expect(valueFormatter(col)(params)).not.toContain(' - ')
  })

  it('provides static transaction-type options via floatingFilterComponentParams', () => {
    const optionsQuery = col.floatingFilterComponentParams!.optionsQuery
    const { data } = optionsQuery()
    const types = data.map((d: { type: string }) => d.type)
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
  const col = colDefs.find((c) => c.colId === 'compliancePeriod')!

  it('returns the compliancePeriod when present', () => {
    expect(
      valueGetter(col)(getterParams(makeRow({ compliancePeriod: '2023' }).data))
    ).toBe('2023')
  })

  it('falls back to "N/A" when compliancePeriod is absent', () => {
    expect(
      valueGetter(col)(getterParams(makeRow({ compliancePeriod: null }).data))
    ).toBe('N/A')
    expect(
      valueGetter(col)(
        getterParams(makeRow({ compliancePeriod: undefined }).data)
      )
    ).toBe('N/A')
  })
})

// ---------------------------------------------------------------------------
// fromOrganization column — valueGetter
// ---------------------------------------------------------------------------
describe('transactionsColDefs — fromOrganization column', () => {
  const col = colDefs.find((c) => c.colId === 'fromOrganization')!

  it('returns the organisation name when present', () => {
    expect(
      valueGetter(col)(
        getterParams(makeRow({ fromOrganization: 'Delta Fuels' }).data)
      )
    ).toBe('Delta Fuels')
  })

  it('falls back to "N/A" when fromOrganization is absent', () => {
    expect(
      valueGetter(col)(getterParams(makeRow({ fromOrganization: null }).data))
    ).toBe('N/A')
  })
})

// ---------------------------------------------------------------------------
// pricePerUnit column — valueGetter
// ---------------------------------------------------------------------------
describe('transactionsColDefs — pricePerUnit column', () => {
  const col = colDefs.find((c) => c.colId === 'pricePerUnit')!

  it('returns the numeric value when present', () => {
    expect(
      valueGetter(col)(getterParams(makeRow({ pricePerUnit: 25.5 }).data))
    ).toBe(25.5)
  })

  it('returns 0 as-is', () => {
    expect(
      valueGetter(col)(getterParams(makeRow({ pricePerUnit: 0 }).data))
    ).toBe(0)
  })

  it('returns "N/A" when pricePerUnit is null', () => {
    expect(
      valueGetter(col)(getterParams(makeRow({ pricePerUnit: null }).data))
    ).toBe('N/A')
  })

  it('returns "N/A" when pricePerUnit is undefined', () => {
    expect(
      valueGetter(col)(getterParams(makeRow({ pricePerUnit: undefined }).data))
    ).toBe('N/A')
  })
})

// ---------------------------------------------------------------------------
// updateDate column — comparator
// ---------------------------------------------------------------------------
describe('transactionsColDefs — updateDate column comparator', () => {
  const col = colDefs.find((c) => c.colId === 'updateDate')!
  const comparator = col.filterParams!.comparator!

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
