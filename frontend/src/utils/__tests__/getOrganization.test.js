import { describe, it, expect } from 'vitest'
import { getOrganization } from '../getOrganization'

const baseData = {
  transactionType: { type: '' },
  transferHistoryRecord: {
    toOrganization: { name: 'OrgB' },
    fromOrganization: { name: 'OrgA' }
  },
  issuanceHistoryRecord: {
    organization: { name: 'OrgC' }
  }
}

describe('getOrganization', () => {
  it('returns to organization for Transfer to', () => {
    const result = getOrganization(
      { data: { ...baseData, transactionType: { type: 'Transfer' } } },
      'to'
    )
    expect(result).toBe('OrgB')
  })

  it('returns from organization for Transfer from', () => {
    const result = getOrganization(
      { data: { ...baseData, transactionType: { type: 'Transfer' } } },
      'from'
    )
    expect(result).toBe('OrgA')
  })

  it('returns organization name for Issuance to', () => {
    const result = getOrganization(
      { data: { ...baseData, transactionType: { type: 'Issuance' } } },
      'to'
    )
    expect(result).toBe('OrgC')
  })

  it('returns BC Gov for Issuance from', () => {
    const result = getOrganization(
      { data: { ...baseData, transactionType: { type: 'Issuance' } } },
      'from'
    )
    expect(result).toBe('BC Gov')
  })

  it('returns empty string for unknown types', () => {
    const result = getOrganization(
      { data: { ...baseData, transactionType: { type: 'Assessment' } } },
      'from'
    )
    expect(result).toBe('')
  })
})
