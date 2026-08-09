import { describe, it, expect } from 'vitest'
import {
  ORG_TYPE_LABELS,
  getOrgTypeDisplayLabel
} from '@/utils/organizationTypes'

describe('organizationTypes', () => {
  it('maps the Credit Trader org type to its label (#4547)', () => {
    expect(ORG_TYPE_LABELS.credit_trader).toBe('Credit Trader')
    expect(getOrgTypeDisplayLabel('credit_trader')).toBe('Credit Trader')
    expect(getOrgTypeDisplayLabel({ orgType: 'credit_trader' })).toBe(
      'Credit Trader'
    )
  })

  it('still maps the existing org types', () => {
    expect(getOrgTypeDisplayLabel('fuel_supplier')).toBe('Supplier')
    expect(getOrgTypeDisplayLabel('initiative_agreement_holder')).toBe(
      'IA Holder'
    )
  })

  it('falls back to a humanized key for unknown types', () => {
    expect(getOrgTypeDisplayLabel('some_new_type')).toBe('some new type')
    expect(getOrgTypeDisplayLabel('')).toBe('')
  })
})
