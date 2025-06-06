import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ComplianceReportViewSelector } from '../ComplianceReportViewSelector.jsx'
import * as useComplianceReportsHook from '@/hooks/useComplianceReports'
import * as useCurrentUserHook from '@/hooks/useCurrentUser'
import { wrapper } from '@/tests/utils/wrapper'

// Import useParams after mocking so it's already a mock
import { useParams } from 'react-router-dom'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: vi.fn()
  }
})

vi.mock('@/hooks/useComplianceReports')
vi.mock('@/hooks/useCurrentUser')

vi.mock('@/components/Loading', () => ({
  default: () => <div>Loading...</div>
}))

vi.mock('@/views/ComplianceReports/ViewLegacyComplianceReport', () => ({
  ViewLegacyComplianceReport: () => <div>Legacy Report View</div>
}))

vi.mock('@/views/ComplianceReports/EditViewComplianceReport', () => ({
  EditViewComplianceReport: () => <div>Edit Compliance Report</div>
}))

describe('ViewComplianceReportBrancher', () => {
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
    complianceReportId = '123'
  } = {}) => {
    // Set the return value for useParams
    useParams.mockReturnValue({ complianceReportId })

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
      error
    })
  }

  beforeEach(() => {
    vi.resetAllMocks()
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
})
