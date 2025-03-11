export const apiRoutes = {
  dummy: '/dummy',
  currentUser: '/users/current',
  exportUsers: '/users/export?format=xls',
  listUsers: '/users/list',
  roles: '/roles/',
  orgUsers: '/organization/:orgID/users/list',
  transactions: '/transactions/',
  exportTransactions: '/transactions/export',
  filteredTransactionsByOrg: '/transactions/:orgID',
  exportFilteredTransactionsByOrg: '/transactions/:orgID/export',
  orgTransactions: '/organization/transactions',
  exportOrgTransactions: '/organization/transactions/export',
  adminAdjustments: '/admin-adjustments/',
  initiativeAgreements: '/initiative-agreements/',
  openapi: '/openapi.json/',
  updateCategory: '/transfers/:transferId/category',
  getTransfer: '/transfers/:transferId',
  getFuelCode: '/fuel-codes/:fuelCodeId',
  saveFuelCode: '/fuel-codes',
  approveFuelCode: '/fuel-codes/:fuelCodeId/approve',
  deleteFuelCode: '/fuel-codes/:fuelCodeId',
  fuelCodeOptions: '/fuel-codes/table-options',
  fuelCodeSearch: '/fuel-codes/search?',
  getFuelCodes: '/fuel-codes/list',
  getCompliancePeriods: '/reports/compliance-periods',
  getComplianceReports: '/reports/list',
  createComplianceReport: '/organization/:orgID/reports',
  notionalTransferOptions: '/notional-transfers/table-options',
  getNotionalTransfer: '/notional-transfers/:notionalTransferId',
  getNotionalTransfers: '/notional-transfers/list',
  getAllNotionalTransfers: '/notional-transfers/list-all',
  saveNotionalTransfer: '/notional-transfers/save',
  saveOtherUses: '/other-uses/save',
  getOtherUses: '/other-uses/list',
  getAllOtherUses: '/other-uses/list-all',
  otherUsesOptions: '/other-uses/table-options?',
  getComplianceReport: '/reports/:reportID',
  updateComplianceReport: '/reports/:reportID',
  getComplianceReportSummary: '/reports/:reportID/summary',
  updateComplianceReportSummary: '/reports/:reportID/summary',
  exportComplianceReport: '/reports/:reportID/export',
  createSupplementalReport: '/reports/:reportID/supplemental',
  getDocuments: '/documents/:parentType/:parentID',
  uploadDocument: '/documents/:parentType/:parentID',
  getDocument: '/documents/:parentType/:parentID/:documentID',
  getOrgComplianceReport: '/organization/:orgID/reports/:reportID',
  getOrgComplianceReports: '/organization/:orgID/reports/list',
  getOrgComplianceReportReportedYears:
    '/organization/:orgID/reports/reported-years',
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
  fuelSupplyOptions: '/fuel-supply/table-options?',
  getAllFuelSupplies: '/fuel-supply/list-all',
  saveFuelSupplies: '/fuel-supply/save',
  fuelExportOptions: '/fuel-exports/table-options?',
  getAllFuelExports: '/fuel-exports/list-all',
  saveFuelExports: '/fuel-exports/save',
  directorReviewCounts: '/dashboard/director-review-counts',
  TransactionCounts: '/dashboard/transaction-counts',
  OrgTransactionCounts: '/dashboard/org-transaction-counts',
  getAllAllocationAgreements: '/allocation-agreement/list-all',
  getAllocationAgreements: '/allocation-agreement/list',
  allocationAgreementOptions: '/allocation-agreement/table-options?',
  saveAllocationAgreements: '/allocation-agreement/save',
  allocationAgreementSearch: '/allocation-agreement/search?',
  OrgComplianceReportCounts: '/dashboard/org-compliance-report-counts',
  complianceReportCounts: '/dashboard/compliance-report-counts',
  fuelCodeCounts: '/dashboard/fuel-code-counts',
  organizationSearch: '/organizations/search?',
  getUserActivities: '/users/:userID/activity',
  getAllUserActivities: '/users/activities/all',
  getFuelTypeOthers: '/fuel-type/others/list',
  trackUserLogin: '/users/logged-in',
  getUserLoginHistories: '/users/login-history',
  getAuditLogs: '/audit-log/list',
  getAuditLog: '/audit-log/:auditLogId',
  notifications: '/notifications/',
  getNotifications: '/notifications/list',
  getNotificationsCount: '/notifications/count',
  getNotificationSubscriptions: '/notifications/subscriptions',
  saveNotificationSubscriptions: '/notifications/subscriptions/save',
  updateNotificationsEmail: '/users/update-email',
  getOrganizationSnapshot: '/organization_snapshot/:reportID',
  getChangelog: '/reports/:selection/changelog',
  deleteUser: '/users/:userID'
}
