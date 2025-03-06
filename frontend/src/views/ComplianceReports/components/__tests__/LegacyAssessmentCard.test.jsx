import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, it, vi, describe, beforeEach } from 'vitest'
import { LegacyAssessmentCard } from '../LegacyAssessmentCard'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('@/components/BCWidgetCard/BCWidgetCard', () => ({
  __esModule: true,
  default: ({ title, content }) => (
    <div data-testid="mocked-bcwidgetcard">
      <h2>{title}</h2>
      <div>{content}</div>
    </div>
  )
}))

vi.mock('../HistoryCard.jsx', () => ({
  __esModule: true,
  HistoryCard: ({ report }) => (
    <div data-testid="mocked-historycard">{`History for version ${report.version}`}</div>
  )
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      switch (key) {
        case 'report:assessment':
          return 'Assessment'
        case 'report:orgDetails':
          return 'Organization Details'
        case 'report:serviceAddrLabel':
          return 'Service Address'
        case 'report:bcAddrLabel':
          return 'BC Address'
        case 'report:contactForAddrChange':
          return 'Contact us for address changes.'
        case 'report:reportHistory':
          return 'Report History'
        case 'report:supplementalWarning':
          return 'Supplemental Warning Text'
        case 'report:viewLegacyBtn':
          return 'View Legacy'
        default:
          return key
      }
    }
  })
}))

vi.mock('@/constants/config', () => ({
  CONFIG: {
    TFRS_BASE: 'http://example.com'
  }
}))

const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

function minimalAddress() {
  return {
    streetAddress: '123 Street',
    city: 'Townsville',
    state: 'BC',
    country: 'Canada',
    postalCode: 'V0X 1Y0'
  }
}

describe('LegacyAssessmentCard', () => {
  beforeEach(() => {
    openSpy.mockClear()
  })

  it('renders "Assessment" title if currentStatus is "Assessed"', () => {
    render(
      <LegacyAssessmentCard
        orgData={{
          name: 'Test Org',
          orgAddress: minimalAddress(),
          orgAttorneyAddress: minimalAddress()
        }}
        hasSupplemental={false}
        isGovernmentUser={false}
        currentStatus={COMPLIANCE_REPORT_STATUSES.ASSESSED}
        legacyReportId={42}
        chain={[]}
      />,
      { wrapper }
    )
    expect(screen.getByText('Assessment')).toBeInTheDocument()
  })

  it('renders "Assessment" title if user is government, even if status is not assessed', () => {
    render(
      <LegacyAssessmentCard
        orgData={{
          name: 'Test Org',
          orgAddress: minimalAddress(),
          orgAttorneyAddress: minimalAddress()
        }}
        hasSupplemental={false}
        isGovernmentUser
        currentStatus={COMPLIANCE_REPORT_STATUSES.DRAFT}
        legacyReportId={42}
        chain={[]}
      />,
      { wrapper }
    )
    expect(screen.getByText('Assessment')).toBeInTheDocument()
  })

  it('renders "Assessment" title if hasSupplemental is true, ignoring status', () => {
    render(
      <LegacyAssessmentCard
        orgData={{
          name: 'Test Org',
          orgAddress: minimalAddress(),
          orgAttorneyAddress: minimalAddress()
        }}
        hasSupplemental
        isGovernmentUser={false}
        currentStatus={COMPLIANCE_REPORT_STATUSES.DRAFT}
        legacyReportId={42}
        chain={[]}
      />,
      { wrapper }
    )
    expect(screen.getByText('Assessment')).toBeInTheDocument()
  })

  it('renders "Organization Details" if not assessed, not gov, and no supplemental', () => {
    render(
      <LegacyAssessmentCard
        orgData={{
          name: 'Test Org',
          orgAddress: minimalAddress(),
          orgAttorneyAddress: minimalAddress()
        }}
        hasSupplemental={false}
        isGovernmentUser={false}
        currentStatus={COMPLIANCE_REPORT_STATUSES.DRAFT}
        legacyReportId={42}
        chain={[]}
      />,
      { wrapper }
    )
    expect(screen.getByText('Organization Details')).toBeInTheDocument()
  })

  it('renders org name, addresses, and the "contactForAddrChange" if not government', () => {
    const testOrg = {
      name: 'Cool Org',
      orgAddress: {
        streetAddress: '321 Apple Ln',
        city: 'Fruitvale',
        state: 'BC',
        country: 'Canada',
        postalCode: 'V1A 2B3'
      },
      orgAttorneyAddress: {
        streetAddress: '456 Berry St',
        city: 'Berrytown',
        state: 'BC',
        country: 'Canada',
        postalCode: 'V2C 3D4'
      }
    }

    render(
      <LegacyAssessmentCard
        orgData={testOrg}
        hasSupplemental={false}
        isGovernmentUser={false}
        currentStatus={COMPLIANCE_REPORT_STATUSES.DRAFT}
        legacyReportId={42}
        chain={[]}
      />,
      { wrapper }
    )

    expect(screen.getByText('Cool Org')).toBeInTheDocument()

    expect(screen.getByText(/321 Apple Ln/)).toBeInTheDocument()
    expect(screen.getByText(/456 Berry St/)).toBeInTheDocument()

    expect(
      screen.getByText('Contact us for address changes.')
    ).toBeInTheDocument()
  })

  it('omits contactForAddrChange if user is government', () => {
    const testOrg = {
      name: 'Gov Org',
      orgAddress: minimalAddress(),
      orgAttorneyAddress: minimalAddress()
    }

    render(
      <LegacyAssessmentCard
        orgData={testOrg}
        hasSupplemental={false}
        isGovernmentUser
        currentStatus={COMPLIANCE_REPORT_STATUSES.DRAFT}
        legacyReportId={42}
        chain={[]}
      />,
      { wrapper }
    )

    expect(screen.getByText('Gov Org')).toBeInTheDocument()
    expect(
      screen.queryByText('Contact us for address changes.')
    ).not.toBeInTheDocument()
  })

  it('renders the chain items in <HistoryCard> if chain is non-empty', () => {
    const mockChain = [{ version: 0 }, { version: 1 }]

    const testOrg = {
      name: 'Test Org',
      orgAddress: minimalAddress(),
      orgAttorneyAddress: minimalAddress()
    }

    render(
      <LegacyAssessmentCard
        orgData={testOrg}
        hasSupplemental={false}
        isGovernmentUser={false}
        currentStatus={COMPLIANCE_REPORT_STATUSES.DRAFT}
        legacyReportId={42}
        chain={mockChain}
      />,
      { wrapper }
    )

    expect(screen.getByText('History for version 0')).toBeInTheDocument()
    expect(screen.getByText('History for version 1')).toBeInTheDocument()
  })

  it('clicking "View Legacy" calls window.open with correct URL', () => {
    const testOrg = {
      name: 'Test Org',
      orgAddress: minimalAddress(),
      orgAttorneyAddress: minimalAddress()
    }

    render(
      <LegacyAssessmentCard
        orgData={testOrg}
        hasSupplemental={false}
        isGovernmentUser={false}
        currentStatus={COMPLIANCE_REPORT_STATUSES.DRAFT}
        legacyReportId={999}
        chain={[]}
      />,
      { wrapper }
    )

    const btn = screen.getByText('View Legacy')
    fireEvent.click(btn)

    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(openSpy).toHaveBeenCalledWith(
      'http://example.com/compliance_reporting/edit/999/intro',
      '_blank'
    )
  })
})
