import { ROUTES } from '@/routes/routes'

export const routesMapping = (currentUser) => ({
  Transfer: ROUTES.TRANSFERS.VIEW,
  AdminAdjustment: currentUser.isGovernmentUser
    ? ROUTES.TRANSACTIONS.ADMIN_ADJUSTMENT.VIEW
    : ROUTES.TRANSACTIONS.ADMIN_ADJUSTMENT.ORG_VIEW,
  InitiativeAgreement: currentUser.isGovernmentUser
    ? ROUTES.TRANSACTIONS.INITIATIVE_AGREEMENT.VIEW
    : ROUTES.TRANSACTIONS.INITIATIVE_AGREEMENT.ORG_VIEW,
  ComplianceReport: ROUTES.REPORTS.VIEW,
  'Fuel Code': ROUTES.FUEL_CODES.EDIT,
  'Fuel Code Status Update': ROUTES.FUEL_CODES.EDIT,
  'Fuel Code Recommended': ROUTES.FUEL_CODES.EDIT,
  'Fuel Code Approved': ROUTES.FUEL_CODES.EDIT,
  'Fuel Code Draft': ROUTES.FUEL_CODES.EDIT,
  'Fuel Code Returned': ROUTES.FUEL_CODES.EDIT
})
