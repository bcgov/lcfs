import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import IDIRAnalystNotificationSettings from '../IDIRAnalystNotificationSettings'

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
              <div key={notificationKey} data-test={`notification-${notificationKey}`}>
                {notificationKey}: {translationKey}
              </div>
            ))}
        </div>
      ))}
    </div>
  )
}))

describe('IDIRAnalystNotificationSettings', () => {
  it('renders the notification settings form with all categories', () => {
    render(<IDIRAnalystNotificationSettings />)
    
    expect(screen.getByTestId('notification-settings-form')).toBeInTheDocument()
  })

  it('includes fuel codes category in the settings', () => {
    render(<IDIRAnalystNotificationSettings />)
    
    expect(screen.getByTestId('category-idirAnalyst.categories.fuelCodes')).toBeInTheDocument()
  })

  it('includes fuel code director decision notification', () => {
    render(<IDIRAnalystNotificationSettings />)
    
    expect(screen.getByTestId('notification-IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED')).toBeInTheDocument()
    expect(screen.getByText('IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED: idirAnalyst.categories.fuelCodes.directorReturned')).toBeInTheDocument()
  })

  it('includes fuel code director approval notification', () => {
    render(<IDIRAnalystNotificationSettings />)
    
    expect(screen.getByTestId('notification-IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL')).toBeInTheDocument()
    expect(screen.getByText('IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL: idirAnalyst.categories.fuelCodes.directorApproval')).toBeInTheDocument()
  })

  it('includes all expected categories', () => {
    render(<IDIRAnalystNotificationSettings />)
    
    // Check that all categories are present
    expect(screen.getByTestId('category-idirAnalyst.categories.transfers')).toBeInTheDocument()
    expect(screen.getByTestId('category-idirAnalyst.categories.initiativeAgreements')).toBeInTheDocument()
    expect(screen.getByTestId('category-idirAnalyst.categories.complianceReports')).toBeInTheDocument()
    expect(screen.getByTestId('category-idirAnalyst.categories.fuelCodes')).toBeInTheDocument()
  })

  it('has correct structure for fuel codes category', () => {
    render(<IDIRAnalystNotificationSettings />)
    
    const fuelCodesCategory = screen.getByTestId('category-idirAnalyst.categories.fuelCodes')
    expect(fuelCodesCategory).toBeInTheDocument()
    
    // Check that the fuel codes category has the correct title
    expect(fuelCodesCategory).toHaveTextContent('idirAnalyst.categories.fuelCodes.title')
    
    // Check that it has exactly 2 fuel code notifications
    const fuelCodeNotifications = fuelCodesCategory.querySelectorAll('[data-test^="notification-IDIR_ANALYST__FUEL_CODE"]')
    expect(fuelCodeNotifications).toHaveLength(2)
  })

  it('does not include director-only fuel code notifications', () => {
    render(<IDIRAnalystNotificationSettings />)
    
    // Should not include director notifications
    expect(screen.queryByTestId('notification-IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION')).not.toBeInTheDocument()
  })
})