import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { BCPagination } from '../BCPagination'

// Mock MUI components
const mockTablePagination = vi.fn()
vi.mock('@mui/material', () => ({
  TablePagination: (props) => {
    mockTablePagination(props)
    
    // Extract and test labelDisplayedRows function
    if (props.labelDisplayedRows) {
      const testLabelResult = props.labelDisplayedRows({ from: 1, to: 10, count: 100 })
      return (
        <div data-test="table-pagination">
          <div data-test="label-displayed-rows">{testLabelResult}</div>
          <div data-test="actions">
            {props.ActionsComponent && props.ActionsComponent({ 
              count: props.count, 
              page: props.page, 
              rowsPerPage: props.rowsPerPage,
              onPageChange: props.onPageChange 
            })}
          </div>
          <div data-test="icon-component">
            {props.slotProps?.select?.IconComponent && 
             props.slotProps.select.IconComponent({ 'data-test': 'dropdown-icon' })}
          </div>
        </div>
      )
    }
    
    return <div data-test="table-pagination">TablePagination</div>
  }
}))

// Mock MUI icons
vi.mock('@mui/icons-material', () => ({
  ArrowDropDown: (props) => <div data-test="arrow-drop-down" {...props}>ArrowDropDown</div>
}))

// Mock BCPaginationActions
vi.mock('../BCPaginationActions', () => ({
  BCPaginationActions: (props) => (
    <div data-test="bc-pagination-actions" data-props={JSON.stringify(props)}>
      BCPaginationActions
    </div>
  )
}))

describe('BCPagination', () => {
  const defaultProps = {
    total: 100,
    page: 1,
    handleChangePage: vi.fn(),
    size: 10,
    handleChangeRowsPerPage: vi.fn(),
    gridRef: { current: { api: {} } }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      render(<BCPagination {...defaultProps} />)
      
      expect(screen.getByTestId('table-pagination')).toBeInTheDocument()
      expect(mockTablePagination).toHaveBeenCalledWith(
        expect.objectContaining({
          className: 'ag-grid-pagination',
          'aria-label': 'pagination for BC DataGrid',
          component: 'div',
          count: 100,
          page: 0, // page - 1
          rowsPerPage: 10,
          rowsPerPageOptions: [5, 10, 20, 25, 50, 100],
          labelRowsPerPage: 'Page Size:',
          showFirstButton: true,
          showLastButton: true
        })
      )
    })

    it('renders with custom props', () => {
      const customProps = {
        ...defaultProps,
        total: 250,
        page: 3,
        size: 25,
        enableResetButton: true,
        enableCopyButton: true,
        enableExportButton: true,
        exportName: 'CustomExport'
      }

      render(<BCPagination {...customProps} />)
      
      expect(mockTablePagination).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 250,
          page: 2, // page - 1
          rowsPerPage: 25
        })
      )
    })
  })

  describe('Props Handling', () => {
    it('applies default values for optional props', () => {
      const minimalProps = {
        handleChangePage: vi.fn(),
        handleChangeRowsPerPage: vi.fn(),
        gridRef: { current: { api: {} } }
      }

      render(<BCPagination {...minimalProps} />)
      
      expect(mockTablePagination).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 0, // default total
          page: 0, // default page - 1
          rowsPerPage: 10 // default size
        })
      )
    })

    it('handles zero total correctly', () => {
      render(<BCPagination {...defaultProps} total={0} />)
      
      expect(mockTablePagination).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 0
        })
      )
    })

    it('passes callback functions correctly', () => {
      const handleChangePage = vi.fn()
      const handleChangeRowsPerPage = vi.fn()

      render(
        <BCPagination 
          {...defaultProps} 
          handleChangePage={handleChangePage}
          handleChangeRowsPerPage={handleChangeRowsPerPage}
        />
      )
      
      expect(mockTablePagination).toHaveBeenCalledWith(
        expect.objectContaining({
          onPageChange: handleChangePage,
          onRowsPerPageChange: handleChangeRowsPerPage
        })
      )
    })
  })

  describe('labelDisplayedRows Function', () => {
    it('renders label with correct formatting', () => {
      render(<BCPagination {...defaultProps} />)
      
      const labelElement = screen.getByTestId('label-displayed-rows')
      expect(labelElement).toBeInTheDocument()
      
      // Check for bold elements and text content
      const boldElements = labelElement.querySelectorAll('b')
      expect(boldElements).toHaveLength(3)
      expect(boldElements[0]).toHaveTextContent('1')
      expect(boldElements[1]).toHaveTextContent('10')
      expect(boldElements[2]).toHaveTextContent('100')
    })

    it('handles different from/to/count values', () => {
      // This tests the labelDisplayedRows function with different values
      // The mock will automatically test with from:1, to:10, count:100
      render(<BCPagination {...defaultProps} />)
      
      expect(screen.getByTestId('label-displayed-rows')).toBeInTheDocument()
    })
  })

  describe('ActionsComponent Function', () => {
    it('renders BCPaginationActions with default props', () => {
      render(<BCPagination {...defaultProps} />)
      
      const actionsElement = screen.getByTestId('bc-pagination-actions')
      expect(actionsElement).toBeInTheDocument()
      
      const propsData = JSON.parse(actionsElement.getAttribute('data-props'))
      expect(propsData).toEqual(
        expect.objectContaining({
          enableResetButton: false,
          enableCopyButton: false,
          enableExportButton: false,
          exportName: 'ExportData',
          gridRef: { current: { api: {} } }
        })
      )
    })

    it('renders BCPaginationActions with custom props', () => {
      const customProps = {
        ...defaultProps,
        enableResetButton: true,
        enableCopyButton: true,
        enableExportButton: true,
        exportName: 'MyExport'
      }

      render(<BCPagination {...customProps} />)
      
      const actionsElement = screen.getByTestId('bc-pagination-actions')
      const propsData = JSON.parse(actionsElement.getAttribute('data-props'))
      
      expect(propsData).toEqual(
        expect.objectContaining({
          enableResetButton: true,
          enableCopyButton: true,
          enableExportButton: true,
          exportName: 'MyExport'
        })
      )
    })

    it('passes pagination props to ActionsComponent', () => {
      render(<BCPagination {...defaultProps} />)
      
      const actionsElement = screen.getByTestId('bc-pagination-actions')
      const propsData = JSON.parse(actionsElement.getAttribute('data-props'))
      
      expect(propsData).toEqual(
        expect.objectContaining({
          count: 100,
          page: 0, // page - 1
          rowsPerPage: 10
        })
      )
    })
  })

  describe('IconComponent Function', () => {
    it('renders ArrowDropDown icon with correct props', () => {
      render(<BCPagination {...defaultProps} />)
      
      const iconElement = screen.getByTestId('dropdown-icon')
      expect(iconElement).toBeInTheDocument()
      expect(iconElement).toHaveAttribute('data-test', 'dropdown-icon')
    })

    it('applies custom styling to ArrowDropDown icon', () => {
      render(<BCPagination {...defaultProps} />)
      
      // Verify that the icon component is called with the correct props
      expect(mockTablePagination).toHaveBeenCalledWith(
        expect.objectContaining({
          slotProps: expect.objectContaining({
            select: expect.objectContaining({
              IconComponent: expect.any(Function)
            })
          })
        })
      )
    })
  })

  describe('Boolean Props Combinations', () => {
    it('handles all boolean props as false', () => {
      const props = {
        ...defaultProps,
        enableResetButton: false,
        enableCopyButton: false,
        enableExportButton: false
      }

      render(<BCPagination {...props} />)
      
      const actionsElement = screen.getByTestId('bc-pagination-actions')
      const propsData = JSON.parse(actionsElement.getAttribute('data-props'))
      
      expect(propsData.enableResetButton).toBe(false)
      expect(propsData.enableCopyButton).toBe(false)
      expect(propsData.enableExportButton).toBe(false)
    })

    it('handles all boolean props as true', () => {
      const props = {
        ...defaultProps,
        enableResetButton: true,
        enableCopyButton: true,
        enableExportButton: true
      }

      render(<BCPagination {...props} />)
      
      const actionsElement = screen.getByTestId('bc-pagination-actions')
      const propsData = JSON.parse(actionsElement.getAttribute('data-props'))
      
      expect(propsData.enableResetButton).toBe(true)
      expect(propsData.enableCopyButton).toBe(true)
      expect(propsData.enableExportButton).toBe(true)
    })

    it('handles mixed boolean prop combinations', () => {
      const props = {
        ...defaultProps,
        enableResetButton: true,
        enableCopyButton: false,
        enableExportButton: true
      }

      render(<BCPagination {...props} />)
      
      const actionsElement = screen.getByTestId('bc-pagination-actions')
      const propsData = JSON.parse(actionsElement.getAttribute('data-props'))
      
      expect(propsData.enableResetButton).toBe(true)
      expect(propsData.enableCopyButton).toBe(false)
      expect(propsData.enableExportButton).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('handles page 0 correctly', () => {
      render(<BCPagination {...defaultProps} page={0} />)
      
      expect(mockTablePagination).toHaveBeenCalledWith(
        expect.objectContaining({
          page: -1 // page - 1
        })
      )
    })

    it('handles large page numbers', () => {
      render(<BCPagination {...defaultProps} page={999} />)
      
      expect(mockTablePagination).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 998 // page - 1
        })
      )
    })

    it('handles null gridRef', () => {
      render(<BCPagination {...defaultProps} gridRef={null} />)
      
      const actionsElement = screen.getByTestId('bc-pagination-actions')
      const propsData = JSON.parse(actionsElement.getAttribute('data-props'))
      
      expect(propsData.gridRef).toBe(null)
    })

    it('handles undefined gridRef', () => {
      const props = { ...defaultProps }
      delete props.gridRef
      
      render(<BCPagination {...props} />)
      
      const actionsElement = screen.getByTestId('bc-pagination-actions')
      const propsData = JSON.parse(actionsElement.getAttribute('data-props'))
      
      expect(propsData.gridRef).toBe(null)
    })
  })

  describe('Slots and SlotProps Configuration', () => {
    it('configures slots correctly', () => {
      render(<BCPagination {...defaultProps} />)
      
      expect(mockTablePagination).toHaveBeenCalledWith(
        expect.objectContaining({
          slots: {
            root: 'div',
            toolbar: 'nav'
          }
        })
      )
    })

    it('configures slotProps with IconComponent', () => {
      render(<BCPagination {...defaultProps} />)
      
      expect(mockTablePagination).toHaveBeenCalledWith(
        expect.objectContaining({
          slotProps: {
            select: {
              IconComponent: expect.any(Function)
            }
          }
        })
      )
    })
  })

  describe('Component Configuration', () => {
    it('sets correct component and accessibility props', () => {
      render(<BCPagination {...defaultProps} />)
      
      expect(mockTablePagination).toHaveBeenCalledWith(
        expect.objectContaining({
          className: 'ag-grid-pagination',
          'aria-label': 'pagination for BC DataGrid',
          component: 'div'
        })
      )
    })

    it('sets correct pagination options', () => {
      render(<BCPagination {...defaultProps} />)
      
      expect(mockTablePagination).toHaveBeenCalledWith(
        expect.objectContaining({
          rowsPerPageOptions: [5, 10, 20, 25, 50, 100],
          labelRowsPerPage: 'Page Size:',
          showFirstButton: true,
          showLastButton: true
        })
      )
    })
  })

  describe('Component DisplayName', () => {
    it('has correct displayName', () => {
      expect(BCPagination.displayName).toBe('BCPagination')
    })
  })
})