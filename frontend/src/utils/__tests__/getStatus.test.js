import { describe, it, expect } from 'vitest'
import { getStatus } from '../getStatus'

const baseData = {
  transactionType: { type: '' },
  transferHistoryRecord: {
    transferStatus: { status: 'Recorded' }
  },
  issuanceHistoryRecord: {
    issuanceStatus: { status: 'Issued' }
  }
}

describe('getStatus', () => {
  it('returns transfer status for Transfer', () => {
    const result = getStatus({
      data: { ...baseData, transactionType: { type: 'Transfer' } }
    })
    expect(result).toBe('Recorded')
  })

  it('returns issuance status for Issuance', () => {
    const result = getStatus({
      data: { ...baseData, transactionType: { type: 'Issuance' } }
    })
    expect(result).toBe('Issued')
  })

  it('returns empty string for other types', () => {
    const result = getStatus({
      data: { ...baseData, transactionType: { type: 'Assessment' } }
    })
    expect(result).toBe('')
  })
})
