import { describe, expect, it } from 'vitest'
import {
  GOVERNMENT_ROLE_VALUES,
  ORG_ALLOWED_ROLE_VALUES,
  sanitizeOrgRoles,
  isSeededUserSelectable,
  isValidOrgRolePayload
} from '../SeededUserAssociation'

describe('SeededUserAssociation role boundaries', () => {
  it('keeps government and org role sets disjoint', () => {
    const overlap = [...GOVERNMENT_ROLE_VALUES].filter((role) =>
      ORG_ALLOWED_ROLE_VALUES.has(role)
    )

    expect(overlap).toEqual([])
  })

  it('sanitizeOrgRoles removes government and unknown roles', () => {
    const result = sanitizeOrgRoles([
      'manage users',
      'supplier',
      'analyst',
      'compliance reporting',
      'unknown role'
    ])

    expect(result).toEqual(['manage users', 'compliance reporting'])
  })

  it('isValidOrgRolePayload accepts org-only payload', () => {
    expect(
      isValidOrgRolePayload(['supplier', 'manage users', 'read only'])
    ).toBe(true)
  })

  it('isValidOrgRolePayload rejects mixed gov role payload', () => {
    expect(
      isValidOrgRolePayload(['supplier', 'manage users', 'analyst'])
    ).toBe(false)
  })

  it('isSeededUserSelectable only allows lcfs/tfs users 1 through 10', () => {
    expect(isSeededUserSelectable('lcfs1')).toBe(true)
    expect(isSeededUserSelectable('tfs10')).toBe(true)
    expect(isSeededUserSelectable('lcfs_05')).toBe(true)
    expect(isSeededUserSelectable('tfs-11')).toBe(false)
    expect(isSeededUserSelectable('lcfs0')).toBe(false)
    expect(isSeededUserSelectable('bcgov1')).toBe(false)
  })
})
