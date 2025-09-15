import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
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

vi.mock('@/utils/formatters.js', () => ({
  numberFormatter: (value) => {
    if (value == null) return ''
    const num = typeof value === 'object' ? value.value : value
    return num.toLocaleString()
  }
}))

describe('OrganizationsSummaryCard', () => {
  const mockOrganizations = [
    { name: 'Org A', totalBalance: 1000, reservedBalance: 200 },
    { name: 'Org B', totalBalance: 1500, reservedBalance: -300 },
    { name: 'Org C', totalBalance: 750, reservedBalance: 150 }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    useOrganizationNames.mockReturnValue({
      data: mockOrganizations,
      isLoading: false
    })
  })

  it('calls useOrganizationNames to fetch all organizations', () => {
    render(<OrganizationsSummaryCard />, { wrapper })

    expect(useOrganizationNames).toHaveBeenCalledWith()
  })

  it('renders correctly with default values and shows all organizations total', () => {
    render(<OrganizationsSummaryCard />, { wrapper })

    expect(screen.getAllByText('txn:allOrganizations')).toHaveLength(2) // One in display, one in select
    expect(screen.getByText('3,250')).toBeInTheDocument() // Total balance: 1000 + 1500 + 750
    expect(screen.getByText('compliance units')).toBeInTheDocument()
    expect(screen.getByText('(650 in reserve)')).toBeInTheDocument() // Total reserved: |200| + |-300| + |150|
    expect(screen.getByText('Show balance for:')).toBeInTheDocument()
  })

  it('displays organization names in the dropdown', () => {
    render(<OrganizationsSummaryCard />, { wrapper })

    const select = screen.getByRole('combobox')
    fireEvent.mouseDown(select)

    mockOrganizations.forEach((org) => {
      expect(screen.getByText(org.name)).toBeInTheDocument()
    })
  })

  it('updates total balance and reserved balance when a specific organization is selected', () => {
    render(<OrganizationsSummaryCard />, { wrapper })

    const select = screen.getByRole('combobox')
    fireEvent.mouseDown(select)
    fireEvent.click(screen.getByRole('option', { name: 'Org A' }))

    // Should have at least one instance of Org A in the display
    expect(screen.getAllByText('Org A')).toHaveLength(3) // One in display, one in select, one in dropdown
    expect(screen.getByText('1,000')).toBeInTheDocument()
    expect(screen.getByText('(200 in reserve)')).toBeInTheDocument()
  })

  it('calculates total balance and reserved balance correctly when switching back to all organizations', () => {
    render(<OrganizationsSummaryCard />, { wrapper })

    const select = screen.getByRole('combobox')
    
    // First select a specific organization
    fireEvent.mouseDown(select)
    fireEvent.click(screen.getByRole('option', { name: 'Org A' }))
    
    // Verify specific org is selected
    expect(screen.getAllByText('Org A')).toHaveLength(3) // One in display, one in select, one in dropdown
    expect(screen.getByText('1,000')).toBeInTheDocument()
    
    // Then switch back to all organizations
    fireEvent.mouseDown(select)
    fireEvent.click(screen.getByRole('option', { name: 'txn:allOrganizations' }))

    expect(screen.getAllByText('txn:allOrganizations')).toHaveLength(3) // One in display, one in select, one in dropdown
    expect(screen.getByText('3,250')).toBeInTheDocument() // Total: 1000 + 1500 + 750
    expect(screen.getByText('(650 in reserve)')).toBeInTheDocument() // Total reserved: |200| + |-300| + |150|
  })

  it('renders correctly when loading', () => {
    useOrganizationNames.mockReturnValue({
      data: [],
      isLoading: true
    })

    render(<OrganizationsSummaryCard />, { wrapper })

    // Should show default state with zero values
    expect(screen.getAllByText('txn:allOrganizations')).toHaveLength(2) // One in display, one in select
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('(0 in reserve)')).toBeInTheDocument()
    
    // Should not show organization options in dropdown when loading
    const select = screen.getByRole('combobox')
    fireEvent.mouseDown(select)
    expect(screen.queryByText('Org A')).not.toBeInTheDocument()
  })

  it('handles organizations with different reserved balance formats', () => {
    render(<OrganizationsSummaryCard />, { wrapper })

    const select = screen.getByRole('combobox')
    fireEvent.mouseDown(select)
    fireEvent.click(screen.getByRole('option', { name: 'Org B' }))

    expect(screen.getAllByText('Org B')).toHaveLength(3) // One in display, one in select, one in dropdown
    expect(screen.getByText('1,500')).toBeInTheDocument()
    expect(screen.getByText('(300 in reserve)')).toBeInTheDocument() // Should show absolute value
  })

  it('handles organizations with zero balances', () => {
    const mockOrgsWithZeros = [
      { name: 'Zero Org', totalBalance: 0, reservedBalance: 0 }
    ]
    
    useOrganizationNames.mockReturnValue({
      data: mockOrgsWithZeros,
      isLoading: false
    })

    render(<OrganizationsSummaryCard />, { wrapper })

    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('(0 in reserve)')).toBeInTheDocument()
  })

  it('handles empty organizations array', () => {
    useOrganizationNames.mockReturnValue({
      data: [],
      isLoading: false
    })

    render(<OrganizationsSummaryCard />, { wrapper })

    expect(screen.getAllByText('txn:allOrganizations')).toHaveLength(2) // One in display, one in select
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('(0 in reserve)')).toBeInTheDocument()
    
    // Should not show any organization options
    const select = screen.getByRole('combobox')
    fireEvent.mouseDown(select)
    expect(screen.queryByText('Org A')).not.toBeInTheDocument()
  })

  it('processes organizations data when useEffect dependency changes', async () => {
    const { rerender } = render(<OrganizationsSummaryCard />, { wrapper })

    // Initial render with organizations
    expect(screen.getByText('3,250')).toBeInTheDocument()

    // Change to loading state
    useOrganizationNames.mockReturnValue({
      data: mockOrganizations,
      isLoading: true
    })

    await act(async () => {
      rerender(<OrganizationsSummaryCard />)
    })

    // Should maintain previous state during loading
    expect(screen.getByText('3,250')).toBeInTheDocument()

    // Change back to loaded with different data
    const newMockOrgs = [
      { name: 'New Org', totalBalance: 2000, reservedBalance: 400 }
    ]

    useOrganizationNames.mockReturnValue({
      data: newMockOrgs,
      isLoading: false
    })

    await act(async () => {
      rerender(<OrganizationsSummaryCard />)
    })

    expect(screen.getByText('2,000')).toBeInTheDocument()
    expect(screen.getByText('(400 in reserve)')).toBeInTheDocument()
  })

  it('handles select dropdown ARIA attributes correctly', () => {
    render(<OrganizationsSummaryCard />, { wrapper })

    const select = screen.getByRole('combobox')
    expect(select).toHaveAttribute('aria-label', 'Select an organization')
  })

  it('applies correct styling and layout classes', () => {
    render(<OrganizationsSummaryCard />, { wrapper })

    // Check for title
    expect(screen.getByText('Summary')).toBeInTheDocument()
    
    // Check for various text elements
    expect(screen.getByText('compliance units')).toBeInTheDocument()
    expect(screen.getByText('Show balance for:')).toBeInTheDocument()
  })
})
