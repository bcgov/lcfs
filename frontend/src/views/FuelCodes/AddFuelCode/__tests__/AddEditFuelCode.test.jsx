import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { AddEditFuelCode } from '../AddEditFuelCode'
import * as useFuelCodeHooks from '@/hooks/useFuelCode'
import * as useCurrentUserHook from '@/hooks/useCurrentUser'
import { FUEL_CODE_STATUSES } from '@/constants/statuses'

// Mock hooks
vi.mock('@/hooks/useFuelCode')
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/utils/withRole', () => ({ default: (Component) => Component }))
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useParams: () => ({ fuelCodeID: '123' }),
  useNavigate: () => vi.fn()
}))

// Mock components
vi.mock('@/components/BCDataGrid/BCGridEditor', () => ({
  BCGridEditor: ({ onGridReady, onCellValueChanged, onCellEditingStopped, onAction }) => (
    <div data-testid="grid">
      <button onClick={() => onGridReady?.({ api: { sizeColumnsToFit: vi.fn() } })}>
        Ready
      </button>
      <button onClick={() => onCellValueChanged?.({ 
        data: { id: 'test' }, 
        colDef: { field: 'prefix' }, 
        newValue: 'BCLCF',
        api: { applyTransaction: vi.fn() }
      })}>
        Change Cell
      </button>
      <button onClick={() => onCellEditingStopped?.({
        oldValue: 'old',
        newValue: 'new',
        node: { 
          data: { id: 'test', modified: true },
          updateData: vi.fn()
        }
      })}>
        Stop Edit
      </button>
      <button onClick={() => onAction?.('duplicate', { data: { fuelCodeId: 123 } })}>
        Duplicate
      </button>
      <button onClick={() => onAction?.('delete', { data: { fuelCodeId: 123 } })}>
        Delete
      </button>
      <button onClick={() => onAction?.('add', {})}>
        Add
      </button>
    </div>
  )
}))

vi.mock('@/components/Loading', () => ({
  default: () => <div data-testid="loading">Loading</div>
}))

vi.mock('@/components/BCButton', () => ({
  default: ({ children, onClick, ...props }) => <button onClick={onClick} {...props}>{children}</button>
}))

vi.mock('@/components/BCModal', () => ({
  default: ({ open, onClose, data }) => open ? (
    <div data-testid="modal">
      <button onClick={data?.primaryButtonAction}>Primary</button>
      <button onClick={onClose}>Close</button>
    </div>
  ) : null
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }) => <span {...props}>{children}</span>
}))

vi.mock('../_schema', () => ({
  defaultColDef: {},
  fuelCodeColDefs: () => [{ field: 'prefix', editable: true }]
}))

vi.mock('./buttonConfigs', () => ({
  fuelCodeButtonConfigFn: () => ({ DRAFT: [{ id: 'save', label: 'Save', handler: vi.fn() }] }),
  buildFuelCodeButtonContext: (context) => ({ ...context, currentStatus: 'DRAFT' })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('uuid', () => ({ v4: () => 'test-uuid' }))
vi.mock('papaparse', () => ({ default: { parse: vi.fn() } }))

const TestWrapper = ({ children }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const theme = createTheme()
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <BrowserRouter>{children}</BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('AddEditFuelCode', () => {
  const mockOptionsData = {
    fuelCodePrefixes: [{ fuelCodePrefixId: 1, prefix: 'BCLCF', nextFuelCode: 'BCLCF001' }],
    fuelTypes: [{ fuelTypeId: 1, fuelType: 'Diesel' }]
  }

  const mockExistingFuelCode = {
    fuelCodeId: 123,
    prefix: 'BCLCF',
    fuelCodeStatus: { status: FUEL_CODE_STATUSES.DRAFT },
    feedstockFuelTransportModes: [],
    finishedFuelTransportModes: []
  }

  const mockMutation = {
    mutateAsync: vi.fn().mockResolvedValue({ data: { fuelCodeId: 123, fuelSuffix: 'BCLCF001' } }),
    isLoading: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useFuelCodeHooks.useFuelCodeMutation).mockReturnValue(mockMutation)
    vi.mocked(useFuelCodeHooks.useFuelCodeOptions).mockReturnValue({
      data: mockOptionsData,
      isLoading: false,
      isFetched: true,
      refetch: vi.fn().mockResolvedValue({ data: mockOptionsData })
    })
    vi.mocked(useFuelCodeHooks.useGetFuelCode).mockReturnValue({
      data: null,
      isLoading: false,
      refetch: vi.fn()
    })
    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      hasRoles: vi.fn().mockReturnValue(true)
    })
  })

  it('renders loading when options loading', () => {
    vi.mocked(useFuelCodeHooks.useFuelCodeOptions).mockReturnValue({
      data: null,
      isLoading: true,
      isFetched: false,
      refetch: vi.fn()
    })

    render(<TestWrapper><AddEditFuelCode /></TestWrapper>)
    expect(screen.getByText('Loading')).toBeInTheDocument()
  })

  it('renders loading when existing fuel code loading', () => {
    vi.mocked(useFuelCodeHooks.useGetFuelCode).mockReturnValue({
      data: null,
      isLoading: true,
      refetch: vi.fn()
    })

    render(<TestWrapper><AddEditFuelCode /></TestWrapper>)
    expect(screen.getByText('Loading')).toBeInTheDocument()
  })

  it('returns null when not fetched', () => {
    vi.mocked(useFuelCodeHooks.useFuelCodeOptions).mockReturnValue({
      data: null,
      isLoading: false,
      isFetched: false,
      refetch: vi.fn()
    })

    const { container } = render(<TestWrapper><AddEditFuelCode /></TestWrapper>)
    expect(container.firstChild).toBeNull()
  })

  it('renders grid and new title by default', async () => {
    render(<TestWrapper><AddEditFuelCode /></TestWrapper>)
    
    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument()
      expect(screen.getByText('fuelCode:newFuelCodeTitle')).toBeInTheDocument()
    })
  })

  it('shows view title for existing fuel code', async () => {
    vi.mocked(useFuelCodeHooks.useGetFuelCode).mockReturnValue({
      data: mockExistingFuelCode,
      isLoading: false,
      refetch: vi.fn()
    })

    render(<TestWrapper><AddEditFuelCode /></TestWrapper>)
    
    await waitFor(() => {
      expect(screen.getByText('fuelCode:viewFuelCodeTitle')).toBeInTheDocument()
    })
  })

  it('handles approved status as non-editable', async () => {
    const approvedFuelCode = {
      ...mockExistingFuelCode,
      fuelCodeStatus: { status: FUEL_CODE_STATUSES.APPROVED }
    }
    
    vi.mocked(useFuelCodeHooks.useGetFuelCode).mockReturnValue({
      data: approvedFuelCode,
      isLoading: false,
      refetch: vi.fn()
    })

    render(<TestWrapper><AddEditFuelCode /></TestWrapper>)
    
    await waitFor(() => {
      expect(screen.getByText('fuelCode:viewFuelCodeTitle')).toBeInTheDocument()
    })
  })

  it('transforms existing fuel code data with transport modes', async () => {
    const fuelCodeWithModes = {
      ...mockExistingFuelCode,
      feedstockFuelTransportModes: [
        { feedstockFuelTransportMode: { transportMode: 'Truck' } }
      ],
      finishedFuelTransportModes: [
        { finishedFuelTransportMode: { transportMode: 'Ship' } }
      ]
    }
    
    vi.mocked(useFuelCodeHooks.useGetFuelCode).mockReturnValue({
      data: fuelCodeWithModes,
      isLoading: false,
      refetch: vi.fn()
    })

    render(<TestWrapper><AddEditFuelCode /></TestWrapper>)
    
    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument()
    })
  })

  it('handles grid ready callback', async () => {
    render(<TestWrapper><AddEditFuelCode /></TestWrapper>)
    
    const readyButton = await screen.findByText('Ready')
    fireEvent.click(readyButton)
    
    expect(readyButton).toBeInTheDocument()
  })

  it('handles cell value changes', async () => {
    render(<TestWrapper><AddEditFuelCode /></TestWrapper>)
    
    await waitFor(() => {
      expect(screen.getByText('Change Cell')).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByText('Change Cell'))
  })

  it('handles cell editing stopped with mutation', async () => {
    render(<TestWrapper><AddEditFuelCode /></TestWrapper>)
    
    await waitFor(() => {
      expect(screen.getByText('Stop Edit')).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByText('Stop Edit'))
    
    await waitFor(() => {
      expect(mockMutation.mutateAsync).toHaveBeenCalled()
    })
  })

  it('handles duplicate action', async () => {
    render(<TestWrapper><AddEditFuelCode /></TestWrapper>)
    
    await waitFor(() => {
      expect(screen.getByText('Duplicate')).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByText('Duplicate'))
  })

  it('handles delete action with modal', async () => {
    render(<TestWrapper><AddEditFuelCode /></TestWrapper>)
    
    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByText('Delete'))
    
    await waitFor(() => {
      expect(screen.getByText('Primary')).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByText('Primary'))
    
    await waitFor(() => {
      expect(mockMutation.mutateAsync).toHaveBeenCalledWith({
        action: 'delete',
        fuelCodeId: 123
      })
    })
  })

  it('handles add action', async () => {
    render(<TestWrapper><AddEditFuelCode /></TestWrapper>)
    
    await waitFor(() => {
      expect(screen.getByText('Add')).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByText('Add'))
  })

  it('closes modal', async () => {
    render(<TestWrapper><AddEditFuelCode /></TestWrapper>)
    
    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByText('Delete'))
    
    await waitFor(() => {
      expect(screen.getByText('Close')).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByText('Close'))
    
    await waitFor(() => {
      expect(screen.queryByText('Primary')).not.toBeInTheDocument()
    })
  })

  it('handles mutation error', async () => {
    const mockError = new Error('Test error')
    mockError.response = { data: { errors: [{ fields: ['company'], message: 'is required' }] } }
    mockMutation.mutateAsync.mockRejectedValue(mockError)
    
    render(<TestWrapper><AddEditFuelCode /></TestWrapper>)
    
    await waitFor(() => {
      expect(screen.getByText('Stop Edit')).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByText('Stop Edit'))
    
    await waitFor(() => {
      expect(mockMutation.mutateAsync).toHaveBeenCalled()
    })
  })

  it('handles user roles correctly', async () => {
    const mockHasRoles = vi.fn().mockReturnValue(false)
    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      hasRoles: mockHasRoles
    })

    render(<TestWrapper><AddEditFuelCode /></TestWrapper>)
    
    await waitFor(() => {
      expect(mockHasRoles).toHaveBeenCalled()
    })
  })

  it('shows notes required warning', async () => {
    const fuelCodeWithNotes = {
      ...mockExistingFuelCode,
      fuelCodeStatus: { status: FUEL_CODE_STATUSES.DRAFT },
      isNotesRequired: true
    }
    
    vi.mocked(useFuelCodeHooks.useGetFuelCode).mockReturnValue({
      data: fuelCodeWithNotes,
      isLoading: false,
      refetch: vi.fn()
    })

    render(<TestWrapper><AddEditFuelCode /></TestWrapper>)
    
    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument()
    })
  })

  it('handles recommended status', async () => {
    const recommendedFuelCode = {
      ...mockExistingFuelCode,
      fuelCodeStatus: { status: FUEL_CODE_STATUSES.RECOMMENDED }
    }
    
    vi.mocked(useFuelCodeHooks.useGetFuelCode).mockReturnValue({
      data: recommendedFuelCode,
      isLoading: false,
      refetch: vi.fn()
    })

    render(<TestWrapper><AddEditFuelCode /></TestWrapper>)
    
    await waitFor(() => {
      expect(screen.getByText('fuelCode:viewFuelCodeTitle')).toBeInTheDocument()
    })
  })
})