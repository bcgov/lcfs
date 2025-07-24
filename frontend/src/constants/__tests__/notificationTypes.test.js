import { describe, it, expect } from 'vitest'
import { notificationTypes, notificationChannels } from '../notificationTypes'

describe('notificationTypes', () => {
  it('includes all fuel code notification types', () => {
    const fuelCodeNotifications = [
      'IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED',
      'IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL',
      'IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION'
    ]

    fuelCodeNotifications.forEach(notification => {
      expect(notificationTypes).toHaveProperty(notification)
      expect(notificationTypes[notification]).toBe(notification)
    })
  })

  it('has fuel code notifications for analysts', () => {
    expect(notificationTypes.IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED).toBe('IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED')
    expect(notificationTypes.IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL).toBe('IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL')
  })

  it('has fuel code notifications for directors', () => {
    expect(notificationTypes.IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION).toBe('IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION')
  })

  it('follows consistent naming convention for fuel code notifications', () => {
    const fuelCodeNotificationKeys = Object.keys(notificationTypes).filter(key => 
      key.includes('FUEL_CODE')
    )

    fuelCodeNotificationKeys.forEach(key => {
      // Should start with role
      expect(key).toMatch(/^(IDIR_ANALYST|IDIR_DIRECTOR|IDIR_COMPLIANCE_MANAGER|BCEID)__/)
      
      // Should contain FUEL_CODE
      expect(key).toContain('FUEL_CODE')
      
      // Should end with action
      expect(key).toMatch(/__[A-Z_]+$/)
      
      // Value should match key
      expect(notificationTypes[key]).toBe(key)
    })
  })

  it('has the correct number of fuel code notifications', () => {
    const fuelCodeNotificationKeys = Object.keys(notificationTypes).filter(key => 
      key.includes('FUEL_CODE')
    )
    
    // Should have exactly 3 fuel code notification types
    expect(fuelCodeNotificationKeys).toHaveLength(3)
  })

  it('maintains consistency with other notification types', () => {
    // Check that all notification types follow the same pattern
    Object.entries(notificationTypes).forEach(([key, value]) => {
      expect(value).toBe(key) // Value should equal key
      expect(key).toMatch(/^[A-Z_]+$/) // Should be all uppercase with underscores
    })
  })
})

describe('notificationChannels', () => {
  it('includes EMAIL and IN_APP channels', () => {
    expect(notificationChannels.EMAIL).toBe('EMAIL')
    expect(notificationChannels.IN_APP).toBe('IN_APP')
  })

  it('has only two notification channels', () => {
    expect(Object.keys(notificationChannels)).toHaveLength(2)
  })
})