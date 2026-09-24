import { roles } from '@/constants/roles'

/**
 * Maps each assignable role to the notification type names it owns.
 * Sourced from the per-role NotificationSettings components.
 * Used by UserImpactSummaryModal to compute which subscriptions a role
 * change will remove.
 */
export const ROLE_NOTIF_TYPES = {
  [roles.analyst.toLowerCase()]: new Set([
    'IDIR_ANALYST__GOVERNMENT_NOTIFICATION',
    'IDIR_ANALYST__TRANSFER__SUBMITTED_FOR_REVIEW',
    'IDIR_ANALYST__TRANSFER__RESCINDED_ACTION',
    'IDIR_ANALYST__TRANSFER__DIRECTOR_RECORDED',
    'IDIR_ANALYST__INITIATIVE_AGREEMENT__RETURNED_TO_ANALYST',
    'IDIR_ANALYST__CI_APPLICATION__DIRECTOR_APPROVAL',
    'IDIR_ANALYST__CI_APPLICATION__DIRECTOR_RETURNED',
    'IDIR_ANALYST__CI_APPLICATION__APPLICANT_ACTIVITY',
    'IDIR_ANALYST__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW',
    'IDIR_ANALYST__COMPLIANCE_REPORT__MANAGER_RECOMMENDATION',
    'IDIR_ANALYST__COMPLIANCE_REPORT__DIRECTOR_DECISION',
    'IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED',
    'IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL',
  ]),
  [roles.compliance_manager.toLowerCase()]: new Set([
    'IDIR_COMPLIANCE_MANAGER__GOVERNMENT_NOTIFICATION',
    'IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW',
    'IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__ANALYST_RECOMMENDATION',
    'IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT',
  ]),
  [roles.director.toLowerCase()]: new Set([
    'IDIR_DIRECTOR__GOVERNMENT_NOTIFICATION',
    'IDIR_DIRECTOR__TRANSFER__ANALYST_RECOMMENDATION',
    'IDIR_DIRECTOR__INITIATIVE_AGREEMENT__ANALYST_RECOMMENDATION',
    'IDIR_DIRECTOR__COMPLIANCE_REPORT__MANAGER_RECOMMENDATION',
    'IDIR_DIRECTOR__CI_APPLICATION__ANALYST_RECOMMENDATION',
  ]),
  [roles.signing_authority.toLowerCase()]: new Set([
    'BCEID__GOVERNMENT_NOTIFICATION',
    'BCEID__CREDIT_MARKET__CREDITS_LISTED_FOR_SALE',
    'BCEID__TRANSFER__PARTNER_ACTIONS',
    'BCEID__TRANSFER__DIRECTOR_DECISION',
    'BCEID__INITIATIVE_AGREEMENT__DIRECTOR_APPROVAL',
    'BCEID__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT',
  ]),
  [roles.transfers.toLowerCase()]: new Set([
    'BCEID__TRANSFER__PARTNER_ACTIONS',
    'BCEID__TRANSFER__DIRECTOR_DECISION',
    'BCEID__CREDIT_MARKET__CREDITS_LISTED_FOR_SALE',
  ]),
  [roles.compliance_reporting.toLowerCase()]: new Set([
    'BCEID__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT',
  ]),
  [roles.ci_applicant.toLowerCase()]: new Set([
    'BCEID__CI_APPLICATION__GOVERNMENT_ACTION',
    'BCEID__CI_APPLICATION__FUEL_CODE_APPROVED',
  ]),
  [roles.ia_proponent.toLowerCase()]: new Set([
    'BCEID__INITIATIVE_AGREEMENT__DIRECTOR_APPROVAL',
  ]),
  [roles.ia_signer.toLowerCase()]: new Set([
    'BCEID__INITIATIVE_AGREEMENT__DIRECTOR_APPROVAL',
  ]),
}

/**
 * Maps each notification type name to its i18n category key, label key,
 * and sort order. Mirrors the category structure in the NotificationSettings
 * components so the impact modal can render the same grouping/labels.
 * Shape: [categoryKey, labelKey, categoryOrder]
 */
export const NOTIF_TYPE_CONFIG = {
  IDIR_ANALYST__GOVERNMENT_NOTIFICATION:                          ['idirAnalyst.categories.governmentNotifications', 'subscription',         0],
  IDIR_ANALYST__TRANSFER__SUBMITTED_FOR_REVIEW:                   ['idirAnalyst.categories.transfers',               'submittedForReview',    1],
  IDIR_ANALYST__TRANSFER__RESCINDED_ACTION:                       ['idirAnalyst.categories.transfers',               'rescindedAction',       1],
  IDIR_ANALYST__TRANSFER__DIRECTOR_RECORDED:                      ['idirAnalyst.categories.transfers',               'directorRecorded',      1],
  IDIR_ANALYST__INITIATIVE_AGREEMENT__RETURNED_TO_ANALYST:        ['idirAnalyst.categories.initiativeAgreements',    'returnedToAnalyst',     2],
  IDIR_ANALYST__CI_APPLICATION__DIRECTOR_APPROVAL:                ['idirAnalyst.categories.ciApplications',          'directorApproval',      3],
  IDIR_ANALYST__CI_APPLICATION__DIRECTOR_RETURNED:                ['idirAnalyst.categories.ciApplications',          'directorReturned',      3],
  IDIR_ANALYST__CI_APPLICATION__APPLICANT_ACTIVITY:               ['idirAnalyst.categories.ciApplications',          'applicantActivity',     3],
  IDIR_ANALYST__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW:          ['idirAnalyst.categories.complianceReports',       'submittedForReview',    4],
  IDIR_ANALYST__COMPLIANCE_REPORT__MANAGER_RECOMMENDATION:        ['idirAnalyst.categories.complianceReports',       'managerRecommendation', 4],
  IDIR_ANALYST__COMPLIANCE_REPORT__DIRECTOR_DECISION:             ['idirAnalyst.categories.complianceReports',       'directorDecision',      4],
  IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED:                     ['idirAnalyst.categories.fuelCodes',               'directorReturned',      5],
  IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL:                     ['idirAnalyst.categories.fuelCodes',               'directorApproval',      5],

  IDIR_COMPLIANCE_MANAGER__GOVERNMENT_NOTIFICATION:               ['idirComplianceManager.categories.governmentNotifications', 'subscription',         0],
  IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW: ['idirComplianceManager.categories.complianceReports',    'submittedForReview',    2],
  IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__ANALYST_RECOMMENDATION: ['idirComplianceManager.categories.complianceReports', 'analystRecommendation', 2],
  IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT:  ['idirComplianceManager.categories.complianceReports',   'directorAssessment',    2],

  IDIR_DIRECTOR__GOVERNMENT_NOTIFICATION:                         ['idirDirector.categories.governmentNotifications', 'subscription',          0],
  IDIR_DIRECTOR__TRANSFER__ANALYST_RECOMMENDATION:                ['idirDirector.categories.transfers',               'analystRecommendation', 1],
  IDIR_DIRECTOR__INITIATIVE_AGREEMENT__ANALYST_RECOMMENDATION:    ['idirDirector.categories.initiativeAgreements',    'analystRecommendation', 2],
  IDIR_DIRECTOR__COMPLIANCE_REPORT__MANAGER_RECOMMENDATION:       ['idirDirector.categories.complianceReports',       'managerRecommendation', 3],
  IDIR_DIRECTOR__CI_APPLICATION__ANALYST_RECOMMENDATION:          ['idirDirector.categories.ciApplications',          'analystRecommendation', 4],

  BCEID__GOVERNMENT_NOTIFICATION:                                 ['bceid.categories.governmentNotifications', 'subscription',      0],
  BCEID__TRANSFER__PARTNER_ACTIONS:                               ['bceid.categories.transfers',               'partnerActions',    1],
  BCEID__TRANSFER__DIRECTOR_DECISION:                             ['bceid.categories.transfers',               'directorDecision',  1],
  BCEID__INITIATIVE_AGREEMENT__DIRECTOR_APPROVAL:                 ['bceid.categories.initiativeAgreements',    'directorApproval',  2],
  BCEID__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT:                  ['bceid.categories.complianceReports',       'directorAssessment', 3],
  BCEID__CI_APPLICATION__GOVERNMENT_ACTION:                       ['bceid.categories.ciApplications',          'governmentAction',  4],
  BCEID__CI_APPLICATION__FUEL_CODE_APPROVED:                      ['bceid.categories.ciApplications',          'fuelCodeApproved',  4],
}

/**
 * One-line access description per role, shown in the impact modal role rows.
 */
export const ROLE_ACCESS = {
  [roles.administrator.toLowerCase()]:
    'Add/edit IDIR users and organizations; assign roles; edit comments',
  [roles.system_admin.toLowerCase()]:
    'Control compliance report opening windows and login screen background',
  [roles.analyst.toLowerCase()]:
    'Make recommendations on transfers, compliance reports, CI applications and fuel codes',
  [roles.compliance_manager.toLowerCase()]:
    'Make recommendations on compliance reports',
  [roles.director.toLowerCase()]:
    'Assess compliance reports; approve transactions, fuel codes and initiative agreements',
  [roles.manage_users.toLowerCase()]:
    'Add/edit BCeID users and assign roles within the organization',
  [roles.transfers.toLowerCase()]:
    'Create and submit transfers to government and trade partners',
  [roles.compliance_reporting.toLowerCase()]:
    'Create and submit compliance reports to government',
  [roles.signing_authority.toLowerCase()]:
    'Sign and submit compliance reports and transfers on behalf of the organization',
  [roles.read_only.toLowerCase()]:
    'View transactions, compliance reports and files; no edit access',
  [roles.ci_applicant.toLowerCase()]:
    'Access the Fuel Code tab and CI Application subtab',
  [roles.ia_proponent.toLowerCase()]:
    'Access the Initiative Agreement tab and submit applications',
  [roles.ia_analyst.toLowerCase()]:
    'Make recommendations on initiative agreements and designated actions',
  [roles.ia_manager.toLowerCase()]:
    'Make recommendations on initiative agreements and designated actions',
  [roles.ia_signer.toLowerCase()]:
    'Sign and submit IA submissions and evidence to government (government-assigned only)',
}
