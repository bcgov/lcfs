import { describe, it, expect, vi } from 'vitest'
import { buttonClusterConfigFn } from '../buttonConfigs'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { roles } from '@/constants/roles'
import { DateTime } from 'luxon'

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
  currentUser: mockCurrentUser
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
  it('should return correct buttons for Submitted status (Analyst, no draft, before deadline)', () => {
    // Set date to before March 31st of next year
    vi.setSystemTime(new Date(2024, 1, 15)) // Feb 15, 2024

    const props = {
      ...baseProps,
      isGovernmentUser: true,
      hasRoles: (role) => role === roles.analyst,
      hasDraftSupplemental: false // No draft
    }
    const config = buttonClusterConfigFn(props)
    const buttons = config[COMPLIANCE_REPORT_STATUSES.SUBMITTED]
    expect(buttons).toBeDefined()
    expect(buttons.length).toBe(3)
    expect(buttons[0].label).toBe('report:actionBtns.recommendReportAnalystBtn')
    expect(buttons[0].disabled).toBe(false)
    expect(buttons[1].label).toBe('report:actionBtns.returnToSupplier')
    expect(buttons[1].disabled).toBe(false) // Not past deadline, no draft
    expect(buttons[2].label).toBe(
      'report:actionBtns.createSupplementalReportBtn'
    )
    expect(buttons[2].disabled).toBe(false) // No draft

    vi.useRealTimers() // Reset time
  })

  it('should disable Return to Supplier button after deadline', () => {
    // Set date to after March 31st of next year
    vi.setSystemTime(new Date(2024, 3, 15)) // April 15, 2024

    const props = {
      ...baseProps,
      isGovernmentUser: true,
      hasRoles: (role) => role === roles.analyst,
      hasDraftSupplemental: false
    }
    const config = buttonClusterConfigFn(props)
    const buttons = config[COMPLIANCE_REPORT_STATUSES.SUBMITTED]
    const returnButton = buttons.find(
      (b) => b.id === 'return-report-supplier-btn'
    )
    expect(returnButton.disabled).toBe(true) // Past deadline

    vi.useRealTimers() // Reset time
  })

  it('should disable Analyst actions on Submitted status when draft supplemental exists', () => {
    const props = {
      ...baseProps,
      isGovernmentUser: true,
      hasRoles: (role) => role === roles.analyst,
      hasDraftSupplemental: true // Draft exists
    }
    const config = buttonClusterConfigFn(props)
    const buttons = config[COMPLIANCE_REPORT_STATUSES.SUBMITTED]
    expect(buttons).toBeDefined()
    expect(buttons.length).toBe(3)
    expect(buttons[0].disabled).toBe(true) // Recommend disabled
    expect(buttons[1].disabled).toBe(true) // Return disabled
    expect(buttons[2].disabled).toBe(true) // Create disabled
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
  })
})
