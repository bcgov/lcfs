import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, vi } from 'vitest'
import IDIRDirectorNotificationSettings from '../IDIRDirectorNotificationSettings'
import { test } from '@/tests/utils/fixtures'

// Mock the NotificationSettingsForm component
vi.mock('../NotificationSettingsForm', () => ({
  default: ({ categories }) => (
    <div data-test="notification-settings-form">
      {Object.keys(categories).map((categoryKey) => (
        <div key={categoryKey} data-test={`category-${categoryKey}`}>
          <h3>{categories[categoryKey].title}</h3>
          {Object.entries(categories[categoryKey])
            .filter(([key]) => key !== 'title')
            .map(([notificationKey, translationKey]) => (
              <div
                key={notificationKey}
                data-test={`notification-${notificationKey}`}
              >
                {notificationKey}: {translationKey}
              </div>
            ))}
        </div>
      ))}
    </div>
  )
}))

describe('IDIRDirectorNotificationSettings', () => {
  test('renders the notification settings form with all categories', ({
    render
  }) => {
    render(<IDIRDirectorNotificationSettings />)

    expect(screen.getByTestId('notification-settings-form')).toBeInTheDocument()
  })

  test('includes CI applications category in the settings', ({ render }) => {
    render(<IDIRDirectorNotificationSettings />)

    expect(
      screen.getByTestId('category-idirDirector.categories.ciApplications')
    ).toBeInTheDocument()
  })

  test('includes CI application analyst recommendation notification', ({
    render
  }) => {
    render(<IDIRDirectorNotificationSettings />)

    expect(
      screen.getByTestId(
        'notification-IDIR_DIRECTOR__CI_APPLICATION__ANALYST_RECOMMENDATION'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'IDIR_DIRECTOR__CI_APPLICATION__ANALYST_RECOMMENDATION: idirDirector.categories.ciApplications.analystRecommendation'
      )
    ).toBeInTheDocument()
  })

  test('includes all expected categories', ({ render }) => {
    render(<IDIRDirectorNotificationSettings />)

    // Check that all categories are present
    expect(
      screen.getByTestId('category-idirDirector.categories.transfers')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId(
        'category-idirDirector.categories.initiativeAgreements'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('category-idirDirector.categories.complianceReports')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('category-idirDirector.categories.ciApplications')
    ).toBeInTheDocument()
  })

  test('has correct structure for CI applications category', ({ render }) => {
    render(<IDIRDirectorNotificationSettings />)

    const ciApplicationsCategory = screen.getByTestId(
      'category-idirDirector.categories.ciApplications'
    )
    expect(ciApplicationsCategory).toBeInTheDocument()

    // Check that the CI applications category has the correct title
    expect(ciApplicationsCategory).toHaveTextContent(
      'idirDirector.categories.ciApplications.title'
    )

    // Check that it has exactly 1 CI application notification for director
    const ciApplicationNotifications = ciApplicationsCategory.querySelectorAll(
      '[data-test^="notification-IDIR_DIRECTOR__CI_APPLICATION"]'
    )
    expect(ciApplicationNotifications).toHaveLength(1)
  })

  test('does not include analyst-only fuel code notifications', ({
    render
  }) => {
    render(<IDIRDirectorNotificationSettings />)

    // Should not include analyst notifications
    expect(
      screen.queryByTestId(
        'notification-IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED'
      )
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId(
        'notification-IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL'
      )
    ).not.toBeInTheDocument()
  })

  test('has only one notification in CI applications category', ({
    render
  }) => {
    render(<IDIRDirectorNotificationSettings />)

    const ciApplicationsCategory = screen.getByTestId(
      'category-idirDirector.categories.ciApplications'
    )
    const allNotifications = ciApplicationsCategory.querySelectorAll(
      '[data-test^="notification-"]'
    )

    // Director should only have one CI application notification
    expect(allNotifications).toHaveLength(1)
    expect(allNotifications[0]).toHaveAttribute(
      'data-test',
      'notification-IDIR_DIRECTOR__CI_APPLICATION__ANALYST_RECOMMENDATION'
    )
  })
})
