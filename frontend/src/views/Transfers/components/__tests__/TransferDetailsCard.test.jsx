import React from 'react'
import { render, screen } from '@testing-library/react'
import { TransferDetailsCard } from '../TransferDetailsCard'
import { vi } from 'vitest'
import { useMediaQuery, useTheme } from '@mui/material'
import { decimalFormatter } from '@/utils/formatters'
import { wrapper } from '@/tests/utils/wrapper'

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

describe('TransferDetailsCard', () => {
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

  test('renders correctly with provided props', () => {
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

  test('calculates and displays total value correctly', () => {
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
      screen.getByText(`$${decimalFormatter(totalValue)}`)
    ).toBeInTheDocument()
  })

  test('renders icons correctly based on screen size', () => {
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
})
