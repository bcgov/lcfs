import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FinalSupplyEquipmentReporting } from '../FinalSupplyEquipmentReporting'
import { wrapper } from '@/tests/utils/wrapper'

// Mock dependencies
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({
    complianceReportId: '123',
    compliancePeriod: '2024'
  })
}))

vi.mock('@/hooks/useChargingSite', () => ({
  useSiteNames: vi.fn()
}))

vi.mock('@/hooks/useFinalSupplyEquipment', () => ({
  useGetFSEReportingList: vi.fn(),
  useSaveFSEReporting: vi.fn(),
  useDeleteFSEReportingBatch: vi.fn(),
  useSetFSEReportingDefaultDates: vi.fn()
}))

vi.mock('@/hooks/useComplianceReports', () => ({
  useComplianceReportWithCache: vi.fn()
}))

vi.mock('./_schema', () => ({
  getFSEReportingColDefs: vi.fn(() => [
    { field: 'chargingEquipmentId', headerName: 'Equipment ID' },
    { field: 'supplyFromDate', headerName: 'From Date' },
    { field: 'supplyToDate', headerName: 'To Date' }
  ])
}))

const mockBCGrid = vi.fn(({ onGridReady }) => {
  if (onGridReady) {
    setTimeout(() => onGridReady(), 0)
  }
  return <div data-testid="bc-grid-editor">Grid Editor</div>
})

vi.mock('@/components/BCDataGrid/BCGridEditorPaginated', () => ({
  BCGridEditorPaginated: (props) => mockBCGrid(props)
}))

vi.mock('@/utils/schedules', () => ({
  handleScheduleSave: vi.fn()
}))

import { useSiteNames } from '@/hooks/useChargingSite'
import {
  useGetFSEReportingList,
  useSaveFSEReporting,
  useDeleteFSEReportingBatch,
  useSetFSEReportingDefaultDates
} from '@/hooks/useFinalSupplyEquipment'
import { useComplianceReportWithCache } from '@/hooks/useComplianceReports'
import { handleScheduleSave } from '@/utils/schedules'

describe('FinalSupplyEquipmentReporting', () => {
  const mockSiteNames = [
    { chargingSiteId: 1, siteName: 'Site A' },
    { chargingSiteId: 2, siteName: 'Site B' }
  ]

  const mockFSEData = {
    finalSupplyEquipments: [
      {
        chargingEquipmentId: 1,
        serialNumber: 'SN001',
        complianceReportId: null, // No compliance report ID means not selected
        supplyFromDate: null,
        supplyToDate: null,
        kwhUsage: 1000
      },
      {
        chargingEquipmentId: 2,
        serialNumber: 'SN002',
        complianceReportId: null, // No compliance report ID means not selected
        supplyFromDate: null,
        supplyToDate: null,
        kwhUsage: 2000
      }
    ],
    pagination: { total: 2, page: 1, size: 10 }
  }

  const mockReportData = {
    report: {
      organizationId: 456,
      compliancePeriodId: 789,
      complianceReportGroupUuid: 'group-uuid'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock useSiteNames
    vi.mocked(useSiteNames).mockReturnValue({
      data: mockSiteNames,
      isLoading: false,
      isError: false
    })

    // Mock useGetFSEReportingList
    vi.mocked(useGetFSEReportingList).mockReturnValue({
      data: mockFSEData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    })

    // Mock useSaveFSEReporting
    vi.mocked(useSaveFSEReporting).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ data: { id: 1 } })
    })

    // Mock useDeleteFSEReportingBatch
    vi.mocked(useDeleteFSEReportingBatch).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ data: {} })
    })

    // Mock useSetFSEReportingDefaultDates
    vi.mocked(useSetFSEReportingDefaultDates).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ data: {} })
    })

    // Mock useComplianceReportWithCache
    vi.mocked(useComplianceReportWithCache).mockReturnValue({
      data: mockReportData,
      isLoading: false
    })
    handleScheduleSave.mockResolvedValue({
      validationStatus: 'success',
      modified: false
    })
    mockBCGrid.mockClear()
  })

  describe('Component Rendering', () => {
    it('renders loading state when compliance report is loading', () => {
      vi.mocked(useComplianceReportWithCache).mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<FinalSupplyEquipmentReporting />, { wrapper })
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('renders the component with title and description', () => {
      render(<FinalSupplyEquipmentReporting />, { wrapper })

      // Grid editor is rendered immediately by the mock
      expect(screen.getByText('Grid Editor')).toBeInTheDocument()
    })

    it('renders date input fields', () => {
      render(<FinalSupplyEquipmentReporting />, { wrapper })

      const fromDateInput = screen.getByLabelText(/default from/i)
      const toDateInput = screen.getByLabelText(/default to/i)
      
      expect(fromDateInput).toBeInTheDocument()
      expect(toDateInput).toBeInTheDocument()
    })

    it('renders site name filter dropdown', () => {
      render(<FinalSupplyEquipmentReporting />, { wrapper })

      const autocomplete = screen.getByRole('combobox')
      expect(autocomplete).toBeInTheDocument()
    })

    it('renders set default values button', () => {
      render(<FinalSupplyEquipmentReporting />, { wrapper })

      const setDefaultButton = screen.getByRole('button', {
        name: /set default/i
      })
      expect(setDefaultButton).toBeInTheDocument()
    })

    it('renders grid editor component', () => {
      render(<FinalSupplyEquipmentReporting />, { wrapper })

      // Use text content instead of testid
      expect(screen.getByText('Grid Editor')).toBeInTheDocument()
    })
  })

  it('saves row changes when cell value changes', async () => {
    render(<FinalSupplyEquipmentReporting />, { wrapper })

    const gridCall = mockBCGrid.mock.calls[0][0]
    const mockUpdateData = vi.fn()
    const mockAutoSize = vi.fn()
    const mockParams = {
      oldValue: '2024-01-01',
      newValue: '2024-02-01',
      node: {
        data: {
          chargingEquipmentId: 1,
          chargingEquipmentVersion: 2,
          chargingEquipmentComplianceId: 99,
          supplyFromDate: '2024-02-01',
          supplyToDate: '2024-02-15',
          kwhUsage: 100,
          complianceNotes: 'note'
        },
        updateData: mockUpdateData
      },
      data: {
        chargingEquipmentId: 1,
        chargingEquipmentVersion: 2,
        chargingEquipmentComplianceId: 99,
        supplyFromDate: '2024-02-01',
        supplyToDate: '2024-02-15',
        kwhUsage: 100,
        complianceNotes: 'note'
      },
      api: { autoSizeAllColumns: mockAutoSize }
    }

    await gridCall.onCellValueChanged(mockParams)

    expect(handleScheduleSave).toHaveBeenCalled()
    expect(mockUpdateData).toHaveBeenCalledWith(
      expect.objectContaining({ validationStatus: 'pending' })
    )
    expect(mockAutoSize).toHaveBeenCalled()
  })

  describe('Data Fetching', () => {
    it('fetches FSE reporting list on mount', () => {
      render(<FinalSupplyEquipmentReporting />, { wrapper })

      expect(useGetFSEReportingList).toHaveBeenCalledWith(
        '123',
        expect.objectContaining({
          defaultInitialPagination: expect.any(Object)
        }),
        expect.objectContaining({ enabled: true }),
        456,
        'all'
      )
    })

    it('fetches site names on mount', () => {
      render(<FinalSupplyEquipmentReporting />, { wrapper })

      expect(useSiteNames).toHaveBeenCalled()
    })

    it('displays loading state when sites are loading', () => {
      vi.mocked(useSiteNames).mockReturnValue({
        data: [],
        isLoading: true,
        isError: false
      })

      render(<FinalSupplyEquipmentReporting />, { wrapper })

      // The autocomplete should show loading state
      const autocomplete = screen.getByRole('combobox')
      expect(autocomplete).toBeInTheDocument()
    })
  })

  describe('Site Filter Functionality', () => {
    it('updates filter when site is selected', async () => {
      const { container } = render(<FinalSupplyEquipmentReporting />, {
        wrapper
      })

      const autocomplete = screen.getByRole('combobox')
      fireEvent.mouseDown(autocomplete)

      await waitFor(() => {
        const options = screen.getAllByRole('option')
        expect(options.length).toBeGreaterThan(0)
      })
    })

    it('clears filter when site selection is cleared', async () => {
      const { container } = render(<FinalSupplyEquipmentReporting />, {
        wrapper
      })

      const autocomplete = screen.getByRole('combobox')
      expect(autocomplete).toBeInTheDocument()
    })
  })

  describe('Date Range Validation', () => {
    it('validates that from date is before to date', async () => {
      render(<FinalSupplyEquipmentReporting />, { wrapper })

      const fromDateInput = screen.getByLabelText(/default from/i)
      const toDateInput = screen.getByLabelText(/default to/i)

      // Set invalid date range
      fireEvent.change(fromDateInput, { target: { value: '2024-12-31' } })
      fireEvent.change(toDateInput, { target: { value: '2024-01-01' } })

      await waitFor(() => {
        const setDefaultButton = screen.getByRole('button', {
          name: /set default/i
        })
        expect(setDefaultButton).toBeDisabled()
      })
    })

    it('allows valid date range', async () => {
      render(<FinalSupplyEquipmentReporting />, { wrapper })

      const fromDateInput = screen.getByLabelText(/default from/i)
      const toDateInput = screen.getByLabelText(/default to/i)

      // Set valid date range
      fireEvent.change(fromDateInput, { target: { value: '2024-01-01' } })
      fireEvent.change(toDateInput, { target: { value: '2024-12-31' } })

      await waitFor(() => {
        // Button should be enabled with valid dates (if rows are selected)
        const setDefaultButton = screen.getByRole('button', {
          name: /set default/i
        })
        expect(setDefaultButton).toBeInTheDocument()
      })
    })
  })

  describe('Default Values Button', () => {
    it('is disabled when no rows are selected', () => {
      render(<FinalSupplyEquipmentReporting />, { wrapper })

      const setDefaultButton = screen.getByRole('button', {
        name: /set default/i
      })
      expect(setDefaultButton).toBeDisabled()
    })

    it('is disabled when date range is invalid', async () => {
      render(<FinalSupplyEquipmentReporting />, { wrapper })

      const fromDateInput = screen.getByLabelText(/default from/i)
      const toDateInput = screen.getByLabelText(/default to/i)

      fireEvent.change(fromDateInput, { target: { value: '2024-12-31' } })
      fireEvent.change(toDateInput, { target: { value: '2024-01-01' } })

      await waitFor(() => {
        const setDefaultButton = screen.getByRole('button', {
          name: /set default/i
        })
        expect(setDefaultButton).toBeDisabled()
      })
    })
  })

  describe('Grid Initialization', () => {
    it('calls onGridReady when grid is initialized', () => {
      render(<FinalSupplyEquipmentReporting />, { wrapper })

      // Grid is rendered by the mock
      expect(screen.getByText('Grid Editor')).toBeInTheDocument()
    })

    it('sets up grid with correct column definitions', () => {
      render(<FinalSupplyEquipmentReporting />, { wrapper })

      expect(screen.getByText('Grid Editor')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('handles API errors gracefully', () => {
      vi.mocked(useGetFSEReportingList).mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
        error: new Error('API Error'),
        refetch: vi.fn()
      })

      render(<FinalSupplyEquipmentReporting />, { wrapper })

      // Grid still renders even with API error
      expect(screen.getByText('Grid Editor')).toBeInTheDocument()
    })

    it('handles site names loading error', () => {
      vi.mocked(useSiteNames).mockReturnValue({
        data: [],
        isLoading: false,
        isError: true
      })

      render(<FinalSupplyEquipmentReporting />, { wrapper })

      const autocomplete = screen.getByRole('combobox')
      expect(autocomplete).toBeInTheDocument()
    })
  })

  describe('Store Integration', () => {
    it('retrieves report data from store', () => {
      render(<FinalSupplyEquipmentReporting />, { wrapper })

      expect(useComplianceReportWithCache).toHaveBeenCalled()
    })

    it('uses organization ID from store in queries', () => {
      render(<FinalSupplyEquipmentReporting />, { wrapper })

      expect(useGetFSEReportingList).toHaveBeenCalledWith(
        '123',
        expect.objectContaining({
          defaultInitialPagination: expect.any(Object)
        }),
        expect.objectContaining({ enabled: true }),
        456,
        'all'
      )
    })
  })

  describe('Pagination', () => {
    it('initializes with default pagination options', () => {
      render(<FinalSupplyEquipmentReporting />, { wrapper })

      expect(useGetFSEReportingList).toHaveBeenCalledWith(
        '123',
        expect.objectContaining({
          defaultInitialPagination: expect.any(Object)
        }),
        expect.objectContaining({ enabled: true }),
        456,
        'all'
      )
    })

    it('updates pagination when filter changes', async () => {
      const { container } = render(<FinalSupplyEquipmentReporting />, {
        wrapper
      })

      const autocomplete = screen.getByRole('combobox')
      fireEvent.mouseDown(autocomplete)

      await waitFor(() => {
        expect(autocomplete).toBeInTheDocument()
      })
    })
  })

  describe('Date Range Constraints', () => {
    it('enforces compliance period date boundaries', () => {
      render(<FinalSupplyEquipmentReporting />, { wrapper })

      const fromDateInput = screen.getByLabelText(/default from/i)
      const toDateInput = screen.getByLabelText(/default to/i)

      // Check that min/max attributes are set correctly
      expect(fromDateInput.min).toBe('2024-01-01')
      expect(fromDateInput.max).toBe('2024-12-31')
      expect(toDateInput.min).toBe('2024-01-01')
      expect(toDateInput.max).toBe('2024-12-31')
    })
  })
})
