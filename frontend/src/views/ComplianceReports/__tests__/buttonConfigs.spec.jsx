import { describe, it, expect } from 'vitest'
import { buttonClusterConfigFn } from '../buttonConfigs'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { roles } from '@/constants/roles'

const baseContext = {
  t: (key) => key,
  hasRoles: () => false,
  hasAnyRole: () => false,
  setModalData: () => {},
  updateComplianceReport: () => {},
  deleteComplianceReport: () => {},
  createSupplementalReport: () => {},
  createAnalystAdjustment: () => {},
  createIdirSupplementalReport: () => {},
  compliancePeriod: '2023',
  isSigningAuthorityDeclared: true,
  hadBeenAssessed: false,
  hasDraftSupplemental: false,
  isEarlyIssuance: false,
  isOriginalReport: true,
  reportVersion: 0
}

describe('buttonClusterConfigFn', () => {
  it('includes submit and delete buttons for BCeID signer on draft status', () => {
    const context = {
      ...baseContext,
      currentStatus: COMPLIANCE_REPORT_STATUSES.DRAFT,
      hasRoles: (role) => role === roles.signing_authority,
      hasAnyRole: () => false
    }
    const config = buttonClusterConfigFn(context)
    const buttons = config[COMPLIANCE_REPORT_STATUSES.DRAFT]
    const ids = buttons.map((b) => b.id)
    expect(ids).toContain('submit-report-btn')
    expect(ids).toContain('delete-draft-btn')
  })

  it('omits return-to-supplier after deadline for original report', () => {
    const context = {
      ...baseContext,
      currentStatus: COMPLIANCE_REPORT_STATUSES.SUBMITTED,
      compliancePeriod: '2020',
      isOriginalReport: true,
      reportVersion: 0,
      hasRoles: (role) => role === roles.analyst,
      hasAnyRole: (...args) => args.includes(roles.analyst)
    }
    const config = buttonClusterConfigFn(context)
    const buttons = config[COMPLIANCE_REPORT_STATUSES.SUBMITTED]
    const ids = buttons.map((b) => b.id)
    expect(ids).not.toContain('return-to-supplier-btn')
  })
})
