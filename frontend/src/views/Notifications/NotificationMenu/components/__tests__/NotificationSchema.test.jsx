import { describe, it, expect, vi } from 'vitest'
import { routesMapping, columnDefs, defaultSortModel } from '../_schema'
import { ROUTES } from '@/routes/routes'

describe('Notification Schema', () => {
  describe('routesMapping', () => {
    it('returns correct routes for government users', () => {
      const currentUser = { isGovernmentUser: true }
      const mapping = routesMapping(currentUser)

      expect(mapping.Transfer).toBe(ROUTES.TRANSFERS.VIEW)
      expect(mapping.AdminAdjustment).toBe(ROUTES.TRANSACTIONS.ADMIN_ADJUSTMENT.VIEW)
      expect(mapping.InitiativeAgreement).toBe(ROUTES.TRANSACTIONS.INITIATIVE_AGREEMENT.VIEW)
      expect(mapping.ComplianceReport).toBe(ROUTES.REPORTS.VIEW)
    })

    it('returns correct routes for non-government users', () => {
      const currentUser = { isGovernmentUser: false }
      const mapping = routesMapping(currentUser)

      expect(mapping.Transfer).toBe(ROUTES.TRANSFERS.VIEW)
      expect(mapping.AdminAdjustment).toBe(ROUTES.TRANSACTIONS.ADMIN_ADJUSTMENT.ORG_VIEW)
      expect(mapping.InitiativeAgreement).toBe(ROUTES.TRANSACTIONS.INITIATIVE_AGREEMENT.ORG_VIEW)
      expect(mapping.ComplianceReport).toBe(ROUTES.REPORTS.VIEW)
    })

    it('includes all fuel code notification types', () => {
      const currentUser = { isGovernmentUser: true }
      const mapping = routesMapping(currentUser)

      const fuelCodeTypes = [
        'Fuel Code',
        'Fuel Code Status Update',
        'Fuel Code Recommended',
        'Fuel Code Approved',
        'Fuel Code Draft',
        'Fuel Code Returned'
      ]

      fuelCodeTypes.forEach(type => {
        expect(mapping[type]).toBe(ROUTES.FUEL_CODES.EDIT)
      })
    })

    it('returns all required notification types', () => {
      const currentUser = { isGovernmentUser: true }
      const mapping = routesMapping(currentUser)

      // Check that all expected keys exist
      const expectedKeys = [
        'Transfer',
        'AdminAdjustment',
        'InitiativeAgreement',
        'ComplianceReport',
        'Fuel Code',
        'Fuel Code Status Update',
        'Fuel Code Recommended',
        'Fuel Code Approved',
        'Fuel Code Draft',
        'Fuel Code Returned'
      ]

      expectedKeys.forEach(key => {
        expect(mapping).toHaveProperty(key)
        expect(mapping[key]).toBeTruthy()
      })
    })
  })

  describe('columnDefs', () => {
    it('returns column definitions with required fields', () => {
      const mockT = (key) => key
      const currentUser = { isGovernmentUser: true }
      const columns = columnDefs(mockT, currentUser)

      expect(Array.isArray(columns)).toBe(true)
      
      // Check for required columns
      const columnIds = columns.map(col => col.colId || col.field)
      expect(columnIds).toContain('type')
      expect(columnIds).toContain('date')
      expect(columnIds).toContain('user')
      expect(columnIds).toContain('transactionId')
      expect(columnIds).toContain('organization')
    })

    it('includes delete action column', () => {
      const mockT = (key) => key
      const currentUser = { isGovernmentUser: true }
      const columns = columnDefs(mockT, currentUser)

      const actionColumn = columns.find(col => col.headerName === 'Delete')
      expect(actionColumn).toBeDefined()
    })

    it('configures date column with proper filter', () => {
      const mockT = (key) => key
      const currentUser = { isGovernmentUser: true }
      const columns = columnDefs(mockT, currentUser)

      const dateColumn = columns.find(col => col.colId === 'date')
      expect(dateColumn).toBeDefined()
      expect(dateColumn.filter).toBe('agDateColumnFilter')
      expect(dateColumn.floatingFilterComponent).toBeDefined()
    })

    it('uses proper value getters for nested data', () => {
      const mockT = (key) => key
      const currentUser = { isGovernmentUser: true }
      const columns = columnDefs(mockT, currentUser)

      const userColumn = columns.find(col => col.colId === 'user')
      expect(userColumn.valueGetter).toBeDefined()

      const dateColumn = columns.find(col => col.colId === 'date')
      expect(dateColumn.valueGetter).toBeDefined()

      const transactionColumn = columns.find(col => col.colId === 'transactionId')
      expect(transactionColumn.valueGetter).toBeDefined()
    })
  })

  describe('defaultSortModel', () => {
    it('sorts by date in descending order by default', () => {
      expect(defaultSortModel).toEqual([
        { field: 'date', direction: 'desc' }
      ])
    })
  })

  describe('Route parameter replacement', () => {
    it('all routes contain proper parameter placeholders', () => {
      const currentUser = { isGovernmentUser: true }
      const mapping = routesMapping(currentUser)

      // Transfer route should have :transferId
      expect(mapping.Transfer).toContain(':transferId')

      // Admin adjustment routes should have :transactionId
      expect(mapping.AdminAdjustment).toContain(':transactionId')

      // Initiative agreement routes should have :transactionId
      expect(mapping.InitiativeAgreement).toContain(':transactionId')

      // Compliance report route should have parameters
      expect(mapping.ComplianceReport).toContain(':compliancePeriod')
      expect(mapping.ComplianceReport).toContain(':complianceReportId')

      // Fuel code routes should have :fuelCodeID
      Object.entries(mapping).forEach(([key, value]) => {
        if (key.startsWith('Fuel Code')) {
          expect(value).toContain(':fuelCodeID')
        }
      })
    })
  })

  describe('Integration with notification click handler', () => {
    it('all mapped routes are valid ROUTES constants', () => {
      const currentUser = { isGovernmentUser: true }
      const mapping = routesMapping(currentUser)

      // Verify all values are actual route strings
      Object.values(mapping).forEach(route => {
        expect(typeof route).toBe('string')
        expect(route).toMatch(/^\//) // All routes should start with /
      })
    })

    it('handles both government and non-government user contexts', () => {
      const govUser = { isGovernmentUser: true }
      const nonGovUser = { isGovernmentUser: false }

      const govMapping = routesMapping(govUser)
      const nonGovMapping = routesMapping(nonGovUser)

      // Government users should see different admin/initiative routes
      expect(govMapping.AdminAdjustment).not.toBe(nonGovMapping.AdminAdjustment)
      expect(govMapping.InitiativeAgreement).not.toBe(nonGovMapping.InitiativeAgreement)

      // But same routes for others
      expect(govMapping.Transfer).toBe(nonGovMapping.Transfer)
      expect(govMapping.ComplianceReport).toBe(nonGovMapping.ComplianceReport)
      expect(govMapping['Fuel Code']).toBe(nonGovMapping['Fuel Code'])
    })
  })
})