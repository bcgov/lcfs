import { describe, expect, it, vi } from 'vitest'

vi.mock('@/constants/config', () => ({
  CONFIG: { API_BASE: '', ENVIRONMENT: 'test' },
  FEATURE_FLAGS: { INITIATIVE_AGREEMENTS: 'initiativeAgreements' },
  isFeatureEnabled: vi.fn(() => false)
}))

import {
  allDesignatedActionColDefs,
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
      'specifiedDate',
      'updateDate'
    ])
  })

  it('shows the date for completion just before Last updated (#5203)', () => {
    const column = designatedActionColDefs(t, 7).find(
      (colDef) => colDef.field === 'specifiedDate'
    )
    expect(column.headerName).toBe(
      'initiativeAgreement:actions.columns.dateForCompletion'
    )
    // Filtered and sorted server-side like Last updated.
    expect(column.filter).toBe('agDateColumnFilter')
    expect(column.sortable).not.toBe(false)
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

describe('allDesignatedActionColDefs (module tab, #5078)', () => {
  const t = (key) => key

  it('adds the organization and IA name after the ID and keeps the agreement grid columns (#5203)', () => {
    const ids = allDesignatedActionColDefs(t).map(
      (colDef) => colDef.colId ?? colDef.field
    )
    expect(ids).toEqual([
      'actionNumber',
      'organization.name',
      'iaCode',
      'name',
      'currentStatus',
      'assignedAnalyst',
      'lastComment',
      'creditAllocation',
      'specifiedDate',
      'updateDate'
    ])
  })

  it("reads the organization off the row's agreement", () => {
    const column = allDesignatedActionColDefs(t).find(
      (colDef) => colDef.field === 'organization.name'
    )
    expect(
      column.valueGetter({ data: { organization: { name: 'Org A' } } })
    ).toBe('Org A')
    // An agreement saved before its organization is known (#5186).
    expect(column.valueGetter({ data: { organization: null } })).toBe(undefined)
    expect(column.filter).toBe('agTextColumnFilter')
  })

  it('shares the analyst column with the agreement grid', () => {
    const tab = allDesignatedActionColDefs(t).find(
      (colDef) => colDef.colId === 'assignedAnalyst'
    )
    const grid = designatedActionColDefs(t, 7).find(
      (colDef) => colDef.colId === 'assignedAnalyst'
    )
    expect(tab.cellRenderer).toBe(grid.cellRenderer)
    expect(tab.floatingFilterComponentParams).toEqual(
      grid.floatingFilterComponentParams
    )
  })

  it("builds the ID from each row's own agreement", () => {
    const idColumn = allDesignatedActionColDefs(t).find(
      (colDef) => colDef.colId === 'actionNumber'
    )
    expect(
      idColumn.valueGetter({
        data: { actionNumber: 2, initiativeAgreementId: 5 }
      })
    ).toBe('DA2-IA5')
  })

  it('the agreement grid still pins its own agreement in the ID', () => {
    const idColumn = designatedActionColDefs(t, 9).find(
      (colDef) => colDef.colId === 'actionNumber'
    )
    expect(
      idColumn.valueGetter({
        data: { actionNumber: 1, initiativeAgreementId: 5 }
      })
    ).toBe('DA1-IA9')
  })
})
