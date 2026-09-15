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

// Roles typically enabled for each organization type, keyed by org type key.
// Mirrors the migration backfill defaults. Suggested when an analyst checks a
// type on the organization form; never enforced and never auto-removed, so
// the final selection stays at the analyst's discretion (#4565).
export const orgTypeDefaultRoles: Record<string, string[]> = {
  fuel_supplier: [roles.compliance_reporting, roles.transfers],
  exempted_supplier: [roles.compliance_reporting],
  credit_trader: [roles.transfers],
  aggregator: [roles.transfers],
  fuel_producer: [roles.ci_applicant],
  initiative_agreement_holder: [roles.ia_proponent]
}

// Roles to add when the given org type keys have just been checked,
// excluding any the organization already has.
export const suggestedRolesForTypes = (
  typeKeys: string[],
  currentRoles: string[] = []
): string[] => {
  const additions: string[] = []
  typeKeys.forEach((key) => {
    ;(orgTypeDefaultRoles[key] ?? []).forEach((role) => {
      if (!currentRoles.includes(role) && !additions.includes(role)) {
        additions.push(role)
      }
    })
  })
  return additions
}
