import React from 'react'
import { screen } from '@testing-library/react'
import { OrganizationBadge } from '../OrganizationBadge'
import { beforeEach, describe, expect, vi } from 'vitest'
import { useOrganizationBalance } from '@/hooks/useOrganization'
import { test } from '@/tests/utils/fixtures'

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

  test('renders correctly with organization name', ({ render, theme }) => {
    render(
      <OrganizationBadge
        organizationId={1}
        organizationName="Test Organization"
        transferStatus="Submitted"
        isGovernmentUser={true}
      />,
      [theme]
    )
    expect(screen.getByText('Test Organization')).toBeInTheDocument()
  })

  test('displays balance and registration status for government users with valid transfer status', ({
    render,
    theme
  }) => {
    render(
      <OrganizationBadge
        organizationId={1}
        organizationName="Test Organization"
        transferStatus="Submitted"
        isGovernmentUser={true}
      />,
      [theme]
    )
    expect(screen.getByText('Balance: 1,000 (200)')).toBeInTheDocument()
    expect(screen.getByText('Registered: Yes')).toBeInTheDocument()
  })

  test('does not display balance and registration status for non-government users', ({
    render,
    theme
  }) => {
    render(
      <OrganizationBadge
        organizationId={1}
        organizationName="Test Organization"
        transferStatus="Submitted"
        isGovernmentUser={false}
      />,
      [theme]
    )
    expect(screen.queryByText('Balance:')).not.toBeInTheDocument()
    expect(screen.queryByText('Registered:')).not.toBeInTheDocument()
  })

  test('does not display balance and registration status for invalid transfer status', ({
    render,
    theme
  }) => {
    render(
      <OrganizationBadge
        organizationId={1}
        organizationName="Test Organization"
        transferStatus="Pending"
        isGovernmentUser={true}
      />,
      [theme]
    )
    expect(screen.queryByText('Balance:')).not.toBeInTheDocument()
    expect(screen.queryByText('Registered:')).not.toBeInTheDocument()
  })

  test('handles loading state correctly', ({ render, theme }) => {
    useOrganizationBalance.mockReturnValue({
      data: null,
      isLoading: true,
      isLoadingError: false
    })

    render(
      <OrganizationBadge
        organizationId={1}
        organizationName="Test Organization"
        transferStatus="Submitted"
        isGovernmentUser={true}
      />,
      [theme]
    )
    expect(screen.getByText('Test Organization')).toBeInTheDocument()
    expect(screen.queryByText('Balance:')).not.toBeInTheDocument()
    expect(screen.queryByText('Registered:')).not.toBeInTheDocument()
  })

  test('handles error state gracefully', ({ render, theme }) => {
    useOrganizationBalance.mockReturnValue({
      data: null,
      isLoading: false,
      isLoadingError: true
    })

    render(
      <OrganizationBadge
        organizationId={1}
        organizationName="Test Organization"
        transferStatus="Submitted"
        isGovernmentUser={true}
      />,
      [theme]
    )
    expect(screen.getByText('Test Organization')).toBeInTheDocument()
    expect(screen.queryByText('Balance:')).not.toBeInTheDocument()
    expect(screen.queryByText('Registered:')).not.toBeInTheDocument()
  })

  test('displays correct balance formatting', ({ render, theme }) => {
    useOrganizationBalance.mockReturnValue({
      data: {
        totalBalance: 1234567.89,
        reservedBalance: -123456.78,
        registered: false
      },
      isLoading: false,
      isLoadingError: false
    })

    render(
      <OrganizationBadge
        organizationId={1}
        organizationName="Test Organization"
        transferStatus="Submitted"
        isGovernmentUser={true}
      />,
      [theme]
    )
    expect(
      screen.getByText('Balance: 1,234,567.89 (123,456.78)')
    ).toBeInTheDocument()
    expect(screen.getByText('Registered: No')).toBeInTheDocument()
  })
})
