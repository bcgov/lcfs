/**
 * This file contains all the API routes used in the application.
 */

export const apiRoutes = {
  // OpenAPI
  openapi: '/openapi.json/',

  // roles
  roles: '/roles/',

  // users
  currentUser: '/users/current',
  exportUsers: '/users/export?format=xlsx',
  listUsers: '/users/list',
  getUserActivities: '/users/:userID/activity',
  getAllUserActivities: '/users/activities/all',
  trackUserLogin: '/users/logged-in',
  getUserLoginHistories: '/users/login-history',
  updateNotificationsEmail: '/users/update-email',
  deleteUser: '/users/:userID',

  // organization
  orgUsers: '/organization/:orgID/users/list',
  orgTransactions: '/organization/transactions',
  exportOrgTransactions: '/organization/transactions/export',
  createComplianceReport: '/organization/:orgID/reports',
  deleteSupplementalReport: '/organization/:orgID/:reportID/supplemental',
  getOrgComplianceReport: '/organization/:orgID/reports/:reportID',
  getOrgComplianceReports: '/organization/:orgID/reports/list',
  getOrgComplianceReportReportedYears:
    '/organization/:orgID/reports/reported-years',

  // Credit‑ledger
  creditLedger: '/credit-ledger/organization/:orgID',
  creditLedgerYears: '/credit-ledger/organization/:orgID/years',
  exportCreditLedger: '/credit-ledger/organization/:orgID/export',

  // organizations
  organizationSearch: '/organizations/search?',
  organizationExport: '/organizations/export',
  organizationPenaltyLogsList: '/organizations/:orgID/penalties/logs/list',
  organizationPenaltyLogs: '/organizations/:orgID/penalties/logs',
  organizationPenaltyLog: '/organizations/:orgID/penalties/logs/:penaltyLogId',

  // transactions
  transactions: '/transactions/',
  exportTransactions: '/transactions/export',
  filteredTransactionsByOrg: '/transactions/:orgID',
  exportFilteredTransactionsByOrg: '/transactions/:orgID/export',

  // transfers
  updateCategory: '/transfers/:transferId/category',
  getTransfer: '/transfers/:transferId',

  // admin-adjustments
  adminAdjustments: '/admin-adjustments/',

  // initiative-agreements
  initiativeAgreements: '/initiative-agreements/',

  // fuel-type
  getFuelTypeOthers: '/fuel-type/others/list',

  // fuel-codes
  getFuelCode: '/fuel-codes/:fuelCodeId',
  updateFuelCodeStatus: '/fuel-codes/:fuelCodeId',
  saveFuelCode: '/fuel-codes',
  deleteFuelCode: '/fuel-codes/:fuelCodeId',
  fuelCodeOptions: '/fuel-codes/table-options',
  fuelCodeSearch: '/fuel-codes/search?',
  getFuelCodes: '/fuel-codes/list',
  exportFuelCodes: '/fuel-codes/export',

  // reports
  getCompliancePeriods: '/reports/compliance-periods',
  getComplianceReports: '/reports/list',
  getComplianceReportStatuses: '/reports/statuses',
  getComplianceReport: '/reports/:reportID',
  updateComplianceReport: '/reports/:reportID',
  deleteComplianceReport: '/reports/:reportID',
  getComplianceReportSummary: '/reports/:reportID/summary',
  updateComplianceReportSummary: '/reports/:reportID/summary',
  exportComplianceReport: '/reports/:reportID/export',
  createSupplementalReport: '/reports/:reportID/supplemental',
  createAnalystAdjustment: '/reports/:reportID/adjustment',
  createIdirSupplementalReport: '/reports/:reportID/idir-supplemental',
  getChangelog: '/reports/:complianceReportGroupUuid/changelog/:dataType',
  getAvailableAnalysts: '/reports/analysts',
  assignAnalyst: '/reports/:reportId/assign',

  // notional-transfers
  notionalTransferOptions: '/notional-transfers/table-options',
  getNotionalTransfer: '/notional-transfers/:notionalTransferId',
  getNotionalTransfers: '/notional-transfers/list',
  getAllNotionalTransfers: '/notional-transfers/list-all',
  saveNotionalTransfer: '/notional-transfers/save',

  // other-uses
  saveOtherUses: '/other-uses/save',
  getOtherUses: '/other-uses/list',
  getAllOtherUses: '/other-uses/list-all',
  otherUsesOptions: '/other-uses/table-options?',

  // final-supply-equipments
  finalSupplyEquipmentOptions: '/final-supply-equipments/table-options',
  getAllFinalSupplyEquipments: '/final-supply-equipments/list-all',
  saveFinalSupplyEquipments: '/final-supply-equipments/save',
  exportFinalSupplyEquipments: '/final-supply-equipments/export/:reportID',
  importFinalSupplyEquipments: '/final-supply-equipments/import/:reportID',
  getImportFinalSupplyEquipmentsJobStatus:
    '/final-supply-equipments/status/:jobID',
  downloadFinalSupplyEquipmentsTemplate:
    '/final-supply-equipments/template/:reportID',
  searchFinalSupplyEquipments: '/final-supply-equipments/search?',
  // charging sites
  getSiteStatuses: '/charging-sites/statuses',
  getEquipmentStatuses: '/charging-sites/equipment/statuses',
  intendedUsers: '/charging-sites/intended-users',

  // charging-equipment (new FSE system)
  chargingEquipment: {
    list: '/charging-equipment/list',
    get: '/charging-equipment/:id',
    create: '/charging-equipment/',
    update: '/charging-equipment/:id',
    delete: '/charging-equipment/:id',
    bulkSubmit: '/charging-equipment/bulk/submit',
    bulkDecommission: '/charging-equipment/bulk/decommission',
    statuses: '/charging-equipment/statuses/list',
    levels: '/charging-equipment/levels/list',
    endUseTypes: '/charging-equipment/end-use-types/list',
    chargingSites: '/charging-equipment/charging-sites/list',
    organizations: '/charging-equipment/organizations/list',
    hasAllocationAgreements: '/charging-equipment/organizations/has-allocation-agreements'
  },
  getChargingSite: '/charging-sites/:siteId',
  getAllChargingSites: '/charging-sites/list-all',
  getAllChargingSitesByOrg: '/charging-sites/organization/:orgID/list-all',
  saveChargingSite: '/charging-sites/organization/:orgID/save', // create, update or delete
  // Charging-site specific equipment endpoints
  // Backend: POST /charging-sites/{site_id}/equipment/list-all
  getChargingSiteEquipmentPaginated: '/charging-sites/:siteId/equipment/list-all',
  bulkUpdateEquipmentStatus: '/charging-sites/:siteId/equipment/bulk-status-update',
  exportChargingSites: '/charging-sites/export/:orgID',
  importChargingSites: '/charging-sites/import/:orgID',
  getImportChargingSitesJobStatus: '/charging-sites/status/:jobID',
  downloadChargingSitesTemplate: '/charging-sites/template/:orgID',

  // fuel-supplies
  fuelSupplyOptions: '/fuel-supply/table-options?',
  getAllFuelSupplies: '/fuel-supply/list-all',
  saveFuelSupplies: '/fuel-supply/save',

  // fuel-exports
  fuelExportOptions: '/fuel-exports/table-options?',
  getAllFuelExports: '/fuel-exports/list-all',
  saveFuelExports: '/fuel-exports/save',

  // allocation-agreement
  getAllAllocationAgreements: '/allocation-agreement/list-all',
  getAllocationAgreements: '/allocation-agreement/list',
  allocationAgreementOptions: '/allocation-agreement/table-options?',
  saveAllocationAgreements: '/allocation-agreement/save',
  allocationAgreementSearch: '/allocation-agreement/search?',
  exportAllocationAgreements: '/allocation-agreement/export/:reportID',
  importAllocationAgreements: '/allocation-agreement/import/:reportID',
  getImportAllocationAgreementsJobStatus: '/allocation-agreement/status/:jobID',
  downloadAllocationAgreementsTemplate:
    '/allocation-agreement/template/:reportID',

  // documents
  getDocuments: '/documents/:parentType/:parentID',
  uploadDocument: '/documents/:parentType/:parentID',
  getDocument: '/documents/:parentType/:parentID/:documentID',

  // compliance_snapshot
  getOrganizationSnapshot: '/organization_snapshot/:reportID',

  // dashboard
  directorReviewCounts: '/dashboard/director-review-counts',
  TransactionCounts: '/dashboard/transaction-counts',
  OrgTransactionCounts: '/dashboard/org-transaction-counts',
  OrgComplianceReportCounts: '/dashboard/org-compliance-report-counts',
  complianceReportCounts: '/dashboard/compliance-report-counts',
  fuelCodeCounts: '/dashboard/fuel-code-counts',

  // audit-logs
  getAuditLogs: '/audit-log/list',
  getAuditLog: '/audit-log/:auditLogId',

  // notifications
  notifications: '/notifications/',
  getNotifications: '/notifications/list',
  getNotificationsCount: '/notifications/count',
  getNotificationSubscriptions: '/notifications/subscriptions',
  saveNotificationSubscriptions: '/notifications/subscriptions/save',
  // calculator endpoints
  getCalculatorCompliancePeriods: '/calculator/compliance-periods',
  getCalculatorFuelTypes: '/calculator/:complianceYear/',
  getCalculatorFuelTypeOptions:
    '/calculator/:complianceYear/fuel-type-options/',
  getCalculatedComplianceUnits: '/calculator/:complianceYear/calculate/',

  // geocoder endpoints
  geocoderValidate: '/geocoder/validate',
  geocoderForward: '/geocoder/forward',
  geocoderReverse: '/geocoder/reverse',
  geocoderBatch: '/geocoder/batch',
  geocoderBoundaryCheck: '/geocoder/boundary-check',
  geocoderAutocomplete: '/geocoder/autocomplete',
  geocoderHealth: '/geocoder/health',
  geocoderClearCache: '/geocoder/cache',
}
