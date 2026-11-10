import { describe, it, expect } from 'vite-plus/test'
import { getOrganization } from '../getOrganization'

describe('getOrganization', () => {
  it('returns the to organization with only the to-side transfer data', () => {
    const result = getOrganization(
      {
        data: {
          transactionType: { type: 'Transfer' },
          transferHistoryRecord: { toOrganization: { name: 'OrgB' } }
        }
      },
      'to'
    )
    expect(result).toBe('OrgB')
  })

  it('returns the from organization with only the from-side transfer data', () => {
    const result = getOrganization(
      {
        data: {
          transactionType: { type: 'Transfer' },
          transferHistoryRecord: { fromOrganization: { name: 'OrgA' } }
        }
      },
      'from'
    )
    expect(result).toBe('OrgA')
  })

  it('returns the organization name for Issuance to', () => {
    const result = getOrganization(
      {
        data: {
          transactionType: { type: 'Issuance' },
          issuanceHistoryRecord: { organization: { name: 'OrgC' } }
        }
      },
      'to'
    )
    expect(result).toBe('OrgC')
  })

  it('returns BC Gov for Issuance from without issuance history', () => {
    const result = getOrganization(
      { data: { transactionType: { type: 'Issuance' } } },
      'from'
    )
    expect(result).toBe('BC Gov')
  })

  it('returns an empty string for an assessment without history records', () => {
    expect(
      getOrganization(
        { data: { transactionType: { type: 'Assessment' } } },
        'from'
      )
    ).toBe('')
  })

  it('preserves the default result for unknown transaction types', () => {
    expect(
      getOrganization({ data: { transactionType: { type: 'Unknown' } } }, 'to')
    ).toBeUndefined()
  })
})
