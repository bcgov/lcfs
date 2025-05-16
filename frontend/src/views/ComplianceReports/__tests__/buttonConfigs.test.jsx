import { describe, it, expect, vi } from 'vitest'
import { buttonClusterConfigFn } from '../buttonConfigs'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { roles } from '@/constants/roles'

// Mock t function
const t = (key) => key

// Mock functions/props
const mockSetModalData = vi.fn()
const mockUpdateComplianceReport = vi.fn()
const mockCreateIdirSupplementalReport = vi.fn()
const mockDeleteComplianceReport = vi.fn()
const mockCreateSupplementalReport = vi.fn()
const mockCreateAnalystAdjustment = vi.fn()
const mockCurrentUser = {
  /* mock user structure if needed */
}

const baseProps = {
  t,
  setModalData: mockSetModalData,
  updateComplianceReport: mockUpdateComplianceReport,
  deleteComplianceReport: mockDeleteComplianceReport,
  createSupplementalReport: mockCreateSupplementalReport,
  createAnalystAdjustment: mockCreateAnalystAdjustment,
  createIdirSupplementalReport: mockCreateIdirSupplementalReport,
  compliancePeriod: '2023',
  isGovernmentUser: false,
  isSigningAuthorityDeclared: true,
  supplementalInitiator: null,
  hasDraftSupplemental: false,
  currentUser: mockCurrentUser,
  isSupplemental: false
  // Add other props used by the function as needed
}

describe('buttonClusterConfigFn', () => {
  // Example test - expand this
  it('should return submit button for Draft status and Signing Authority', () => {
    const props = {
      ...baseProps,
      hasRoles: (role) => role === roles.signing_authority
    }
    const config = buttonClusterConfigFn(props)
    const buttons = config[COMPLIANCE_REPORT_STATUSES.DRAFT]
    expect(buttons).toBeDefined()
    expect(buttons.length).toBeGreaterThan(0)
    expect(buttons[0].label).toBe('report:actionBtns.submitReportBtn')
    // Add more assertions for other scenarios
  })

  // Add tests for IDIR supplemental logic here
  it('shows recommend and returnToSupplier for Submitted (Analyst, no draft, reportVersion 0, before deadline)', () => {
    // Set date to before March 31st of next year
    vi.setSystemTime(new Date(2024, 1, 15)) // Feb 15, 2024 for compliancePeriod 2023

    const props = {
      ...baseProps,
      isGovernmentUser: true,
      hasRoles: (role) => role === roles.analyst,
      hasDraftSupplemental: false,
      reportVersion: 0
    }
    const config = buttonClusterConfigFn(props)
    const buttons = config[COMPLIANCE_REPORT_STATUSES.SUBMITTED]
    expect(buttons).toBeDefined()
    expect(buttons.length).toBe(2)
    expect(buttons[0].label).toBe('report:actionBtns.recommendReportAnalystBtn')
    expect(buttons[0].disabled).toBe(false)
    expect(buttons[1].label).toBe('report:actionBtns.returnToSupplier')
    expect(buttons[1].disabled).toBe(false)

    const createSupplementalButton = buttons.find(
      (b) => b.id === 'create-idir-supplemental-report-btn'
    )
    expect(createSupplementalButton).toBeUndefined()

    vi.useRealTimers() // Reset time
  })

  it('shows recommend and createIdirSupplemental for Submitted (Analyst, no draft, reportVersion 0, after deadline)', () => {
    // Set date to after March 31st of next year
    vi.setSystemTime(new Date(2024, 3, 15)) // April 15, 2024 for compliancePeriod 2023

    const props = {
      ...baseProps,
      isGovernmentUser: true,
      hasRoles: (role) => role === roles.analyst,
      hasDraftSupplemental: false,
      reportVersion: 0
    }
    const config = buttonClusterConfigFn(props)
    const buttons = config[COMPLIANCE_REPORT_STATUSES.SUBMITTED]
    expect(buttons).toBeDefined()
    expect(buttons.length).toBe(2)
    expect(buttons[0].label).toBe('report:actionBtns.recommendReportAnalystBtn')
    expect(buttons[0].disabled).toBe(false)
    expect(buttons[1].label).toBe(
      'report:actionBtns.createSupplementalReportBtn'
    )
    expect(buttons[1].disabled).toBe(false)

    const returnButton = buttons.find(
      (b) => b.id === 'return-report-supplier-btn'
    )
    expect(returnButton).toBeUndefined()

    vi.useRealTimers() // Reset time
  })

  it('disables Analyst actions for Submitted (reportVersion 0, before deadline) if draft exists', () => {
    vi.setSystemTime(new Date(2024, 1, 15)) // Feb 15, 2024

    const props = {
      ...baseProps,
      isGovernmentUser: true,
      hasRoles: (role) => role === roles.analyst,
      hasDraftSupplemental: true, // Draft exists
      reportVersion: 0
    }
    const config = buttonClusterConfigFn(props)
    const buttons = config[COMPLIANCE_REPORT_STATUSES.SUBMITTED]
    expect(buttons).toBeDefined()
    expect(buttons.length).toBe(2)
    expect(buttons[0].label).toBe('report:actionBtns.recommendReportAnalystBtn')
    expect(buttons[0].disabled).toBe(true)
    expect(buttons[1].label).toBe('report:actionBtns.returnToSupplier')
    expect(buttons[1].disabled).toBe(true)

    vi.useRealTimers()
  })

  it('disables Analyst actions for Submitted (reportVersion 0, after deadline) if draft exists', () => {
    vi.setSystemTime(new Date(2024, 3, 15)) // April 15, 2024

    const props = {
      ...baseProps,
      isGovernmentUser: true,
      hasRoles: (role) => role === roles.analyst,
      hasDraftSupplemental: true, // Draft exists
      reportVersion: 0
    }
    const config = buttonClusterConfigFn(props)
    const buttons = config[COMPLIANCE_REPORT_STATUSES.SUBMITTED]
    expect(buttons).toBeDefined()
    expect(buttons.length).toBe(2)
    expect(buttons[0].label).toBe('report:actionBtns.recommendReportAnalystBtn')
    expect(buttons[0].disabled).toBe(true)
    expect(buttons[1].label).toBe(
      'report:actionBtns.createSupplementalReportBtn'
    )
    expect(buttons[1].disabled).toBe(true)

    vi.useRealTimers()
  })

  it('disables Analyst actions for Submitted (reportVersion > 0) if draft exists', () => {
    const props = {
      ...baseProps,
      isGovernmentUser: true,
      hasRoles: (role) => role === roles.analyst,
      hasDraftSupplemental: true, // Draft exists
      reportVersion: 1 // Is a supplemental report
    }
    const config = buttonClusterConfigFn(props)
    const buttons = config[COMPLIANCE_REPORT_STATUSES.SUBMITTED]
    expect(buttons).toBeDefined()
    expect(buttons.length).toBe(2)
    expect(buttons[0].label).toBe('report:actionBtns.recommendReportAnalystBtn')
    expect(buttons[0].disabled).toBe(true)
    expect(buttons[1].label).toBe(
      'report:actionBtns.createSupplementalReportBtn'
    )
    expect(buttons[1].disabled).toBe(true)
  })

  it('should disable Manager/Director actions when draft supplemental exists', () => {
    const props = {
      ...baseProps,
      isGovernmentUser: true,
      hasRoles: (role) => role === roles.compliance_manager, // Example: Manager
      hasDraftSupplemental: true // Draft exists
    }
    // Test Recommended by Analyst status
    let config = buttonClusterConfigFn(props)
    let buttons = config[COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST]
    expect(buttons[0].disabled).toBe(true) // Recommend Manager disabled
    expect(buttons[1].disabled).toBe(true) // Return Analyst disabled

    // Test Recommended by Manager status (need Director role)
    props.hasRoles = (role) => role === roles.director
    config = buttonClusterConfigFn(props)
    buttons = config[COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER]
    expect(buttons[0].disabled).toBe(true) // Assess disabled
    expect(buttons[1].disabled).toBe(true) // Return Manager disabled

    // Verify no Return to Supplier button
    const returnButton = buttons.find(
      (b) => b.id === 'return-report-supplier-btn'
    )
    expect(returnButton).toBeUndefined()
  })

  const findReturnToSupplierButton = (buttons) => {
    return buttons?.find((b) => b.id === 'return-report-supplier-btn')
  }

  it('should show return to supplier button for Analyst role with reportVersion 0 before deadline', () => {
    // Set date to before March 31st of next year
    vi.setSystemTime(new Date(2024, 1, 15)) // Feb 15, 2024

    const props = {
      ...baseProps,
      hasRoles: (role) => role === roles.analyst,
      isGovernmentUser: true,
      reportVersion: 0
    }

    const config = buttonClusterConfigFn(props)
    const buttons = config[COMPLIANCE_REPORT_STATUSES.SUBMITTED]
    const returnButton = findReturnToSupplierButton(buttons)

    expect(returnButton).toBeDefined()
    expect(returnButton.label).toBe('report:actionBtns.returnToSupplier')
    expect(returnButton.disabled).toBe(false)
  })

  it('should not show return to supplier button for Analyst role with reportVersion 0 after deadline', () => {
    // Set date to after March 31st of next year
    vi.setSystemTime(new Date(2024, 4, 1)) // May 1, 2024

    const props = {
      ...baseProps,
      hasRoles: (role) => role === roles.analyst,
      isGovernmentUser: true,
      reportVersion: 0
    }

    const config = buttonClusterConfigFn(props)
    const buttons = config[COMPLIANCE_REPORT_STATUSES.SUBMITTED]
    const returnButton = findReturnToSupplierButton(buttons)

    expect(returnButton).toBeUndefined()
  })

  it('should show return to supplier button for supplemental reports even if past deadline', () => {
    // Set date to after March 31st of next year
    vi.setSystemTime(new Date(2024, 4, 1)) // May 1, 2024
    const props = {
      ...baseProps,
      hasRoles: (role) => role === roles.analyst,
      isGovernmentUser: true,
      reportVersion: 1,
      isSupplemental: true
    }

    const config = buttonClusterConfigFn(props)
    const buttons = config[COMPLIANCE_REPORT_STATUSES.SUBMITTED]
    const returnButton = findReturnToSupplierButton(buttons)

    expect(returnButton).toBeDefined()
    expect(returnButton.label).toBe('report:actionBtns.returnToSupplier')
    expect(returnButton.disabled).toBe(false)
  })

  it('should display assessment button for Director in Recommended by analyst status', () => {
    const props = {
      ...baseProps,
      isGovernmentUser: true,
      hasRoles: (role) => role === roles.director,
      hasDraftSupplemental: false
    }

    // Test Recommended by Analyst status with Director role
    const config = buttonClusterConfigFn(props)
    const buttons = config[COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST]

    // We should see the Director buttons (after the Manager buttons)
    expect(buttons.length).toBe(2)
    expect(buttons[0].id).toBe('assess-report-btn')
    expect(buttons[0].label).toBe('report:actionBtns.assessReportBtn')
    expect(buttons[0].disabled).toBe(false)

    expect(buttons[1].id).toBe('return-report-manager-btn')
    expect(buttons[1].label).toBe('report:actionBtns.returnToAnalyst')
    expect(buttons[1].disabled).toBe(false)
  })
})
