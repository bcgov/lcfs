import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import BCeIDNotificationSettings from '../BCeIDNotificationSettings'

// Mock the NotificationSettingsForm component
const mockNotificationSettingsForm = vi.fn()
vi.mock('../NotificationSettingsForm', () => ({
  default: (props) => {
    mockNotificationSettingsForm(props)
    return <div data-test="notification-settings-form-mock" />
  }
}))

// Mock the useCurrentUser hook with different scenarios
const mockUseCurrentUser = vi.fn()
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser()
}))

describe('BCeIDNotificationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders NotificationSettingsForm with currentUser email', () => {
    mockUseCurrentUser.mockReturnValue({
      data: { email: 'test@example.com' }
    })

    render(<BCeIDNotificationSettings />)

    expect(
      screen.getByTestId('notification-settings-form-mock')
    ).toBeInTheDocument()
    
    expect(mockNotificationSettingsForm).toHaveBeenCalledWith(
      expect.objectContaining({
        showEmailField: true,
        initialEmail: 'test@example.com',
        categories: expect.any(Object)
      })
    )
  })

  it('renders NotificationSettingsForm with undefined email when currentUser has no email', () => {
    mockUseCurrentUser.mockReturnValue({
      data: {}
    })

    render(<BCeIDNotificationSettings />)

    expect(mockNotificationSettingsForm).toHaveBeenCalledWith(
      expect.objectContaining({
        showEmailField: true,
        initialEmail: undefined,
        categories: expect.any(Object)
      })
    )
  })

  it('renders NotificationSettingsForm with undefined email when no currentUser', () => {
    mockUseCurrentUser.mockReturnValue({
      data: null
    })

    render(<BCeIDNotificationSettings />)

    expect(mockNotificationSettingsForm).toHaveBeenCalledWith(
      expect.objectContaining({
        showEmailField: true,
        initialEmail: undefined,
        categories: expect.any(Object)
      })
    )
  })

  it('passes correct categories structure to NotificationSettingsForm', () => {
    mockUseCurrentUser.mockReturnValue({
      data: { email: 'test@example.com' }
    })

    render(<BCeIDNotificationSettings />)

    const passedProps = mockNotificationSettingsForm.mock.calls[0][0]
    const expectedCategories = {
      'bceid.categories.transfers': {
        title: 'bceid.categories.transfers.title',
        BCEID__CREDIT_MARKET__CREDITS_LISTED_FOR_SALE:
          'bceid.categories.transfers.creditsListedForSale',
        BCEID__TRANSFER__PARTNER_ACTIONS:
          'bceid.categories.transfers.partnerActions',
        BCEID__TRANSFER__DIRECTOR_DECISION:
          'bceid.categories.transfers.directorDecision'
      },
      'bceid.categories.initiativeAgreements': {
        title: 'bceid.categories.initiativeAgreements.title',
        BCEID__INITIATIVE_AGREEMENT__DIRECTOR_APPROVAL:
          'bceid.categories.initiativeAgreements.directorApproval'
      },
      'bceid.categories.complianceReports': {
        title: 'bceid.categories.complianceReports.title',
        BCEID__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT:
          'bceid.categories.complianceReports.directorAssessment'
      },
      'bceid.categories.governmentNotifications': {
        title: 'bceid.categories.governmentNotifications.title',
        BCEID__GOVERNMENT_NOTIFICATION:
          'bceid.categories.governmentNotifications.subscription'
      }
    }

    expect(passedProps.categories).toEqual(expectedCategories)
  })

  it('always passes showEmailField as true', () => {
    mockUseCurrentUser.mockReturnValue({
      data: { email: 'test@example.com' }
    })

    render(<BCeIDNotificationSettings />)

    expect(mockNotificationSettingsForm).toHaveBeenCalledWith(
      expect.objectContaining({
        showEmailField: true
      })
    )
  })
})