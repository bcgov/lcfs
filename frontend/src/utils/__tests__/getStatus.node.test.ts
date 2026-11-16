import { describe, it, expect } from 'vite-plus/test'
import { getStatus, type TransactionStatusData } from '../getStatus'

type IsAssignable<Source, Target> = [Source] extends [Target] ? true : false
type Assert<T extends true> = T
type IsNotAssignable<Source, Target> =
  IsAssignable<Source, Target> extends true ? false : true

type StatusTypeChecks = [
  Assert<
    IsAssignable<
      { transactionType: { type: 'Assessment' } },
      TransactionStatusData<'Assessment'>
    >
  >,
  Assert<
    IsNotAssignable<
      { transactionType: { type: string } },
      TransactionStatusData<string>
    >
  >,
  Assert<
    IsNotAssignable<
      { transactionType: { type: 'Transfer' | 'Assessment' } },
      TransactionStatusData<'Transfer' | 'Assessment'>
    >
  >,
  Assert<
    IsNotAssignable<
      {
        transactionType: { type: 'Transfer' | 'Assessment' }
        issuanceHistoryRecord: { issuanceStatus: { status: string } }
      },
      TransactionStatusData<'Transfer' | 'Assessment'>
    >
  >,
  Assert<
    IsAssignable<
      {
        transactionType: { type: 'Transfer' | 'Assessment' }
        transferHistoryRecord: { transferStatus: { status: string } }
      },
      TransactionStatusData<'Transfer' | 'Assessment'>
    >
  >
]

export type GetStatusCompileTimeChecks = StatusTypeChecks

describe('getStatus', () => {
  it('returns transfer status with only the transfer history', () => {
    const result = getStatus({
      data: {
        transactionType: { type: 'Transfer' },
        transferHistoryRecord: { transferStatus: { status: 'Recorded' } }
      }
    })
    expect(result).toBe('Recorded')
  })

  it('returns issuance status with only the issuance history', () => {
    const result = getStatus({
      data: {
        transactionType: { type: 'Issuance' },
        issuanceHistoryRecord: { issuanceStatus: { status: 'Issued' } }
      }
    })
    expect(result).toBe('Issued')
  })

  it('returns an empty string for an assessment without history records', () => {
    expect(
      getStatus({ data: { transactionType: { type: 'Assessment' } } })
    ).toBe('')
  })

  it('returns an empty string for an initiative agreement without history records', () => {
    expect(
      getStatus({
        data: { transactionType: { type: 'Initiative Agreement' } }
      })
    ).toBe('')
  })

  it('preserves the default result for unknown transaction types', () => {
    expect(
      getStatus({ data: { transactionType: { type: 'Unknown' } } })
    ).toBeUndefined()
  })
})
