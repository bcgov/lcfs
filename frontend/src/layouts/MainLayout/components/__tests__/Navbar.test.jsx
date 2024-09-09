import React from 'react'
import { render, screen } from '@testing-library/react'
import { Navbar } from '../Navbar'
import { vi } from 'vitest'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useMediaQuery, useTheme } from '@mui/material'
import { wrapper } from '@/tests/utils/wrapper.jsx'
import { roles } from '@/constants/roles.js'

vi.mock('@/hooks/useCurrentUser')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))
vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material')
  return {
    ...actual,
    useTheme: vi.fn(),
    useMediaQuery: vi.fn()
  }
})

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: vi.fn().mockReturnValue({
    keycloak: { authenticated: true }
  })
}))

describe('Navbar', () => {
  const mockUser = {
    isGovernmentUser: true,
    roles: [
      {
        name: roles.analyst
      }
    ]
  }

  beforeEach(() => {
    useCurrentUser.mockReturnValue({
      data: mockUser
    })
    useMediaQuery.mockReturnValue(false) // Set to false for desktop tests
    useTheme.mockReturnValue({
      breakpoints: {
        down: () => {}
      }
    })
  })

  test('renders correctly with the expected title', () => {
    render(<Navbar />, { wrapper })
    expect(screen.getByTestId('bc-navbar')).toBeInTheDocument()
  })

  test('displays the correct navigation menu items for government users', () => {
    render(<Navbar />, { wrapper })

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Organizations')).toBeInTheDocument()
    expect(screen.getByText('Transactions')).toBeInTheDocument()
    expect(screen.getByText('ComplianceReporting')).toBeInTheDocument()
    expect(screen.getByText('FuelCodes')).toBeInTheDocument() // Analyst role allows this
    expect(screen.getByText('Administration')).toBeInTheDocument()
  })

  test('displays the correct navigation menu items for non-government users', () => {
    mockUser.isGovernmentUser = false
    render(<Navbar />, { wrapper })

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Organizations')).not.toBeInTheDocument() // Should not be present
    expect(screen.getByText('Transactions')).toBeInTheDocument()
    expect(screen.getByText('ComplianceReporting')).toBeInTheDocument()
    expect(screen.getByText('Organization')).toBeInTheDocument()
  })

  test('renders logout component', () => {
    render(<Navbar />, { wrapper })
    expect(screen.getByText('logout')).toBeInTheDocument() // Assuming Logout component has this text
  })
})
