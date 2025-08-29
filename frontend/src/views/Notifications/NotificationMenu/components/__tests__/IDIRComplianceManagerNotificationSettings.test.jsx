import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import IDIRComplianceManagerNotificationSettings from '../IDIRComplianceManagerNotificationSettings'

// Mock the NotificationSettingsForm component
const mockNotificationSettingsForm = vi.fn()
vi.mock('../NotificationSettingsForm', () => ({
  default: (props) => {
    mockNotificationSettingsForm(props)
    return <div data-test="notification-settings-form-mock" />
  }
}))

describe('IDIRComplianceManagerNotificationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    const component = render(<IDIRComplianceManagerNotificationSettings />)
    expect(component).toBeTruthy()
    expect(
      screen.getByTestId('notification-settings-form-mock')
    ).toBeInTheDocument()
  })

  it('renders NotificationSettingsForm with correct categories prop', () => {
    render(<IDIRComplianceManagerNotificationSettings />)

    // Check if NotificationSettingsForm was called with categories
    expect(mockNotificationSettingsForm).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: expect.any(Object)
      })
    )
  })

  it('has correct categories object structure and keys', () => {
    render(<IDIRComplianceManagerNotificationSettings />)

    const passedProps = mockNotificationSettingsForm.mock.calls[0][0]
    const categories = passedProps.categories

    // Test main category key exists
    expect(categories).toHaveProperty(
      'idirComplianceManager.categories.complianceReports'
    )

    const complianceReportsCategory = categories[
      'idirComplianceManager.categories.complianceReports'
    ]

    // Test category has title property
    expect(complianceReportsCategory).toHaveProperty('title')

    // Test all notification type keys exist
    expect(complianceReportsCategory).toHaveProperty(
      'IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW'
    )
    expect(complianceReportsCategory).toHaveProperty(
      'IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__ANALYST_RECOMMENDATION'
    )
    expect(complianceReportsCategory).toHaveProperty(
      'IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT'
    )
  })

  it('has correct categories nested property values', () => {
    render(<IDIRComplianceManagerNotificationSettings />)

    const passedProps = mockNotificationSettingsForm.mock.calls[0][0]
    const complianceReportsCategory = passedProps.categories[
      'idirComplianceManager.categories.complianceReports'
    ]

    // Test all property values are correct
    expect(complianceReportsCategory.title).toBe(
      'idirComplianceManager.categories.complianceReports.title'
    )
    expect(
      complianceReportsCategory.IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW
    ).toBe(
      'idirComplianceManager.categories.complianceReports.submittedForReview'
    )
    expect(
      complianceReportsCategory.IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__ANALYST_RECOMMENDATION
    ).toBe(
      'idirComplianceManager.categories.complianceReports.analystRecommendation'
    )
    expect(
      complianceReportsCategory.IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT
    ).toBe(
      'idirComplianceManager.categories.complianceReports.directorAssessment'
    )
  })

  it('component export functionality works correctly', () => {
    // Test that the component can be imported and used
    expect(IDIRComplianceManagerNotificationSettings).toBeDefined()
    expect(typeof IDIRComplianceManagerNotificationSettings).toBe('function')
    
    // Test that component returns JSX
    const result = IDIRComplianceManagerNotificationSettings()
    expect(result).toBeTruthy()
    expect(result.type).toBeDefined()
  })

  it('does not pass showEmailField or initialEmail props', () => {
    render(<IDIRComplianceManagerNotificationSettings />)

    expect(mockNotificationSettingsForm).toHaveBeenCalledWith(
      expect.not.objectContaining({
        showEmailField: expect.any(Boolean),
        initialEmail: expect.any(String)
      })
    )
  })
})
