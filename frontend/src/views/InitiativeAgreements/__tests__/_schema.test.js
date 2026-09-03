import { describe, expect, it } from 'vitest'
import {
  defaultSortModel,
  designatedActionColDefs,
  initiativeAgreementColDefs
} from '../_schema'

describe('initiativeAgreementColDefs', () => {
  const t = (key) => key

  it('defines the wireframe columns in order', () => {
    const fields = initiativeAgreementColDefs(t).map((colDef) => colDef.field)
    expect(fields).toEqual([
      'lifecycleStatus.status',
      'organization.name',
      'contactName',
      'iaCode',
      'agreementStartDate',
      'agreementEndDate',
      'updateDate',
      'lastComment'
    ])
  })

  it('uses translation keys for every header', () => {
    const headers = initiativeAgreementColDefs(t).map(
      (colDef) => colDef.headerName
    )
    headers.forEach((header) => {
      expect(header).toMatch(/^initiativeAgreement:columns\./)
    })
  })

  it('sorts by last updated descending by default', () => {
    expect(defaultSortModel).toEqual([
      { field: 'updateDate', direction: 'desc' }
    ])
  })
})

describe('designatedActionColDefs', () => {
  const t = (key) => key

  it('places Current status right after the DA name (#4926)', () => {
    const ids = designatedActionColDefs(t, 7).map(
      (colDef) => colDef.colId ?? colDef.field
    )
    expect(ids).toEqual([
      'actionNumber',
      'name',
      'currentStatus',
      'assignedAnalyst',
      'lastComment',
      'creditAllocation',
      'updateDate'
    ])
  })

  it('reads the status off the same field the detail page renders', () => {
    const column = designatedActionColDefs(t, 7).find(
      (colDef) => colDef.colId === 'currentStatus'
    )
    // Same source as the detail page's chip, so the grid and the record
    // can never disagree about what state an action is in.
    expect(
      column.valueGetter({ data: { currentStatus: { status: 'Underway' } } })
    ).toBe('Underway')
    expect(column.valueGetter({ data: undefined })).toBe('')
    // Sorting stays on (server-side, by workflow order).
    expect(column.sortable).not.toBe(false)
  })
})
