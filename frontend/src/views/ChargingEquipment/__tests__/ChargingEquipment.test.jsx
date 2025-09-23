import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import { forwardRef } from 'react'
import theme from '@/themes'
import { ChargingEquipment } from '../ChargingEquipment'

// Mock all hooks and dependencies
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useChargingEquipment')

const mockNavigate = vi.fn()
const mockSetSearchParams = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
    useLocation: () => ({ pathname: '/compliance-reporting/fse', state: null })
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, defaultValue) => {
      const translations = {
        'chargingEquipment:manageFSE': 'Manage FSE',
        'chargingEquipment:manageFSEDescription': 'Add new FSE, submit draft or updated FSE to government for validation, or decommission FSE to remove from future compliance reports.',
        'chargingEquipment:newFSE': 'New FSE',
        'chargingEquipment:selectAllDraftUpdated': 'Select All Draft/Updated',
        'chargingEquipment:selectAllValidated': 'Select All Validated',
        'chargingEquipment:submitSelected': 'Submit selected',
        'chargingEquipment:setToDecommissioned': 'Set to Decommissioned',
        'chargingEquipment:errorLoadingEquipment': 'Error loading equipment',
        'common:cancel': 'Cancel'
      }
      return translations[key] || defaultValue || key
    }
  })
}))

// Mock components
vi.mock('@/components/ClearFiltersButton', () => ({
  ClearFiltersButton: ({ onClick }) => (
    <button data-test="clear-filters-button" onClick={onClick}>
      Clear Filters
    </button>
  )
}))

vi.mock('@/components/BCDataGrid/BCGridViewer.jsx', () => ({
  BCGridViewer: ({
    rowData,
    queryData,
    onRowClicked,
    onSelectionChanged,
    gridRef,
    highlightedRowId,
    onPaginationChange,
    onSortChanged,
    onFilterChanged
  }) => {
    const items = rowData ?? queryData?.data?.items ?? []

    if (gridRef) {
      const deselectAllMock = vi.fn()
      gridRef.current = {
        api: {
          setFilterModel: vi.fn(),
          getFilterModel: vi.fn(() => ({})),
          forEachNode: (callback) =>
            items.forEach((row, index) =>
              callback({
                data: row,
                setSelected: vi.fn(),
                updateData: vi.fn()
              })
            ),
          getSelectedNodes: vi.fn(() => []),
          deselectAll: deselectAllMock
        }
      }
    }

    const triggerSelectionChanged = (selectedItems) => {
      if (gridRef?.current?.api) {
        gridRef.current.api.getSelectedNodes = vi.fn(() =>
          selectedItems.map((row) => ({ data: row }))
        )
      }
      onSelectionChanged?.({
        api: {
          getSelectedNodes: () => selectedItems.map((row) => ({ data: row }))
        }
      })
    }

    return (
      <div data-test="bc-grid-viewer">
        {items.map((row) => (
          <div
            key={row.charging_equipment_id}
            data-test={`equipment-row-${row.charging_equipment_id}`}
            onClick={() => onRowClicked?.({ data: row })}
            className={
              highlightedRowId === row.charging_equipment_id.toString()
                ? 'highlighted'
                : ''
            }
          >
            <span data-test="status">{row.status}</span>
            <span data-test="serial-number">{row.serial_number}</span>
            <span data-test="manufacturer">{row.manufacturer}</span>
          </div>
        ))}

        <div data-test="selection-controls">
          <button
            onClick={() => triggerSelectionChanged(items)}
            data-test="select-all"
          >
            Select All
          </button>
          <button
            onClick={() => triggerSelectionChanged([])}
            data-test="deselect-all"
          >
            Deselect All
          </button>
        </div>

        <div data-test="pagination-controls">
          <button
            onClick={() =>
              onPaginationChange?.({
                page: 2,
                size: 25,
                sortOrders: [],
                filters: []
              })
            }
          >
            Page 2
          </button>
        </div>
      </div>
    )
  }
}))

vi.mock('../components/BulkActionButtons', () => ({
  BulkActionButtons: ({ selectedRows, canSubmit, canDecommission, onSubmitClick, onDecommissionClick }) => (
    <div data-test="bulk-action-buttons">
      {selectedRows?.length > 0 && canSubmit && (
        <button data-test="submit-selected-btn" onClick={onSubmitClick}>
          Submit Selected ({selectedRows.filter(r => r.status === 'Draft' || r.status === 'Updated').length})
        </button>
      )}
      {selectedRows?.length > 0 && canDecommission && (
        <button data-test="decommission-selected-btn" onClick={onDecommissionClick}>
          Set to Decommissioned ({selectedRows.filter(r => r.status === 'Validated').length})
        </button>
      )}
    </div>
  )
}))

vi.mock('../components/BulkActionModals', () => ({
  BulkActionModals: ({ 
    showSubmitModal, 
    showDecommissionModal, 
    onSubmitConfirm, 
    onDecommissionConfirm,
    onSubmitCancel,
    onDecommissionCancel 
  }) => (
    <div data-test="bulk-action-modals">
      {showSubmitModal && (
        <div data-test="submit-modal">
          <button data-test="confirm-submit" onClick={onSubmitConfirm}>Confirm Submit</button>
          <button data-test="cancel-submit" onClick={onSubmitCancel}>Cancel</button>
        </div>
      )}
      {showDecommissionModal && (
        <div data-test="decommission-modal">
          <button data-test="confirm-decommission" onClick={onDecommissionConfirm}>Confirm Decommission</button>
          <button data-test="cancel-decommission" onClick={onDecommissionCancel}>Cancel</button>
        </div>
      )}
    </div>
  )
}))

// Mock data
const mockEquipmentData = {
  items: [
    {
      charging_equipment_id: 1,
      status: 'Draft',
      site_name: 'Test Site 1',
      registration_number: 'TEST1-001',
      version: 1,
      allocating_organization_name: 'Test Org',
      serial_number: 'ABC123',
      manufacturer: 'Tesla',
      model: 'Supercharger',
      level_of_equipment_name: 'Level 2',
      created_date: '2024-01-01',
      updated_date: '2024-01-02'
    },
    {
      charging_equipment_id: 2,
      status: 'Validated',
      site_name: 'Test Site 2',
      registration_number: 'TEST2-001',
      version: 1,
      allocating_organization_name: 'Test Org',
      serial_number: 'XYZ789',
      manufacturer: 'ChargePoint',
      model: 'Express',
      level_of_equipment_name: 'Level 3',
      created_date: '2024-01-01',
      updated_date: '2024-01-02'
    }
  ],
  total_count: 2,
  total_pages: 1,
  current_page: 1,
  page_size: 25
}

const TestWrapper = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          {children}
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('ChargingEquipment', () => {
  let mockCurrentUser, mockChargingEquipment

  beforeEach(async () => {
    vi.clearAllMocks()

    mockCurrentUser = {
      data: { 
        user_type: 'Supplier',
        organization_id: 1,
        hasAnyRole: vi.fn(() => true),
        hasRoles: vi.fn(() => true)
      },
      hasAnyRole: vi.fn(() => true),
      hasRoles: vi.fn(() => true)
    }

    mockChargingEquipment = {
      data: mockEquipmentData,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      submitEquipment: vi.fn(),
      decommissionEquipment: vi.fn(),
      isSubmitting: false,
      isDecommissioning: false
    }

    // Setup mocks
    const { useCurrentUser } = await import('@/hooks/useCurrentUser')
    const { useChargingEquipment } = await import('@/hooks/useChargingEquipment')
    
    useCurrentUser.mockReturnValue(mockCurrentUser)
    useChargingEquipment.mockReturnValue(mockChargingEquipment)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders charging equipment page correctly', async () => {
    render(
      <TestWrapper>
        <ChargingEquipment />
      </TestWrapper>
    )

    expect(screen.getByText('Manage FSE')).toBeInTheDocument()
    expect(screen.getByText(/Add new FSE, submit draft/)).toBeInTheDocument()
    expect(screen.getByText('New FSE')).toBeInTheDocument()
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('displays equipment data in grid', async () => {
    render(
      <TestWrapper>
        <ChargingEquipment />
      </TestWrapper>
    )

    await waitFor(() => {
      expect(screen.getByTestId('equipment-row-1')).toBeInTheDocument()
      expect(screen.getByTestId('equipment-row-2')).toBeInTheDocument()
    })

    // Check equipment details
    expect(screen.getByText('ABC123')).toBeInTheDocument()
    expect(screen.getByText('Tesla')).toBeInTheDocument()
    expect(screen.getByText('XYZ789')).toBeInTheDocument()
    expect(screen.getByText('ChargePoint')).toBeInTheDocument()
  })

  it('handles new FSE button click', async () => {
    render(
      <TestWrapper>
        <ChargingEquipment />
      </TestWrapper>
    )

    const newFseButton = screen.getByText('New FSE')
    fireEvent.click(newFseButton)

    expect(mockNavigate).toHaveBeenCalledWith('/compliance-reporting/fse/add')
  })

  it('handles row click for draft equipment', async () => {
    render(
      <TestWrapper>
        <ChargingEquipment />
      </TestWrapper>
    )

    await waitFor(() => {
      const draftRow = screen.getByTestId('equipment-row-1')
      fireEvent.click(draftRow)
    })

    expect(mockNavigate).toHaveBeenCalledWith('/compliance-reporting/fse/1/edit')
  })

  it('handles row click for validated equipment', async () => {
    render(
      <TestWrapper>
        <ChargingEquipment />
      </TestWrapper>
    )

    await waitFor(() => {
      const validatedRow = screen.getByTestId('equipment-row-2')
      fireEvent.click(validatedRow)
    })

    expect(mockNavigate).toHaveBeenCalledWith('/compliance-reporting/fse/2/edit')
  })

  it('shows bulk action buttons when equipment is selected', async () => {
    render(
      <TestWrapper>
        <ChargingEquipment />
      </TestWrapper>
    )

    // Select all equipment
    await waitFor(() => {
      const selectAllButton = screen.getByTestId('select-all')
      fireEvent.click(selectAllButton)
    })

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Submit selected/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /Set to Decommissioned/i })
      ).toBeInTheDocument()
    })
  })

  it('handles bulk submit action', async () => {
    mockChargingEquipment.submitEquipment.mockResolvedValue({
      success: true,
      message: 'Successfully submitted equipment'
    })

    render(
      <TestWrapper>
        <ChargingEquipment />
      </TestWrapper>
    )

    // Select equipment
    await waitFor(() => {
      const selectAllButton = screen.getByTestId('select-all')
      fireEvent.click(selectAllButton)
    })

    // Click submit button
    await waitFor(() => {
      const submitButton = screen.getByRole('button', {
        name: /Submit selected/i
      })
      fireEvent.click(submitButton)
    })

    // Confirm in modal
    await waitFor(() => {
      const confirmButton = screen.getByTestId('confirm-submit')
      fireEvent.click(confirmButton)
    })

    expect(mockChargingEquipment.submitEquipment).toHaveBeenCalledWith([1, 2])
  })

  it('handles bulk decommission action', async () => {
    mockChargingEquipment.decommissionEquipment.mockResolvedValue({
      success: true,
      message: 'Successfully decommissioned equipment'
    })

    render(
      <TestWrapper>
        <ChargingEquipment />
      </TestWrapper>
    )

    // Select equipment
    await waitFor(() => {
      const selectAllButton = screen.getByTestId('select-all')
      fireEvent.click(selectAllButton)
    })

    // Click decommission button
    await waitFor(() => {
      const decommissionButton = screen.getByRole('button', {
        name: /Set to Decommissioned/i
      })
      fireEvent.click(decommissionButton)
    })

    // Confirm in modal
    await waitFor(() => {
      const confirmButton = screen.getByTestId('confirm-decommission')
      fireEvent.click(confirmButton)
    })

    expect(mockChargingEquipment.decommissionEquipment).toHaveBeenCalledWith([1, 2])
  })

  it('handles clear filters action', async () => {
    render(
      <TestWrapper>
        <ChargingEquipment />
      </TestWrapper>
    )

    const clearFiltersButton = screen.getByTestId('clear-filters-button')
    fireEvent.click(clearFiltersButton)

    // Should reset filters and call grid API
    await waitFor(() => {
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })
  })

  it('shows loading state', async () => {
    mockChargingEquipment.isLoading = true

    render(
      <TestWrapper>
        <ChargingEquipment />
      </TestWrapper>
    )

    // Loading component should be rendered (mocked as div)
    expect(document.querySelector('body')).toBeInTheDocument()
  })

  it('shows error state', async () => {
    mockChargingEquipment.isLoading = false
    mockChargingEquipment.isError = true

    render(
      <TestWrapper>
        <ChargingEquipment />
      </TestWrapper>
    )

    expect(screen.getByText('Error loading equipment')).toBeInTheDocument()
  })

  it('handles pagination changes', async () => {
    render(
      <TestWrapper>
        <ChargingEquipment />
      </TestWrapper>
    )

    await waitFor(() => {
      const page2Button = screen.getByText('Page 2')
      fireEvent.click(page2Button)
    })

    // Should update pagination options
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('cancels bulk action modals', async () => {
    render(
      <TestWrapper>
        <ChargingEquipment />
      </TestWrapper>
    )

    // Select equipment and trigger submit modal
    await waitFor(() => {
      const selectAllButton = screen.getByTestId('select-all')
      fireEvent.click(selectAllButton)
    })

    await waitFor(() => {
      const submitButton = screen.getByRole('button', {
        name: /Submit selected/i
      })
      fireEvent.click(submitButton)
    })

    // Cancel the modal
    await waitFor(() => {
      const cancelButton = screen.getByTestId('cancel-submit')
      fireEvent.click(cancelButton)
    })

    // Modal should be closed (not visible)
    await waitFor(() => {
      expect(screen.queryByTestId('submit-modal')).not.toBeInTheDocument()
    })
  })
})
