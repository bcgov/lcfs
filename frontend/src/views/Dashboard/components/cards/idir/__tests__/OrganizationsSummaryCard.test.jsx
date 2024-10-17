import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import OrganizationsSummaryCard from '../OrganizationsSummaryCard'
import { vi } from 'vitest'
import { useOrganizationNames } from '@/hooks/useOrganizations'

vi.mock('@/hooks/useOrganizations')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

describe('OrganizationsSummaryCards', () => {
  const mockOrganizations = [
    { name: 'Org A', totalBalance: 1000, reservedBalance: 200 },
    { name: 'Org B', totalBalance: 1500, reservedBalance: 300 }
  ]

  beforeEach(() => {
    useOrganizationNames.mockReturnValue({
      data: mockOrganizations,
      isLoading: false
    })
  })

  test('renders correctly with default values', () => {
    render(<OrganizationsSummaryCard />)
    // render(<OrganizationsSummaryCard />, { wrapper }) Uncomment to see test freeze

    expect(screen.getByText('All organizations')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument() // Initial total balance
    expect(screen.getByText('compliance units')).toBeInTheDocument()
    expect(screen.getByText('(0 in reserve)')).toBeInTheDocument() // Initial reserved balance
  })

  test('displays organization names in the dropdown', () => {
    render(<OrganizationsSummaryCard />)
    // render(<OrganizationsSummaryCard />, { wrapper })

    const select = screen.getByRole('button', { name: /Show balance for:/i })
    fireEvent.mouseDown(select)

    mockOrganizations.forEach((org) => {
      expect(screen.getByText(org.name)).toBeInTheDocument()
    })
  })

  test('updates total balance and reserved balance when an organization is selected', () => {
    render(<OrganizationsSummaryCard />)
    // render(<OrganizationsSummaryCard />, { wrapper }) Uncomment to see test freeze

    const select = screen.getByRole('button', { name: /Show balance for:/i })
    fireEvent.mouseDown(select)
    fireEvent.click(screen.getByText('Org A')) // Select Org A

    expect(screen.getByText('1,000')).toBeInTheDocument() // Total balance for Org A
    expect(screen.getByText('(200 in reserve)')).toBeInTheDocument() // Reserved balance for Org A
  })

  test('calculates total balance and reserved balance correctly for all organizations', () => {
    render(<OrganizationsSummaryCard />)
    // render(<OrganizationsSummaryCard />, { wrapper }) Uncomment to see test freeze

    const select = screen.getByRole('button', { name: /Show balance for:/i })
    fireEvent.mouseDown(select)
    fireEvent.click(screen.getByText('All organizations')) // Select All organizations

    const totalBalance = mockOrganizations.reduce(
      (total, org) => total + org.totalBalance,
      0
    )
    const totalReserved = mockOrganizations.reduce(
      (total, org) => total + org.reservedBalance,
      0
    )

    expect(screen.getByText(totalBalance.toLocaleString())).toBeInTheDocument() // Total balance for all organizations
    expect(
      screen.getByText(`(${totalReserved.toLocaleString()} in reserve)`)
    ).toBeInTheDocument() // Total reserved balance for all organizations
  })
})
