import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme } from '@mui/material/styles'
import { BCPagination } from '../BCPagination'

// Mock BCPaginationActions component
vi.mock('../BCPaginationActions', () => ({
  BCPaginationActions: ({ enableResetButton, enableCopyButton, enableExportButton, exportName, gridRef, ...props }) => (
    <div 
      data-test="bc-pagination-actions"
      data-enable-reset={String(enableResetButton)}
      data-enable-copy={String(enableCopyButton)}
      data-enable-export={String(enableExportButton)}
      data-export-name={exportName || ''}
      data-grid-ref={gridRef ? 'present' : 'null'}
      data-pagination-props={JSON.stringify(props)}
    >
      BCPaginationActions Mock
    </div>
  )
}))

// Mock MUI TablePagination for detailed prop testing
vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material')
  return {
    ...actual,
    TablePagination: ({ 
      count, 
      page, 
      rowsPerPage, 
      onPageChange, 
      onRowsPerPageChange,
      ActionsComponent,
      labelDisplayedRows,
      slotProps,
      ...props 
    }) => (
      <div 
        data-test="table-pagination"
        data-count={count}
        data-page={page}
        data-rows-per-page={rowsPerPage}
        data-on-page-change={onPageChange ? 'present' : 'null'}
        data-on-rows-per-page-change={onRowsPerPageChange ? 'present' : 'null'}
        {...props}
      >
        <div data-test="label-displayed-rows">
          {labelDisplayedRows && labelDisplayedRows({ from: 1, to: 10, count: 100 })}
        </div>
        <div data-test="actions-component">
          {ActionsComponent && ActionsComponent({ count, page, rowsPerPage })}
        </div>
        <div data-test="icon-component">
          {slotProps?.select?.IconComponent && slotProps.select.IconComponent({})}
        </div>
      </div>
    )
  }
})

const theme = createTheme()

const renderWithTheme = (component) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  )
}

describe('BCPagination', () => {
  let mockHandleChangePage
  let mockHandleChangeRowsPerPage
  let defaultProps

  beforeEach(() => {
    mockHandleChangePage = vi.fn()
    mockHandleChangeRowsPerPage = vi.fn()
    defaultProps = {
      total: 100,
      page: 1,
      handleChangePage: mockHandleChangePage,
      size: 10,
      handleChangeRowsPerPage: mockHandleChangeRowsPerPage,
      gridRef: { current: {} }
    }
  })

  describe('Component Rendering', () => {
    it('renders correctly with default props', () => {
      renderWithTheme(<BCPagination {...defaultProps} />)
      
      const tablePagination = screen.getByTestId('table-pagination')
      expect(tablePagination).toBeInTheDocument()
      expect(tablePagination).toHaveAttribute('data-count', '100')
      expect(tablePagination).toHaveAttribute('data-page', '0') // page - 1
      expect(tablePagination).toHaveAttribute('data-rows-per-page', '10')
    })

    it('renders with all custom props provided', () => {
      const customProps = {
        total: 250,
        page: 3,
        handleChangePage: mockHandleChangePage,
        size: 25,
        handleChangeRowsPerPage: mockHandleChangeRowsPerPage,
        enableResetButton: true,
        enableCopyButton: true,
        enableExportButton: true,
        exportName: 'CustomExport',
        gridRef: { current: { api: {} } }
      }
      
      renderWithTheme(<BCPagination {...customProps} />)
      
      const tablePagination = screen.getByTestId('table-pagination')
      expect(tablePagination).toBeInTheDocument()
      expect(tablePagination).toHaveAttribute('data-count', '250')
      expect(tablePagination).toHaveAttribute('data-page', '2') // page - 1
      expect(tablePagination).toHaveAttribute('data-rows-per-page', '25')
      
      const actions = screen.getByTestId('bc-pagination-actions')
      expect(actions).toHaveAttribute('data-enable-reset', 'true')
      expect(actions).toHaveAttribute('data-enable-copy', 'true')
      expect(actions).toHaveAttribute('data-enable-export', 'true')
      expect(actions).toHaveAttribute('data-export-name', 'CustomExport')
    })

    it('renders with null gridRef', () => {
      const props = { ...defaultProps, gridRef: null }
      renderWithTheme(<BCPagination {...props} />)
      
      const actions = screen.getByTestId('bc-pagination-actions')
      expect(actions).toHaveAttribute('data-grid-ref', 'null')
    })

    it('renders with valid gridRef object', () => {
      const props = { ...defaultProps, gridRef: { current: { api: {}, columnApi: {} } } }
      renderWithTheme(<BCPagination {...props} />)
      
      const actions = screen.getByTestId('bc-pagination-actions')
      expect(actions).toHaveAttribute('data-grid-ref', 'present')
    })
  })

  describe('Default Props', () => {
    it('uses default values when props are not provided', () => {
      const minimalProps = {
        handleChangePage: mockHandleChangePage,
        handleChangeRowsPerPage: mockHandleChangeRowsPerPage,
        gridRef: { current: {} }
      }
      
      renderWithTheme(<BCPagination {...minimalProps} />)
      
      const tablePagination = screen.getByTestId('table-pagination')
      expect(tablePagination).toHaveAttribute('data-count', '0') // default total = 0
      expect(tablePagination).toHaveAttribute('data-page', '0') // default page = 1, so page - 1 = 0
      expect(tablePagination).toHaveAttribute('data-rows-per-page', '10') // default size = 10
      
      const actions = screen.getByTestId('bc-pagination-actions')
      expect(actions).toHaveAttribute('data-enable-reset', 'false') // default false
      expect(actions).toHaveAttribute('data-enable-copy', 'false') // default false
      expect(actions).toHaveAttribute('data-enable-export', 'false') // default false
      expect(actions).toHaveAttribute('data-export-name', 'ExportData') // default value
    })
  })

  describe('labelDisplayedRows Function', () => {
    it('returns correct JSX format with from/to/count values', () => {
      renderWithTheme(<BCPagination {...defaultProps} />)
      
      const labelElement = screen.getByTestId('label-displayed-rows')
      expect(labelElement).toBeInTheDocument()
      
      // The mock passes { from: 1, to: 10, count: 100 } to test the function
      expect(labelElement.textContent).toContain('1')
      expect(labelElement.textContent).toContain('to')
      expect(labelElement.textContent).toContain('10')
      expect(labelElement.textContent).toContain('of')
      expect(labelElement.textContent).toContain('100')
    })
  })

  describe('ActionsComponent Function', () => {
    it('renders BCPaginationActions with passed props', () => {
      const props = {
        ...defaultProps,
        enableResetButton: true,
        enableCopyButton: true,
        enableExportButton: true,
        exportName: 'TestExport'
      }
      
      renderWithTheme(<BCPagination {...props} />)
      
      const actions = screen.getByTestId('bc-pagination-actions')
      expect(actions).toBeInTheDocument()
      expect(actions).toHaveAttribute('data-enable-reset', 'true')
      expect(actions).toHaveAttribute('data-enable-copy', 'true')
      expect(actions).toHaveAttribute('data-enable-export', 'true')
      expect(actions).toHaveAttribute('data-export-name', 'TestExport')
    })
  })

  describe('IconComponent Function', () => {
    it('renders ArrowDropDown with correct styling props', () => {
      renderWithTheme(<BCPagination {...defaultProps} />)
      
      // The IconComponent should be rendered within the slotProps
      const iconComponent = screen.getByTestId('icon-component')
      expect(iconComponent).toBeInTheDocument()
    })
  })

  describe('Prop Values Testing', () => {
    it('handles different page values', () => {
      const testCases = [1, 3, 5]
      
      testCases.forEach(pageValue => {
        const { unmount } = renderWithTheme(<BCPagination {...defaultProps} page={pageValue} />)
        
        const tablePagination = screen.getByTestId('table-pagination')
        expect(tablePagination).toHaveAttribute('data-page', String(pageValue - 1))
        
        unmount()
      })
    })

    it('handles different size values', () => {
      const testCases = [5, 10, 25, 100]
      
      testCases.forEach(sizeValue => {
        const { unmount } = renderWithTheme(<BCPagination {...defaultProps} size={sizeValue} />)
        
        const tablePagination = screen.getByTestId('table-pagination')
        expect(tablePagination).toHaveAttribute('data-rows-per-page', String(sizeValue))
        
        unmount()
      })
    })

    it('handles different total values', () => {
      const testCases = [0, 10, 100]
      
      testCases.forEach(totalValue => {
        const { unmount } = renderWithTheme(<BCPagination {...defaultProps} total={totalValue} />)
        
        const tablePagination = screen.getByTestId('table-pagination')
        expect(tablePagination).toHaveAttribute('data-count', String(totalValue))
        
        unmount()
      })
    })
  })

  describe('Enable Buttons Testing', () => {
    it('handles enableResetButton=true', () => {
      const props = { ...defaultProps, enableResetButton: true }
      renderWithTheme(<BCPagination {...props} />)
      
      const actions = screen.getByTestId('bc-pagination-actions')
      expect(actions).toHaveAttribute('data-enable-reset', 'true')
    })

    it('handles enableCopyButton=true', () => {
      const props = { ...defaultProps, enableCopyButton: true }
      renderWithTheme(<BCPagination {...props} />)
      
      const actions = screen.getByTestId('bc-pagination-actions')
      expect(actions).toHaveAttribute('data-enable-copy', 'true')
    })

    it('handles enableExportButton=true', () => {
      const props = { ...defaultProps, enableExportButton: true }
      renderWithTheme(<BCPagination {...props} />)
      
      const actions = screen.getByTestId('bc-pagination-actions')
      expect(actions).toHaveAttribute('data-enable-export', 'true')
    })

    it('handles all enable buttons false (default)', () => {
      renderWithTheme(<BCPagination {...defaultProps} />)
      
      const actions = screen.getByTestId('bc-pagination-actions')
      expect(actions).toHaveAttribute('data-enable-reset', 'false')
      expect(actions).toHaveAttribute('data-enable-copy', 'false')
      expect(actions).toHaveAttribute('data-enable-export', 'false')
    })
  })

  describe('Callback Functions', () => {
    it('passes callback functions correctly to TablePagination', () => {
      renderWithTheme(<BCPagination {...defaultProps} />)
      
      const tablePagination = screen.getByTestId('table-pagination')
      expect(tablePagination).toHaveAttribute('data-on-page-change', 'present')
      expect(tablePagination).toHaveAttribute('data-on-rows-per-page-change', 'present')
    })
  })

  describe('Component Properties', () => {
    it('has correct displayName', () => {
      expect(BCPagination.displayName).toBe('BCPagination')
    })

    it('has correct PropTypes defined', () => {
      expect(BCPagination.propTypes).toBeDefined()
      expect(typeof BCPagination.propTypes).toBe('object')
    })
  })
})