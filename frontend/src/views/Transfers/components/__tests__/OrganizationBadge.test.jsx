import React from 'react'
import { render, screen } from '@testing-library/react'
import { OrganizationBadge } from '../OrganizationBadge'
import { vi } from 'vitest'
import { useOrganizationBalance } from '@/hooks/useOrganization'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('@/hooks/useOrganization')

const keycloak = vi.hoisted(() => ({
  useKeycloak: vi.fn()
}))
vi.mock('@react-keycloak/web', () => keycloak)

// Mock necessary hooks and dependencies
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: {
      roles: [{ name: 'Government' }]
    },
    isLoading: false,
    hasRoles: vi.fn().mockReturnValue(true),
    hasAnyRole: vi.fn().mockReturnValue(true)
  })
}))

describe('OrganizationBadge Component', () => {
  const mockOrgData = {
    totalBalance: 1000,
    reservedBalance: -200,
    registered: true
  }

  beforeEach(() => {
    keycloak.useKeycloak.mockReturnValue({
      keycloak: { authenticated: true },
      initialized: true
    })

    useOrganizationBalance.mockReturnValue({
      data: mockOrgData,
      isLoading: false,
      isLoadingError: false
    })
  })

  test('renders correctly with organization name', () => {
    render(
      <OrganizationBadge
        organizationId={1}
        organizationName="Test Organization"
        transferStatus="Submitted"
        isGovernmentUser={true}
      />,
      { wrapper }
    )
    expect(screen.getByText('Test Organization')).toBeInTheDocument()
  })

  test('displays balance and registration status for government users with valid transfer status', () => {
    render(
      <OrganizationBadge
        organizationId={1}
        organizationName="Test Organization"
        transferStatus="Submitted"
        isGovernmentUser={true}
      />,
      { wrapper }
    )
    expect(screen.getByText('Balance: 1,000 (200)')).toBeInTheDocument()
    expect(screen.getByText('Registered: Yes')).toBeInTheDocument()
  })

  test('does not display balance and registration status for non-government users', () => {
    render(
      <OrganizationBadge
        organizationId={1}
        organizationName="Test Organization"
        transferStatus="Submitted"
        isGovernmentUser={false}
      />,
      { wrapper }
    )
    expect(screen.queryByText('Balance:')).not.toBeInTheDocument()
    expect(screen.queryByText('Registered:')).not.toBeInTheDocument()
  })

  test('does not display balance and registration status for invalid transfer status', () => {
    render(
      <OrganizationBadge
        organizationId={1}
        organizationName="Test Organization"
        transferStatus="Pending"
        isGovernmentUser={true}
      />,
      { wrapper }
    )
    expect(screen.queryByText('Balance:')).not.toBeInTheDocument()
    expect(screen.queryByText('Registered:')).not.toBeInTheDocument()
  })
})
