import { describe, it, expect } from 'vite-plus/test'
import {
  getOrganization,
  type TransactionOrganizationData
} from '../getOrganization'

type IsAssignable<Source, Target> = [Source] extends [Target] ? true : false
type Assert<T extends true> = T
type IsNotAssignable<Source, Target> =
  IsAssignable<Source, Target> extends true ? false : true

type OrganizationTypeChecks = [
  Assert<
    IsAssignable<
      { transactionType: { type: 'Assessment' } },
      TransactionOrganizationData<'Assessment', 'to'>
    >
  >,
  Assert<
    IsNotAssignable<
      { transactionType: { type: string } },
      TransactionOrganizationData<string, 'to'>
    >
  >,
  Assert<
    IsNotAssignable<
      { transactionType: { type: 'Transfer' | 'Assessment' } },
      TransactionOrganizationData<'Transfer' | 'Assessment', 'to'>
    >
  >,
  Assert<
    IsNotAssignable<
      {
        transactionType: { type: 'Transfer' | 'Assessment' }
        issuanceHistoryRecord: { organization: { name: string } }
      },
      TransactionOrganizationData<'Transfer' | 'Assessment', 'to'>
    >
  >,
  Assert<
    IsAssignable<
      {
        transactionType: { type: 'Transfer' | 'Assessment' }
        transferHistoryRecord: { toOrganization: { name: string } }
      },
      TransactionOrganizationData<'Transfer' | 'Assessment', 'to'>
    >
  >,
  Assert<
    IsNotAssignable<
      { transactionType: { type: 'Issuance' } },
      TransactionOrganizationData<'Issuance', 'to' | 'from'>
    >
  >,
  Assert<
    IsAssignable<
      {
        transactionType: { type: 'Issuance' }
        issuanceHistoryRecord: { organization: { name: string } }
      },
      TransactionOrganizationData<'Issuance', 'to' | 'from'>
    >
  >,
  Assert<
    IsNotAssignable<
      {
        transactionType: { type: 'Transfer' }
        transferHistoryRecord: { toOrganization: { name: string } }
      },
      TransactionOrganizationData<'Transfer', 'to' | 'from'>
    >
  >
]

export type GetOrganizationCompileTimeChecks = OrganizationTypeChecks

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
