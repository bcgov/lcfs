import { describe, expect, it } from 'vitest'
import { defaultSortModel, initiativeAgreementColDefs } from '../_schema'

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
