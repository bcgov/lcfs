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

  // organizations
  organizationSearch: '/organizations/search?',

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
  saveFuelCode: '/fuel-codes',
  approveFuelCode: '/fuel-codes/:fuelCodeId/approve',
  deleteFuelCode: '/fuel-codes/:fuelCodeId',
  fuelCodeOptions: '/fuel-codes/table-options',
  fuelCodeSearch: '/fuel-codes/search?',
  getFuelCodes: '/fuel-codes/list',

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
  getChangelog: '/reports/:complianceReportGroupUuid/changelog/:dataType',

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
  getCalculatorFuelTypeOptions: '/calculator/:complianceYear/fuel-type-options/',
  getCalculatedComplianceUnits: '/calculator/:complianceYear/calculate/',
}
