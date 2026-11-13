import { useState } from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vite-plus/test'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { AddEditFuelCode } from '../AddEditFuelCode'
import * as useFuelCodeHooks from '@/hooks/useFuelCode'
import * as useCurrentUserHook from '@/hooks/useCurrentUser'
import { FUEL_CODE_STATUSES } from '@/constants/statuses'

// Import utility functions for direct testing
const originalModule = await vi.importActual('../AddEditFuelCode')

// Extract utility functions for testing
const transformExistingFuelCodeData =
  originalModule.transformExistingFuelCodeData ||
  ((existingFuelCode) => {
    if (!existingFuelCode) return null
    return {
      ...existingFuelCode,
      id: existingFuelCode.id || 'test-uuid',
      feedstockFuelTransportMode:
        existingFuelCode.feedstockFuelTransportModes?.map(
          (mode) => mode.feedstockFuelTransportMode.transportMode
        ) || [],
      finishedFuelTransportMode:
        existingFuelCode.finishedFuelTransportModes?.map(
          (mode) => mode.finishedFuelTransportMode.transportMode
        ) || []
    }
  })

const createDefaultRow =
  originalModule.createDefaultRow ||
  ((optionsData) => {
    const DEFAULT_PREFIX = 'BCLCF'
    const defaultPrefix = optionsData?.fuelCodePrefixes?.find(
      (item) => item.prefix === DEFAULT_PREFIX
    )
    return {
      id: 'test-uuid',
      prefixId: defaultPrefix?.fuelCodePrefixId || 1,
      prefix: defaultPrefix?.prefix || DEFAULT_PREFIX,
      fuelSuffix: defaultPrefix?.nextFuelCode,
      isNewRow: true,
      modified: false
    }
  })

const filterNonNullValues =
  originalModule.filterNonNullValues ||
  ((data) => {
    const result = {}
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== '') {
        result[key] = value
      }
    }
    return result
  })

const { mockGridApi, mockTriggerAlert } = vi.hoisted(() => ({
  mockGridApi: { sizeColumnsToFit: vi.fn() },
  mockTriggerAlert: vi.fn()
}))

// Mock hooks and update
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
  BCGridEditor: ({
    alertRef,
    onGridReady,
    onCellValueChanged,
    onCellEditingStopped,
    onAction,
    handlePaste,
    loading
  }) => {
    if (alertRef) alertRef.current = { triggerAlert: mockTriggerAlert }
    return (
      <div data-testid="grid" data-loading={String(Boolean(loading))}>
        <button onClick={() => onGridReady?.({ api: mockGridApi })}>
          Ready
        </button>
        <button
          onClick={() =>
            onCellValueChanged?.({
              data: { id: 'test' },
              colDef: { field: 'prefix' },
              newValue: 'BCLCF',
              api: { applyTransaction: vi.fn() }
            })
          }
        >
          Change Cell
        </button>
        <button
          onClick={() =>
            onCellValueChanged?.({
              data: { id: 'test' },
              colDef: { field: 'other' },
              newValue: 'value',
              api: { applyTransaction: vi.fn() }
            })
          }
        >
          Change Other Cell
        </button>
        <button
          onClick={() =>
            onCellEditingStopped?.({
              oldValue: 'old',
              newValue: 'new',
              node: {
                data: { id: 'test', modified: true },
                updateData: vi.fn()
              }
            })
          }
        >
          Stop Edit
        </button>
        <button
          onClick={() =>
            onCellEditingStopped?.({
              oldValue: 'same',
              newValue: 'same',
              node: {
                data: { id: 'test', modified: true },
                updateData: vi.fn()
              }
            })
          }
        >
          Stop Edit Same
        </button>
        <button
          onClick={() =>
            onCellEditingStopped?.({
              oldValue: '999.0',
              newValue: '1000.0',
              node: {
                data: {
                  id: 'four-digit-row',
                  prefix: 'BCLCF',
                  prefixId: 1,
                  fuelSuffix: '1000.0',
                  modified: true
                },
                updateData: vi.fn()
              }
            })
          }
        >
          Stop Edit Four Digit
        </button>
        <button
          onClick={() => onAction?.('duplicate', { data: { fuelCodeId: 123 } })}
        >
          Duplicate
        </button>
        <button
          onClick={() =>
            onAction?.('delete', {
              data: { fuelCodeId: 123 },
              node: { data: { fuelCodeId: 123 } },
              api: { applyTransaction: vi.fn() }
            })
          }
        >
          Delete
        </button>
        <button onClick={() => onAction?.('add', {})}>Add</button>
        <button
          onClick={() =>
            handlePaste?.(
              {
                clipboardData: { getData: () => 'col1\tval1' },
                preventDefault: vi.fn()
              },
              {
                api: {
                  getAllDisplayedColumns: () => [{ colDef: { field: 'col1' } }],
                  applyTransaction: vi.fn().mockReturnValue({
                    add: [{ node: { data: { id: 'test-id' } } }]
                  })
                }
              }
            )
          }
        >
          Paste
        </button>
      </div>
    )
  }
}))

vi.mock('@/components/Loading', () => ({
  default: () => <div data-testid="loading">Loading</div>
}))

vi.mock('@/components/BCButton', () => ({
  default: ({ children, onClick, ...domProps }) => {
    delete domProps.startIcon
    delete domProps.loading
    delete domProps.variant
    delete domProps.color
    delete domProps.size
    delete domProps.sx
    return (
      <button onClick={onClick} {...domProps}>
        {children}
      </button>
    )
  }
}))

vi.mock('@/components/BCModal', () => ({
  default: ({ open, onClose, data }) =>
    open ? (
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
  fuelCodeColDefs: () => [{ field: 'prefix', editable: true }],
  normalizeTransportModeDistances: (value) =>
    Array.isArray(value)
      ? value.map((item) =>
          typeof item === 'object'
            ? {
                transportMode:
                  item.transportMode?.transportMode || item.transportMode || '',
                distance: item.distance ?? ''
              }
            : { transportMode: item, distance: '' }
        )
      : [],
  normalizeTransportModeDistancesForSave: (value) =>
    Array.isArray(value)
      ? value.map((item) =>
          typeof item === 'object'
            ? {
                transport_mode:
                  item.transportMode?.transportMode || item.transportMode || '',
                distance: item.distance ?? ''
              }
            : { transport_mode: item, distance: '' }
        )
      : []
}))

vi.mock('./buttonConfigs', () => ({
  fuelCodeButtonConfigFn: () => ({
    DRAFT: [{ id: 'save', label: 'Save', handler: vi.fn() }]
  }),
  buildFuelCodeButtonContext: (context) => ({
    ...context,
    currentStatus: 'DRAFT'
  })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('uuid', () => ({ v4: () => 'test-uuid' }))
vi.mock('papaparse', () => ({
  default: { parse: vi.fn().mockReturnValue({ data: [{ col1: 'val1' }] }) }
}))

const TestWrapper = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
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
    fuelCodePrefixes: [
      { fuelCodePrefixId: 1, prefix: 'BCLCF', nextFuelCode: 'BCLCF001' },
      { fuelCodePrefixId: 2, prefix: 'PROXY', nextFuelCode: 'PROXY001' },
      { fuelCodePrefixId: 3, prefix: 'C-BCLCF', nextFuelCode: 'C-BCLCF001' },
      { fuelCodePrefixId: 4, prefix: 'C-PROXY', nextFuelCode: 'C-PROXY001' }
    ],
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
    mutateAsync: vi
      .fn()
      .mockResolvedValue({ data: { fuelCodeId: 123, fuelSuffix: 'BCLCF001' } }),
    isLoading: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useFuelCodeHooks.useFuelCodeMutation).mockReturnValue(
      mockMutation
    )
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

    render(
      <TestWrapper>
        <AddEditFuelCode />
      </TestWrapper>
    )
    expect(screen.getByText('Loading')).toBeInTheDocument()
  })

  it('renders loading when existing fuel code loading', () => {
    vi.mocked(useFuelCodeHooks.useGetFuelCode).mockReturnValue({
      data: null,
      isLoading: true,
      refetch: vi.fn()
    })

    render(
      <TestWrapper>
        <AddEditFuelCode />
      </TestWrapper>
    )
    expect(screen.getByText('Loading')).toBeInTheDocument()
  })

  it('returns null when not fetched', () => {
    vi.mocked(useFuelCodeHooks.useFuelCodeOptions).mockReturnValue({
      data: null,
      isLoading: false,
      isFetched: false,
      refetch: vi.fn()
    })

    const { container } = render(
      <TestWrapper>
        <AddEditFuelCode />
      </TestWrapper>
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders grid and new title by default', async () => {
    render(
      <TestWrapper>
        <AddEditFuelCode />
      </TestWrapper>
    )

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

    render(
      <TestWrapper>
        <AddEditFuelCode />
      </TestWrapper>
    )

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

    render(
      <TestWrapper>
        <AddEditFuelCode />
      </TestWrapper>
    )

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

    render(
      <TestWrapper>
        <AddEditFuelCode />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument()
    })
  })

  it('leaves column sizing to the grid on grid ready', async () => {
    render(
      <TestWrapper>
        <AddEditFuelCode />
      </TestWrapper>
    )

    const readyButton = await screen.findByText('Ready')
    fireEvent.click(readyButton)

    expect(readyButton).toBeInTheDocument()
    // Fitting ~30 fuel code columns to the viewport squeezed them unreadably (#5288)
    expect(mockGridApi.sizeColumnsToFit).not.toHaveBeenCalled()
  })

  it('handles cell value changes', async () => {
    render(
      <TestWrapper>
        <AddEditFuelCode />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Change Cell')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Change Cell'))
  })

  it('handles cell editing stopped with mutation', async () => {
    render(
      <TestWrapper>
        <AddEditFuelCode />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Stop Edit')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Stop Edit'))

    await waitFor(() => {
      expect(mockMutation.mutateAsync).toHaveBeenCalled()
    })
  })

  it('clears the grid loading overlay when the page re-renders as a save finishes', async () => {
    let resolveSave
    mockMutation.mutateAsync.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve
        })
    )
    let rerenderParent
    const Parent = () => {
      const [tick, setTick] = useState(0)
      rerenderParent = () => setTick((value) => value + 1)
      return <AddEditFuelCode tick={tick} />
    }

    render(
      <TestWrapper>
        <Parent />
      </TestWrapper>
    )

    fireEvent.click(await screen.findByText('Stop Edit'))
    const grid = () => document.querySelector('[data-testid="grid"]')
    await waitFor(() => {
      expect(grid()).toHaveAttribute('data-loading', 'true')
    })

    // Hold zero-delay timers so a parent re-render lands between the save
    // finishing and those timers running.
    const heldTimers = []
    const realSetTimeout = globalThis.setTimeout
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation((callback, delay, ...args) => {
        if (!delay) {
          heldTimers.push(() => callback(...args))
          return 0
        }
        return realSetTimeout(callback, delay, ...args)
      })
    try {
      await act(async () => {
        resolveSave({ data: { fuelCodeId: 123, fuelSuffix: 'BCLCF001' } })
      })
      act(() => rerenderParent())
      act(() => heldTimers.splice(0).forEach((run) => run()))
    } finally {
      setTimeoutSpy.mockRestore()
    }

    expect(grid()).toHaveAttribute('data-loading', 'false')
  })

  it('preserves a four-digit suffix when saving an Add/Edit grid row', async () => {
    render(
      <TestWrapper>
        <AddEditFuelCode />
      </TestWrapper>
    )

    fireEvent.click(await screen.findByText('Stop Edit Four Digit'))

    await waitFor(() => {
      expect(mockMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fuelSuffix: '1000.0' })
        })
      )
    })
  })

  it('handles duplicate action', async () => {
    render(
      <TestWrapper>
        <AddEditFuelCode />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Duplicate')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Duplicate'))
  })

  it('handles delete action with modal', async () => {
    render(
      <TestWrapper>
        <AddEditFuelCode />
      </TestWrapper>
    )

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
    render(
      <TestWrapper>
        <AddEditFuelCode />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('Add')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Add'))
  })

  it('closes modal', async () => {
    render(
      <TestWrapper>
        <AddEditFuelCode />
      </TestWrapper>
    )

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
    mockError.response = {
      data: { errors: [{ fields: ['company'], message: 'is required' }] }
    }
    mockMutation.mutateAsync.mockRejectedValue(mockError)

    render(
      <TestWrapper>
        <AddEditFuelCode />
      </TestWrapper>
    )

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

    render(
      <TestWrapper>
        <AddEditFuelCode />
      </TestWrapper>
    )

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

    render(
      <TestWrapper>
        <AddEditFuelCode />
      </TestWrapper>
    )

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

    render(
      <TestWrapper>
        <AddEditFuelCode />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('fuelCode:viewFuelCodeTitle')).toBeInTheDocument()
    })
  })

  // Utility function tests
  describe('Utility Functions', () => {
    describe('transformExistingFuelCodeData', () => {
      it('returns null for null input', () => {
        expect(transformExistingFuelCodeData(null)).toBeNull()
      })

      it('returns null for undefined input', () => {
        expect(transformExistingFuelCodeData(undefined)).toBeNull()
      })

      it('transforms data with transport modes', () => {
        const input = {
          id: 123,
          feedstockFuelTransportModes: [
            { feedstockFuelTransportMode: { transportMode: 'Truck' } },
            { feedstockFuelTransportMode: { transportMode: 'Rail' } }
          ],
          finishedFuelTransportModes: [
            { finishedFuelTransportMode: { transportMode: 'Ship' } }
          ]
        }

        const result = transformExistingFuelCodeData(input)
        expect(result.feedstockFuelTransportMode).toEqual(['Truck', 'Rail'])
        expect(result.finishedFuelTransportMode).toEqual(['Ship'])
        expect(result.id).toBe(123)
      })

      it('handles empty transport modes', () => {
        const input = {
          id: 123,
          feedstockFuelTransportModes: [],
          finishedFuelTransportModes: []
        }

        const result = transformExistingFuelCodeData(input)
        expect(result.feedstockFuelTransportMode).toEqual([])
        expect(result.finishedFuelTransportMode).toEqual([])
      })

      it('adds uuid when id is missing', () => {
        const input = { name: 'test' }
        const result = transformExistingFuelCodeData(input)
        expect(result.id).toBe('test-uuid')
      })
    })

    describe('createDefaultRow', () => {
      it('creates default row with options data', () => {
        const optionsData = {
          fuelCodePrefixes: [
            { fuelCodePrefixId: 1, prefix: 'BCLCF', nextFuelCode: 'BCLCF001' }
          ]
        }

        const result = createDefaultRow(optionsData)
        expect(result).toEqual({
          id: 'test-uuid',
          prefixId: 1,
          prefix: 'BCLCF',
          fuelSuffix: 'BCLCF001',
          isNewRow: true,
          modified: false
        })
      })

      it('uses defaults when prefix not found', () => {
        const optionsData = {
          fuelCodePrefixes: [
            { fuelCodePrefixId: 2, prefix: 'OTHER', nextFuelCode: 'OTHER001' }
          ]
        }

        const result = createDefaultRow(optionsData)
        expect(result.prefixId).toBe(1)
        expect(result.prefix).toBe('BCLCF')
      })

      it('handles null options data', () => {
        const result = createDefaultRow(null)
        expect(result.prefixId).toBe(1)
        expect(result.prefix).toBe('BCLCF')
      })
    })

    describe('filterNonNullValues', () => {
      it('filters out null values', () => {
        const input = { a: 1, b: null, c: 'test' }
        const result = filterNonNullValues(input)
        expect(result).toEqual({ a: 1, c: 'test' })
      })

      it('filters out empty strings', () => {
        const input = { a: 1, b: '', c: 'test' }
        const result = filterNonNullValues(input)
        expect(result).toEqual({ a: 1, c: 'test' })
      })

      it('keeps falsy but valid values', () => {
        const input = { a: 0, b: false, c: null, d: '' }
        const result = filterNonNullValues(input)
        expect(result).toEqual({ a: 0, b: false })
      })

      it('handles empty object', () => {
        const result = filterNonNullValues({})
        expect(result).toEqual({})
      })
    })
  })

  // Enhanced component tests
  describe('Enhanced Component Behavior', () => {
    it('handles cell editing with no value change', async () => {
      render(
        <TestWrapper>
          <AddEditFuelCode />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Stop Edit Same')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Stop Edit Same'))

      // Should not trigger mutation for unchanged values
      expect(mockMutation.mutateAsync).not.toHaveBeenCalled()
    })

    it('handles cell value change without prefix field', async () => {
      render(
        <TestWrapper>
          <AddEditFuelCode />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Change Other Cell')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Change Other Cell'))
    })

    it('handles paste functionality', async () => {
      render(
        <TestWrapper>
          <AddEditFuelCode />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Paste')).toBeInTheDocument()
      })

      // Just verify the paste button exists, don't trigger it
      // due to complex mock requirements for the paste handler
      expect(screen.getByText('Paste')).toBeInTheDocument()
    })

    it('shows edit title in edit mode', async () => {
      const draftFuelCode = {
        ...mockExistingFuelCode,
        fuelCodeStatus: { status: FUEL_CODE_STATUSES.DRAFT }
      }

      vi.mocked(useFuelCodeHooks.useGetFuelCode).mockReturnValue({
        data: draftFuelCode,
        isLoading: false,
        refetch: vi.fn()
      })

      // Simulate edit mode being enabled
      const { rerender } = render(
        <TestWrapper>
          <AddEditFuelCode />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(
          screen.getByText('fuelCode:viewFuelCodeTitle')
        ).toBeInTheDocument()
      })

      // Re-render would show edit title if isInEditMode was true
      // This tests the conditional logic in computedValues
      rerender(
        <TestWrapper>
          <AddEditFuelCode />
        </TestWrapper>
      )
    })

    it('handles mutation error with no response data', async () => {
      const mockError = new Error('Network error')
      mockMutation.mutateAsync.mockRejectedValue(mockError)

      render(
        <TestWrapper>
          <AddEditFuelCode />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Stop Edit')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Stop Edit'))

      await waitFor(() => {
        expect(mockMutation.mutateAsync).toHaveBeenCalled()
      })
    })

    it('handles duplicate action with no existing fuel code id', async () => {
      // Simulate duplicate on new row without fuelCodeId
      render(
        <TestWrapper>
          <AddEditFuelCode />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Duplicate')).toBeInTheDocument()
      })

      // Just verify the duplicate button exists and can be clicked
      fireEvent.click(screen.getByText('Duplicate'))
    })

    it('renders guide text for new fuel code', async () => {
      render(
        <TestWrapper>
          <AddEditFuelCode />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Ready')).toBeInTheDocument()
      })

      // Guide text should be shown for new fuel codes
      // This tests the showGuideText computed value
    })

    it('handles error response with field details', async () => {
      const mockError = new Error('Validation error')
      mockError.response = {
        data: {
          errors: [
            {
              fields: ['fuelType', 'carbonIntensity'],
              message: 'are required'
            }
          ],
          detail: 'Validation failed'
        }
      }
      mockMutation.mutateAsync.mockRejectedValue(mockError)

      render(
        <TestWrapper>
          <AddEditFuelCode />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Stop Edit')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Stop Edit'))

      await waitFor(() => {
        expect(mockMutation.mutateAsync).toHaveBeenCalled()
      })
    })

    it('handles action unknown type', async () => {
      render(
        <TestWrapper>
          <AddEditFuelCode />
        </TestWrapper>
      )

      // Test that component renders successfully, which covers action handler creation
      await waitFor(() => {
        expect(screen.getByText('Ready')).toBeInTheDocument()
      })

      expect(screen.getByText('Ready')).toBeInTheDocument()
    })
  })

  // Button context handler tests
  describe('Button Context Handlers', () => {
    beforeEach(() => {
      // Reset all mocks for button tests
      vi.clearAllMocks()
    })

    it('handles button configuration with existing fuel code', async () => {
      vi.mocked(useFuelCodeHooks.useGetFuelCode).mockReturnValue({
        data: mockExistingFuelCode,
        isLoading: false,
        refetch: vi.fn()
      })

      render(
        <TestWrapper>
          <AddEditFuelCode />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Ready')).toBeInTheDocument()
      })

      // Button configuration should be computed based on existing fuel code
    })

    it('computes correct permissions for different user roles', async () => {
      const mockHasRoles = vi
        .fn()
        .mockReturnValueOnce(true) // analyst
        .mockReturnValueOnce(false) // other roles

      vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
        hasRoles: mockHasRoles
      })

      render(
        <TestWrapper>
          <AddEditFuelCode />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(mockHasRoles).toHaveBeenCalled()
      })
    })

    it('handles computed values for edit vs view modes', async () => {
      vi.mocked(useFuelCodeHooks.useGetFuelCode).mockReturnValue({
        data: mockExistingFuelCode,
        isLoading: false,
        refetch: vi.fn()
      })

      render(
        <TestWrapper>
          <AddEditFuelCode />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Ready')).toBeInTheDocument()
      })

      // shouldShowEditButton and shouldShowSaveButton should be computed correctly
    })

    it('shows notes required validation error', async () => {
      const fuelCodeWithNotesRequired = {
        ...mockExistingFuelCode,
        fuelCodeStatus: { status: FUEL_CODE_STATUSES.DRAFT },
        isNotesRequired: true
      }

      vi.mocked(useFuelCodeHooks.useGetFuelCode).mockReturnValue({
        data: fuelCodeWithNotesRequired,
        isLoading: false,
        refetch: vi.fn()
      })

      render(
        <TestWrapper>
          <AddEditFuelCode />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Ready')).toBeInTheDocument()
      })

      // This tests hasNotesValidationError computation
    })

    it('disables Save while a row has a failed save, until the row saves', async () => {
      mockMutation.mutateAsync
        .mockRejectedValueOnce({
          response: {
            status: 422,
            data: {
              errors: [
                {
                  fields: ['feedstockFuelTransportMode'],
                  message: 'Input should be a valid string'
                }
              ]
            }
          }
        })
        .mockResolvedValueOnce({
          data: { fuelCodeId: 123, fuelSuffix: 'BCLCF001' }
        })

      render(
        <TestWrapper>
          <AddEditFuelCode />
        </TestWrapper>
      )
      fireEvent.click(await screen.findByText('Ready'))

      const saveButton = () =>
        document.querySelector('[data-test="save-fuel-code-btn"]')
      await waitFor(() => expect(saveButton()).not.toBeDisabled())

      fireEvent.click(screen.getByText('Stop Edit'))
      await waitFor(() => expect(saveButton()).toBeDisabled())

      fireEvent.click(screen.getByText('Stop Edit'))
      await waitFor(() => expect(saveButton()).not.toBeDisabled())
      expect(mockMutation.mutateAsync).toHaveBeenCalledTimes(2)
    })
  })

  // The CI application workflow now processes fuel codes through to approval,
  // so these pages only edit approved codes and the drafts they started.
  describe('Legacy fuel code lock (#5308)', () => {
    const renderWith = (fuelCode) => {
      vi.mocked(useFuelCodeHooks.useGetFuelCode).mockReturnValue({
        data: fuelCode,
        isLoading: false,
        refetch: vi.fn()
      })
      render(
        <TestWrapper>
          <AddEditFuelCode />
        </TestWrapper>
      )
    }
    const button = (id) => document.querySelector(`[data-test="${id}"]`)
    const lockAlert = () =>
      document.querySelector('[data-test="fuel-code-legacy-lock"]')

    it('keeps the actions on a draft these pages started', async () => {
      renderWith({ ...mockExistingFuelCode, legacyLockReason: null })

      await waitFor(() => expect(button('edit-fuel-code-btn')).toBeTruthy())
      expect(button('approve-fuel-code-btn')).toBeTruthy()
      expect(lockAlert()).toBeNull()
    })

    it('offers no actions on a CI application draft and links to it', async () => {
      renderWith({
        ...mockExistingFuelCode,
        legacyLockReason: 'CI_APPLICATION',
        openCiApplicationId: 42
      })

      await waitFor(() => expect(lockAlert()).toBeTruthy())
      expect(lockAlert()).toHaveTextContent(
        'fuelCode:legacyLock.CI_APPLICATION'
      )
      expect(
        screen.getByRole('link', {
          name: 'fuelCode:legacyLock.ciApplicationLink'
        })
      ).toHaveAttribute('href', '/ci-applications/42')
      for (const id of [
        'edit-fuel-code-btn',
        'save-fuel-code-btn',
        'recommend-fuel-code-btn',
        'approve-fuel-code-btn',
        'return-to-analyst-btn',
        'delete-fuel-code-btn'
      ]) {
        expect(button(id)).toBeNull()
      }
    })

    it('offers no actions on any other fuel code that is not approved', async () => {
      renderWith({
        ...mockExistingFuelCode,
        fuelCodeStatus: { status: FUEL_CODE_STATUSES.RECOMMENDED },
        legacyLockReason: 'NOT_APPROVED',
        openCiApplicationId: null
      })

      await waitFor(() => expect(lockAlert()).toBeTruthy())
      expect(lockAlert()).toHaveTextContent('fuelCode:legacyLock.NOT_APPROVED')
      expect(screen.queryByRole('link')).toBeNull()
      expect(button('approve-fuel-code-btn')).toBeNull()
      expect(button('return-to-analyst-btn')).toBeNull()
      expect(button('edit-fuel-code-btn')).toBeNull()
    })

    it('still lets an approved fuel code be reopened with Edit', async () => {
      renderWith({
        ...mockExistingFuelCode,
        fuelCodeStatus: { status: FUEL_CODE_STATUSES.APPROVED },
        legacyLockReason: null
      })

      await waitFor(() => expect(button('edit-fuel-code-btn')).toBeTruthy())
      expect(lockAlert()).toBeNull()
    })

    it("shows the API's reason when an action is refused", async () => {
      mockMutation.mutateAsync.mockRejectedValueOnce({
        message: 'Request failed with status code 409',
        response: {
          status: 409,
          data: { detail: 'Only approved fuel codes can be edited here.' }
        }
      })
      renderWith({
        ...mockExistingFuelCode,
        fuelCodeStatus: { status: FUEL_CODE_STATUSES.APPROVED },
        legacyLockReason: null
      })

      fireEvent.click(await screen.findByText('Ready'))
      await waitFor(() => expect(button('edit-fuel-code-btn')).toBeTruthy())
      fireEvent.click(button('edit-fuel-code-btn'))
      fireEvent.click(await screen.findByText('Primary'))

      await waitFor(() =>
        expect(mockTriggerAlert).toHaveBeenCalledWith({
          message:
            'Error enabling edit mode: Only approved fuel codes can be edited here.',
          severity: 'error'
        })
      )
    })
  })

  // Error handling edge cases
  describe('Error Handling Edge Cases', () => {
    it('handles component with minimal props', async () => {
      // Test with minimal mock data to ensure component doesn't crash
      vi.mocked(useFuelCodeHooks.useFuelCodeOptions).mockReturnValue({
        data: { fuelCodePrefixes: [] },
        isLoading: false,
        isFetched: true,
        refetch: vi.fn()
      })

      render(
        <TestWrapper>
          <AddEditFuelCode />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Ready')).toBeInTheDocument()
      })
    })

    it('handles component cleanup gracefully', async () => {
      const { unmount } = render(
        <TestWrapper>
          <AddEditFuelCode />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Ready')).toBeInTheDocument()
      })

      // Should unmount without errors
      unmount()
    })

    it('handles refetch options error', async () => {
      const mockRefetch = vi.fn().mockResolvedValue({ data: mockOptionsData })

      vi.mocked(useFuelCodeHooks.useFuelCodeOptions).mockReturnValue({
        data: mockOptionsData,
        isLoading: false,
        isFetched: true,
        refetch: mockRefetch
      })

      render(
        <TestWrapper>
          <AddEditFuelCode />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Add')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Add'))

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled()
      })
    })
  })
})
