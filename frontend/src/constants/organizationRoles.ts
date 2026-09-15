import { roles } from '@/constants/roles'

export interface OrgAvailableRoleOption {
  value: string
  label: string
}

// Org-controllable roles (#4565) in wireframe order, with the wording shown
// on the organization form and profile. Values are the backend role names.
export const orgAvailableRoleOptions: OrgAvailableRoleOption[] = [
  { value: roles.compliance_reporting, label: 'Compliance reporting' },
  { value: roles.transfers, label: 'Credit transfer' },
  { value: roles.ci_applicant, label: 'CI applicant' },
  { value: roles.ia_proponent, label: 'IA proponent' }
]

// Display labels for an organization's available roles, in canonical order.
export const formatOrgAvailableRoles = (roleNames?: string[] | null): string => {
  const names = roleNames ?? []
  return orgAvailableRoleOptions
    .filter((option) => names.includes(option.value))
    .map((option) => option.label)
    .join(', ')
}
