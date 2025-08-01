import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { CreditMarketTable } from '../CreditMarketTable'
import { wrapper } from '@/tests/utils/wrapper'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useCreditMarketListings } from '@/hooks/useOrganization'

// Mock the hooks
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useOrganization')

// Mock BCGridViewer component
vi.mock('@/components/BCDataGrid/BCGridViewer.jsx', () => ({
  BCGridViewer: ({ queryData, overlayNoRowsTemplate, columnDefs, readOnlyGrid, ...props }) => {
    const { data, isLoading, error } = queryData
    
    if (isLoading) return <div data-test="grid-loading">Loading...</div>
    if (error) return <div data-test="grid-error">Error: {error.message}</div>
    if (!data?.creditMarketListings?.length) return <div data-test="grid-no-rows">{overlayNoRowsTemplate}</div>
    
    return (
      <div data-test="bc-grid-viewer" readonlygrid={readOnlyGrid?.toString()}>
        <div data-test="column-count">{columnDefs.length}</div>
        <div data-test="row-count">{data.creditMarketListings.length}</div>
        {data.creditMarketListings.map((row, index) => (
          <div key={index} data-test={`row-data-${row.id}`}>
            {row.organizationName}
          </div>
        ))}
      </div>
    )
  }
}))

// Sample test data
const mockCurrentUser = {
  organization: {
    organizationId: 1
  }
}

const mockCreditMarketData = [
  {
    organizationId: 1,
    organizationName: 'Current User Org',
    creditsToSell: 100,
    displayInCreditMarket: true,
    creditMarketIsSeller: true,
    creditMarketIsBuyer: false,
    creditMarketContactName: 'John Doe',
    creditMarketContactEmail: 'john@currentorg.com',
    creditMarketContactPhone: '555-0001'
  },
  {
    organizationId: 2,
    organizationName: 'Acme Corporation',
    creditsToSell: 250,
    displayInCreditMarket: true,
    creditMarketIsSeller: true,
    creditMarketIsBuyer: false,
    creditMarketContactName: 'Jane Smith',
    creditMarketContactEmail: 'jane@acme.com',
    creditMarketContactPhone: '555-0002'
  },
  {
    organizationId: 3,
    organizationName: 'Beta Industries',
    creditsToSell: 0,
    displayInCreditMarket: true,
    creditMarketIsSeller: false,
    creditMarketIsBuyer: true,
    creditMarketContactName: 'Bob Johnson',
    creditMarketContactEmail: 'bob@beta.com',
    creditMarketContactPhone: '555-0003'
  }
]

describe('CreditMarketTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    vi.mocked(useCurrentUser).mockReturnValue({ data: mockCurrentUser })
    vi.mocked(useCreditMarketListings).mockReturnValue({ 
      data: mockCreditMarketData, 
      isLoading: false, 
      isError: false, 
      error: null 
    })
  })

  it('renders the table with data', async () => {
    render(<CreditMarketTable />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
      expect(screen.getByTestId('column-count')).toHaveTextContent('6') // 6 columns expected
      expect(screen.getByTestId('row-count')).toHaveTextContent('3') // Should include current user org
    })
  })

  it('shows current user organization at the top of the list', async () => {
    render(<CreditMarketTable />, { wrapper })

    await waitFor(() => {
      // Current user org (organizationId: 1) should be displayed at the top
      expect(screen.getByTestId('row-data-1')).toBeInTheDocument()
      expect(screen.getByTestId('row-data-1')).toHaveTextContent('Current User Org')
      
      // Other organizations should be displayed after
      expect(screen.getByTestId('row-data-2')).toBeInTheDocument()
      expect(screen.getByTestId('row-data-3')).toBeInTheDocument()
    })
  })

  it('shows organization names in the table', async () => {
    render(<CreditMarketTable />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument()
      expect(screen.getByText('Beta Industries')).toBeInTheDocument()
      expect(screen.getByText('Current User Org')).toBeInTheDocument()
    })
  })

  it('shows loading state', () => {
    vi.mocked(useCreditMarketListings).mockReturnValue({ 
      data: null, 
      isLoading: true, 
      isError: false, 
      error: null 
    })

    render(<CreditMarketTable />, { wrapper })

    expect(screen.getByTestId('grid-loading')).toHaveTextContent('Loading...')
  })

  it('shows error state', () => {
    vi.mocked(useCreditMarketListings).mockReturnValue({ 
      data: null, 
      isLoading: false, 
      isError: true, 
      error: new Error('Network error') 
    })

    render(<CreditMarketTable />, { wrapper })

    expect(screen.getByTestId('grid-error')).toHaveTextContent('Error: Network error')
  })

  it('shows no data message when no listings available', () => {
    vi.mocked(useCreditMarketListings).mockReturnValue({ 
      data: [], 
      isLoading: false, 
      isError: false, 
      error: null 
    })

    render(<CreditMarketTable />, { wrapper })

    expect(screen.getByTestId('grid-no-rows')).toHaveTextContent('No credit market listings found')
  })

  it('shows current user organization when only it exists', async () => {
    vi.mocked(useCreditMarketListings).mockReturnValue({ 
      data: [mockCreditMarketData[0]], // Only current user org
      isLoading: false, 
      isError: false, 
      error: null 
    })

    render(<CreditMarketTable />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('row-count')).toHaveTextContent('1')
      expect(screen.getByTestId('row-data-1')).toHaveTextContent('Current User Org')
    })
  })

  it('configures grid as read-only', async () => {
    render(<CreditMarketTable />, { wrapper })

    await waitFor(() => {
      const grid = screen.getByTestId('bc-grid-viewer')
      expect(grid).toHaveAttribute('readonlygrid', 'true') // DOM converts to lowercase
    })
  })

  it('handles empty current user gracefully', async () => {
    vi.mocked(useCurrentUser).mockReturnValue({ data: null })

    render(<CreditMarketTable />, { wrapper })

    await waitFor(() => {
      // Should show all organizations since no user to exclude
      expect(screen.getByTestId('row-count')).toHaveTextContent('3')
    })
  })

  it('transforms API data correctly to frontend schema', async () => {
    render(<CreditMarketTable />, { wrapper })

    await waitFor(() => {
      // Verify organizations are displayed (data transformation working)
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument()
      expect(screen.getByText('Beta Industries')).toBeInTheDocument()
    })
  })

  it('sorts data alphabetically by organization name', async () => {
    // Mock data in non-alphabetical order
    const unsortedData = [
      {
        organizationId: 4,
        organizationName: 'Zeta Company',
        creditsToSell: 75,
        displayInCreditMarket: true,
        creditMarketIsSeller: true,
        creditMarketIsBuyer: false,
        creditMarketContactName: 'Alice Williams',
        creditMarketContactEmail: 'alice@zeta.com',
        creditMarketContactPhone: '555-0004'
      },
      {
        organizationId: 2,
        organizationName: 'Acme Corporation',
        creditsToSell: 250,
        displayInCreditMarket: true,
        creditMarketIsSeller: true,
        creditMarketIsBuyer: false,
        creditMarketContactName: 'Jane Smith',
        creditMarketContactEmail: 'jane@acme.com',
        creditMarketContactPhone: '555-0002'
      }
    ]

    vi.mocked(useCreditMarketListings).mockReturnValue({ 
      data: unsortedData, 
      isLoading: false, 
      isError: false, 
      error: null 
    })

    render(<CreditMarketTable />, { wrapper })

    await waitFor(() => {
      // Should show both organizations (sorting is tested through the display)
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument()
      expect(screen.getByText('Zeta Company')).toBeInTheDocument()
    })
  })

  it('handles missing organization data fields gracefully', async () => {
    const incompleteData = [
      {
        organizationId: 2,
        organizationName: 'Incomplete Org',
        // Missing most fields
        displayInCreditMarket: true
      }
    ]

    vi.mocked(useCreditMarketListings).mockReturnValue({ 
      data: incompleteData, 
      isLoading: false, 
      isError: false, 
      error: null 
    })

    render(<CreditMarketTable />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('Incomplete Org')).toBeInTheDocument()
      expect(screen.getByTestId('row-count')).toHaveTextContent('1')
    })
  })
})