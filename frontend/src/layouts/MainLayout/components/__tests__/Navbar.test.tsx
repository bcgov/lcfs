import { render, screen } from '@testing-library/react'
import { Navbar } from '../Navbar'
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useMediaQuery, useTheme } from '@mui/material'
import { wrapper } from '@/tests/utils/wrapper'
import { roles } from '@/constants/roles'

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

vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({
    setForbidden: vi.fn()
  })
}))

const mockedUseCurrentUser = useCurrentUser as unknown as Mock
const mockedUseMediaQuery = useMediaQuery as unknown as Mock
const mockedUseTheme = useTheme as unknown as Mock

describe('Navbar', () => {
  const mockUser = {
    isGovernmentUser: true,
    roles: [
      {
        name: roles.analyst
      },
      {
        name: roles.administrator
      }
    ]
  }

  beforeEach(() => {
    mockedUseCurrentUser.mockReturnValue({
      data: mockUser,
      hasRoles: (role) =>
        mockUser.roles.some((userRole) => userRole.name === role),
      hasAnyRole: (...roleNames) => {
        return roleNames.some((roleName) =>
          mockUser.roles.some((role) => role.name === roleName)
        )
      }
    })
    mockedUseMediaQuery.mockReturnValue(false) // Set to false for desktop tests
    mockedUseTheme.mockReturnValue({
      breakpoints: {
        down: () => {}
      }
    })
  })

  it('renders correctly with the expected title', () => {
    render(<Navbar />, { wrapper })
    expect(screen.getByTestId('bc-navbar')).toBeInTheDocument()
  })

  it('displays the correct navigation menu items for government users', () => {
    render(<Navbar />, { wrapper })

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Organizations')).toBeInTheDocument()
    expect(screen.getByText('Transactions')).toBeInTheDocument()
    expect(screen.getByText('ComplianceReporting')).toBeInTheDocument()
    expect(screen.getByText('FuelCodes')).toBeInTheDocument() // Analyst role allows this
    expect(screen.getByText('Administration')).toBeInTheDocument() // Admin role allows this
  })

  it('displays the correct navigation menu items for non-government users', () => {
    mockUser.isGovernmentUser = false
    render(<Navbar />, { wrapper })

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Organizations')).not.toBeInTheDocument() // Should not be present
    expect(screen.getByText('Transactions')).toBeInTheDocument()
    expect(screen.getByText('Organization')).toBeInTheDocument()
  })

  it('displays compliance reporting for non-government users with compliance reporting role', () => {
    mockUser.isGovernmentUser = false
    mockUser.roles = [
      {
        name: roles.supplier
      },
      {
        name: roles.compliance_reporting
      }
    ]

    render(<Navbar />, { wrapper })

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Organizations')).not.toBeInTheDocument() // Should not be present
    expect(screen.getByText('Transactions')).toBeInTheDocument()
    expect(screen.getByText('ComplianceReporting')).toBeInTheDocument()
    expect(screen.getByText('Organization')).toBeInTheDocument()
  })

  it('renders logout component', () => {
    render(<Navbar />, { wrapper })
    expect(screen.getByText('logout')).toBeInTheDocument() // Assuming Logout component has this text
  })

  describe('Initiative agreements tab visibility', () => {
    const mockNavUser = (roleNames: string[], isGovernmentUser: boolean) => {
      const userRoles = roleNames.map((name) => ({ name }))
      mockedUseCurrentUser.mockReturnValue({
        data: { isGovernmentUser, roles: userRoles },
        hasRoles: (role: string) => userRoles.some((r) => r.name === role),
        hasAnyRole: (...roleNames: string[]) =>
          roleNames.some((name) => userRoles.some((r) => r.name === name))
      })
    }

    it.each([
      ['Director', roles.director, true],
      ['IA Analyst', roles.ia_analyst, true],
      ['IA Manager', roles.ia_manager, true],
      ['IA Proponent (BCeID)', roles.ia_proponent, false]
    ])('shows tab for %s', (_, role, isGovernmentUser) => {
      mockNavUser([role], isGovernmentUser)
      render(<Navbar />, { wrapper })
      expect(screen.getByText('InitiativeAgreements')).toBeInTheDocument()
    })

    it.each([
      ['Analyst (IDIR)', roles.analyst, true],
      ['Compliance Reporting (BCeID)', roles.compliance_reporting, false]
    ])('hides tab for %s', (_, role, isGovernmentUser) => {
      mockNavUser([role], isGovernmentUser)
      render(<Navbar />, { wrapper })
      expect(screen.queryByText('InitiativeAgreements')).not.toBeInTheDocument()
    })
  })
})
