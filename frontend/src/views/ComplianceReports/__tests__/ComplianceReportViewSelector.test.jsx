import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComplianceReportViewSelector } from '../ComplianceReportViewSelector'
import { wrapper } from '@/tests/utils/wrapper.jsx'

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

vi.mock('@/views/ComplianceReports/ViewLegacyComplianceReport.jsx', () => ({
  ViewLegacyComplianceReport: ({ reportData, error, isError }) => (
    <div data-test="legacy-report">
      ViewLegacyComplianceReport - {JSON.stringify({ reportData, error, isError })}
    </div>
  )
}))

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
    
    // Default mock implementations
    mockUseParams.mockReturnValue({ complianceReportId: 'test-report-id' })
    mockUseLocation.mockReturnValue({ state: null })
    mockUseQueryClient.mockReturnValue(mockQueryClient)
    mockUseCurrentUser.mockReturnValue(defaultCurrentUser)
    mockUseGetComplianceReport.mockReturnValue(defaultReportData)
  })

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
    it('renders ViewLegacyComplianceReport when legacyId exists', () => {
      const reportWithLegacyId = {
        ...defaultReportData,
        data: {
          report: {
            ...defaultReportData.data.report,
            legacyId: 'legacy-123'
          }
        }
      }
      mockUseGetComplianceReport.mockReturnValue(reportWithLegacyId)

      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(screen.getByTestId('legacy-report')).toBeInTheDocument()
      expect(screen.queryByTestId('edit-report')).not.toBeInTheDocument()
    })

    it('renders EditViewComplianceReport when legacyId does not exist', () => {
      const reportWithoutLegacyId = {
        ...defaultReportData,
        data: {
          report: {
            ...defaultReportData.data.report,
            legacyId: null
          }
        }
      }
      mockUseGetComplianceReport.mockReturnValue(reportWithoutLegacyId)

      render(<ComplianceReportViewSelector />, { wrapper })
      
      expect(screen.getByTestId('edit-report')).toBeInTheDocument()
      expect(screen.queryByTestId('legacy-report')).not.toBeInTheDocument()
    })

    it('passes correct props to ViewLegacyComplianceReport', () => {
      const reportWithLegacyId = {
        data: {
          report: {
            id: 'report-123',
            legacyId: 'legacy-123',
            currentStatus: { status: 'Draft' }
          }
        },
        isLoading: false,
        isError: true,
        error: 'Test error',
        refetch: mockRefetch
      }
      mockUseGetComplianceReport.mockReturnValue(reportWithLegacyId)

      render(<ComplianceReportViewSelector />, { wrapper })
      
      const legacyReportElement = screen.getByTestId('legacy-report')
      expect(legacyReportElement.textContent).toContain('"error":"Test error"')
      expect(legacyReportElement.textContent).toContain('"isError":true')
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
})