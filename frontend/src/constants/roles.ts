export const roles = {
  government: 'Government',
  supplier: 'Supplier',
  administrator: 'Administrator',
  analyst: 'Analyst',
  compliance_manager: 'Compliance Manager',
  director: 'Director',
  manage_users: 'Manage Users',
  transfers: 'Transfer',
  compliance_reporting: 'Compliance Reporting',
  signing_authority: 'Signing Authority',
  read_only: 'Read Only'
} as const

export type RoleName = (typeof roles)[keyof typeof roles]

export const govRoles: RoleName[] = [
  roles.government,
  roles.administrator,
  roles.analyst,
  roles.compliance_manager,
  roles.director
]

export const nonGovRoles: RoleName[] = [
  roles.supplier,
  roles.manage_users,
  roles.transfers,
  roles.compliance_reporting,
  roles.signing_authority,
  roles.read_only
]
