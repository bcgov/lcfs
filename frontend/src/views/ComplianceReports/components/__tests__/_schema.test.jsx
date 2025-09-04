import { describe, expect, it, vi } from 'vitest'
import { reportsColDefs } from '../_schema'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock the AssignedAnalystCell component
vi.mock('../AssignedAnalystCell', () => ({
  AssignedAnalystCell: 'AssignedAnalystCell'
}))

// Mock other dependencies
vi.mock('@/hooks/useComplianceReports', () => ({
  useGetComplianceReportStatuses: vi.fn(),
  useGetAvailableAnalysts: vi.fn()
}))

vi.mock('@/utils/grid/cellRenderers', () => ({
  ReportsStatusRenderer: 'ReportsStatusRenderer',
  LastCommentRenderer: 'LastCommentRenderer'
}))

vi.mock('@/utils/formatters', () => ({
  timezoneFormatter: 'timezoneFormatter'
}))

vi.mock('@/components/BCDataGrid/components', () => ({
  BCDateFloatingFilter: 'BCDateFloatingFilter',
  BCSelectFloatingFilter: 'BCSelectFloatingFilter'
}))

describe('ComplianceReports Schema', () => {
  const mockT = (key) => key
  const mockOnRefresh = vi.fn()

  describe('reportsColDefs', () => {
    it('should return all expected columns for government users', () => {
      const isSupplier = false
      const colDefs = reportsColDefs(mockT, isSupplier, mockOnRefresh)

      // Verify we have the right number of columns
      expect(colDefs).toHaveLength(7)

      // Verify column fields
      const fields = colDefs.map(col => col.field)
      expect(fields).toEqual([
        'status',
        'assignedAnalyst',
        'lastComment',
        'compliancePeriod',
        'organization',
        'type',
        'updateDate'
      ])
    })

    it('should return columns with assigned analyst column visible for government users', () => {
      const isSupplier = false
      const colDefs = reportsColDefs(mockT, isSupplier, mockOnRefresh)

      const assignedAnalystCol = colDefs.find(col => col.field === 'assignedAnalyst')
      
      expect(assignedAnalystCol).toBeDefined()
      expect(assignedAnalystCol.hide).toBe(false)
      expect(assignedAnalystCol.headerName).toBe('report:reportColLabels.assignedAnalyst')
      expect(assignedAnalystCol.width).toBe(180)
    })

    it('should hide assigned analyst column for suppliers', () => {
      const isSupplier = true
      const colDefs = reportsColDefs(mockT, isSupplier, mockOnRefresh)

      const assignedAnalystCol = colDefs.find(col => col.field === 'assignedAnalyst')
      
      expect(assignedAnalystCol).toBeDefined()
      expect(assignedAnalystCol.hide).toBe(true)
    })

    it('should hide organization column for suppliers', () => {
      const isSupplier = true
      const colDefs = reportsColDefs(mockT, isSupplier, mockOnRefresh)

      const organizationCol = colDefs.find(col => col.field === 'organization')
      
      expect(organizationCol).toBeDefined()
      expect(organizationCol.hide).toBe(true)
    })

    it('should configure assigned analyst column with correct cell renderer', () => {
      const isSupplier = false
      const colDefs = reportsColDefs(mockT, isSupplier, mockOnRefresh)

      const assignedAnalystCol = colDefs.find(col => col.field === 'assignedAnalyst')
      
      expect(assignedAnalystCol.cellRenderer).toBe('AssignedAnalystCell')
      expect(assignedAnalystCol.cellRendererParams).toEqual({
        onRefresh: mockOnRefresh
      })
    })

    it('should configure assigned analyst value getter correctly', () => {
      const isSupplier = false
      const colDefs = reportsColDefs(mockT, isSupplier, mockOnRefresh)

      const assignedAnalystCol = colDefs.find(col => col.field === 'assignedAnalyst')
      
      // Test value getter with assigned analyst
      const dataWithAnalyst = {
        assignedAnalyst: { initials: 'JD' }
      }
      const resultWithAnalyst = assignedAnalystCol.valueGetter({ data: dataWithAnalyst })
      expect(resultWithAnalyst).toBe('JD')

      // Test value getter without assigned analyst
      const dataWithoutAnalyst = {
        assignedAnalyst: null
      }
      const resultWithoutAnalyst = assignedAnalystCol.valueGetter({ data: dataWithoutAnalyst })
      expect(resultWithoutAnalyst).toBe('')

      // Test value getter with undefined
      const dataUndefined = {}
      const resultUndefined = assignedAnalystCol.valueGetter({ data: dataUndefined })
      expect(resultUndefined).toBe('')
    })

    it('should maintain other column configurations', () => {
      const isSupplier = false
      const colDefs = reportsColDefs(mockT, isSupplier, mockOnRefresh)

      // Check status column
      const statusCol = colDefs.find(col => col.field === 'status')
      expect(statusCol).toBeDefined()
      expect(statusCol.headerName).toBe('report:reportColLabels.status')
      expect(statusCol.width).toBe(220)

      // Check compliance period column
      const periodCol = colDefs.find(col => col.field === 'compliancePeriod')
      expect(periodCol).toBeDefined()
      expect(periodCol.headerName).toBe('report:reportColLabels.compliancePeriod')
      expect(periodCol.width).toBe(210)

      // Check type column
      const typeCol = colDefs.find(col => col.field === 'type')
      expect(typeCol).toBeDefined()
      expect(typeCol.headerName).toBe('report:reportColLabels.type')
      expect(typeCol.flex).toBe(2)

      // Check update date column
      const updateDateCol = colDefs.find(col => col.field === 'updateDate')
      expect(updateDateCol).toBeDefined()
      expect(updateDateCol.headerName).toBe('report:reportColLabels.lastUpdated')
    })

    it('should pass onRefresh function to cell renderer params', () => {
      const customOnRefresh = vi.fn()
      const isSupplier = false
      const colDefs = reportsColDefs(mockT, isSupplier, customOnRefresh)

      const assignedAnalystCol = colDefs.find(col => col.field === 'assignedAnalyst')
      
      expect(assignedAnalystCol.cellRendererParams.onRefresh).toBe(customOnRefresh)
    })
  })

  describe('Column ordering', () => {
    it('should place status column first', () => {
      const isSupplier = false
      const colDefs = reportsColDefs(mockT, isSupplier, mockOnRefresh)

      const fields = colDefs.map(col => col.field)
      const statusIndex = fields.indexOf('status')

      expect(statusIndex).toBe(0)
    })

    it('should place assigned analyst column second', () => {
      const isSupplier = false
      const colDefs = reportsColDefs(mockT, isSupplier, mockOnRefresh)

      const fields = colDefs.map(col => col.field)
      const assignedAnalystIndex = fields.indexOf('assignedAnalyst')

      expect(assignedAnalystIndex).toBe(1)
    })
  })

  describe('Accessibility', () => {
    it('should have proper header names for screen readers', () => {
      const isSupplier = false
      const colDefs = reportsColDefs(mockT, isSupplier, mockOnRefresh)

      const assignedAnalystCol = colDefs.find(col => col.field === 'assignedAnalyst')
      
      expect(assignedAnalystCol.headerName).toBe('report:reportColLabels.assignedAnalyst')
      expect(typeof assignedAnalystCol.headerName).toBe('string')
    })
  })
})