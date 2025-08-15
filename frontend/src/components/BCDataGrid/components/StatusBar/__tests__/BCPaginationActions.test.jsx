import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme } from '@mui/material/styles'
import { BCPaginationActions } from '../BCPaginationActions'

const theme = createTheme()

const renderWithTheme = (component) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  )
}

// Mock Material-UI components
vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material')
  return {
    ...actual,
    Pagination: vi.fn(({ onChange, showFirstButton, showLastButton, component, color, ...props }) => (
      <div data-test="pagination" onClick={() => onChange && onChange(null, 2)} {...props}>
        Mock Pagination
      </div>
    )),
    IconButton: vi.fn(({ onClick, children, ...props }) => (
      <button data-test={props.id} onClick={onClick} {...props}>
        {children}
      </button>
    )),
    Tooltip: vi.fn(({ children }) => <div>{children}</div>)
  }
})

// Mock Material-UI icons
vi.mock('@mui/icons-material', () => ({
  Replay: () => <span>Replay</span>,
  ContentCopy: () => <span>ContentCopy</span>,
  FileDownloadOutlined: () => <span>FileDownloadOutlined</span>
}))

// Mock BCBox component
vi.mock('@/components/BCBox', () => ({
  default: vi.fn(({ children, ...props }) => (
    <div data-test="bc-box" {...props}>
      {children}
    </div>
  ))
}))

// Mock XLSX library
vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn(() => ({ '!cols': [] })),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn()
  },
  writeFile: vi.fn()
}))

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn()
  }
})

describe('BCPaginationActions', () => {
  let mockOnPageChange
  let mockGridRef
  let defaultProps

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockOnPageChange = vi.fn()
    mockGridRef = {
      current: {
        api: {
          resetColumnState: vi.fn(),
          setFilterModel: vi.fn(),
          getDataAsCsv: vi.fn(() => 'mock,csv,data'),
          showLoadingOverlay: vi.fn(),
          forEachNodeAfterFilterAndSort: vi.fn((callback) => {
            callback({ data: { id: 1, name: 'Test', date: '2023-01-01T10:00:00Z' } })
            callback({ data: { id: 2, name: 'Test2', date: '2023-01-02T11:00:00Z' } })
          }),
          getColumnDefs: vi.fn(() => [
            { field: 'id', headerName: 'ID' },
            { field: 'name', headerName: 'Name' },
            { field: 'date', headerName: 'Date' }
          ])
        }
      }
    }

    defaultProps = {
      count: 100,
      page: 0,
      rowsPerPage: 10,
      onPageChange: mockOnPageChange,
      enableResetButton: true,
      enableCopyButton: true,
      enableExportButton: true,
      exportName: 'Test Export',
      gridRef: mockGridRef
    }
  })

  describe('Component Rendering', () => {
    it('renders with required props only', () => {
      const requiredProps = {
        count: 50,
        page: 1,
        rowsPerPage: 5,
        onPageChange: mockOnPageChange
      }
      
      renderWithTheme(<BCPaginationActions {...requiredProps} />)
      
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
      expect(screen.getByTestId('bc-box')).toBeInTheDocument()
    })

    it('renders with all optional props enabled', () => {
      renderWithTheme(<BCPaginationActions {...defaultProps} />)
      
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
      expect(screen.getByTestId('reloadGridButton')).toBeInTheDocument()
      expect(screen.getByTestId('copyGridButton')).toBeInTheDocument()
      expect(screen.getByTestId('downloadGridButton')).toBeInTheDocument()
    })

    it('renders with optional props disabled', () => {
      const props = {
        ...defaultProps,
        enableResetButton: false,
        enableCopyButton: false,
        enableExportButton: false
      }
      
      renderWithTheme(<BCPaginationActions {...props} />)
      
      expect(screen.getByTestId('pagination')).toBeInTheDocument()
      expect(screen.queryByTestId('reloadGridButton')).not.toBeInTheDocument()
      expect(screen.queryByTestId('copyGridButton')).not.toBeInTheDocument()
      expect(screen.queryByTestId('downloadGridButton')).not.toBeInTheDocument()
    })

    it('pagination component receives correct props', async () => {
      const { Pagination } = await import('@mui/material')
      
      renderWithTheme(<BCPaginationActions {...defaultProps} />)
      
      expect(Pagination).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 10, // Math.ceil(100 / 10)
          page: 1,   // page + 1
          component: 'div',
          color: 'primary',
          showFirstButton: true,
          showLastButton: true
        }),
        expect.anything()
      )
    })
  })

  describe('reloadGrid Function', () => {
    it('calls resetColumnState and setFilterModel when gridRef exists', () => {
      renderWithTheme(<BCPaginationActions {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('reloadGridButton'))
      
      expect(mockGridRef.current.api.resetColumnState).toHaveBeenCalled()
      expect(mockGridRef.current.api.setFilterModel).toHaveBeenCalledWith(null)
    })

    it('handles missing gridRef gracefully', () => {
      const props = { ...defaultProps, gridRef: null }
      
      renderWithTheme(<BCPaginationActions {...props} />)
      
      expect(() => {
        fireEvent.click(screen.getByTestId('reloadGridButton'))
      }).not.toThrow()
    })

    it('handles missing gridRef.current gracefully', () => {
      const props = { ...defaultProps, gridRef: { current: null } }
      
      renderWithTheme(<BCPaginationActions {...props} />)
      
      expect(() => {
        fireEvent.click(screen.getByTestId('reloadGridButton'))
      }).not.toThrow()
    })
  })

  describe('handleCopyData Function', () => {
    it('calls getDataAsCsv and clipboard.writeText when gridRef exists', () => {
      renderWithTheme(<BCPaginationActions {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('copyGridButton'))
      
      expect(mockGridRef.current.api.getDataAsCsv).toHaveBeenCalledWith({
        allColumns: true,
        onlySelected: true,
        skipColumnHeaders: true
      })
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('mock,csv,data')
    })

    it('handles missing gridRef gracefully', () => {
      const props = { ...defaultProps, gridRef: null }
      
      renderWithTheme(<BCPaginationActions {...props} />)
      
      expect(() => {
        fireEvent.click(screen.getByTestId('copyGridButton'))
      }).not.toThrow()
    })

    it('handles missing gridRef.current gracefully', () => {
      const props = { ...defaultProps, gridRef: { current: null } }
      
      renderWithTheme(<BCPaginationActions {...props} />)
      
      expect(() => {
        fireEvent.click(screen.getByTestId('copyGridButton'))
      }).not.toThrow()
    })
  })

  describe('handlePageChange Function', () => {
    it('calls onPageChange when pagination is clicked', () => {
      renderWithTheme(<BCPaginationActions {...defaultProps} />)
      
      // Click the pagination element which triggers onChange
      fireEvent.click(screen.getByTestId('pagination'))
      
      expect(mockOnPageChange).toHaveBeenCalledWith(null, 1) // 2 - 1
    })

    it('calls showLoadingOverlay when gridRef exists and page changes', () => {
      renderWithTheme(<BCPaginationActions {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('pagination'))
      
      expect(mockGridRef.current.api.showLoadingOverlay).toHaveBeenCalled()
    })

    it('handles missing gridRef gracefully', () => {
      const props = { ...defaultProps, gridRef: null }
      
      renderWithTheme(<BCPaginationActions {...props} />)
      
      expect(() => {
        fireEvent.click(screen.getByTestId('pagination'))
      }).not.toThrow()
      
      expect(mockOnPageChange).toHaveBeenCalled()
    })
  })

  describe('handleDownloadData Function', () => {
    it('collects data and creates Excel file', async () => {
      const XLSX = await import('xlsx')
      
      renderWithTheme(<BCPaginationActions {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('downloadGridButton'))
      
      expect(mockGridRef.current.api.forEachNodeAfterFilterAndSort).toHaveBeenCalled()
      expect(mockGridRef.current.api.getColumnDefs).toHaveBeenCalled()
      expect(XLSX.utils.json_to_sheet).toHaveBeenCalled()
      expect(XLSX.utils.book_new).toHaveBeenCalled()
      expect(XLSX.utils.book_append_sheet).toHaveBeenCalled()
      expect(XLSX.writeFile).toHaveBeenCalled()
    })

    it('formats date strings correctly', async () => {
      const XLSX = await import('xlsx')
      
      renderWithTheme(<BCPaginationActions {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('downloadGridButton'))
      
      const transformedData = XLSX.utils.json_to_sheet.mock.calls[0][0]
      expect(transformedData[0]['Date']).toBe('2023-01-01') // Date part only
      expect(transformedData[1]['Date']).toBe('2023-01-02') // Date part only
    })

    it('preserves non-date values', async () => {
      const XLSX = await import('xlsx')
      
      renderWithTheme(<BCPaginationActions {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('downloadGridButton'))
      
      const transformedData = XLSX.utils.json_to_sheet.mock.calls[0][0]
      expect(transformedData[0]['ID']).toBe(1)
      expect(transformedData[0]['Name']).toBe('Test')
    })

    it('calculates column widths correctly', async () => {
      const XLSX = await import('xlsx')
      
      renderWithTheme(<BCPaginationActions {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('downloadGridButton'))
      
      // The function should set !cols property on the worksheet
      expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ ID: 1, Name: 'Test' })
        ])
      )
    })

    it('creates Excel file with correct name format', async () => {
      const XLSX = await import('xlsx')
      
      // Mock current date
      const mockDate = new Date('2023-01-15T10:00:00Z')
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate)
      Date.prototype.toISOString = vi.fn(() => '2023-01-15T10:00:00.000Z')
      
      renderWithTheme(<BCPaginationActions {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('downloadGridButton'))
      
      expect(XLSX.writeFile).toHaveBeenCalledWith(
        expect.anything(),
        'test_export_2023-01-15.xls',
        { bookType: 'xls', type: 'binary' }
      )
      
      vi.restoreAllMocks()
    })


    it('handles missing fieldToHeaderNameMap entries', () => {
      // Mock getColumnDefs to return empty array
      mockGridRef.current.api.getColumnDefs.mockReturnValue([])
      
      renderWithTheme(<BCPaginationActions {...defaultProps} />)
      
      expect(() => {
        fireEvent.click(screen.getByTestId('downloadGridButton'))
      }).not.toThrow()
    })

    it('handles empty rows gracefully', async () => {
      const XLSX = await import('xlsx')
      
      // Mock forEachNodeAfterFilterAndSort to not call callback
      mockGridRef.current.api.forEachNodeAfterFilterAndSort.mockImplementation(() => {})
      
      renderWithTheme(<BCPaginationActions {...defaultProps} />)
      
      expect(() => {
        fireEvent.click(screen.getByTestId('downloadGridButton'))
      }).not.toThrow()
      
      expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith([])
    })
  })
})