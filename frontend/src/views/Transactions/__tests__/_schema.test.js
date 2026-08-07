import { describe, it, expect, vi } from 'vitest'

vi.mock('@/hooks/useTransactions', () => ({
  useTransactionStatuses: vi.fn()
}))

import { transactionsColDefs } from '../_schema'

const colDefs = transactionsColDefs((key) => key)
const txnIdCol = colDefs.find((col) => col.colId === 'transactionId')

const row = (transactionType, transactionId) => ({
  data: { transactionType, transactionId }
})

describe('transactionsColDefs — transactionId column', () => {
  it('prefixes the id with the code for its transaction type', () => {
    expect(txnIdCol.valueGetter(row('Transfer', 4825))).toBe('CT4825')
    expect(txnIdCol.valueGetter(row('InitiativeAgreement', 3113))).toBe(
      'IA3113'
    )
    expect(txnIdCol.valueGetter(row('AdminAdjustment', 70))).toBe('AA70')
    expect(txnIdCol.valueGetter(row('ComplianceReport', 3798))).toBe('CR3798')
    expect(txnIdCol.valueGetter(row('AggregatorIssuance', 12))).toBe('AG12')
  })

  it('leaves legacy transactions unprefixed', () => {
    expect(txnIdCol.valueGetter(row('StandaloneTransaction', 91))).toBe('91')
  })

  // Regression: the comparator used to slice a single character off a
  // two-character prefix, so every comparison was NaN and the column never
  // actually sorted.
  it('sorts descending by the numeric part regardless of prefix length', () => {
    expect(txnIdCol.comparator('CT100', 'CT9')).toBeLessThan(0)
    expect(txnIdCol.comparator('CT9', 'IA100')).toBeGreaterThan(0)
    expect(txnIdCol.comparator('AA70', 'AA70')).toBe(0)

    const sorted = ['CT9', 'IA100', 'AA70', '91'].sort(txnIdCol.comparator)
    expect(sorted).toEqual(['IA100', '91', 'AA70', 'CT9'])
  })
})
