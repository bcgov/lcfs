import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { creditMarketAuditLogColDefs, formatAuditChanges } from '../_schema'

const t = (key, fallback) => fallback ?? key

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
    expect(formatAuditChanges(undefined, t)).toEqual([])
    expect(formatAuditChanges([], t)).toEqual([])
  })
})

describe('creditMarketAuditLogColDefs', () => {
  const colDefs = creditMarketAuditLogColDefs(t)
  const byField = (field) => colDefs.find((c) => c.field === field)

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
    expect(byField('action').valueFormatter({ value: null })).toBe('N/A')
    expect(byField('action').valueFormatter({ value: 'Removed' })).toBe(
      'Removed'
    )
  })

  it('renders change lines in the changes cell', () => {
    const changes = byField('changes')
    const data = {
      changes: [{ field: 'credits_to_sell', oldValue: 10, newValue: 20 }]
    }

    expect(changes.valueGetter({ data })).toBe('Credits to sell: 10 → 20')

    render(changes.cellRenderer({ data }))
    expect(screen.getByText('Credits to sell: 10 → 20')).toBeInTheDocument()
  })

  it('says when no change details were recorded', () => {
    const changes = byField('changes')
    expect(changes.cellRenderer({ data: { changes: [] } })).toBe('Not recorded')
    expect(changes.valueGetter({ data: {} })).toBe('')
  })
})
