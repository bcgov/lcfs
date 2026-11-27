import { describe, it, expect, vi } from 'vite-plus/test'

import { transactionsColDefs } from '../_schema'

vi.mock('@/hooks/useTransactions', () => ({
  useTransactionStatuses: vi.fn()
}))

const colDefs = transactionsColDefs((key: string) => key)
const txnIdCol = colDefs.find((col) => col.colId === 'transactionId')!
const valueGetter = () => {
  if (typeof txnIdCol.valueGetter !== 'function') {
    throw new Error('Expected transaction ID value getter')
  }
  return txnIdCol.valueGetter
}
const comparator = () => {
  if (typeof txnIdCol.comparator !== 'function') {
    throw new Error('Expected transaction ID comparator')
  }
  return txnIdCol.comparator
}
type ComparatorNode = Parameters<ReturnType<typeof comparator>>[2]
const comparatorNode = { data: undefined } as ComparatorNode

const row = (transactionType: string, transactionId: number) =>
  ({ data: { transactionType, transactionId } }) as Parameters<
    ReturnType<typeof valueGetter>
  >[0]
const compare = (left: string, right: string) =>
  comparator()(left, right, comparatorNode, comparatorNode, false)

describe('transactionsColDefs — transactionId column', () => {
  it('prefixes the id with the code for its transaction type', () => {
    expect(valueGetter()(row('Transfer', 4825))).toBe('CT4825')
    expect(valueGetter()(row('InitiativeAgreement', 3113))).toBe('IA3113')
    expect(valueGetter()(row('AdminAdjustment', 70))).toBe('AA70')
    expect(valueGetter()(row('ComplianceReport', 3798))).toBe('CR3798')
    expect(valueGetter()(row('AggregatorIssuance', 12))).toBe('AG12')
  })

  it('leaves legacy transactions unprefixed', () => {
    expect(valueGetter()(row('StandaloneTransaction', 91))).toBe('91')
  })

  // Regression: the comparator used to slice a single character off a
  // two-character prefix, so every comparison was NaN and the column never
  // actually sorted.
  it('sorts descending by the numeric part regardless of prefix length', () => {
    expect(compare('CT100', 'CT9')).toBeLessThan(0)
    expect(compare('CT9', 'IA100')).toBeGreaterThan(0)
    expect(compare('AA70', 'AA70')).toBe(0)

    const sorted = ['CT9', 'IA100', 'AA70', '91'].sort((left, right) =>
      compare(left, right)
    )
    expect(sorted).toEqual(['IA100', '91', 'AA70', 'CT9'])
  })
})
