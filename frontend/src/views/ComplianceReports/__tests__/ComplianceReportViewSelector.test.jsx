import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, beforeEach, vi } from 'vitest'
import { ComplianceReportViewSelector } from '../ComplianceReportViewSelector.jsx'
import * as useComplianceReportsHook from '@/hooks/useComplianceReports'
import * as useCurrentUserHook from '@/hooks/useCurrentUser'
import { test } from '@/tests/utils/fixtures'

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
      EditViewComplianceReport -{' '}
      {JSON.stringify({ reportData, error, isError })}
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
    test('renders the component function correctly', ({
      render,
      theme,
      localization,
      router
    }) => {
      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(screen.getByTestId('edit-report')).toBeInTheDocument()
    })
  })

  describe('Hook integrations', () => {
    test('calls useParams and extracts complianceReportId', ({
      render,
      theme,
      localization,
      router
    }) => {
      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(mockUseParams).toHaveBeenCalled()
    })

    test('calls useCurrentUser hook', ({
      render,
      theme,
      localization,
      router
    }) => {
      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(mockUseCurrentUser).toHaveBeenCalled()
    })

    test('calls useLocation hook', ({
      render,
      theme,
      localization,
      router
    }) => {
      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(mockUseLocation).toHaveBeenCalled()
    })

    test('calls useQueryClient hook', ({
      render,
      theme,
      localization,
      router
    }) => {
      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(mockUseQueryClient).toHaveBeenCalled()
    })

    test('calls useGetComplianceReport with correct parameters', ({
      render,
      theme,
      localization,
      router
    }) => {
      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(mockUseGetComplianceReport).toHaveBeenCalledWith(
        'org-123',
        'test-report-id',
        { enabled: true }
      )
    })

    test('calls useGetComplianceReport with enabled false when currentUser is loading', ({
      render,
      theme,
      localization,
      router
    }) => {
      mockUseCurrentUser.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(mockUseGetComplianceReport).toHaveBeenCalledWith(
        undefined,
        'test-report-id',
        { enabled: false }
      )
    })
  })

  describe('Loading states', () => {
    test('renders Loading component when isReportLoading is true', ({
      render,
      theme,
      localization,
      router
    }) => {
      mockUseGetComplianceReport.mockReturnValue({
        ...defaultReportData,
        isLoading: true
      })

      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(screen.getByTestId('loading')).toBeInTheDocument()
      expect(screen.queryByTestId('edit-report')).not.toBeInTheDocument()
      expect(screen.queryByTestId('legacy-report')).not.toBeInTheDocument()
    })

    test('renders Loading component when isCurrentUserLoading is true', ({
      render,
      theme,
      localization,
      router
    }) => {
      mockUseCurrentUser.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(screen.getByTestId('loading')).toBeInTheDocument()
      expect(screen.queryByTestId('edit-report')).not.toBeInTheDocument()
      expect(screen.queryByTestId('legacy-report')).not.toBeInTheDocument()
    })

    test('renders main content when both loading states are false', ({
      render,
      theme,
      localization,
      router
    }) => {
      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
      expect(screen.getByTestId('edit-report')).toBeInTheDocument()
    })
  })

  describe('Report type rendering', () => {
    test('renders EditViewComplianceReport for all reports including historical TFRS-migrated reports', ({
      render,
      theme,
      localization,
      router
    }) => {
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

      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(screen.getByTestId('edit-report')).toBeInTheDocument()
    })

    test('renders EditViewComplianceReport for 2024+ reports', ({
      render,
      theme,
      localization,
      router
    }) => {
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

      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(screen.getByTestId('edit-report')).toBeInTheDocument()
    })
  })

  describe('Props passing', () => {
    test('passes error and isError props to the rendered component', async ({
      render,
      theme,
      localization,
      router
    }) => {
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

      render(<ComplianceReportViewSelector />, [theme, localization, router])

      const editReportElement = screen.getByTestId('edit-report')
      expect(editReportElement.textContent).toContain(
        '"error":{"message":"Test error"}'
      )
      expect(editReportElement.textContent).toContain('"isError":true')
    })

    test('passes correct props to EditViewComplianceReport', ({
      render,
      theme,
      localization,
      router
    }) => {
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

      render(<ComplianceReportViewSelector />, [theme, localization, router])

      const editReportElement = screen.getByTestId('edit-report')
      expect(editReportElement.textContent).toContain('"error":"Test error"')
      expect(editReportElement.textContent).toContain('"isError":true')
    })
  })

  describe('useEffect cache invalidation logic', () => {
    test('does NOT call invalidateQueries when reportData is null', ({
      render,
      theme,
      localization,
      router
    }) => {
      mockUseGetComplianceReport.mockReturnValue({
        ...defaultReportData,
        data: null
      })
      mockUseLocation.mockReturnValue({
        state: { reportStatus: 'Submitted' }
      })

      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled()
      expect(mockRefetch).not.toHaveBeenCalled()
    })

    test('does NOT call invalidateQueries when location.state.reportStatus is null', ({
      render,
      theme,
      localization,
      router
    }) => {
      mockUseLocation.mockReturnValue({
        state: null
      })

      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled()
      expect(mockRefetch).not.toHaveBeenCalled()
    })

    test('does NOT call invalidateQueries when reportStatus matches current status', ({
      render,
      theme,
      localization,
      router
    }) => {
      mockUseLocation.mockReturnValue({
        state: { reportStatus: 'Draft' }
      })

      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled()
      expect(mockRefetch).not.toHaveBeenCalled()
    })

    test('calls invalidateQueries and refetch when all conditions are true', ({
      render,
      theme,
      localization,
      router
    }) => {
      mockUseLocation.mockReturnValue({
        state: { reportStatus: 'Submitted' }
      })

      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith([
        'compliance-report',
        'test-report-id'
      ])
      expect(mockRefetch).toHaveBeenCalled()
    })

    test('handles undefined location.state gracefully', ({
      render,
      theme,
      localization,
      router
    }) => {
      mockUseLocation.mockReturnValue({
        state: undefined
      })

      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled()
      expect(mockRefetch).not.toHaveBeenCalled()
    })

    test('handles missing reportStatus in location.state', ({
      render,
      theme,
      localization,
      router
    }) => {
      mockUseLocation.mockReturnValue({
        state: { otherProperty: 'value' }
      })

      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled()
      expect(mockRefetch).not.toHaveBeenCalled()
    })
  })

  describe('Edge cases', () => {
    test('handles undefined reportData gracefully', ({
      render,
      theme,
      localization,
      router
    }) => {
      mockUseGetComplianceReport.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch
      })

      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(screen.getByTestId('edit-report')).toBeInTheDocument()
    })

    test('handles undefined currentUser organization gracefully', ({
      render,
      theme,
      localization,
      router
    }) => {
      mockUseCurrentUser.mockReturnValue({
        data: {
          organization: null
        },
        isLoading: false
      })

      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(mockUseGetComplianceReport).toHaveBeenCalledWith(
        undefined,
        'test-report-id',
        { enabled: true }
      )
    })

    test('handles completely undefined currentUser', ({
      render,
      theme,
      localization,
      router
    }) => {
      mockUseCurrentUser.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(mockUseGetComplianceReport).toHaveBeenCalledWith(
        undefined,
        'test-report-id',
        { enabled: true }
      )
    })

    test('handles missing report in reportData', ({
      render,
      theme,
      localization,
      router
    }) => {
      mockUseGetComplianceReport.mockReturnValue({
        data: {
          report: null
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch
      })

      render(<ComplianceReportViewSelector />, [theme, localization, router])

      expect(screen.getByTestId('edit-report')).toBeInTheDocument()
    })
  })

  describe('Cache invalidation tests', () => {
    test('does not invalidate cache when location state is null', async ({
      render,
      theme,
      localization,
      router
    }) => {
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

      render(<ComplianceReportViewSelector />, [theme, localization, router])

      await waitFor(() => {
        expect(screen.getByTestId('edit-report')).toBeInTheDocument()
      })

      // Should not invalidate cache since there's no location state
      expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled()
      expect(mockRefetch).not.toHaveBeenCalled()
    })
  })

  describe('Hook integration tests', () => {
    test('calls useGetComplianceReport with correct parameters', async ({
      render,
      theme,
      localization,
      router
    }) => {
      const currentUser = {
        data: { organization: { organizationId: '456' } },
        isLoading: false
      }
      const complianceReportId = '789'

      setupMocks({
        currentUser,
        complianceReportId
      })

      render(<ComplianceReportViewSelector />, [theme, localization, router])

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
