import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import BCeIDNotificationSettings from '../BCeIDNotificationSettings'

// Mock the useCurrentUser hook
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: {
      email: 'test@example.com'
    }
  })
}))

// Mock the NotificationSettingsForm component
const mockNotificationSettingsForm = vi.fn()
vi.mock('../NotificationSettingsForm', () => ({
  default: (props) => {
    mockNotificationSettingsForm(props)
    return <div data-test="notification-settings-form-mock" />
  }
}))

describe('BCeIDNotificationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders NotificationSettingsForm with correct props', () => {
    render(<BCeIDNotificationSettings />)

    // Check if the mocked form is rendered
    expect(
      screen.getByTestId('notification-settings-form-mock')
    ).toBeInTheDocument()

    // Check if NotificationSettingsForm was called with the correct props
    expect(mockNotificationSettingsForm).toHaveBeenCalledWith(
      expect.objectContaining({
        showEmailField: true,
        initialEmail: 'test@example.com',
        categories: expect.any(Object)
      })
    )

    const passedProps = mockNotificationSettingsForm.mock.calls[0][0]
    expect(passedProps.categories).toHaveProperty('bceid.categories.transfers')
    expect(passedProps.categories).toHaveProperty(
      'bceid.categories.initiativeAgreements'
    )
    expect(passedProps.categories).toHaveProperty(
      'bceid.categories.complianceReports'
    )
  })
})
