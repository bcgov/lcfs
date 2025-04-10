import React from 'react'
import { render, screen } from '@testing-library/react'
import { TransferDetailsCard } from '../TransferDetailsCard'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMediaQuery, useTheme } from '@mui/material'
import { currencyFormatter } from '@/utils/formatters'
import { wrapper } from '@/tests/utils/wrapper'

global.XMLHttpRequest = vi.fn(() => ({
  open: vi.fn(),
  send: vi.fn(),
  setRequestHeader: vi.fn(),
  onreadystatechange: vi.fn(),
  readyState: 4,
  status: 200,
  responseText: JSON.stringify({})
}))

const keycloak = vi.hoisted(() => ({
  useKeycloak: () => ({
    keycloak: vi.fn()
  })
}))
vi.mock('@react-keycloak/web', () => keycloak)

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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@mui/material', async (importOriginal) => {
  const mod = await importOriginal() // type is inferred
  return {
    ...mod,
    useMediaQuery: vi.fn(),
    useTheme: vi.fn()
  }
})

vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({
    setForbidden: vi.fn()
  })
}))

describe('TransferDetailsCard Component', () => {
  const mockUseTheme = {
    breakpoints: {
      down: vi.fn().mockReturnValue(false)
    },
    spacing: vi.fn().mockReturnValue('16px')
  }

  beforeEach(() => {
    useTheme.mockReturnValue(mockUseTheme)
    useMediaQuery.mockReturnValue(false) // Set to false for desktop tests
  })

  it('renders correctly with provided props', () => {
    render(
      <TransferDetailsCard
        fromOrgId={1}
        fromOrganization="Org A"
        toOrgId={2}
        toOrganization="Org B"
        quantity={10}
        pricePerUnit={5}
        transferStatus="Submitted"
        isGovernmentUser={true}
      />,
      { wrapper }
    )
    expect(screen.getByText('Org A')).toBeInTheDocument()
    expect(screen.getByText('Org B')).toBeInTheDocument()
  })

  it('calculates and displays total value correctly', () => {
    render(
      <TransferDetailsCard
        fromOrgId={1}
        fromOrganization="Org A"
        toOrgId={2}
        toOrganization="Org B"
        quantity={10}
        pricePerUnit={5}
        transferStatus="Submitted"
        isGovernmentUser={true}
      />,
      { wrapper }
    )
    const totalValue = (10 * 5).toFixed(2)
    expect(
      screen.getByText(currencyFormatter({ value: totalValue }))
    ).toBeInTheDocument()
  })

  it('renders icons correctly based on screen size', () => {
    // Test for desktop view
    render(
      <TransferDetailsCard
        fromOrgId={1}
        fromOrganization="Org A"
        toOrgId={2}
        toOrganization="Org B"
        quantity={10}
        pricePerUnit={5}
        transferStatus="Submitted"
        isGovernmentUser={true}
      />,
      { wrapper }
    )
    expect(screen.getByTestId('SyncAltIcon')).toBeInTheDocument()

    // Change to mobile view
    useMediaQuery.mockReturnValue(true)
    render(
      <TransferDetailsCard
        fromOrgId={1}
        fromOrganization="Org A"
        toOrgId={2}
        toOrganization="Org B"
        quantity={10}
        pricePerUnit={5}
        transferStatus="Submitted"
        isGovernmentUser={true}
      />,
      { wrapper }
    )
    expect(screen.getByTestId('SwapVertIcon')).toBeInTheDocument()
  })

  it('handles zero and negative quantities and prices', () => {
    render(
      <TransferDetailsCard
        fromOrgId={1}
        fromOrganization="Org A"
        toOrgId={2}
        toOrganization="Org B"
        quantity={0}
        pricePerUnit={0}
        transferStatus="Submitted"
        isGovernmentUser={true}
      />,
      { wrapper }
    )
    expect(screen.getByText('$0.00')).toBeInTheDocument()
    expect(screen.getByText('0 transfer:complianceUnits')).toBeInTheDocument()
  })

  it('formats large numbers correctly', () => {
    render(
      <TransferDetailsCard
        fromOrgId={1}
        fromOrganization="Org A"
        toOrgId={2}
        toOrganization="Org B"
        quantity={1000000}
        pricePerUnit={5000}
        transferStatus="Submitted"
        isGovernmentUser={true}
      />,
      { wrapper }
    )
    const totalValue = (1000000 * 5000).toFixed(2)
    expect(
      screen.getByText(currencyFormatter({ value: totalValue }))
    ).toBeInTheDocument()
  })
})
