import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { reportsColDefs } from '../_schema'
import { BrowserRouter } from 'react-router-dom'

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

vi.mock('@mui/material', () => ({
  Tooltip: ({ children, title }) => (
    <div data-testid="tooltip" title={title}>
      {children}
    </div>
  )
}))

vi.mock('@mui/icons-material/Warning', () => ({
  default: () => <div data-testid="warning-icon">⚠️</div>
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
      expect(assignedAnalystCol.minWidth).toBe(180)
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
      expect(statusCol.minWidth).toBe(220)

      // Check compliance period column
      const periodCol = colDefs.find(col => col.field === 'compliancePeriod')
      expect(periodCol).toBeDefined()
      expect(periodCol.headerName).toBe('report:reportColLabels.compliancePeriod')
      expect(periodCol.minWidth).toBe(190)

      // Check type column
      const typeCol = colDefs.find(col => col.field === 'type')
      expect(typeCol).toBeDefined()
      expect(typeCol.headerName).toBe('report:reportColLabels.type')

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

  describe('TypeCellRenderer - 30-day supplemental flag', () => {
    // Mock useLocation
    vi.mock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom')
      return {
        ...actual,
        useLocation: () => ({ pathname: '/compliance-reports' })
      }
    })

    // Helper to render cell renderer
    const renderTypeCell = (data, isSupplier = false) => {
      const colDefs = reportsColDefs(mockT, isSupplier, mockOnRefresh)
      const typeCol = colDefs.find(col => col.field === 'type')
      const TypeRenderer = typeCol.cellRenderer
      
      return render(
        <BrowserRouter>
          <TypeRenderer data={data} />
        </BrowserRouter>
      )
    }

    it('should display warning icon for submitted supplemental older than 30 days (IDIR user)', () => {
      const thirtyOneDaysAgo = new Date()
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31)
      
      const data = {
        reportType: 'Supplemental report 1',
        compliancePeriod: '2024',
        complianceReportId: 2,
        latestSupplementalCreateDate: thirtyOneDaysAgo.toISOString(),
        latestStatus: 'Submitted',
        isLatest: true
      }

      const { container } = renderTypeCell(data, false) // IDIR user
      
      const warningIcon = container.querySelector('[data-testid="warning-icon"]')
      expect(warningIcon).toBeInTheDocument()
      expect(screen.getByText('Supplemental report 1')).toBeInTheDocument()
    })

    it('should NOT display warning icon for submitted supplemental exactly 30 days old', () => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const data = {
        reportType: 'Supplemental report 1',
        compliancePeriod: '2024',
        complianceReportId: 2,
        latestSupplementalCreateDate: thirtyDaysAgo.toISOString(),
        latestStatus: 'Submitted',
        isLatest: true
      }

      const { container } = renderTypeCell(data, false) // IDIR user
      
      const warningIcon = container.querySelector('[data-testid="warning-icon"]')
      expect(warningIcon).not.toBeInTheDocument()
      expect(screen.getByText('Supplemental report 1')).toBeInTheDocument()
    })

    it('should NOT display warning icon for submitted supplemental less than 30 days old', () => {
      const twentyDaysAgo = new Date()
      twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20)
      
      const data = {
        reportType: 'Supplemental report 1',
        compliancePeriod: '2024',
        complianceReportId: 2,
        latestSupplementalCreateDate: twentyDaysAgo.toISOString(),
        latestStatus: 'Submitted',
        isLatest: true
      }

      const { container } = renderTypeCell(data, false) // IDIR user
      
      const warningIcon = container.querySelector('[data-testid="warning-icon"]')
      expect(warningIcon).not.toBeInTheDocument()
      expect(screen.getByText('Supplemental report 1')).toBeInTheDocument()
    })

    it('should NOT display warning icon for assessed supplemental older than 30 days', () => {
      const fortyDaysAgo = new Date()
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40)
      
      const data = {
        reportType: 'Supplemental report 1',
        compliancePeriod: '2024',
        complianceReportId: 2,
        latestSupplementalCreateDate: fortyDaysAgo.toISOString(),
        latestStatus: 'Assessed',
        isLatest: true
      }

      const { container } = renderTypeCell(data, false) // IDIR user
      
      const warningIcon = container.querySelector('[data-testid="warning-icon"]')
      expect(warningIcon).not.toBeInTheDocument()
      expect(screen.getByText('Supplemental report 1')).toBeInTheDocument()
    })

    it('should NOT display warning icon when latestSupplementalCreateDate is missing', () => {
      const data = {
        reportType: 'Original report',
        compliancePeriod: '2024',
        complianceReportId: 1,
        latestSupplementalCreateDate: null,
        latestStatus: 'Submitted',
        isLatest: true
      }

      const { container } = renderTypeCell(data, false) // IDIR user
      
      const warningIcon = container.querySelector('[data-testid="warning-icon"]')
      expect(warningIcon).not.toBeInTheDocument()
      expect(screen.getByText('Original report')).toBeInTheDocument()
    })

    it('should NOT display warning icon for supplier users regardless of status', () => {
      const fortyDaysAgo = new Date()
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40)
      
      const data = {
        reportType: 'Supplemental report 1',
        compliancePeriod: '2024',
        complianceReportId: 2,
        latestSupplementalCreateDate: fortyDaysAgo.toISOString(),
        latestStatus: 'Submitted',
        isLatest: true
      }

      const { container } = renderTypeCell(data, true) // Supplier user
      
      const warningIcon = container.querySelector('[data-testid="warning-icon"]')
      expect(warningIcon).not.toBeInTheDocument()
      expect(screen.getByText('Supplemental report 1')).toBeInTheDocument()
    })

    it('should display tooltip with correct message', () => {
      const fortyDaysAgo = new Date()
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40)
      
      const data = {
        reportType: 'Supplemental report 1',
        compliancePeriod: '2024',
        complianceReportId: 2,
        latestSupplementalCreateDate: fortyDaysAgo.toISOString(),
        latestStatus: 'Submitted',
        isLatest: true
      }

      const { container } = renderTypeCell(data, false) // IDIR user
      
      const tooltip = container.querySelector('[data-testid="tooltip"]')
      expect(tooltip).toHaveAttribute('title', 'Supplemental draft over 30 days old')
    })

    it('should NOT show flag on original report even when there is an old supplemental in the group', () => {
      const fortyDaysAgo = new Date()
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40)
      
      // This is an original report in a group that has an old supplemental
      const data = {
        reportType: 'Original Report',
        compliancePeriod: '2024',
        complianceReportId: 1,
        isLatest: false,
        latestSupplementalCreateDate: fortyDaysAgo.toISOString(),
        latestStatus: 'Submitted'
      }

      const { container } = renderTypeCell(data, false) // IDIR user
      
      const warningIcon = container.querySelector('[data-testid="warning-icon"]')
      expect(warningIcon).not.toBeInTheDocument()
      expect(screen.getByText('Original Report')).toBeInTheDocument()
    })

    it('should render report type with link', () => {
      const data = {
        reportType: 'Original report',
        compliancePeriod: '2024',
        complianceReportId: 1,
        latestSupplementalCreateDate: null,
        latestStatus: 'Draft',
        isLatest: true
      }

      const { container } = renderTypeCell(data, false)
      
      const link = container.querySelector('a')
      expect(link).toBeInTheDocument()
      // The href will be relative, constructed from location.pathname
      expect(link.getAttribute('href')).toContain('2024/1')
    })

    it('should NOT display flag when reportType is empty (cannot determine if supplemental)', () => {
      const fortyDaysAgo = new Date()
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40)
      
      const data = {
        reportType: '',
        compliancePeriod: '2024',
        complianceReportId: 2,
        latestSupplementalCreateDate: fortyDaysAgo.toISOString(),
        latestStatus: 'Submitted',
        isLatest: true
      }

      const { container } = renderTypeCell(data, false) // IDIR user
      
      const warningIcon = container.querySelector('[data-testid="warning-icon"]')
      expect(warningIcon).not.toBeInTheDocument()
    })
  })
})