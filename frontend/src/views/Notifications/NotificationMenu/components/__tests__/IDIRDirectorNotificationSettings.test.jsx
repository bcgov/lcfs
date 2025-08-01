import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import IDIRDirectorNotificationSettings from '../IDIRDirectorNotificationSettings'

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

describe('IDIRDirectorNotificationSettings', () => {
  it('renders the notification settings form with all categories', () => {
    render(<IDIRDirectorNotificationSettings />)
    
    expect(screen.getByTestId('notification-settings-form')).toBeInTheDocument()
  })

  it('includes fuel codes category in the settings', () => {
    render(<IDIRDirectorNotificationSettings />)
    
    expect(screen.getByTestId('category-idirDirector.categories.fuelCodes')).toBeInTheDocument()
  })

  it('includes fuel code analyst recommendation notification', () => {
    render(<IDIRDirectorNotificationSettings />)
    
    expect(screen.getByTestId('notification-IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION')).toBeInTheDocument()
    expect(screen.getByText('IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION: idirDirector.categories.fuelCodes.analystRecommendation')).toBeInTheDocument()
  })

  it('includes all expected categories', () => {
    render(<IDIRDirectorNotificationSettings />)
    
    // Check that all categories are present
    expect(screen.getByTestId('category-idirDirector.categories.transfers')).toBeInTheDocument()
    expect(screen.getByTestId('category-idirDirector.categories.initiativeAgreements')).toBeInTheDocument()
    expect(screen.getByTestId('category-idirDirector.categories.complianceReports')).toBeInTheDocument()
    expect(screen.getByTestId('category-idirDirector.categories.fuelCodes')).toBeInTheDocument()
  })

  it('has correct structure for fuel codes category', () => {
    render(<IDIRDirectorNotificationSettings />)
    
    const fuelCodesCategory = screen.getByTestId('category-idirDirector.categories.fuelCodes')
    expect(fuelCodesCategory).toBeInTheDocument()
    
    // Check that the fuel codes category has the correct title
    expect(fuelCodesCategory).toHaveTextContent('idirDirector.categories.fuelCodes.title')
    
    // Check that it has exactly 1 fuel code notification for director
    const fuelCodeNotifications = fuelCodesCategory.querySelectorAll('[data-test^="notification-IDIR_DIRECTOR__FUEL_CODE"]')
    expect(fuelCodeNotifications).toHaveLength(1)
  })

  it('does not include analyst-only fuel code notifications', () => {
    render(<IDIRDirectorNotificationSettings />)
    
    // Should not include analyst notifications
    expect(screen.queryByTestId('notification-IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED')).not.toBeInTheDocument()
    expect(screen.queryByTestId('notification-IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL')).not.toBeInTheDocument()
  })

  it('has only one notification in fuel codes category', () => {
    render(<IDIRDirectorNotificationSettings />)
    
    const fuelCodesCategory = screen.getByTestId('category-idirDirector.categories.fuelCodes')
    const allNotifications = fuelCodesCategory.querySelectorAll('[data-test^="notification-"]')
    
    // Director should only have one fuel code notification
    expect(allNotifications).toHaveLength(1)
    expect(allNotifications[0]).toHaveAttribute('data-test', 'notification-IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION')
  })
})