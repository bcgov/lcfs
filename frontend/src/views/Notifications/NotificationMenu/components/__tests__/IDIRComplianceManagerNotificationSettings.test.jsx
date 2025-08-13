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
  it('renders NotificationSettingsForm with correct categories', () => {
    render(<IDIRComplianceManagerNotificationSettings />)

    // Check if the mocked form is rendered
    expect(
      screen.getByTestId('notification-settings-form-mock')
    ).toBeInTheDocument()

    // Check if NotificationSettingsForm was called with the correct categories
    expect(mockNotificationSettingsForm).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: expect.any(Object)
      })
    )

    const passedProps = mockNotificationSettingsForm.mock.calls[0][0]
    expect(passedProps.categories).toHaveProperty(
      'idirComplianceManager.categories.complianceReports'
    )
    expect(
      passedProps.categories[
        'idirComplianceManager.categories.complianceReports'
      ]
    ).toHaveProperty(
      'IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW'
    )
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
