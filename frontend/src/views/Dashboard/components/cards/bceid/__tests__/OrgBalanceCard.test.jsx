import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import OrgBalanceCard from '../OrgBalanceCard'

vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useOrganization')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        'dashboard:orgBalance.loading': 'Loading balance...',
        'dashboard:orgBalance.unableToFetchBalanceDetails': 'Unable to fetch balance details',
        'dashboard:orgBalance.org': 'Organization',
        'dashboard:orgBalance.hasABalanceOf': 'has a balance of',
        'dashboard:orgBalance.complianceUnits': 'Compliance Units',
        'dashboard:orgBalance.inReserve': 'in reserve',
        'dashboard:orgBalance.inReserveTooltip': 'Credits held in reserve for compliance'
      }
      return translations[key] || key
    }
  })
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }) => <div data-test="bc-typography" {...props}>{children}</div>
}))

vi.mock('@/components/Loading', () => ({
  default: ({ message }) => <div data-test="loading">{message}</div>
}))

vi.mock('@mui/material', () => ({
  Box: ({ children, ...props }) => <div data-test="box" {...props}>{children}</div>,
  Tooltip: ({ children, title }) => <div data-test="tooltip" title={title}>{children}</div>,
  Fade: () => <div data-test="fade" />
}))

vi.mock('@mui/icons-material', () => ({
  Info: () => <div data-test="info-icon" />
}))

describe('OrgBalanceCard', () => {
  let useCurrentUser, useCurrentOrgBalance

  beforeAll(async () => {
    const userModule = await import('@/hooks/useCurrentUser')
    const orgModule = await import('@/hooks/useOrganization')
    useCurrentUser = userModule.useCurrentUser
    useCurrentOrgBalance = orgModule.useCurrentOrgBalance
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays loading state when user is loading', () => {
    useCurrentUser.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false
    })
    useCurrentOrgBalance.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false
    })

    render(<OrgBalanceCard />)
    
    expect(screen.getByText('Loading balance...')).toBeInTheDocument()
  })

  it('displays loading state when balance is loading', () => {
    useCurrentUser.mockReturnValue({
      data: { organization: { name: 'Test Org' } },
      isLoading: false,
      isError: false
    })
    useCurrentOrgBalance.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false
    })

    render(<OrgBalanceCard />)
    
    expect(screen.getByText('Loading balance...')).toBeInTheDocument()
  })

  it('displays error message when user fetch fails', () => {
    useCurrentUser.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true
    })
    useCurrentOrgBalance.mockReturnValue({
      data: { totalBalance: 1000, reservedBalance: 100 },
      isLoading: false,
      isError: false
    })

    render(<OrgBalanceCard />)
    
    expect(screen.getByText('Unable to fetch balance details')).toBeInTheDocument()
  })

  it('displays error message when balance fetch fails', () => {
    useCurrentUser.mockReturnValue({
      data: { organization: { name: 'Test Org' } },
      isLoading: false,
      isError: false
    })
    useCurrentOrgBalance.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true
    })

    render(<OrgBalanceCard />)
    
    expect(screen.getByText('Unable to fetch balance details')).toBeInTheDocument()
  })

  it('displays error message when balance data is missing', () => {
    useCurrentUser.mockReturnValue({
      data: { organization: { name: 'Test Org' } },
      isLoading: false,
      isError: false
    })
    useCurrentOrgBalance.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false
    })

    render(<OrgBalanceCard />)
    
    expect(screen.getByText('Unable to fetch balance details')).toBeInTheDocument()
  })

  it('displays organization balance with organization name', () => {
    useCurrentUser.mockReturnValue({
      data: { organization: { name: 'Test Organization' } },
      isLoading: false,
      isError: false
    })
    useCurrentOrgBalance.mockReturnValue({
      data: { totalBalance: 1500, reservedBalance: 200 },
      isLoading: false,
      isError: false
    })

    render(<OrgBalanceCard />)
    
    expect(screen.getByText('Test Organization')).toBeInTheDocument()
    expect(screen.getByText('has a balance of')).toBeInTheDocument()
    expect(screen.getByText('1,500')).toBeInTheDocument()
    expect(screen.getByText('Compliance Units')).toBeInTheDocument()
    expect(screen.getByText('(200 in reserve)')).toBeInTheDocument()
  })

  it('displays fallback organization name when organization name is missing', () => {
    useCurrentUser.mockReturnValue({
      data: { organization: null },
      isLoading: false,
      isError: false
    })
    useCurrentOrgBalance.mockReturnValue({
      data: { totalBalance: 500, reservedBalance: 50 },
      isLoading: false,
      isError: false
    })

    render(<OrgBalanceCard />)
    
    expect(screen.getByText('Organization')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
    expect(screen.getByText('(50 in reserve)')).toBeInTheDocument()
  })

  it('converts negative reserved balance to positive using Math.abs', () => {
    useCurrentUser.mockReturnValue({
      data: { organization: { name: 'Test Org' } },
      isLoading: false,
      isError: false
    })
    useCurrentOrgBalance.mockReturnValue({
      data: { totalBalance: 1000, reservedBalance: -150 },
      isLoading: false,
      isError: false
    })

    render(<OrgBalanceCard />)
    
    expect(screen.getByText('(150 in reserve)')).toBeInTheDocument()
  })

  it('formats large numbers with locale string', () => {
    useCurrentUser.mockReturnValue({
      data: { organization: { name: 'Test Org' } },
      isLoading: false,
      isError: false
    })
    useCurrentOrgBalance.mockReturnValue({
      data: { totalBalance: 1234567, reservedBalance: 12345 },
      isLoading: false,
      isError: false
    })

    render(<OrgBalanceCard />)
    
    expect(screen.getByText('1,234,567')).toBeInTheDocument()
    expect(screen.getByText('(12,345 in reserve)')).toBeInTheDocument()
  })

  it('renders tooltip with correct title', () => {
    useCurrentUser.mockReturnValue({
      data: { organization: { name: 'Test Org' } },
      isLoading: false,
      isError: false
    })
    useCurrentOrgBalance.mockReturnValue({
      data: { totalBalance: 1000, reservedBalance: 100 },
      isLoading: false,
      isError: false
    })

    render(<OrgBalanceCard />)
    
    expect(screen.getByTitle('Credits held in reserve for compliance')).toBeInTheDocument()
  })

  it('renders info icon', () => {
    useCurrentUser.mockReturnValue({
      data: { organization: { name: 'Test Org' } },
      isLoading: false,
      isError: false
    })
    useCurrentOrgBalance.mockReturnValue({
      data: { totalBalance: 1000, reservedBalance: 100 },
      isLoading: false,
      isError: false
    })

    render(<OrgBalanceCard />)
    
    expect(screen.getByTestId('info-icon')).toBeInTheDocument()
  })
})