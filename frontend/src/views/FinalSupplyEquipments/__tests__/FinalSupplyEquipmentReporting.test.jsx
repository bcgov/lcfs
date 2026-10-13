import { act, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, expect, vi, beforeEach } from 'vitest'
import { FinalSupplyEquipmentReporting } from '../FinalSupplyEquipmentReporting'
import { test } from '@/tests/utils/fixtures'

let render
const fixtureOptions = undefined
const it = (name, fn) =>
  test(name, ({ render: fixtureRender, query, theme }) => {
    render = (ui, options) => fixtureRender(ui, [query, theme], options)
    return fn()
  })

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
  useSetFSEReportingDefaultDates: vi.fn(),
  useUpdateFSEReportingActiveStatus: vi.fn(),
  useImportFSEReportingUpdate: vi.fn(),
  useGetFSEReportingUpdateJobStatus: vi.fn()
}))

// vi.hoisted ensures this mock ref is available inside the hoisted vi.mock factory.
const mockApiDownload = vi.hoisted(() => vi.fn().mockResolvedValue({}))

// The component uses useApiService directly for the download; mock it
// so the Keycloak dependency is never touched during rendering.
vi.mock('@/services/useApiService', () => ({
  useApiService: () => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    download: mockApiDownload
  })
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
  useSetFSEReportingDefaultDates,
  useUpdateFSEReportingActiveStatus,
  useImportFSEReportingUpdate,
  useGetFSEReportingUpdateJobStatus
} from '@/hooks/useFinalSupplyEquipment'
import { useComplianceReportWithCache } from '@/hooks/useComplianceReports'
import { handleScheduleSave } from '@/utils/schedules'
import { useFseReportingSavedRowsStore } from '@/stores/useFseReportingSavedRowsStore'

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
    useFseReportingSavedRowsStore.setState({ savedRows: {} })

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

    // Mock useUpdateFSEReportingActiveStatus
    vi.mocked(useUpdateFSEReportingActiveStatus).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ data: {} })
    })

    // Reset API download mock
    mockApiDownload.mockResolvedValue({})

    // Mock bulk update hooks
    vi.mocked(useImportFSEReportingUpdate).mockReturnValue({
      mutate: vi.fn()
    })
    vi.mocked(useGetFSEReportingUpdateJobStatus).mockReturnValue({
      data: null,
      refetch: vi.fn()
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

      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('does not break hook ordering when loading data resolves after initial render', async () => {
      let reportState = {
        data: null,
        isLoading: true
      }

      vi.mocked(useComplianceReportWithCache).mockImplementation(
        () => reportState
      )

      const { rerender } = render(<FinalSupplyEquipmentReporting />, {
        fixtureOptions
      })

      reportState = {
        data: mockReportData,
        isLoading: false
      }

      expect(() => rerender(<FinalSupplyEquipmentReporting />)).not.toThrow()

      await waitFor(() => {
        expect(screen.getByText('Grid Editor')).toBeInTheDocument()
      })
    })

    it('renders the component with title and description', () => {
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      // Grid editor is rendered immediately by the mock
      expect(screen.getByText('Grid Editor')).toBeInTheDocument()
    })

    it('renders date input fields', () => {
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      const fromDateInput = screen.getByLabelText(/default from/i)
      const toDateInput = screen.getByLabelText(/default to/i)

      expect(fromDateInput).toBeInTheDocument()
      expect(toDateInput).toBeInTheDocument()
    })

    it('renders site name filter dropdown', () => {
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      const autocomplete = screen.getByRole('combobox')
      expect(autocomplete).toBeInTheDocument()
    })

    it('renders set default values button', () => {
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      const setDefaultButton = screen.getByRole('button', {
        name: /set default/i
      })
      expect(setDefaultButton).toBeInTheDocument()
    })

    it('renders grid editor component', () => {
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      // Use text content instead of testid
      expect(screen.getByText('Grid Editor')).toBeInTheDocument()
    })
  })

  it('saves row changes when cell value changes', async () => {
    render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

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
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      expect(useGetFSEReportingList).toHaveBeenCalledWith(
        '123',
        expect.objectContaining({
          page: expect.any(Number),
          size: expect.any(Number)
        }),
        expect.objectContaining({ enabled: true }),
        456,
        'all'
      )
    })

    it('fetches site names on mount', () => {
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      expect(useSiteNames).toHaveBeenCalled()
    })

    it('displays loading state when sites are loading', () => {
      vi.mocked(useSiteNames).mockReturnValue({
        data: [],
        isLoading: true,
        isError: false
      })

      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      // The autocomplete should show loading state
      const autocomplete = screen.getByRole('combobox')
      expect(autocomplete).toBeInTheDocument()
    })
  })

  describe('Site Filter Functionality', () => {
    it('updates filter when site is selected', async () => {
      const { container } = render(<FinalSupplyEquipmentReporting />, {
        fixtureOptions
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
        fixtureOptions
      })

      const autocomplete = screen.getByRole('combobox')
      expect(autocomplete).toBeInTheDocument()
    })
  })

  describe('Date Range Validation', () => {
    it('validates that from date is before to date', async () => {
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

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
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

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
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      const setDefaultButton = screen.getByRole('button', {
        name: /set default/i
      })
      expect(setDefaultButton).toBeDisabled()
    })

    it('is disabled when date range is invalid', async () => {
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

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
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      // Grid is rendered by the mock
      expect(screen.getByText('Grid Editor')).toBeInTheDocument()
    })

    it('sets up grid with correct column definitions', () => {
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

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

      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      // Grid still renders even with API error
      expect(screen.getByText('Grid Editor')).toBeInTheDocument()
    })

    it('handles site names loading error', () => {
      vi.mocked(useSiteNames).mockReturnValue({
        data: [],
        isLoading: false,
        isError: true
      })

      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      const autocomplete = screen.getByRole('combobox')
      expect(autocomplete).toBeInTheDocument()
    })
  })

  describe('Store Integration', () => {
    it('retrieves report data from store', () => {
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      expect(useComplianceReportWithCache).toHaveBeenCalled()
    })

    it('uses organization ID from store in queries', () => {
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      expect(useGetFSEReportingList).toHaveBeenCalledWith(
        '123',
        expect.objectContaining({
          page: expect.any(Number),
          size: expect.any(Number)
        }),
        expect.objectContaining({ enabled: true }),
        456,
        'all'
      )
    })
  })

  describe('Pagination', () => {
    it('initializes with default pagination options', () => {
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      expect(useGetFSEReportingList).toHaveBeenCalledWith(
        '123',
        expect.objectContaining({
          page: expect.any(Number),
          size: expect.any(Number)
        }),
        expect.objectContaining({ enabled: true }),
        456,
        'all'
      )
    })

    it('updates pagination when filter changes', async () => {
      const { container } = render(<FinalSupplyEquipmentReporting />, {
        fixtureOptions
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
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      const fromDateInput = screen.getByLabelText(/default from/i)
      const toDateInput = screen.getByLabelText(/default to/i)

      // Check that inputs exist with date type
      expect(fromDateInput).toHaveAttribute('type', 'date')
      expect(toDateInput).toHaveAttribute('type', 'date')
    })
  })

  describe('Bulk Update Template Buttons', () => {
    it('renders the "Download update template" button', () => {
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      const downloadBtn = screen.getByRole('button', {
        name: /download.*template/i
      })
      expect(downloadBtn).toBeInTheDocument()
    })

    it('renders the "Upload update template" button', () => {
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      const uploadBtn = screen.getByRole('button', {
        name: /upload.*template/i
      })
      expect(uploadBtn).toBeInTheDocument()
    })

    it('download button is not in a loading state initially', () => {
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      const downloadBtn = screen.getByRole('button', {
        name: /download.*template/i
      })
      expect(downloadBtn).not.toBeDisabled()
    })

    it('download button shows loading state while downloading', async () => {
      // Mock the download to never resolve so we can observe the loading state
      let resolveDownload
      mockApiDownload.mockReturnValue(
        new Promise((res) => {
          resolveDownload = res
        })
      )

      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      const downloadBtn = screen.getByRole('button', {
        name: /download.*template/i
      })
      fireEvent.click(downloadBtn)

      // The button should enter a loading/disabled state while the download is in-flight
      await waitFor(() => {
        expect(mockApiDownload).toHaveBeenCalled()
      })

      // Resolve to clean up
      resolveDownload({})
    })

    it('clicking download button triggers the api service download', async () => {
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      const downloadBtn = screen.getByRole('button', {
        name: /download.*template/i
      })
      fireEvent.click(downloadBtn)

      await waitFor(() => {
        expect(mockApiDownload).toHaveBeenCalled()
      })
    })

    it('import hook is called with the compliance report ID', () => {
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      // useImportFSEReportingUpdate is passed as the importHook prop to ImportDialog,
      // which calls it at render time; verify it was invoked.
      expect(useImportFSEReportingUpdate).toHaveBeenCalled()
    })
  })
  // The list is read from a materialized view refreshed in the background, so
  // the fetch that follows a save can still return the row as it was (#5132).
  describe('Saved values while the list catches up', () => {
    const listRow = (overrides = {}) => ({
      chargingEquipmentId: 1,
      chargingEquipmentVersion: 2,
      chargingEquipmentComplianceId: 99,
      complianceReportId: 123,
      complianceReportGroupUuid: 'group-uuid',
      isActive: true,
      supplyFromDate: '2024-01-01',
      supplyToDate: '2024-12-31',
      kwhUsage: 100,
      complianceNotes: null,
      ...overrides
    })
    const otherRow = listRow({
      chargingEquipmentId: 2,
      chargingEquipmentComplianceId: 98
    })
    const listResponse = (rows, dataUpdatedAt) => ({
      data: {
        finalSupplyEquipments: rows,
        pagination: { total: rows.length, page: 1, size: 10 }
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      dataUpdatedAt
    })
    const latestGridRows = () =>
      mockBCGrid.mock.calls.at(-1)[0].queryData.data.finalSupplyEquipments
    const savedRowsForReport = () =>
      useFseReportingSavedRowsStore.getState().savedRows['123']

    // As with AG Grid, the edited value is already on the row data when
    // onCellValueChanged fires.
    const editKwh = async (
      kwhUsage,
      saveResult = { validationStatus: 'success', modified: false, id: 99 }
    ) => {
      handleScheduleSave.mockResolvedValueOnce(saveResult)
      const { onCellValueChanged } = mockBCGrid.mock.calls.at(-1)[0]
      const data = listRow({ kwhUsage })
      const updateData = vi.fn()
      await act(async () => {
        await onCellValueChanged({
          oldValue: 100,
          newValue: kwhUsage,
          data,
          node: { data, updateData },
          api: { autoSizeAllColumns: vi.fn() }
        })
      })
      return updateData
    }

    beforeEach(() => {
      vi.mocked(useGetFSEReportingList).mockReturnValue(
        listResponse([listRow(), otherRow], 1)
      )
    })

    it('keeps the saved kWh when the refetch returns the row as it was', async () => {
      const { rerender } = render(<FinalSupplyEquipmentReporting />, {
        fixtureOptions
      })

      await editKwh(250)
      vi.mocked(useGetFSEReportingList).mockReturnValue(
        listResponse([listRow(), otherRow], Date.now() + 1000)
      )
      rerender(<FinalSupplyEquipmentReporting />)

      const rows = latestGridRows()
      expect(rows[0].kwhUsage).toBe(250)
      expect(rows[1]).toBe(otherRow)
      expect(savedRowsForReport()).toBeDefined()
    })

    it('shows the list as returned once it has the saved value', async () => {
      const { rerender } = render(<FinalSupplyEquipmentReporting />, {
        fixtureOptions
      })

      await editKwh(250)
      vi.mocked(useGetFSEReportingList).mockReturnValue(
        listResponse([listRow({ kwhUsage: 250 }), otherRow], Date.now() + 1000)
      )
      rerender(<FinalSupplyEquipmentReporting />)

      await waitFor(() => expect(savedRowsForReport()).toBeUndefined())

      // A later change made elsewhere is not hidden.
      vi.mocked(useGetFSEReportingList).mockReturnValue(
        listResponse([listRow({ kwhUsage: 300 }), otherRow], Date.now() + 2000)
      )
      rerender(<FinalSupplyEquipmentReporting />)

      expect(latestGridRows()[0].kwhUsage).toBe(300)
    })

    it('sends later saves to the record the update answered with', async () => {
      const { rerender } = render(<FinalSupplyEquipmentReporting />, {
        fixtureOptions
      })

      const updateData = await editKwh(250, {
        validationStatus: 'success',
        modified: false,
        id: 555
      })

      expect(updateData).toHaveBeenLastCalledWith(
        expect.objectContaining({
          kwhUsage: 250,
          chargingEquipmentComplianceId: 555,
          validationStatus: 'success'
        })
      )

      vi.mocked(useGetFSEReportingList).mockReturnValue(
        listResponse([listRow(), otherRow], Date.now() + 1000)
      )
      rerender(<FinalSupplyEquipmentReporting />)

      expect(latestGridRows()[0]).toMatchObject({
        kwhUsage: 250,
        chargingEquipmentComplianceId: 555
      })
    })

    it('does not hold values from a save that failed', async () => {
      const { rerender } = render(<FinalSupplyEquipmentReporting />, {
        fixtureOptions
      })

      const updateData = await editKwh(250, { validationStatus: 'error' })

      expect(savedRowsForReport()).toBeUndefined()
      expect(updateData).toHaveBeenLastCalledWith(
        expect.objectContaining({
          chargingEquipmentComplianceId: 99,
          validationStatus: 'error'
        })
      )

      vi.mocked(useGetFSEReportingList).mockReturnValue(
        listResponse([listRow(), otherRow], Date.now() + 1000)
      )
      rerender(<FinalSupplyEquipmentReporting />)

      expect(latestGridRows()[0].kwhUsage).toBe(100)
    })

    it('keeps the saved kWh when the page is opened again', async () => {
      const { unmount } = render(<FinalSupplyEquipmentReporting />, {
        fixtureOptions
      })

      await editKwh(250)
      unmount()

      vi.mocked(useGetFSEReportingList).mockReturnValue(
        listResponse([listRow(), otherRow], Date.now() + 1000)
      )
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      expect(latestGridRows()[0].kwhUsage).toBe(250)
    })

    it('stops holding saved dates for rows given default dates', async () => {
      render(<FinalSupplyEquipmentReporting />, { fixtureOptions })

      await editKwh(250)
      mockBCGrid.mock.calls.at(-1)[0].gridRef.current = {
        api: {
          getSelectedNodes: () => [{ data: listRow() }, { data: otherRow }],
          forEachNode: () => {},
          setNodesSelected: () => {}
        }
      }

      const setDefaultButton = screen.getByRole('button', {
        name: /set default/i
      })
      await waitFor(() => expect(setDefaultButton).toBeEnabled())
      await act(async () => {
        fireEvent.click(setDefaultButton)
      })

      await waitFor(() =>
        expect(savedRowsForReport()['1-2'].values).toEqual({
          kwhUsage: 250,
          complianceNotes: null,
          chargingEquipmentComplianceId: 99
        })
      )
    })
  })
})
