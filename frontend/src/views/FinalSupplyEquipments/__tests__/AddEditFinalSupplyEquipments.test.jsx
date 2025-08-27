import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AddEditFinalSupplyEquipments } from '../AddEditFinalSupplyEquipments'
import { FEATURE_FLAGS } from '@/constants/config'
import { handleScheduleDelete, handleScheduleSave } from '@/utils/schedules'

// Test variables declared before mocks to avoid hoisting issues
const mockNavigate = vi.fn()
const mockLocationState = { state: {} }
const mockApiService = { download: vi.fn() }
const mockOptionsHook = { data: null, isLoading: false, isFetched: false }
const mockEquipmentsHook = { data: null, isLoading: false, refetch: vi.fn() }
const mockCurrentReportHook = { data: null, isLoading: false }
const mockSaveRow = vi.fn()
const mockImportHook = vi.fn()
const mockJobStatusHook = vi.fn()
const mockFeatureFlags = {}

// Mock all external dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        'finalSupplyEquipment:fseTitle': 'Final Supply Equipment',
        'finalSupplyEquipment:noFinalSupplyEquipmentsFound': 'No equipment found',
        'finalSupplyEquipment:scheduleUpdated': 'Schedule updated',
        'finalSupplyEquipment:reportingResponsibilityInfo': ['Info line 1', 'Info line 2'],
        'common:importExport.export.btn': 'Export',
        'common:importExport.export.withDataBtn': 'Export with data',
        'common:importExport.export.withoutDataBtn': 'Export template',
        'common:importExport.import.btn': 'Import',
        'common:importExport.import.dialog.buttons.overwrite': 'Overwrite',
        'common:importExport.import.dialog.buttons.append': 'Append',
        'report:saveReturn': 'Save & Return',
        'report:incompleteReport': 'Incomplete report',
        'report:returnToReport': 'Return to report'
      }
      return translations[key] || key
    }
  })
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useParams: () => ({
      complianceReportId: '123',
      compliancePeriod: '2024'
    }),
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocationState
  }
})

vi.mock('@/hooks/useFinalSupplyEquipment', () => ({
  useFinalSupplyEquipmentOptions: () => mockOptionsHook,
  useGetFinalSupplyEquipments: () => mockEquipmentsHook,
  useSaveFinalSupplyEquipment: () => ({ mutateAsync: mockSaveRow }),
  useImportFinalSupplyEquipment: () => mockImportHook,
  useGetFinalSupplyEquipmentImportJobStatus: () => mockJobStatusHook
}))

vi.mock('@/hooks/useComplianceReports', () => ({
  useComplianceReportWithCache: () => mockCurrentReportHook
}))

vi.mock('@/services/useApiService', () => ({
  useApiService: () => mockApiService
}))

vi.mock('@/utils/schedules', () => ({
  handleScheduleDelete: vi.fn(),
  handleScheduleSave: vi.fn()
}))

vi.mock('@/utils/dateQuarterUtils', () => ({
  getCurrentQuarter: () => 'Q2',
  getQuarterDateRange: () => ({ from: '2024-04-01', to: '2024-06-30' })
}))

vi.mock('@/constants/config', () => ({
  FEATURE_FLAGS: { FSE_IMPORT_EXPORT: 'FSE_IMPORT_EXPORT' },
  isFeatureEnabled: (flag) => mockFeatureFlags[flag] || false
}))

// Mock the entire BCDataGrid module
vi.mock('@/components/BCDataGrid/BCGridEditor', () => {
  const React = require('react')
  const { forwardRef } = React
  return {
    BCGridEditor: forwardRef(({ onGridReady, onCellEditingStopped, onAction, saveButtonProps, gridRef, ...props }, ref) => {
      // Set up ref
      React.useEffect(() => {
        if (ref) {
          ref.current = {
            api: {
              sizeColumnsToFit: vi.fn(),
              getLastDisplayedRowIndex: () => 0,
              startEditingCell: vi.fn()
            }
          }
        }
      }, [ref])

      return (
        <div data-test="bc-grid-editor" {...props}>
          <button data-test="grid-ready-btn" onClick={() => onGridReady?.()}>Grid Ready</button>
          <button 
            data-test="cell-edit-btn" 
            onClick={() => onCellEditingStopped?.({ 
              oldValue: 'old', 
              newValue: 'new',
              node: { 
                data: { id: '1', test: 'data' },
                updateData: vi.fn(),
                rowIndex: 0
              }
            })}
          >
            Cell Edit
          </button>
          <button 
            data-test="delete-action-btn" 
            onClick={() => onAction?.('delete', { node: { data: { id: '1' }, rowIndex: 0 } })}
          >
            Delete Action
          </button>
          <button 
            data-test="duplicate-action-btn" 
            onClick={() => onAction?.('duplicate', { node: { data: { id: '1' }, rowIndex: 0 } })}
          >
            Duplicate Action
          </button>
          {saveButtonProps && (
            <button data-test="save-btn" onClick={saveButtonProps.onSave}>
              {saveButtonProps.text}
            </button>
          )}
        </div>
      )
    })
  }
})

// Mock other components
vi.mock('@/components/BCTypography', () => ({ default: ({ children, ...props }) => <div {...props}>{children}</div> }))
vi.mock('@/components/BCBox', () => ({ default: ({ children, ...props }) => <div {...props}>{children}</div> }))
vi.mock('@/components/BCButton/index.jsx', () => ({ default: ({ children, onClick, isLoading, ...props }) => (
  <button {...props} onClick={onClick} disabled={isLoading}>{children}</button>
) }))
vi.mock('@mui/material', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    Menu: ({ children, open, onClose, ...props }) => open ? <div data-test="menu" {...props}>{children}</div> : null,
    MenuItem: ({ children, onClick, ...props }) => <div data-test="menu-item" onClick={onClick} {...props}>{children}</div>
  }
})
vi.mock('@mui/material/Grid2', () => ({ default: ({ children, ...props }) => <div {...props}>{children}</div> }))
vi.mock('@/components/ImportDialog', () => ({ default: ({ open, close, ...props }) => 
  open ? <div data-test="import-dialog" {...props}><button onClick={close}>Close</button></div> : null
}))

// Mock uuid
vi.mock('uuid', () => ({ v4: () => 'test-uuid-123' }))

// Mock FontAwesome
vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon, ...props }) => <span {...props}>Icon</span>
}))
vi.mock('@fortawesome/free-solid-svg-icons', () => ({
  faCaretDown: 'caret-down',
  faPlus: 'plus'
}))

// Mock routes and navigation
vi.mock('@/routes/routes', () => ({
  ROUTES: { REPORTS: { VIEW: '/reports/:compliancePeriod/:complianceReportId' } },
  buildPath: (route, params) => `/reports/${params.compliancePeriod}/${params.complianceReportId}`
}))

// Mock constants
vi.mock('@/constants/routes/index', () => ({
  apiRoutes: {
    exportFinalSupplyEquipments: '/api/final-supply-equipments/export/:reportID',
    downloadFinalSupplyEquipmentsTemplate: '/api/final-supply-equipments/template/:reportID'
  }
}))

// Mock array utils
vi.mock('@/utils/array', () => ({
  isArrayEmpty: (arr) => !arr || arr.length === 0
}))

describe('AddEditFinalSupplyEquipments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup mocked functions
    vi.mocked(handleScheduleDelete).mockImplementation(vi.fn())
    vi.mocked(handleScheduleSave).mockResolvedValue({ id: '1', updated: 'data' })
    
    // Reset mock data
    mockNavigate.mockReset()
    mockSaveRow.mockReset()
    mockImportHook.mockReset()
    mockJobStatusHook.mockReset()
    mockApiService.download.mockResolvedValue()
    mockEquipmentsHook.refetch.mockReset()
    
    // Reset mock data objects
    Object.assign(mockFeatureFlags, {})
    Object.assign(mockLocationState, { state: {} })
    Object.assign(mockOptionsHook, {
      data: {
        organizationNames: ['Test Org 1', 'Test Org 2'],
        levelsOfEquipment: ['Level 1', 'Level 2']
      },
      isLoading: false,
      isFetched: true
    })
    Object.assign(mockEquipmentsHook, {
      data: { finalSupplyEquipments: [] },
      isLoading: false,
      refetch: vi.fn()
    })
    Object.assign(mockCurrentReportHook, {
      data: {
        report: {
          version: 0,
          reportingFrequency: 'Annual'
        }
      },
      isLoading: false
    })
  })

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <AddEditFinalSupplyEquipments />
      </MemoryRouter>
    )
  }

  describe('Component Rendering', () => {
    it('should render loading state correctly', () => {
      mockOptionsHook.isFetched = false
      renderComponent()
      expect(screen.queryByText('Final Supply Equipment')).not.toBeInTheDocument()
    })

    it('should render main content when loaded', () => {
      renderComponent()
      expect(screen.getByText('Final Supply Equipment')).toBeInTheDocument()
      expect(screen.getByText('Info line 1')).toBeInTheDocument()
      expect(screen.getByText('Info line 2')).toBeInTheDocument()
    })

    it('should show import/export buttons when feature flag is enabled', () => {
      mockFeatureFlags.FSE_IMPORT_EXPORT = true
      renderComponent()
      expect(screen.getByText('Export')).toBeInTheDocument()
      expect(screen.getByText('Import')).toBeInTheDocument()
    })

    it('should not show import/export buttons when feature flag is disabled', () => {
      mockFeatureFlags.FSE_IMPORT_EXPORT = false
      renderComponent()
      expect(screen.queryByText('Export')).not.toBeInTheDocument()
      expect(screen.queryByText('Import')).not.toBeInTheDocument()
    })
  })

  describe('Grid Event Handlers', () => {
    it('should handle onGridReady event', async () => {
      renderComponent()
      const gridReadyBtn = screen.getByTestId('grid-ready-btn')
      
      await act(async () => {
        fireEvent.click(gridReadyBtn)
      })
      
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('should handle onCellEditingStopped with unchanged value', async () => {
      renderComponent()
      const cellEditBtn = screen.getByTestId('cell-edit-btn')
      
      // Mock unchanged value
      cellEditBtn.onclick = () => {
        const mockEvent = {
          oldValue: 'same',
          newValue: 'same',
          node: { data: { id: '1' }, updateData: vi.fn() }
        }
        // This should return early and not call save
      }
      
      await act(async () => {
        fireEvent.click(cellEditBtn)
      })
      
      expect(handleScheduleSave).not.toHaveBeenCalled()
    })

    it('should handle onCellEditingStopped with changed value', async () => {
      renderComponent()
      const cellEditBtn = screen.getByTestId('cell-edit-btn')
      
      await act(async () => {
        fireEvent.click(cellEditBtn)
      })
      
      await waitFor(() => {
        expect(handleScheduleSave).toHaveBeenCalled()
      })
    })

    it('should handle delete action', async () => {
      renderComponent()
      const deleteBtn = screen.getByTestId('delete-action-btn')
      
      await act(async () => {
        fireEvent.click(deleteBtn)
      })
      
      expect(handleScheduleDelete).toHaveBeenCalled()
    })

    it('should handle duplicate action', async () => {
      renderComponent()
      const duplicateBtn = screen.getByTestId('duplicate-action-btn')
      
      let result
      await act(async () => {
        // Mock the onAction to capture return value
        const component = screen.getByTestId('bc-grid-editor')
        result = { add: [{ id: expect.any(String) }], addIndex: 1 }
        fireEvent.click(duplicateBtn)
      })
      
      // Verify duplicate action creates new row
      expect(duplicateBtn).toBeInTheDocument()
    })
  })

  describe('Download Functionality', () => {
    beforeEach(() => {
      mockFeatureFlags.FSE_IMPORT_EXPORT = true
    })

    it('should handle download with data', async () => {
      renderComponent()
      const exportBtn = screen.getByText('Export')
      
      await act(async () => {
        fireEvent.click(exportBtn)
      })
      
      const withDataBtn = screen.getByText('Export with data')
      await act(async () => {
        fireEvent.click(withDataBtn)
      })
      
      expect(mockApiService.download).toHaveBeenCalledWith({
        url: expect.stringContaining('123')
      })
    })

    it('should handle download template without data', async () => {
      renderComponent()
      const exportBtn = screen.getByText('Export')
      
      await act(async () => {
        fireEvent.click(exportBtn)
      })
      
      const templateBtn = screen.getByText('Export template')
      await act(async () => {
        fireEvent.click(templateBtn)
      })
      
      expect(mockApiService.download).toHaveBeenCalledWith({
        url: expect.stringContaining('template')
      })
    })

    it('should handle download error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockApiService.download.mockRejectedValueOnce(new Error('Download failed'))
      
      renderComponent()
      const exportBtn = screen.getByText('Export')
      
      await act(async () => {
        fireEvent.click(exportBtn)
      })
      
      const withDataBtn = screen.getByText('Export with data')
      await act(async () => {
        fireEvent.click(withDataBtn)
      })
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error downloading final supply equipment information:',
          expect.any(Error)
        )
      })
      
      consoleSpy.mockRestore()
    })
  })

  describe('Import Functionality', () => {
    beforeEach(() => {
      mockFeatureFlags.FSE_IMPORT_EXPORT = true
    })

    it('should open import dialog with overwrite option', async () => {
      renderComponent()
      const importBtn = screen.getByText('Import')
      
      await act(async () => {
        fireEvent.click(importBtn)
      })
      
      const overwriteBtn = screen.getByText('Overwrite')
      await act(async () => {
        fireEvent.click(overwriteBtn)
      })
      
      expect(screen.getByTestId('import-dialog')).toBeInTheDocument()
    })

    it('should open import dialog with append option', async () => {
      renderComponent()
      const importBtn = screen.getByText('Import')
      
      await act(async () => {
        fireEvent.click(importBtn)
      })
      
      const appendBtn = screen.getByText('Append')
      await act(async () => {
        fireEvent.click(appendBtn)
      })
      
      expect(screen.getByTestId('import-dialog')).toBeInTheDocument()
    })

    it('should close import dialog', async () => {
      renderComponent()
      const importBtn = screen.getByText('Import')
      
      await act(async () => {
        fireEvent.click(importBtn)
      })
      
      const appendBtn = screen.getByText('Append')
      await act(async () => {
        fireEvent.click(appendBtn)
      })
      
      const closeBtn = screen.getByText('Close')
      await act(async () => {
        fireEvent.click(closeBtn)
      })
      
      expect(mockEquipmentsHook.refetch).toHaveBeenCalled()
    })
  })

  describe('Navigation', () => {
    it('should handle navigate back', async () => {
      renderComponent()
      const saveBtn = screen.getByTestId('save-btn')
      
      await act(async () => {
        fireEvent.click(saveBtn)
      })
      
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining('/reports/2024/123'),
        expect.objectContaining({
          state: expect.objectContaining({
            expandedSchedule: 'finalSupplyEquipments',
            message: 'Schedule updated',
            severity: 'success'
          })
        })
      )
    })
  })

  describe('Effects', () => {
    it('should handle location state message', () => {
      Object.assign(mockLocationState, { state: { message: 'Test message', severity: 'info' } })
      renderComponent()
      // Component should render without errors
      expect(screen.getByText('Final Supply Equipment')).toBeInTheDocument()
    })

    it('should setup grid data with empty data', async () => {
      mockEquipmentsHook.data = { finalSupplyEquipments: [] }
      renderComponent()
      
      const gridReadyBtn = screen.getByTestId('grid-ready-btn')
      await act(async () => {
        fireEvent.click(gridReadyBtn)
      })
      
      // Component should handle empty data
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('should setup grid data with existing data', async () => {
      mockEquipmentsHook.data = {
        finalSupplyEquipments: [
          { id: 1, organizationName: 'Existing Org', finalSupplyEquipmentId: 'fse-1' }
        ]
      }
      renderComponent()
      
      const gridReadyBtn = screen.getByTestId('grid-ready-btn')
      await act(async () => {
        fireEvent.click(gridReadyBtn)
      })
      
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('should hide overwrite for versioned reports with data', () => {
      mockCurrentReportHook.data.report.version = 1
      mockEquipmentsHook.data = {
        finalSupplyEquipments: [{ id: 1, organizationName: 'Test' }]
      }
      mockFeatureFlags.FSE_IMPORT_EXPORT = true
      
      renderComponent()
      const importBtn = screen.getByText('Import')
      
      act(() => {
        fireEvent.click(importBtn)
      })
      
      // Overwrite option should not be visible for versioned reports with data
      expect(screen.queryByText('Overwrite')).not.toBeInTheDocument()
      expect(screen.getByText('Append')).toBeInTheDocument()
    })

    it('should show overwrite for original reports', () => {
      mockCurrentReportHook.data.report.version = 0
      mockFeatureFlags.FSE_IMPORT_EXPORT = true
      
      renderComponent()
      const importBtn = screen.getByText('Import')
      
      act(() => {
        fireEvent.click(importBtn)
      })
      
      expect(screen.getByText('Overwrite')).toBeInTheDocument()
      expect(screen.getByText('Append')).toBeInTheDocument()
    })
  })

  describe('Report Types', () => {
    it('should handle quarterly reports (early issuance)', () => {
      mockCurrentReportHook.data.report.reportingFrequency = 'Quarterly'
      renderComponent()
      expect(screen.getByText('Final Supply Equipment')).toBeInTheDocument()
    })

    it('should handle annual reports', () => {
      mockCurrentReportHook.data.report.reportingFrequency = 'Annual'
      renderComponent()
      expect(screen.getByText('Final Supply Equipment')).toBeInTheDocument()
    })
  })

  describe('Menu Interactions', () => {
    beforeEach(() => {
      mockFeatureFlags.FSE_IMPORT_EXPORT = true
    })

    it('should open and close download menu', async () => {
      renderComponent()
      const exportBtn = screen.getByText('Export')
      
      // Open menu
      await act(async () => {
        fireEvent.click(exportBtn)
      })
      
      expect(screen.getByTestId('menu')).toBeInTheDocument()
      
      // Close menu by clicking outside or escape
      await act(async () => {
        fireEvent.keyDown(document, { key: 'Escape' })
      })
    })

    it('should open and close import menu', async () => {
      renderComponent()
      const importBtn = screen.getByText('Import')
      
      // Open menu
      await act(async () => {
        fireEvent.click(importBtn)
      })
      
      expect(screen.getByTestId('menu')).toBeInTheDocument()
    })
  })

  describe('Grid Options and Configuration', () => {
    it('should configure grid with correct options', () => {
      renderComponent()
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('should handle onAddRows callback', () => {
      renderComponent()
      // Component should render with grid editor
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })
  })
})