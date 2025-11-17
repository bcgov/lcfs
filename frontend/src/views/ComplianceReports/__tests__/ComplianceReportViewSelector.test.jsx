import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ComplianceReportViewSelector } from '../ComplianceReportViewSelector.jsx'
import * as useComplianceReportsHook from '@/hooks/useComplianceReports'
import * as useCurrentUserHook from '@/hooks/useCurrentUser'
import { wrapper } from '@/tests/utils/wrapper'

// Create mock functions at the top level
const mockUseParams = vi.fn()
const mockUseLocation = vi.fn()
const mockUseQueryClient = vi.fn()
const mockUseGetComplianceReport = vi.fn()
const mockUseCurrentUser = vi.fn()

// Mock all external dependencies
vi.mock('react-router-dom', () => ({
  useParams: () => mockUseParams(),
  useLocation: () => mockUseLocation()
}))

// Config mocking removed - no longer using feature flags for legacy views

vi.mock('@/components/Loading', () => ({
  default: () => <div>Loading...</div>
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockUseQueryClient()
}))

vi.mock('@/hooks/useComplianceReports.js', () => ({
  useGetComplianceReport: (...args) => mockUseGetComplianceReport(...args)
}))

vi.mock('@/hooks/useCurrentUser.js', () => ({
  useCurrentUser: () => mockUseCurrentUser()
}))

vi.mock('@/components/Loading.jsx', () => ({
  default: () => <div data-test="loading">Loading...</div>
}))

// Legacy view mock removed - all reports now use EditViewComplianceReport

vi.mock('@/views/ComplianceReports/EditViewComplianceReport.jsx', () => ({
  EditViewComplianceReport: ({ reportData, error, isError }) => (
    <div data-test="edit-report">
      EditViewComplianceReport - {JSON.stringify({ reportData, error, isError })}
    </div>
  )
}))

describe('ComplianceReportViewSelector', () => {
  const mockQueryClient = {
    invalidateQueries: vi.fn()
  }
  const mockRefetch = vi.fn()

  const defaultCurrentUser = {
    data: {
      organization: {
        organizationId: 'org-123'
      }
    },
    isLoading: false
  }

  const defaultReportData = {
    data: {
      report: {
        id: 'report-123',
        currentStatus: {
          status: 'Draft'
        },
        compliancePeriod: {
          description: '2024'
        }
      }
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefetch
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Default to feature flag disabled
    isFeatureEnabled.mockReturnValue(false)
    
    // Default mock implementations
    mockUseParams.mockReturnValue({ complianceReportId: 'test-report-id' })
    mockUseLocation.mockReturnValue({ state: null })
    mockUseQueryClient.mockReturnValue(mockQueryClient)
    mockUseCurrentUser.mockReturnValue(defaultCurrentUser)
    mockUseGetComplianceReport.mockReturnValue(defaultReportData)
  })

  const setupMocks = ({
    currentUser = defaultCurrentUser,
    reportData = defaultReportData,
    complianceReportId = 'test-report-id',
    locationState = null,
    isError = false,
    error = null
  } = {}) => {
    mockUseCurrentUser.mockReturnValue(currentUser)
    mockUseGetComplianceReport.mockReturnValue({
      ...reportData,
      isError,
      error
    })
    mockUseParams.mockReturnValue({ complianceReportId })
    mockUseLocation.mockReturnValue({ state: locationState })
  }

  describe('Component rendering', () => {
    it('renders the component function correctly', () => {
      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(screen.getByTestId('edit-report')).toBeInTheDocument()
    })
  })

  describe('Hook integrations', () => {
    it('calls useParams and extracts complianceReportId', () => {
      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(mockUseParams).toHaveBeenCalled()
    })

    it('calls useCurrentUser hook', () => {
      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(mockUseCurrentUser).toHaveBeenCalled()
    })

    it('calls useLocation hook', () => {
      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(mockUseLocation).toHaveBeenCalled()
    })

    it('calls useQueryClient hook', () => {
      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(mockUseQueryClient).toHaveBeenCalled()
    })

    it('calls useGetComplianceReport with correct parameters', () => {
      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(mockUseGetComplianceReport).toHaveBeenCalledWith(
        'org-123',
        'test-report-id',
        { enabled: true }
      )
    })

    it('calls useGetComplianceReport with enabled false when currentUser is loading', () => {
      mockUseCurrentUser.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(mockUseGetComplianceReport).toHaveBeenCalledWith(
        undefined,
        'test-report-id',
        { enabled: false }
      )
    })
  })

  describe('Loading states', () => {
    it('renders Loading component when isReportLoading is true', () => {
      mockUseGetComplianceReport.mockReturnValue({
        ...defaultReportData,
        isLoading: true
      })

      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(screen.getByTestId('loading')).toBeInTheDocument()
      expect(screen.queryByTestId('edit-report')).not.toBeInTheDocument()
      expect(screen.queryByTestId('legacy-report')).not.toBeInTheDocument()
    })

    it('renders Loading component when isCurrentUserLoading is true', () => {
      mockUseCurrentUser.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(screen.getByTestId('loading')).toBeInTheDocument()
      expect(screen.queryByTestId('edit-report')).not.toBeInTheDocument()
      expect(screen.queryByTestId('legacy-report')).not.toBeInTheDocument()
    })

    it('renders main content when both loading states are false', () => {
      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
      expect(screen.getByTestId('edit-report')).toBeInTheDocument()
    })
  })

  describe('Report type rendering', () => {
    it('renders EditViewComplianceReport for all reports including historical TFRS-migrated reports', () => {
      // TFRS data is migrated into existing LCFS tables, so all reports use the same view
      const historicalReport = {
        ...defaultReportData,
        data: {
          report: {
            ...defaultReportData.data.report,
            compliancePeriod: { description: '2015' } // Historical TFRS report
          }
        }
      }
      mockUseGetComplianceReport.mockReturnValue(historicalReport)

      render(<ComplianceReportViewSelector />, { wrapper })

      expect(screen.getByTestId('edit-report')).toBeInTheDocument()
    })

    it('renders EditViewComplianceReport for 2024+ reports', () => {
      const report2024Plus = {
        ...defaultReportData,
        data: {
          report: {
            ...defaultReportData.data.report,
            compliancePeriod: { description: '2024' }
          }
        }
      }
      mockUseGetComplianceReport.mockReturnValue(report2024Plus)

      render(<ComplianceReportViewSelector />, { wrapper })

      expect(screen.getByTestId('edit-report')).toBeInTheDocument()
    })
  })

  describe('Props passing', () => {
    it('passes error and isError props to the rendered component', async () => {
      const testError = { message: 'Test error' }
      setupMocks({
        isError: true,
        error: testError,
        reportData: {
          data: {
            report: {
              compliancePeriod: { description: '2024' },
              currentStatus: { status: 'DRAFT' }
            }
          }
        }
      })

      render(<ComplianceReportViewSelector />, { wrapper })
      
      const editReportElement = screen.getByTestId('edit-report')
      expect(editReportElement.textContent).toContain('"error":{"message":"Test error"}')
      expect(editReportElement.textContent).toContain('"isError":true')
    })

    it('passes correct props to EditViewComplianceReport', () => {
      const reportData = {
        data: {
          report: {
            id: 'report-123',
            currentStatus: { status: 'Draft' }
          }
        },
        isLoading: false,
        isError: true,
        error: 'Test error',
        refetch: mockRefetch
      }
      mockUseGetComplianceReport.mockReturnValue(reportData)

      render(<ComplianceReportViewSelector />, { wrapper })
      
      const editReportElement = screen.getByTestId('edit-report')
      expect(editReportElement.textContent).toContain('"error":"Test error"')
      expect(editReportElement.textContent).toContain('"isError":true')
    })
  })

  describe('useEffect cache invalidation logic', () => {
    it('does NOT call invalidateQueries when reportData is null', () => {
      mockUseGetComplianceReport.mockReturnValue({
        ...defaultReportData,
        data: null
      })
      mockUseLocation.mockReturnValue({
        state: { reportStatus: 'Submitted' }
      })

      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled()
      expect(mockRefetch).not.toHaveBeenCalled()
    })

    it('does NOT call invalidateQueries when location.state.reportStatus is null', () => {
      mockUseLocation.mockReturnValue({
        state: null
      })

      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled()
      expect(mockRefetch).not.toHaveBeenCalled()
    })

    it('does NOT call invalidateQueries when reportStatus matches current status', () => {
      mockUseLocation.mockReturnValue({
        state: { reportStatus: 'Draft' }
      })

      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled()
      expect(mockRefetch).not.toHaveBeenCalled()
    })

    it('calls invalidateQueries and refetch when all conditions are true', () => {
      mockUseLocation.mockReturnValue({
        state: { reportStatus: 'Submitted' }
      })

      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith([
        'compliance-report',
        'test-report-id'
      ])
      expect(mockRefetch).toHaveBeenCalled()
    })

    it('handles undefined location.state gracefully', () => {
      mockUseLocation.mockReturnValue({
        state: undefined
      })

      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled()
      expect(mockRefetch).not.toHaveBeenCalled()
    })

    it('handles missing reportStatus in location.state', () => {
      mockUseLocation.mockReturnValue({
        state: { otherProperty: 'value' }
      })

      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled()
      expect(mockRefetch).not.toHaveBeenCalled()
    })
  })

  describe('Edge cases', () => {
    it('handles undefined reportData gracefully', () => {
      mockUseGetComplianceReport.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch
      })

      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(screen.getByTestId('edit-report')).toBeInTheDocument()
    })

    it('handles undefined currentUser organization gracefully', () => {
      mockUseCurrentUser.mockReturnValue({
        data: {
          organization: null
        },
        isLoading: false
      })

      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(mockUseGetComplianceReport).toHaveBeenCalledWith(
        undefined,
        'test-report-id',
        { enabled: true }
      )
    })

    it('handles completely undefined currentUser', () => {
      mockUseCurrentUser.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(mockUseGetComplianceReport).toHaveBeenCalledWith(
        undefined,
        'test-report-id',
        { enabled: true }
      )
    })

    it('handles missing report in reportData', () => {
      mockUseGetComplianceReport.mockReturnValue({
        data: {
          report: null
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch
      })

      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(screen.getByTestId('edit-report')).toBeInTheDocument()
    })

  })

  describe('Cache invalidation tests', () => {
    it('does not invalidate cache when location state is null', async () => {
      setupMocks({
        reportData: {
          data: {
            report: {
              compliancePeriod: { description: '2024' },
              currentStatus: { status: 'DRAFT' }
            }
          }
        },
        locationState: null // No location state
      })

      render(<ComplianceReportViewSelector />, { wrapper })

      await waitFor(() => {
        expect(screen.getByTestId('edit-report')).toBeInTheDocument()
      })

      // Should not invalidate cache since there's no location state
      expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled()
      expect(mockRefetch).not.toHaveBeenCalled()
    })
  })

  describe('Hook integration tests', () => {
    it('calls useGetComplianceReport with correct parameters', async () => {
      const currentUser = { data: { organization: { organizationId: '456' } }, isLoading: false }
      const complianceReportId = '789'

      setupMocks({
        currentUser,
        complianceReportId
      })

      render(<ComplianceReportViewSelector />, { wrapper })

      expect(mockUseGetComplianceReport).toHaveBeenCalledWith(
        '456', // organizationId
        '789', // complianceReportId
        {
          enabled: true // !isCurrentUserLoading
        }
      )
    })
  })
})
