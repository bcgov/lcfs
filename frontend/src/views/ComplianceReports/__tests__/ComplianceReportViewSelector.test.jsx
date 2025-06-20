import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ComplianceReportViewSelector } from '../ComplianceReportViewSelector.jsx'
import * as useComplianceReportsHook from '@/hooks/useComplianceReports'
import * as useCurrentUserHook from '@/hooks/useCurrentUser'
import { wrapper } from '@/tests/utils/wrapper'

// Import useParams and useLocation after mocking so they're already mocks
import { useParams, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: vi.fn(),
    useLocation: vi.fn()
  }
})

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useQueryClient: vi.fn()
  }
})

vi.mock('@/hooks/useComplianceReports')
vi.mock('@/hooks/useCurrentUser')

vi.mock('@/stores/useComplianceReportStore', () => ({
  default: vi.fn()
}))

vi.mock('@/components/Loading', () => ({
  default: () => <div>Loading...</div>
}))

vi.mock('@/views/ComplianceReports/ViewLegacyComplianceReport', () => ({
  ViewLegacyComplianceReport: () => <div>Legacy Report View</div>
}))

vi.mock('@/views/ComplianceReports/EditViewComplianceReport', () => ({
  EditViewComplianceReport: () => <div>Edit Compliance Report</div>
}))

describe('ComplianceReportViewSelector', () => {
  const mockQueryClient = {
    invalidateQueries: vi.fn()
  }

  const mockRefetch = vi.fn()

  const setupMocks = ({
    currentUser = { organization: { organizationId: '123' } },
    isCurrentUserLoading = false,
    reportData = {
      report: {
        legacyId: null,
        currentStatus: { status: 'DRAFT' }
      }
    },
    isReportLoading = false,
    isError = false,
    error = null,
    complianceReportId = '123',
    locationState = null
  } = {}) => {
    // Set the return value for useParams
    useParams.mockReturnValue({ complianceReportId })

    // Set the return value for useLocation
    useLocation.mockReturnValue({
      state: locationState,
      pathname: '/compliance-reports/123',
      search: '',
      hash: ''
    })

    // Set the return value for useQueryClient
    useQueryClient.mockReturnValue(mockQueryClient)

    // Mock useCurrentUser
    useCurrentUserHook.useCurrentUser.mockReturnValue({
      data: currentUser,
      isLoading: isCurrentUserLoading
    })

    // Mock useGetComplianceReport
    useComplianceReportsHook.useGetComplianceReport.mockReturnValue({
      data: reportData,
      isLoading: isReportLoading,
      isError,
      error,
      refetch: mockRefetch
    })
  }

  beforeEach(() => {
    vi.resetAllMocks()
    mockQueryClient.invalidateQueries.mockClear()
    mockRefetch.mockClear()
  })

  it('renders loading when user is loading', async () => {
    setupMocks({ isCurrentUserLoading: true })
    render(<ComplianceReportViewSelector />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
  })

  it('renders loading when report is loading', async () => {
    setupMocks({ isReportLoading: true })
    render(<ComplianceReportViewSelector />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
  })

  it('renders ViewLegacyComplianceReport when legacyId is present', async () => {
    setupMocks({
      reportData: {
        report: {
          legacyId: 999,
          currentStatus: { status: 'DRAFT' }
        }
      }
    })

    render(<ComplianceReportViewSelector />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('Legacy Report View')).toBeInTheDocument()
      expect(
        screen.queryByText('Edit Compliance Report')
      ).not.toBeInTheDocument()
    })
  })

  it('renders EditViewComplianceReport when legacyId is null/undefined', async () => {
    setupMocks({
      reportData: {
        report: {
          currentStatus: { status: 'DRAFT' }
          // No legacyId means it should render the EditViewComplianceReport
        }
      }
    })

    render(<ComplianceReportViewSelector />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('Edit Compliance Report')).toBeInTheDocument()
      expect(screen.queryByText('Legacy Report View')).not.toBeInTheDocument()
    })
  })

  it('passes error and isError props to the rendered component', async () => {
    const testError = { message: 'Test error' }
    setupMocks({
      isError: true,
      error: testError,
      reportData: {
        report: {
          currentStatus: { status: 'DRAFT' }
        }
      }
    })

    render(<ComplianceReportViewSelector />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('Edit Compliance Report')).toBeInTheDocument()
    })
  })

  it('invalidates cache and refetches when report status differs from location state', async () => {
    const complianceReportId = '123'
    setupMocks({
      complianceReportId,
      reportData: {
        report: {
          currentStatus: { status: 'SUBMITTED' }
        }
      },
      locationState: { reportStatus: 'DRAFT' } // Different from current status
    })

    render(<ComplianceReportViewSelector />, { wrapper })

    await waitFor(() => {
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith([
        'compliance-report',
        complianceReportId
      ])
      expect(mockRefetch).toHaveBeenCalled()
    })
  })

  it('does not invalidate cache when report status matches location state', async () => {
    setupMocks({
      reportData: {
        report: {
          currentStatus: { status: 'DRAFT' }
        }
      },
      locationState: { reportStatus: 'DRAFT' } // Same as current status
    })

    render(<ComplianceReportViewSelector />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('Edit Compliance Report')).toBeInTheDocument()
    })

    // Should not invalidate cache since statuses match
    expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled()
    expect(mockRefetch).not.toHaveBeenCalled()
  })

  it('does not invalidate cache when location state is null', async () => {
    setupMocks({
      reportData: {
        report: {
          currentStatus: { status: 'DRAFT' }
        }
      },
      locationState: null // No location state
    })

    render(<ComplianceReportViewSelector />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('Edit Compliance Report')).toBeInTheDocument()
    })

    // Should not invalidate cache since there's no location state
    expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled()
    expect(mockRefetch).not.toHaveBeenCalled()
  })

  it('calls useGetComplianceReport with correct parameters', async () => {
    const currentUser = { organization: { organizationId: '456' } }
    const complianceReportId = '789'

    setupMocks({
      currentUser,
      complianceReportId,
      isCurrentUserLoading: false
    })

    render(<ComplianceReportViewSelector />, { wrapper })

    expect(
      useComplianceReportsHook.useGetComplianceReport
    ).toHaveBeenCalledWith(
      '456', // organizationId
      '789', // complianceReportId
      {
        enabled: true // !isCurrentUserLoading
      }
    )
  })
})
