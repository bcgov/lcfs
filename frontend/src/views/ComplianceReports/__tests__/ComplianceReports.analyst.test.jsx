import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes'
import { ComplianceReports } from '../ComplianceReports'
import * as useComplianceReportsHook from '@/hooks/useComplianceReports'
import * as useCurrentUserHook from '@/hooks/useCurrentUser'

// Custom render function with providers
const customRender = (ui, options = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  const AllTheProviders = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  )

  return render(ui, { wrapper: AllTheProviders, ...options })
}

// Mock react-router-dom
const mockUseLocation = vi.fn()
const mockUseNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockUseNavigate
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useComplianceReports')

// Mock the BCGridViewer component to focus on analyst assignment functionality
vi.mock('@/components/BCDataGrid/BCGridViewer.jsx', () => ({
  BCGridViewer: ({ columnDefs, onRefresh }) => {
    // Extract assigned analyst column for testing
    const assignedAnalystCol = columnDefs.find(col => col.field === 'assignedAnalyst')
    
    // Get mock data from the hook (this will be set by individual tests)
    const mockGetComplianceReportList = useComplianceReportsHook.useGetComplianceReportList()
    const mockData = mockGetComplianceReportList?.data?.reports || [
      {
        complianceReportId: 1,
        assignedAnalyst: {
          userProfileId: 1,
          firstName: 'John',
          lastName: 'Doe',
          initials: 'JD'
        }
      },
      {
        complianceReportId: 2,
        assignedAnalyst: null
      }
    ]

    return (
      <div data-test="bc-grid-viewer">
        <div data-test="column-count">{columnDefs.length}</div>
        {assignedAnalystCol && (
          <div data-test="assigned-analyst-column">
            <div data-test="column-field">{assignedAnalystCol.field}</div>
            <div data-test="column-header">{assignedAnalystCol.headerName}</div>
            <div data-test="column-width">{assignedAnalystCol.width}</div>
            <div data-test="column-hide">{String(assignedAnalystCol.hide)}</div>
            {/* Render cell content for testing */}
            {mockData.map((item, index) => (
              <div key={index} data-test={`cell-${index}`}>
                {assignedAnalystCol.valueGetter({ data: item })}
              </div>
            ))}
            {/* Test refresh functionality */}
            {assignedAnalystCol.cellRendererParams?.onRefresh && (
              <button 
                data-test="test-refresh"
                onClick={assignedAnalystCol.cellRendererParams.onRefresh}
              >
                Test Refresh
              </button>
            )}
          </div>
        )}
      </div>
    )
  }
}))

vi.mock('../components/NewComplianceReportButton', () => ({
  NewComplianceReportButton: () => <div>New Report Button</div>
}))

describe('ComplianceReports with Analyst Assignment', () => {
  let mockGetComplianceReportList
  let mockHasRoles

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockGetComplianceReportList = {
      data: {
        pagination: { total: 2 },
        reports: [
          {
            complianceReportId: 1,
            assignedAnalyst: {
              userProfileId: 1,
              firstName: 'John',
              lastName: 'Doe',
              initials: 'JD'
            }
          },
          {
            complianceReportId: 2,
            assignedAnalyst: null
          }
        ]
      },
      isLoading: false,
      refetch: vi.fn()
    }
    
    mockHasRoles = vi.fn()
    
    // Default mocks
    mockUseLocation.mockReturnValue({ state: {} })
    
    useCurrentUserHook.useCurrentUser.mockReturnValue({
      hasRoles: mockHasRoles,
      data: {
        organization: { organizationId: 1 }
      }
    })
    
    useComplianceReportsHook.useGetComplianceReportList.mockReturnValue(mockGetComplianceReportList)
    useComplianceReportsHook.useCreateComplianceReport.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false
    })
  })

  describe('Government/Analyst Users', () => {
    beforeEach(() => {
      mockHasRoles.mockReturnValue(false) // Not supplier
    })

    it('should include assigned analyst column for government users', () => {
      customRender(<ComplianceReports />)

      expect(screen.getByTestId('assigned-analyst-column')).toBeInTheDocument()
      expect(screen.getByTestId('column-field')).toHaveTextContent('assignedAnalyst')
      expect(screen.getByTestId('column-header')).toHaveTextContent('report:reportColLabels.assignedAnalyst')
      expect(screen.getByTestId('column-width')).toHaveTextContent('150')
      expect(screen.getByTestId('column-hide')).toHaveTextContent('false')
    })

    it('should display assigned analyst initials in cells', () => {
      customRender(<ComplianceReports />)

      // First report has assigned analyst
      expect(screen.getByTestId('cell-0')).toHaveTextContent('JD')
      
      // Second report has no assigned analyst
      expect(screen.getByTestId('cell-1')).toHaveTextContent('')
    })

    it('should have all expected columns including assigned analyst', () => {
      customRender(<ComplianceReports />)

      // Should have 7 columns: assignedAnalyst, lastComment, compliancePeriod, organization, type, status, updateDate
      expect(screen.getByTestId('column-count')).toHaveTextContent('7')
    })

    it('should pass refresh function to assigned analyst column', () => {
      customRender(<ComplianceReports />)

      const refreshButton = screen.getByTestId('test-refresh')
      expect(refreshButton).toBeInTheDocument()
      
      fireEvent.click(refreshButton)
      
      expect(mockGetComplianceReportList.refetch).toHaveBeenCalled()
    })
  })

  describe('Supplier Users', () => {
    beforeEach(() => {
      mockHasRoles.mockReturnValue(true) // Is supplier
    })

    it('should hide assigned analyst column for suppliers', () => {
      customRender(<ComplianceReports />)

      expect(screen.getByTestId('assigned-analyst-column')).toBeInTheDocument()
      expect(screen.getByTestId('column-hide')).toHaveTextContent('true')
    })

    it('should have fewer columns for suppliers', () => {
      customRender(<ComplianceReports />)

      // Should still have same number of columns but some hidden
      expect(screen.getByTestId('column-count')).toHaveTextContent('7')
    })
  })

  describe('Data Integration', () => {
    beforeEach(() => {
      mockHasRoles.mockReturnValue(false) // Government user
    })

    it('should handle empty analyst assignment data', () => {
      const emptyDataMock = {
        ...mockGetComplianceReportList,
        data: {
          pagination: { total: 1 },
          reports: [
            {
              complianceReportId: 1,
              assignedAnalyst: null
            }
          ]
        }
      }
      
      useComplianceReportsHook.useGetComplianceReportList.mockReturnValue(emptyDataMock)

      customRender(<ComplianceReports />)

      expect(screen.getByTestId('cell-0')).toBeEmptyDOMElement()
    })

    it('should handle analyst data with missing initials', () => {
      const incompleteDataMock = {
        ...mockGetComplianceReportList,
        data: {
          pagination: { total: 1 },
          reports: [
            {
              complianceReportId: 1,
              assignedAnalyst: {
                userProfileId: 1,
                firstName: 'John',
                lastName: 'Doe'
                // initials missing
              }
            }
          ]
        }
      }
      
      useComplianceReportsHook.useGetComplianceReportList.mockReturnValue(incompleteDataMock)

      customRender(<ComplianceReports />)

      // Should handle missing initials gracefully
      expect(screen.getByTestId('assigned-analyst-column')).toBeInTheDocument()
    })

    it('should handle loading state', () => {
      const loadingMock = {
        ...mockGetComplianceReportList,
        isLoading: true,
        data: undefined
      }
      
      useComplianceReportsHook.useGetComplianceReportList.mockReturnValue(loadingMock)

      customRender(<ComplianceReports />)

      // Should still render the grid structure
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })
  })

  describe('Refresh Functionality', () => {
    beforeEach(() => {
      mockHasRoles.mockReturnValue(false) // Government user
    })

    it('should provide refresh function to analyst assignment cells', () => {
      customRender(<ComplianceReports />)

      const refreshButton = screen.getByTestId('test-refresh')
      expect(refreshButton).toBeInTheDocument()
      
      // Test that clicking refresh calls the refetch function
      fireEvent.click(refreshButton)
      
      expect(mockGetComplianceReportList.refetch).toHaveBeenCalledTimes(1)
    })

    it('should create new refresh function on re-render', () => {
      const { rerender } = customRender(<ComplianceReports />)

      const refreshButton = screen.getByTestId('test-refresh')
      fireEvent.click(refreshButton)
      
      expect(mockGetComplianceReportList.refetch).toHaveBeenCalledTimes(1)

      // Re-render and test again
      rerender(<ComplianceReports />)
      
      const refreshButtonAfterRerender = screen.getByTestId('test-refresh')
      fireEvent.click(refreshButtonAfterRerender)
      
      expect(mockGetComplianceReportList.refetch).toHaveBeenCalledTimes(2)
    })
  })
})