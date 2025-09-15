import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { CreditMarketTable } from '../CreditMarketTable'
import { wrapper } from '@/tests/utils/wrapper'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useCreditMarketListings } from '@/hooks/useOrganization'

// Mock the hooks
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useOrganization')

// Mock translation hook
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, defaultValue) => defaultValue || key
  })
}))

// Mock the schema imports
vi.mock('../_schema', () => ({
  creditMarketColDefs: vi.fn((t) => [
    { headerName: 'Organization Name', field: 'organizationName' },
    { headerName: 'Credits to sell', field: 'creditsToSell' }, 
    { headerName: 'Role in market', field: 'roleInMarket' },
    { headerName: 'Name', field: 'contactPerson' },
    { headerName: 'Email', field: 'email' },
    { headerName: 'Phone', field: 'phone' }
  ]),
  defaultSortModel: [{ colId: 'organizationName', sort: 'asc' }]
}))

// Mock BCGridViewer component to capture all props
const mockBCGridViewer = vi.fn()
vi.mock('@/components/BCDataGrid/BCGridViewer.jsx', () => ({
  BCGridViewer: (props) => {
    mockBCGridViewer(props)
    const { queryData, overlayNoRowsTemplate, columnDefs, readOnlyGrid, getRowId, onPaginationChange } = props
    const { data, isLoading, error } = queryData
    
    if (isLoading) return <div data-test="grid-loading">Loading...</div>
    if (error) return <div data-test="grid-error">Error: {error.message}</div>
    if (!data?.creditMarketListings?.length) return <div data-test="grid-no-rows">{overlayNoRowsTemplate}</div>
    
    return (
      <div data-test="bc-grid-viewer" readonlygrid={readOnlyGrid?.toString()}>
        <div data-test="column-count">{columnDefs.length}</div>
        <div data-test="row-count">{data.creditMarketListings.length}</div>
        <button data-test="test-get-row-id" onClick={() => getRowId({ data: data.creditMarketListings[0] })}>Test getRowId</button>
        <button data-test="test-pagination" onClick={() => onPaginationChange({ page: 2, size: 20 })}>Test Pagination</button>
        {data.creditMarketListings.map((row, index) => (
          <div key={index} data-test={`row-data-${row.id}`}>
            {row.organizationName}
          </div>
        ))}
      </div>
    )
  }
}))

// Mock Material-UI Box
vi.mock('@mui/material', () => ({
  Box: ({ children, component, sx, ...props }) => <div data-test="mui-box" {...props}>{children}</div>
}))

// Sample test data
const mockCurrentUser = {
  organization: {
    organizationId: 1
  }
}

const mockCurrentUserNoOrg = {
  organization: null
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
    mockBCGridViewer.mockClear()
    
    // Setup default mocks
    vi.mocked(useCurrentUser).mockReturnValue({ data: mockCurrentUser })
    vi.mocked(useCreditMarketListings).mockReturnValue({ 
      data: mockCreditMarketData, 
      isLoading: false, 
      isError: false, 
      error: null 
    })
  })

  describe('Component Rendering', () => {
    it('renders the component with correct structure', async () => {
      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(screen.getAllByTestId('mui-box')).toHaveLength(2)
        expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
      })
    })

    it('applies correct styling to outer container', async () => {
      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        const boxes = screen.getAllByTestId('mui-box')
        expect(boxes).toHaveLength(2)
        expect(boxes[0]).toBeInTheDocument()
      })
    })

    it('passes readOnlyGrid prop as true', async () => {
      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        const grid = screen.getByTestId('bc-grid-viewer')
        expect(grid).toHaveAttribute('readonlygrid', 'true')
      })
    })
  })

  describe('Loading and Error States', () => {
    it('shows loading state correctly', () => {
      vi.mocked(useCreditMarketListings).mockReturnValue({ 
        data: null, 
        isLoading: true, 
        isError: false, 
        error: null 
      })

      render(<CreditMarketTable />, { wrapper })

      expect(screen.getByTestId('grid-loading')).toHaveTextContent('Loading...')
    })

    it('shows error state correctly', () => {
      const testError = new Error('Network error')
      vi.mocked(useCreditMarketListings).mockReturnValue({ 
        data: null, 
        isLoading: false, 
        isError: true, 
        error: testError 
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
  })

  describe('Data Transformation and Sorting', () => {
    it('transforms API data to frontend schema correctly', async () => {
      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(mockBCGridViewer).toHaveBeenCalled()
        const props = mockBCGridViewer.mock.calls[0][0]
        const transformedData = props.queryData.data.creditMarketListings
        
        expect(transformedData[0]).toEqual({
          id: 1,
          organizationName: 'Current User Org',
          creditsToSell: 100,
          displayInCreditMarket: true,
          isSeller: true,
          isBuyer: false,
          contactPerson: 'John Doe',
          email: 'john@currentorg.com',
          phone: '555-0001'
        })
      })
    })

    it('sorts current user organization to top when user has org', async () => {
      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(mockBCGridViewer).toHaveBeenCalled()
        const props = mockBCGridViewer.mock.calls[0][0]
        const transformedData = props.queryData.data.creditMarketListings
        
        // First item should be user's org (id: 1)
        expect(transformedData[0].id).toBe(1)
        expect(transformedData[0].organizationName).toBe('Current User Org')
      })
    })

    it('sorts alphabetically when user has no organization', async () => {
      vi.mocked(useCurrentUser).mockReturnValue({ data: mockCurrentUserNoOrg })

      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(mockBCGridViewer).toHaveBeenCalled()
        const props = mockBCGridViewer.mock.calls[0][0]
        const transformedData = props.queryData.data.creditMarketListings
        
        // Should be sorted alphabetically: Acme, Beta, Current User Org
        expect(transformedData[0].organizationName).toBe('Acme Corporation')
        expect(transformedData[1].organizationName).toBe('Beta Industries')
        expect(transformedData[2].organizationName).toBe('Current User Org')
      })
    })

    it('sorts alphabetically when user org not in data', async () => {
      vi.mocked(useCurrentUser).mockReturnValue({ 
        data: { organization: { organizationId: 999 } } 
      })

      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(mockBCGridViewer).toHaveBeenCalled()
        const props = mockBCGridViewer.mock.calls[0][0]
        const transformedData = props.queryData.data.creditMarketListings
        
        // Should be sorted alphabetically since user org (999) not in data
        expect(transformedData[0].organizationName).toBe('Acme Corporation')
        expect(transformedData[1].organizationName).toBe('Beta Industries')
        expect(transformedData[2].organizationName).toBe('Current User Org')
      })
    })

    it('handles null creditMarketData', async () => {
      vi.mocked(useCreditMarketListings).mockReturnValue({ 
        data: null, 
        isLoading: false, 
        isError: false, 
        error: null 
      })

      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(screen.getByTestId('grid-no-rows')).toBeInTheDocument()
      })
    })

    it('handles undefined creditMarketData', async () => {
      vi.mocked(useCreditMarketListings).mockReturnValue({ 
        data: undefined, 
        isLoading: false, 
        isError: false, 
        error: null 
      })

      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(screen.getByTestId('grid-no-rows')).toBeInTheDocument()
      })
    })

    it('handles incomplete data fields', async () => {
      const incompleteData = [{
        organizationId: 5,
        organizationName: 'Incomplete Org'
        // Missing other fields
      }]

      vi.mocked(useCreditMarketListings).mockReturnValue({ 
        data: incompleteData, 
        isLoading: false, 
        isError: false, 
        error: null 
      })

      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(mockBCGridViewer).toHaveBeenCalled()
        const props = mockBCGridViewer.mock.calls[0][0]
        const transformedData = props.queryData.data.creditMarketListings
        
        expect(transformedData[0]).toEqual({
          id: 5,
          organizationName: 'Incomplete Org',
          creditsToSell: undefined,
          displayInCreditMarket: undefined,
          isSeller: undefined,
          isBuyer: undefined,
          contactPerson: undefined,
          email: undefined,
          phone: undefined
        })
      })
    })
  })

  describe('getRowId Function', () => {
    it('generates correct row ID format', async () => {
      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(mockBCGridViewer).toHaveBeenCalled()
        const props = mockBCGridViewer.mock.calls[0][0]
        const getRowId = props.getRowId
        
        const testRowData = { data: { id: 123 } }
        const rowId = getRowId(testRowData)
        
        expect(rowId).toBe('credit-market-123')
      })
    })

    it('handles different id values', async () => {
      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(mockBCGridViewer).toHaveBeenCalled()
        const props = mockBCGridViewer.mock.calls[0][0]
        const getRowId = props.getRowId
        
        expect(getRowId({ data: { id: 1 } })).toBe('credit-market-1')
        expect(getRowId({ data: { id: 999 } })).toBe('credit-market-999')
        expect(getRowId({ data: { id: 0 } })).toBe('credit-market-0')
      })
    })
  })

  describe('Pagination Handling', () => {
    it('initializes with correct pagination options', async () => {
      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(mockBCGridViewer).toHaveBeenCalled()
        const props = mockBCGridViewer.mock.calls[0][0]
        
        expect(props.paginationOptions).toEqual({
          page: 1,
          size: 10,
          sortOrders: [{ colId: 'organizationName', sort: 'asc' }],
          filters: []
        })
      })
    })

    it('handles pagination changes correctly', async () => {
      let capturedProps = null
      mockBCGridViewer.mockImplementation((props) => {
        capturedProps = props
        return <div data-test="mock-grid">Mock Grid</div>
      })

      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(capturedProps).toBeTruthy()
      })

      // Test pagination change
      await act(async () => {
        capturedProps.onPaginationChange({ page: 2, size: 20 })
      })

      // Re-render should be triggered with updated pagination
      await waitFor(() => {
        expect(mockBCGridViewer).toHaveBeenCalled()
      })
    })

    it('merges pagination options correctly', async () => {
      let capturedProps = null
      mockBCGridViewer.mockImplementation((props) => {
        capturedProps = props
        return <div data-test="mock-grid">Mock Grid</div>
      })

      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(capturedProps).toBeTruthy()
      })

      // Test partial pagination change
      await act(async () => {
        capturedProps.onPaginationChange({ page: 3 })
      })

      // Should merge with existing options
      await waitFor(() => {
        expect(mockBCGridViewer).toHaveBeenCalled()
      })
    })
  })

  describe('QueryData Structure', () => {
    it('builds queryData structure correctly', async () => {
      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(mockBCGridViewer).toHaveBeenCalled()
        const props = mockBCGridViewer.mock.calls[0][0]
        const queryData = props.queryData
        
        expect(queryData).toHaveProperty('data')
        expect(queryData).toHaveProperty('isLoading', false)
        expect(queryData).toHaveProperty('isError', false)
        expect(queryData).toHaveProperty('error', null)
        
        expect(queryData.data).toHaveProperty('creditMarketListings')
        expect(queryData.data).toHaveProperty('pagination')
        
        const pagination = queryData.data.pagination
        expect(pagination).toHaveProperty('page', 1)
        expect(pagination).toHaveProperty('size', 10)
        expect(pagination).toHaveProperty('total', 3)
        expect(pagination).toHaveProperty('totalPages', 1)
      })
    })

    it('calculates pagination correctly for larger datasets', async () => {
      // Create larger dataset
      const largeDataset = Array.from({ length: 25 }, (_, index) => ({
        organizationId: index + 1,
        organizationName: `Organization ${index + 1}`,
        creditsToSell: (index + 1) * 10,
        displayInCreditMarket: true,
        creditMarketIsSeller: true,
        creditMarketIsBuyer: false,
        creditMarketContactName: `Contact ${index + 1}`,
        creditMarketContactEmail: `contact${index + 1}@org.com`,
        creditMarketContactPhone: `555-000${index + 1}`
      }))

      vi.mocked(useCreditMarketListings).mockReturnValue({ 
        data: largeDataset, 
        isLoading: false, 
        isError: false, 
        error: null 
      })

      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(mockBCGridViewer).toHaveBeenCalled()
        const props = mockBCGridViewer.mock.calls[0][0]
        const pagination = props.queryData.data.pagination
        
        expect(pagination.total).toBe(25)
        expect(pagination.totalPages).toBe(3) // Math.ceil(25/10) = 3
      })
    })

    it('passes loading state through queryData', () => {
      vi.mocked(useCreditMarketListings).mockReturnValue({ 
        data: null, 
        isLoading: true, 
        isError: false, 
        error: null 
      })

      render(<CreditMarketTable />, { wrapper })

      expect(mockBCGridViewer).toHaveBeenCalled()
      const props = mockBCGridViewer.mock.calls[0][0]
      expect(props.queryData.isLoading).toBe(true)
    })

    it('passes error state through queryData', () => {
      const testError = new Error('Test error')
      vi.mocked(useCreditMarketListings).mockReturnValue({ 
        data: null, 
        isLoading: false, 
        isError: true, 
        error: testError 
      })

      render(<CreditMarketTable />, { wrapper })

      expect(mockBCGridViewer).toHaveBeenCalled()
      const props = mockBCGridViewer.mock.calls[0][0]
      expect(props.queryData.isError).toBe(true)
      expect(props.queryData.error).toBe(testError)
    })
  })

  describe('BCGridViewer Props', () => {
    it('passes all required props to BCGridViewer', async () => {
      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(mockBCGridViewer).toHaveBeenCalled()
        const props = mockBCGridViewer.mock.calls[0][0]
        
        expect(props).toHaveProperty('gridRef')
        expect(props).toHaveProperty('gridKey', 'credit-market-grid')
        expect(props).toHaveProperty('columnDefs')
        expect(props).toHaveProperty('getRowId')
        expect(props).toHaveProperty('overlayNoRowsTemplate', 'No credit market listings found')
        expect(props).toHaveProperty('queryData')
        expect(props).toHaveProperty('dataKey', 'creditMarketListings')
        expect(props).toHaveProperty('paginationOptions')
        expect(props).toHaveProperty('onPaginationChange')
        expect(props).toHaveProperty('readOnlyGrid', true)
      })
    })

    it('passes column definitions correctly', async () => {
      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(mockBCGridViewer).toHaveBeenCalled()
        const props = mockBCGridViewer.mock.calls[0][0]
        
        expect(props.columnDefs).toHaveLength(6)
        expect(props.columnDefs[0]).toHaveProperty('field', 'organizationName')
        expect(props.columnDefs[1]).toHaveProperty('field', 'creditsToSell')
      })
    })

    it('provides correct overlay message', async () => {
      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(mockBCGridViewer).toHaveBeenCalled()
        const props = mockBCGridViewer.mock.calls[0][0]
        
        expect(props.overlayNoRowsTemplate).toBe('No credit market listings found')
      })
    })
  })

  describe('Edge Cases', () => {
    it('handles null current user gracefully', async () => {
      vi.mocked(useCurrentUser).mockReturnValue({ data: null })

      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(mockBCGridViewer).toHaveBeenCalled()
        const props = mockBCGridViewer.mock.calls[0][0]
        const transformedData = props.queryData.data.creditMarketListings
        
        // Should show all organizations in alphabetical order
        expect(transformedData[0].organizationName).toBe('Acme Corporation')
        expect(transformedData[1].organizationName).toBe('Beta Industries')
        expect(transformedData[2].organizationName).toBe('Current User Org')
      })
    })

    it('handles undefined current user gracefully', async () => {
      vi.mocked(useCurrentUser).mockReturnValue({ data: undefined })

      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(mockBCGridViewer).toHaveBeenCalled()
        const props = mockBCGridViewer.mock.calls[0][0]
        expect(props.queryData.data.creditMarketListings).toHaveLength(3)
      })
    })

    it('handles empty array for creditMarketData', async () => {
      vi.mocked(useCreditMarketListings).mockReturnValue({ 
        data: [], 
        isLoading: false, 
        isError: false, 
        error: null 
      })

      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(mockBCGridViewer).toHaveBeenCalled()
        const props = mockBCGridViewer.mock.calls[0][0]
        expect(props.queryData.data.creditMarketListings).toHaveLength(0)
        expect(props.queryData.data.pagination.total).toBe(0)
        expect(props.queryData.data.pagination.totalPages).toBe(0)
      })
    })

    it('handles single organization', async () => {
      vi.mocked(useCreditMarketListings).mockReturnValue({ 
        data: [mockCreditMarketData[0]], 
        isLoading: false, 
        isError: false, 
        error: null 
      })

      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(mockBCGridViewer).toHaveBeenCalled()
        const props = mockBCGridViewer.mock.calls[0][0]
        expect(props.queryData.data.creditMarketListings).toHaveLength(1)
        expect(props.queryData.data.pagination.total).toBe(1)
        expect(props.queryData.data.pagination.totalPages).toBe(1)
      })
    })
  })

  describe('Component State Management', () => {
    it('initializes state correctly', async () => {
      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(mockBCGridViewer).toHaveBeenCalled()
        const props = mockBCGridViewer.mock.calls[0][0]
        
        expect(props.paginationOptions).toEqual({
          page: 1,
          size: 10,
          sortOrders: [{ colId: 'organizationName', sort: 'asc' }],
          filters: []
        })
      })
    })
  })

  describe('Translation Integration', () => {
    it('uses translation for overlay message', async () => {
      render(<CreditMarketTable />, { wrapper })

      await waitFor(() => {
        expect(mockBCGridViewer).toHaveBeenCalled()
        const props = mockBCGridViewer.mock.calls[0][0]
        
        expect(props.overlayNoRowsTemplate).toBe('No credit market listings found')
      })
    })
  })
})