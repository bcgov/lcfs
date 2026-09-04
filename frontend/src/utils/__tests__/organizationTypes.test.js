import { describe, it, expect } from 'vitest'
import {
  ORG_TYPE_LABELS,
  getOrgTypeDisplayLabel,
  getOrgTypesDisplayLabel
} from '@/utils/organizationTypes'

describe('organizationTypes', () => {
  it('maps the credit_trader org type to its label (#4565 wording)', () => {
    expect(ORG_TYPE_LABELS.credit_trader).toBe('Credit Transfer')
    expect(getOrgTypeDisplayLabel('credit_trader')).toBe('Credit Transfer')
    expect(getOrgTypeDisplayLabel({ orgType: 'credit_trader' })).toBe(
      'Credit Transfer'
    )
  })

  it('joins multiple org type labels (#4565 multi-type orgs)', () => {
    expect(
      getOrgTypesDisplayLabel([
        { orgType: 'fuel_supplier' },
        { orgType: 'credit_trader' }
      ])
    ).toBe('Supplier, Credit Transfer')
    expect(getOrgTypesDisplayLabel([])).toBe('')
    expect(getOrgTypesDisplayLabel(null)).toBe('')
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
