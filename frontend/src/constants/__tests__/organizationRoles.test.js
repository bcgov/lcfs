import { describe, it, expect } from 'vitest'
import { roles } from '@/constants/roles'
import {
  orgAvailableRoleOptions,
  formatOrgAvailableRoles,
  orgTypeDefaultRoles,
  suggestedRolesForTypes
} from '@/constants/organizationRoles'

describe('organizationRoles (#4565)', () => {
  it('formats backend role names with the form wording, in form order', () => {
    expect(
      formatOrgAvailableRoles([roles.transfers, roles.compliance_reporting])
    ).toBe('Compliance reporting, Credit transfer')
  })

  it('ignores unknown or missing roles when formatting', () => {
    expect(formatOrgAvailableRoles(['Analyst'])).toBe('')
    expect(formatOrgAvailableRoles(undefined)).toBe('')
    expect(formatOrgAvailableRoles(null)).toBe('')
  })

  it('only ever offers the four org-controllable roles', () => {
    expect(orgAvailableRoleOptions.map((o) => o.value)).toEqual([
      roles.compliance_reporting,
      roles.transfers,
      roles.ci_applicant,
      roles.ia_proponent
    ])
    const offered = new Set(orgAvailableRoleOptions.map((o) => o.value))
    Object.values(orgTypeDefaultRoles)
      .flat()
      .forEach((role) => expect(offered.has(role)).toBe(true))
  })

  it('suggests each newly checked type’s typical roles', () => {
    expect(suggestedRolesForTypes(['fuel_producer'])).toEqual([
      roles.ci_applicant
    ])
    expect(
      suggestedRolesForTypes(['fuel_supplier', 'initiative_agreement_holder'])
    ).toEqual([
      roles.compliance_reporting,
      roles.transfers,
      roles.ia_proponent
    ])
  })

  it('does not re-add roles the organization already has, and de-duplicates', () => {
    expect(
      suggestedRolesForTypes(['fuel_supplier', 'credit_trader'], [roles.transfers])
    ).toEqual([roles.compliance_reporting])
  })

  it('suggests nothing for unknown type keys', () => {
    expect(suggestedRolesForTypes(['some_new_type'])).toEqual([])
  })
})
