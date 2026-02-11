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
      const fields = colDefs.map((col) => col.field)
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

      const assignedAnalystCol = colDefs.find(
        (col) => col.field === 'assignedAnalyst'
      )

      expect(assignedAnalystCol).toBeDefined()
      expect(assignedAnalystCol.hide).toBe(false)
      expect(assignedAnalystCol.headerName).toBe(
        'report:reportColLabels.assignedAnalyst'
      )
      expect(assignedAnalystCol.minWidth).toBe(180)
    })

    it('should hide assigned analyst column for suppliers', () => {
      const isSupplier = true
      const colDefs = reportsColDefs(mockT, isSupplier, mockOnRefresh)

      const assignedAnalystCol = colDefs.find(
        (col) => col.field === 'assignedAnalyst'
      )

      expect(assignedAnalystCol).toBeDefined()
      expect(assignedAnalystCol.hide).toBe(true)
    })

    it('should hide organization column for suppliers', () => {
      const isSupplier = true
      const colDefs = reportsColDefs(mockT, isSupplier, mockOnRefresh)

      const organizationCol = colDefs.find(
        (col) => col.field === 'organization'
      )

      expect(organizationCol).toBeDefined()
      expect(organizationCol.hide).toBe(true)
    })

    it('should configure assigned analyst column with correct cell renderer', () => {
      const isSupplier = false
      const colDefs = reportsColDefs(mockT, isSupplier, mockOnRefresh)

      const assignedAnalystCol = colDefs.find(
        (col) => col.field === 'assignedAnalyst'
      )

      expect(assignedAnalystCol.cellRenderer).toBe('AssignedAnalystCell')
      expect(assignedAnalystCol.cellRendererParams).toEqual({
        onRefresh: mockOnRefresh
      })
    })

    it('should configure assigned analyst value getter correctly', () => {
      const isSupplier = false
      const colDefs = reportsColDefs(mockT, isSupplier, mockOnRefresh)

      const assignedAnalystCol = colDefs.find(
        (col) => col.field === 'assignedAnalyst'
      )

      // Test value getter with assigned analyst
      const dataWithAnalyst = {
        assignedAnalyst: { initials: 'JD' }
      }
      const resultWithAnalyst = assignedAnalystCol.valueGetter({
        data: dataWithAnalyst
      })
      expect(resultWithAnalyst).toBe('JD')

      // Test value getter without assigned analyst
      const dataWithoutAnalyst = {
        assignedAnalyst: null
      }
      const resultWithoutAnalyst = assignedAnalystCol.valueGetter({
        data: dataWithoutAnalyst
      })
      expect(resultWithoutAnalyst).toBe('')

      // Test value getter with undefined
      const dataUndefined = {}
      const resultUndefined = assignedAnalystCol.valueGetter({
        data: dataUndefined
      })
      expect(resultUndefined).toBe('')
    })

    it('should maintain other column configurations', () => {
      const isSupplier = false
      const colDefs = reportsColDefs(mockT, isSupplier, mockOnRefresh)

      // Check status column
      const statusCol = colDefs.find((col) => col.field === 'status')
      expect(statusCol).toBeDefined()
      expect(statusCol.headerName).toBe('report:reportColLabels.status')
      expect(statusCol.minWidth).toBe(220)

      // Check compliance period column
      const periodCol = colDefs.find((col) => col.field === 'compliancePeriod')
      expect(periodCol).toBeDefined()
      expect(periodCol.headerName).toBe(
        'report:reportColLabels.compliancePeriod'
      )
      expect(periodCol.minWidth).toBe(190)

      // Check type column
      const typeCol = colDefs.find((col) => col.field === 'type')
      expect(typeCol).toBeDefined()
      expect(typeCol.headerName).toBe('report:reportColLabels.type')

      // Check update date column
      const updateDateCol = colDefs.find((col) => col.field === 'updateDate')
      expect(updateDateCol).toBeDefined()
      expect(updateDateCol.headerName).toBe(
        'report:reportColLabels.lastUpdated'
      )
    })

    it('should pass onRefresh function to cell renderer params', () => {
      const customOnRefresh = vi.fn()
      const isSupplier = false
      const colDefs = reportsColDefs(mockT, isSupplier, customOnRefresh)

      const assignedAnalystCol = colDefs.find(
        (col) => col.field === 'assignedAnalyst'
      )

      expect(assignedAnalystCol.cellRendererParams.onRefresh).toBe(
        customOnRefresh
      )
    })
  })

  describe('Column ordering', () => {
    it('should place status column first', () => {
      const isSupplier = false
      const colDefs = reportsColDefs(mockT, isSupplier, mockOnRefresh)

      const fields = colDefs.map((col) => col.field)
      const statusIndex = fields.indexOf('status')

      expect(statusIndex).toBe(0)
    })

    it('should place assigned analyst column second', () => {
      const isSupplier = false
      const colDefs = reportsColDefs(mockT, isSupplier, mockOnRefresh)

      const fields = colDefs.map((col) => col.field)
      const assignedAnalystIndex = fields.indexOf('assignedAnalyst')

      expect(assignedAnalystIndex).toBe(1)
    })
  })

  describe('Accessibility', () => {
    it('should have proper header names for screen readers', () => {
      const isSupplier = false
      const colDefs = reportsColDefs(mockT, isSupplier, mockOnRefresh)

      const assignedAnalystCol = colDefs.find(
        (col) => col.field === 'assignedAnalyst'
      )

      expect(assignedAnalystCol.headerName).toBe(
        'report:reportColLabels.assignedAnalyst'
      )
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
      const typeCol = colDefs.find((col) => col.field === 'type')
      const TypeRenderer = typeCol.cellRenderer

      return render(
        <BrowserRouter>
          <TypeRenderer data={data} />
        </BrowserRouter>
      )
    }

    // Matches screenshot: LCFS Org 2 (2025) - Original Report with flag
    // Supplier has draft supplemental > 30 days, IDIR sees Original Report with flag
    it('should show flag on Original Report when a draft supplemental is > 30 days old (IDIR)', () => {
      const thirtyOneDaysAgo = new Date()
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31)

      const data = {
        reportType: 'Original Report',
        compliancePeriod: '2025',
        complianceReportId: 1,
        latestSupplementalCreateDate: thirtyOneDaysAgo.toISOString(),
        latestStatus: 'Draft',
        isLatest: false
      }

      const { container } = renderTypeCell(data, false)

      const warningIcon = container.querySelector(
        '[data-testid="warning-icon"]'
      )
      expect(warningIcon).toBeInTheDocument()
      expect(screen.getByText('Original Report')).toBeInTheDocument()
    })

    // Matches screenshot: LCFS Org 4 (2025) - Early Issuance Report with flag
    it('should show flag on Early Issuance Report when a draft supplemental is > 30 days old', () => {
      const fortyDaysAgo = new Date()
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40)

      const data = {
        reportType: 'Early Issuance Report',
        compliancePeriod: '2025',
        complianceReportId: 3,
        latestSupplementalCreateDate: fortyDaysAgo.toISOString(),
        latestStatus: 'Draft',
        isLatest: false
      }

      const { container } = renderTypeCell(data, false)

      const warningIcon = container.querySelector(
        '[data-testid="warning-icon"]'
      )
      expect(warningIcon).toBeInTheDocument()
      expect(screen.getByText('Early Issuance Report')).toBeInTheDocument()
    })

    // Matches screenshot: LCFS Org 1 (2024) - Supplemental report 1 with flag
    it('should show flag on assessed Supplemental when a newer draft supplemental is > 30 days old', () => {
      const fortyDaysAgo = new Date()
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40)

      const data = {
        reportType: 'Supplemental report 1',
        compliancePeriod: '2024',
        complianceReportId: 2,
        latestSupplementalCreateDate: fortyDaysAgo.toISOString(),
        latestStatus: 'Draft',
        isLatest: false
      }

      const { container } = renderTypeCell(data, false)

      const warningIcon = container.querySelector(
        '[data-testid="warning-icon"]'
      )
      expect(warningIcon).toBeInTheDocument()
      expect(screen.getByText('Supplemental report 1')).toBeInTheDocument()
    })

    // Flag disappears once the draft is submitted
    it('should NOT show flag after draft supplemental is submitted', () => {
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

      const { container } = renderTypeCell(data, false)

      const warningIcon = container.querySelector(
        '[data-testid="warning-icon"]'
      )
      expect(warningIcon).not.toBeInTheDocument()
    })

    // Matches screenshot: LCFS Org 2 (2024) - no flag when no hidden draft
    it('should NOT show flag when there is no hidden draft (isLatest=true)', () => {
      const fortyDaysAgo = new Date()
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40)

      const data = {
        reportType: 'Original Report',
        compliancePeriod: '2024',
        complianceReportId: 1,
        latestSupplementalCreateDate: fortyDaysAgo.toISOString(),
        latestStatus: 'Assessed',
        isLatest: true
      }

      const { container } = renderTypeCell(data, false)

      const warningIcon = container.querySelector(
        '[data-testid="warning-icon"]'
      )
      expect(warningIcon).not.toBeInTheDocument()
      expect(screen.getByText('Original Report')).toBeInTheDocument()
    })

    it('should NOT show flag when draft supplemental is exactly 30 days old', () => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const data = {
        reportType: 'Original Report',
        compliancePeriod: '2025',
        complianceReportId: 1,
        latestSupplementalCreateDate: thirtyDaysAgo.toISOString(),
        latestStatus: 'Draft',
        isLatest: false
      }

      const { container } = renderTypeCell(data, false)

      const warningIcon = container.querySelector(
        '[data-testid="warning-icon"]'
      )
      expect(warningIcon).not.toBeInTheDocument()
    })

    it('should NOT show flag when draft supplemental is less than 30 days old', () => {
      const twentyDaysAgo = new Date()
      twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20)

      const data = {
        reportType: 'Original Report',
        compliancePeriod: '2025',
        complianceReportId: 1,
        latestSupplementalCreateDate: twentyDaysAgo.toISOString(),
        latestStatus: 'Draft',
        isLatest: false
      }

      const { container } = renderTypeCell(data, false)

      const warningIcon = container.querySelector(
        '[data-testid="warning-icon"]'
      )
      expect(warningIcon).not.toBeInTheDocument()
    })

    it('should NOT show flag when latestSupplementalCreateDate is missing', () => {
      const data = {
        reportType: 'Original Report',
        compliancePeriod: '2025',
        complianceReportId: 1,
        latestSupplementalCreateDate: null,
        latestStatus: 'Draft',
        isLatest: false
      }

      const { container } = renderTypeCell(data, false)

      const warningIcon = container.querySelector(
        '[data-testid="warning-icon"]'
      )
      expect(warningIcon).not.toBeInTheDocument()
    })

    // Supplier users never see the flag
    it('should NOT show flag for supplier/BCeID users', () => {
      const fortyDaysAgo = new Date()
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40)

      const data = {
        reportType: 'Original Report',
        compliancePeriod: '2025',
        complianceReportId: 1,
        latestSupplementalCreateDate: fortyDaysAgo.toISOString(),
        latestStatus: 'Draft',
        isLatest: false
      }

      const { container } = renderTypeCell(data, true) // Supplier user

      const warningIcon = container.querySelector(
        '[data-testid="warning-icon"]'
      )
      expect(warningIcon).not.toBeInTheDocument()
    })

    it('should display tooltip with correct message', () => {
      const fortyDaysAgo = new Date()
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40)

      const data = {
        reportType: 'Original Report',
        compliancePeriod: '2025',
        complianceReportId: 1,
        latestSupplementalCreateDate: fortyDaysAgo.toISOString(),
        latestStatus: 'Draft',
        isLatest: false
      }

      const { container } = renderTypeCell(data, false)

      const tooltip = container.querySelector('[data-testid="tooltip"]')
      expect(tooltip).toHaveAttribute(
        'title',
        'Supplemental draft over 30 days old'
      )
    })

    it('should render report type with link', () => {
      const data = {
        reportType: 'Original report',
        compliancePeriod: '2024',
        complianceReportId: 1,
        latestSupplementalCreateDate: null,
        latestStatus: 'Assessed',
        isLatest: true
      }

      const { container } = renderTypeCell(data, false)

      const link = container.querySelector('a')
      expect(link).toBeInTheDocument()
      expect(link.getAttribute('href')).toContain('2024/1')
    })
  })
})
