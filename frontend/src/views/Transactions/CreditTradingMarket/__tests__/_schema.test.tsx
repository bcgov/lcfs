import { describe, it, expect } from 'vite-plus/test'
import { render, screen } from '@testing-library/react'
import { creditMarketAuditLogColDefs, formatAuditChanges } from '../_schema'

const t = (key: string, fallback?: string) => fallback ?? key

describe('formatAuditChanges', () => {
  it('renders each field change as a labelled old → new line', () => {
    const lines = formatAuditChanges(
      [
        { field: 'credits_to_sell', oldValue: 250, newValue: 0 },
        { field: 'display_in_credit_market', oldValue: true, newValue: false },
        {
          field: 'credit_market_contact_email',
          oldValue: null,
          newValue: 'a@b.c'
        }
      ],
      t
    )

    expect(lines).toEqual([
      'Credits to sell: 250 → 0',
      'Display in credit trading market: Yes → No',
      'Email: (blank) → a@b.c'
    ])
  })

  it('falls back to the raw field name for unknown fields', () => {
    expect(
      formatAuditChanges([{ field: 'mystery', oldValue: 1, newValue: 2 }], t)
    ).toEqual(['mystery: 1 → 2'])
  })

  it('returns nothing for legacy rows without a diff', () => {
    expect(formatAuditChanges([], t)).toEqual([])
    expect(formatAuditChanges([], t)).toEqual([])
  })
})

describe('creditMarketAuditLogColDefs', () => {
  const colDefs = creditMarketAuditLogColDefs(t)
  const byField = (field: string) => colDefs.find((c) => c.field === field)!
  const callValueFormatter = (field: string, params: { value: unknown }) => {
    const formatter = byField(field).valueFormatter
    if (typeof formatter !== 'function') throw new Error('Expected formatter')
    return formatter(params as Parameters<typeof formatter>[0])
  }

  it('includes action and changes columns alongside the snapshot columns', () => {
    expect(colDefs.map((c) => c.field)).toEqual([
      'organizationName',
      'action',
      'changes',
      'creditsToSell',
      'roleInMarket',
      'contactPerson',
      'phone',
      'email',
      'changedBy',
      'uploadedDate'
    ])
  })

  it('shows N/A for rows without an action', () => {
    expect(callValueFormatter('action', { value: null })).toBe('N/A')
    expect(callValueFormatter('action', { value: 'Removed' })).toBe('Removed')
  })

  it('renders change lines in the changes cell', () => {
    const changes = byField('changes')
    const data = {
      changes: [{ field: 'credits_to_sell', oldValue: 10, newValue: 20 }]
    }

    const valueGetter = changes.valueGetter
    if (typeof valueGetter !== 'function') throw new Error('Expected getter')
    expect(valueGetter({ data } as Parameters<typeof valueGetter>[0])).toBe(
      'Credits to sell: 10 → 20'
    )

    const cellRenderer = changes.cellRenderer
    if (typeof cellRenderer !== 'function') throw new Error('Expected renderer')
    render(cellRenderer({ data }))
    expect(screen.getByText('Credits to sell: 10 → 20')).toBeInTheDocument()
  })

  it('says when no change details were recorded', () => {
    const changes = byField('changes')
    const cellRenderer = changes.cellRenderer
    const valueGetter = changes.valueGetter
    if (typeof cellRenderer !== 'function') throw new Error('Expected renderer')
    if (typeof valueGetter !== 'function') throw new Error('Expected getter')
    expect(cellRenderer({ data: { changes: [] } })).toBe('Not recorded')
    expect(valueGetter({ data: {} } as Parameters<typeof valueGetter>[0])).toBe(
      ''
    )
  })
})
