import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LegacyAssessmentCard } from '../LegacyAssessmentCard'
import { wrapper } from '@/tests/utils/wrapper.jsx'

// 1. Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// 2. Mock config so TFRS_BASE is stable
vi.mock('@/constants/config', () => ({
  CONFIG: {
    TFRS_BASE: 'http://localhost:3000'
  }
}))

// 3. Mock @react-keycloak/web so we don't get the \"authClient not assigned\" error
vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({ keycloak: {} })
}))

// 4. Mock the `useAuthorization` so we don't get \"Cannot destructure property 'setForbidden'\"
vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({
    setForbidden: vi.fn()
  })
}))

// 5. Mock constructAddress so it returns predictable strings
vi.mock('@/utils/constructAddress', () => ({
  constructAddress: vi.fn((addr) => {
    if (!addr) return ''
    return `${addr.addressLine1}, ${addr.city}, ${addr.postalCode}`
  })
}))

// For the child HistoryCard to not blow up on hooking into user
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { user: 'test-user', isGovernmentUser: false },
    hasRoles: vi.fn().mockReturnValue(false)
  })
}))

// Mock the global open
const windowOpenMock = vi.fn()
global.open = windowOpenMock

describe('LegacyAssessmentCard', () => {
  const mockOrgData = {
    name: 'Test Organization',
    orgAddress: {
      addressLine1: '123 Main St.',
      city: 'Testville',
      postalCode: 'T3S T12'
    },
    orgAttorneyAddress: {
      addressLine1: '456 Legal Ave.',
      city: 'Lawtown',
      postalCode: 'L4W F45'
    }
  }

  const mockChain = [
    {
      version: 1,
      nickname: 'First Version',
      currentStatus: { status: 'Draft' },
      history: []
    },
    {
      version: 2,
      nickname: 'Second Version',
      currentStatus: { status: 'Submitted' },
      history: []
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders organization details and addresses', () => {
    render(
      <LegacyAssessmentCard
        orgData={mockOrgData}
        hasSupplemental={false}
        isGovernmentUser={false}
        currentStatus="Draft"
        legacyReportId="999"
        chain={[]}
      />,
      { wrapper }
    )

    // Check the org name
    expect(screen.getByText('Test Organization')).toBeInTheDocument()

    // The label + colon is spaced by MUI, so let's do a partial or regex match:
    // We can do a function or an inline regex checking for "report:serviceAddrLabel" followed by a colon
    expect(
      screen.getByText((text) => text.includes('report:serviceAddrLabel:'))
    ).toBeInTheDocument()

    // Similarly for the address
    expect(
      screen.getByText(/123 Main St\., Testville, T3S T12/i)
    ).toBeInTheDocument()

    expect(
      screen.getByText((text) => text.includes('report:bcAddrLabel:'))
    ).toBeInTheDocument()

    expect(
      screen.getByText(/456 Legal Ave\., Lawtown, L4W F45/i)
    ).toBeInTheDocument()
  })

  it('renders report history when chain is provided', () => {
    render(
      <LegacyAssessmentCard
        orgData={mockOrgData}
        hasSupplemental={false}
        isGovernmentUser={false}
        currentStatus="Draft"
        legacyReportId="999"
        chain={mockChain}
      />,
      { wrapper }
    )

    // Title
    expect(screen.getByText('report:reportHistory')).toBeInTheDocument()

    // The chain’s versions
    expect(
      screen.getByText((content) => content.includes('First Version'))
    ).toBeInTheDocument()
    expect(
      screen.getByText((content) => content.includes('Second Version'))
    ).toBeInTheDocument()
  })

  it('renders contact message for non-government users', () => {
    render(
      <LegacyAssessmentCard
        orgData={mockOrgData}
        hasSupplemental={false}
        isGovernmentUser={false}
        currentStatus="Draft"
        legacyReportId="999"
        chain={[]}
      />,
      { wrapper }
    )
    expect(screen.getByText(/report:contactForAddrChange/i)).toBeInTheDocument()
  })

  it('renders assessment title if current status is ASSESSED', () => {
    render(
      <LegacyAssessmentCard
        orgData={mockOrgData}
        hasSupplemental={false}
        isGovernmentUser={false}
        currentStatus="Assessed"
        legacyReportId="999"
        chain={[]}
      />,
      { wrapper }
    )
    expect(screen.getByText('report:assessment')).toBeInTheDocument()
  })

  it('renders orgDetails title for non-government and non-supplemental', () => {
    render(
      <LegacyAssessmentCard
        orgData={mockOrgData}
        hasSupplemental={false}
        isGovernmentUser={false}
        currentStatus="Draft"
        legacyReportId="999"
        chain={[]}
      />,
      { wrapper }
    )
    expect(screen.getByText('report:orgDetails')).toBeInTheDocument()
  })

  it('renders assessment title if hasSupplemental is true', () => {
    render(
      <LegacyAssessmentCard
        orgData={mockOrgData}
        hasSupplemental
        isGovernmentUser={false}
        currentStatus="Draft"
        legacyReportId="999"
        chain={[]}
      />,
      { wrapper }
    )
    expect(screen.getByText('report:assessment')).toBeInTheDocument()
  })

  it('renders assessment title for government users', () => {
    render(
      <LegacyAssessmentCard
        orgData={mockOrgData}
        hasSupplemental={false}
        isGovernmentUser
        currentStatus="Draft"
        legacyReportId="999"
        chain={[]}
      />,
      { wrapper }
    )
    expect(screen.getByText('report:assessment')).toBeInTheDocument()
  })

  it('opens legacy report when "view legacy" button is clicked', () => {
    render(
      <LegacyAssessmentCard
        orgData={mockOrgData}
        hasSupplemental={false}
        isGovernmentUser={false}
        currentStatus="Draft"
        legacyReportId="999"
        chain={[]}
      />,
      { wrapper }
    )

    fireEvent.click(screen.getByTestId('view-legacy'))

    expect(windowOpenMock).toHaveBeenCalledWith(
      'http://localhost:3000/compliance_reporting/edit/999/intro',
      '_blank'
    )
  })
})
