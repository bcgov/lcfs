import { describe, expect, it, vi } from 'vite-plus/test'

import {
  defaultSortModel,
  EMPTY_CELL,
  formatDisbursement,
  formatPacificDate,
  lcjfipApplicationColDefs
} from '../_schema'

vi.mock('@/constants/config', () => ({
  CONFIG: { API_BASE: '', ENVIRONMENT: 'test' },
  FEATURE_FLAGS: { LCJFIP: 'lcjfip' },
  isFeatureEnabled: vi.fn(() => false)
}))

const t = (key, values) =>
  values?.amount !== undefined ? `${values.amount} credits` : key

const column = (field, isGovernment = true) =>
  lcjfipApplicationColDefs(t, { isGovernment }).find(
    (colDef) => colDef.field === field
  )

describe('lcjfipApplicationColDefs', () => {
  it('lists the story’s columns in order, with Contact from the mock-up', () => {
    expect(
      lcjfipApplicationColDefs(t, { isGovernment: true }).map(
        (colDef) => colDef.field
      )
    ).toEqual([
      'status',
      'applicationNumber',
      'organizationName',
      'contactName',
      'submittedDate',
      'incentiveAwardDate',
      'authorizedDisbursement'
    ])
  })

  it('leaves the organization column out for BCeID users', () => {
    const fields = lcjfipApplicationColDefs(t, { isGovernment: false }).map(
      (colDef) => colDef.field
    )
    expect(fields).not.toContain('organizationName')
    expect(fields).toHaveLength(6)
  })

  it('uses translation keys for every header', () => {
    for (const colDef of lcjfipApplicationColDefs(t, { isGovernment: true })) {
      expect(colDef.headerName).toMatch(/^lcjfip:index\.columns\./)
    }
  })

  it('filters text columns as text and the submission date as a date', () => {
    for (const field of [
      'applicationNumber',
      'organizationName',
      'contactName'
    ]) {
      expect(column(field).filter).toBe('agTextColumnFilter')
      expect(column(field).sortable).not.toBe(false)
    }
    expect(column('submittedDate').filter).toBe('agDateColumnFilter')
    expect(column('status').floatingFilterComponentParams.valueKey).toBe(
      'status'
    )
  })

  it('neither filters nor sorts the award and disbursement columns yet', () => {
    for (const field of ['incentiveAwardDate', 'authorizedDisbursement']) {
      expect(column(field).filter).toBe(false)
      expect(column(field).sortable).toBe(false)
    }
  })

  it('shows a dash in empty cells and centres the dates and amount', () => {
    for (const field of [
      'submittedDate',
      'incentiveAwardDate',
      'authorizedDisbursement'
    ]) {
      expect(column(field).valueFormatter({ value: null, data: {} })).toBe(
        EMPTY_CELL
      )
      expect(column(field).cellStyle).toEqual({ textAlign: 'center' })
    }
    expect(EMPTY_CELL).toBe('—')
  })

  it('shows the disbursement in the unit of the preferred option', () => {
    const format = column('authorizedDisbursement').valueFormatter
    expect(format({ value: 625000, data: { incentiveType: 'Cash' } })).toBe(
      '$625,000.00'
    )
    expect(format({ value: 5000, data: { incentiveType: 'Credit' } })).toBe(
      '5,000 credits'
    )
  })

  it('has no default sort; the server lists recent changes first', () => {
    expect(defaultSortModel).toEqual([])
  })
})

describe('formatPacificDate', () => {
  it('shows the Pacific calendar date, not the UTC one', () => {
    // 03:30 UTC on the 20th is the evening of the 19th in B.C.
    expect(formatPacificDate('2026-11-20T03:30:00Z')).toBe('2026-11-19')
    expect(formatPacificDate('2026-11-20T18:00:00Z')).toBe('2026-11-20')
  })

  it('shows nothing for a missing date', () => {
    expect(formatPacificDate(null)).toBe('')
    expect(formatPacificDate(undefined)).toBe('')
  })
})

describe('formatDisbursement', () => {
  const credits = (amount) => `${amount} credits`
  it('is empty until a disbursement is authorized', () => {
    expect(formatDisbursement(null, 'Cash', credits)).toBe('')
    expect(formatDisbursement(undefined, 'Credit', credits)).toBe('')
  })

  it('treats zero as a value', () => {
    expect(formatDisbursement(0, 'Cash', credits)).toBe('$0.00')
  })
})
