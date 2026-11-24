import { roles } from '@/constants/roles'

// Analysts and managers edit an agreement package's content; inside a
// change order the Director does too (#5555). The API enforces the same
// rule, so this only hides controls that would be refused.
export const PACKAGE_EDITOR_ROLES = [roles.ia_analyst, roles.ia_manager]

export const packageEditorRoles = (inChangeOrder) =>
  inChangeOrder
    ? [...PACKAGE_EDITOR_ROLES, roles.director]
    : PACKAGE_EDITOR_ROLES
