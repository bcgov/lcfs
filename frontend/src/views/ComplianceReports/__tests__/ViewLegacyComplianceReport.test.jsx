import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { CONFIG } from '@/constants/config'
import { LegacyAssessmentCard } from '@/views/ComplianceReports/components/LegacyAssessmentCard.jsx'
import { wrapper } from '@/tests/utils/wrapper.jsx'

// Mock useTranslation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock HistoryCard
vi.mock('@/views/ComplianceReports/components/HistoryCard.jsx', () => ({
  HistoryCard: ({ report }) => <div>HistoryCard - Version {report.version}</div>
}))

describe('LegacyAssessmentCard', () => {
  // Mock window.open so we can check calls
  global.open = vi.fn()

  const setup = (overrides = {}) => {
    const defaultProps = {
      orgData: {
        name: 'Test Org',
        orgAddress: {
          addressLine1: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345'
        },
        orgAttorneyAddress: {
          addressLine1: '456 Law St',
          city: 'Law City',
          state: 'LS',
          postalCode: '67890'
        }
      },
      hasSupplemental: false,
      isGovernmentUser: false,
      currentStatus: COMPLIANCE_REPORT_STATUSES.DRAFT,
      legacyReportId: '999',
      chain: []
    }

    const props = { ...defaultProps, ...overrides }

    return render(<LegacyAssessmentCard {...props} />, { wrapper })
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders the organization details and addresses', () => {
    setup()
    expect(screen.getByText('report:orgDetails')).toBeInTheDocument()
    expect(screen.getByText('Test Org')).toBeInTheDocument()
    expect(screen.getByText(/report:serviceAddrLabel/)).toBeInTheDocument()
    expect(screen.getByText(/report:bcAddrLabel/)).toBeInTheDocument()
  })

  it('displays contact instructions for non-government users', () => {
    setup({ isGovernmentUser: false })
    expect(
      screen.getByText('report:contactForAddrChange', { exact: false })
    ).toBeInTheDocument()
  })

  it('does not display contact instructions for government users', () => {
    setup({ isGovernmentUser: true })
    expect(
      screen.queryByText('report:contactForAddrChange', { exact: false })
    ).not.toBeInTheDocument()
  })

  it('displays the supplemental warning text', () => {
    setup()
    expect(screen.getByText('report:supplementalWarning')).toBeInTheDocument()
  })

  it('displays "View Legacy" button which opens the legacy report link on click', async () => {
    setup({ legacyReportId: '999' })
    const viewBtn = screen.getByText('report:viewLegacyBtn')
    expect(viewBtn).toBeInTheDocument()
    fireEvent.click(viewBtn)
    await waitFor(() => {
      expect(global.open).toHaveBeenCalledWith(
        `${CONFIG.TFRS_BASE}/compliance_reporting/edit/999/intro`,
        '_blank'
      )
    })
  })

  it('uses environment-based TFRS URL if we override CONFIG.TFRS_BASE', async () => {
    // Temporarily override the TFRS base
    const originalBase = CONFIG.TFRS_BASE
    CONFIG.TFRS_BASE = 'https://fake-env-tfrs.example.com'

    setup({ legacyReportId: '999' })
    fireEvent.click(screen.getByText('report:viewLegacyBtn'))

    await waitFor(() => {
      expect(global.open).toHaveBeenCalledWith(
        'https://fake-env-tfrs.example.com/compliance_reporting/edit/999/intro',
        '_blank'
      )
    })

    // Restore original TFRS_BASE so we don't impact other tests
    CONFIG.TFRS_BASE = originalBase
  })

  it('displays history when chain is not empty', () => {
    setup({
      chain: [
        {
          version: 0,
          report: {
            currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
          }
        },
        {
          version: 1,
          report: {
            currentStatus: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED }
          }
        }
      ]
    })
    expect(screen.getByText('report:reportHistory')).toBeInTheDocument()
    expect(screen.getByText('HistoryCard - Version 0')).toBeInTheDocument()
    expect(screen.getByText('HistoryCard - Version 1')).toBeInTheDocument()
  })

  it('shows "report:assessment" title when currentStatus is ASSESSED', () => {
    setup({ currentStatus: COMPLIANCE_REPORT_STATUSES.ASSESSED })
    expect(screen.getByText('report:assessment')).toBeInTheDocument()
  })

  it('shows "report:assessment" title for government users even if not assessed', () => {
    setup({
      isGovernmentUser: true,
      currentStatus: COMPLIANCE_REPORT_STATUSES.DRAFT
    })
    expect(screen.getByText('report:assessment')).toBeInTheDocument()
  })

  it('shows "report:assessment" title if supplemental is true', () => {
    setup({
      hasSupplemental: true,
      currentStatus: COMPLIANCE_REPORT_STATUSES.DRAFT
    })
    expect(screen.getByText('report:assessment')).toBeInTheDocument()
  })

  it('shows "report:orgDetails" title if not assessed, not government user, and no supplemental', () => {
    setup({
      isGovernmentUser: false,
      hasSupplemental: false,
      currentStatus: COMPLIANCE_REPORT_STATUSES.DRAFT
    })
    expect(screen.getByText('report:orgDetails')).toBeInTheDocument()
  })
})
