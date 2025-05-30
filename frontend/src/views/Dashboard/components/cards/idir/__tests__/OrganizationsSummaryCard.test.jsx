import { render, screen, fireEvent } from '@testing-library/react'
import OrganizationsSummaryCard from '../OrganizationsSummaryCard'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useOrganizationNames } from '@/hooks/useOrganizations'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('@/hooks/useOrganizations')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

describe('OrganizationsSummaryCards', () => {
  const mockOrganizations = [
    {
      name: 'Org A',
      totalBalance: 1000,
      reservedBalance: 200,
      orgStatus: { status: 'Registered' }
    },
    {
      name: 'Org B',
      totalBalance: 1500,
      reservedBalance: 300,
      orgStatus: { status: 'Registered' }
    },
    {
      name: 'Org C',
      totalBalance: 800,
      reservedBalance: 100,
      orgStatus: { status: 'Unregistered' }
    }
  ]

  beforeEach(() => {
    useOrganizationNames.mockReturnValue({
      data: mockOrganizations,
      isLoading: false
    })
  })

  it('calls useOrganizationNames with correct statuses for dashboard', () => {
    render(<OrganizationsSummaryCard />, { wrapper })

    expect(useOrganizationNames).toHaveBeenCalledWith([
      'Registered',
      'Unregistered'
    ])
  })

  it('renders correctly with default values', () => {
    render(<OrganizationsSummaryCard />, { wrapper })

    expect(screen.getByText('2,500')).toBeInTheDocument() // Total balance of registered orgs only (1000 + 1500)
    expect(screen.getByText('compliance units')).toBeInTheDocument()
    expect(screen.getByText('(500 in reserve)')).toBeInTheDocument() // Reserved balance of registered orgs only (200 + 300)
  })

  it('displays organization names in the dropdown', () => {
    render(<OrganizationsSummaryCard />, { wrapper })

    const select = screen.getByRole('combobox')
    fireEvent.mouseDown(select)

    mockOrganizations.forEach((org) => {
      expect(screen.getByText(org.name)).toBeInTheDocument()
    })
  })

  it('updates total balance and reserved balance when an organization is selected', () => {
    render(<OrganizationsSummaryCard />, { wrapper })

    const select = screen.getByRole('combobox')
    fireEvent.mouseDown(select)
    fireEvent.click(screen.getByRole('option', { name: 'Org A' })) // Select All organizations

    expect(screen.getByText('1,000')).toBeInTheDocument() // Total balance for Org A
    expect(screen.getByText('(200 in reserve)')).toBeInTheDocument() // Reserved balance for Org A
  })

  it('calculates total balance and reserved balance correctly for all organizations', () => {
    render(<OrganizationsSummaryCard />, { wrapper })

    const select = screen.getByRole('combobox')
    fireEvent.mouseDown(select)
    fireEvent.click(
      screen.getByRole('option', { name: 'txn:allOrganizations' })
    ) // Select All organizations

    // Only registered organizations should be included in totals (Org A + Org B, not Org C)
    const registeredOrgs = mockOrganizations.filter(
      (org) => org.orgStatus?.status === 'Registered'
    )
    const totalBalance = registeredOrgs.reduce(
      (total, org) => total + org.totalBalance,
      0
    )
    const totalReserved = registeredOrgs.reduce(
      (total, org) => total + org.reservedBalance,
      0
    )

    expect(screen.getByText(totalBalance.toLocaleString())).toBeInTheDocument() // Total balance for registered organizations only
    expect(
      screen.getByText(`(${totalReserved.toLocaleString()} in reserve)`)
    ).toBeInTheDocument() // Total reserved balance for registered organizations only
  })
})
