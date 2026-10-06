import { roles } from '@/constants/roles'

export const GOVERNMENT_ROLE_VALUES = new Set([
  roles.government.toLowerCase(),
  roles.administrator.toLowerCase(),
  roles.analyst.toLowerCase(),
  roles.compliance_manager.toLowerCase(),
  roles.director.toLowerCase(),
  roles.ia_analyst.toLowerCase(),
  roles.ia_manager.toLowerCase()
])

export const ORG_ALLOWED_ROLE_VALUES = new Set([
  roles.supplier.toLowerCase(),
  roles.manage_users.toLowerCase(),
  roles.transfers.toLowerCase(),
  roles.compliance_reporting.toLowerCase(),
  roles.signing_authority.toLowerCase(),
  roles.read_only.toLowerCase(),
  roles.ci_applicant.toLowerCase(),
  roles.ia_proponent.toLowerCase()
])

export const sanitizeOrgRoles = (roleNames: string[] = []): string[] =>
  roleNames.filter(
    (roleName) =>
      roleName &&
      ORG_ALLOWED_ROLE_VALUES.has(roleName) &&
      roleName !== roles.supplier.toLowerCase() &&
      !GOVERNMENT_ROLE_VALUES.has(roleName)
  )

export const isValidOrgRolePayload = (roleNames: string[] = []): boolean =>
  roleNames.every((roleName) => ORG_ALLOWED_ROLE_VALUES.has(roleName))

export const isSeededUserSelectable = (username = ''): boolean => {
  const normalizedUsername = username.trim().toLowerCase()
  const match = normalizedUsername.match(/^(lcfs|tfs)[\s_-]*0*([0-9]{1,2})$/)
  if (!match) {
    return false
  }

  const userNumber = Number(match[2])
  return userNumber >= 1 && userNumber <= 10
}
