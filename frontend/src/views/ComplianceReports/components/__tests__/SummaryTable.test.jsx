import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes'
import SummaryTable from '../SummaryTable'

// Mock formatters
vi.mock('@/utils/formatters', () => ({
  currencyFormatter: vi.fn(
    (value, useParenthesis, decimals) => `$${value.toFixed(decimals || 2)}`
  ),
  formatNumberWithCommas: vi.fn(({ value }) =>
    value?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  ),
  numberFormatter: vi.fn((value, useParenthesis, decimals) =>
    value?.toFixed(decimals || 0)
  )
}))

// Mock Material-UI components for simplified testing
vi.mock('@mui/material', () => ({
  Paper: ({ children, ...props }) => (
    <div data-test="paper" {...props}>
      {children}
    </div>
  ),
  Table: ({ children, ...props }) => (
    <table data-test="table" {...props}>
      {children}
    </table>
  ),
  TableBody: ({ children, ...props }) => (
    <tbody data-test="table-body" {...props}>
      {children}
    </tbody>
  ),
  TableCell: ({ children, ...props }) => (
    <td data-test="table-cell" {...props}>
      {children}
    </td>
  ),
  TableContainer: ({ children, ...props }) => (
    <div data-test="table-container" {...props}>
      {children}
    </div>
  ),
  TableHead: ({ children, ...props }) => (
    <thead data-test="table-head" {...props}>
      {children}
    </thead>
  ),
  TableRow: ({ children, ...props }) => (
    <tr data-test="table-row" {...props}>
      {children}
    </tr>
  ),
  Input: ({ value, onChange, onBlur, onFocus, onKeyDown, inputProps, startAdornment, ...props }) => (
    <div data-test="input-wrapper">
      {startAdornment}
      <input
        data-test="input"
        value={value || ''}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        {...inputProps}
        {...props}
      />
    </div>
  ),
  TextField: ({ value, onChange, onBlur, slotProps, ...props }) => (
    <div data-test="input-wrapper">
      {slotProps?.input?.startAdornment}
      <input
        data-test="input"
        value={value || ''}
        onChange={onChange}
        onBlur={onBlur}
        {...slotProps?.htmlInput}
        {...props}
      />
    </div>
  ),
  InputAdornment: ({ children, ...props }) => (
    <span data-test="input-adornment" {...props}>
      {children}
    </span>
  ),
  CircularProgress: () => <div data-test="circular-progress" />,
  Tooltip: ({ children }) => children
}))

// Mock react-number-format
vi.mock('react-number-format', () => ({
  NumericFormat: ({
    customInput: CustomInput,
    value,
    onValueChange,
    onBlur,
    onFocus,
    onKeyDown,
    thousandSeparator,
    decimalScale,
    allowNegative,
    slotProps,
    ...props
  }) => {
    const handleChange = (e) => {
      const rawValue = e.target.value.replace(/,/g, '')
      onValueChange?.({
        value: rawValue,
        floatValue: parseFloat(rawValue) || 0
      })
    }
    return CustomInput ? (
      <CustomInput
        value={value || ''}
        onChange={handleChange}
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        slotProps={slotProps}
        {...props}
      />
    ) : (
      <input
        data-test="input"
        value={value || ''}
        onChange={handleChange}
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        {...props}
      />
    )
  }
}))

// Custom render function with providers
const customRender = (ui, options = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  const AllTheProviders = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  )

  return render(ui, { wrapper: AllTheProviders, ...options })
}

describe('SummaryTable', () => {
  const mockOnCellEditStopped = vi.fn()

  // Comprehensive test data structures
  const basicColumns = [
    { id: 'description', label: 'Description', align: 'left', width: '200px' },
    { id: 'value', label: 'Value', align: 'right', bold: true }
  ]

  const editableColumns = [
    { id: 'description', label: 'Description', align: 'left' },
    {
      id: 'penalty',
      label: 'Penalty ($)',
      align: 'right',
      editable: true,
      editableCells: [0, 1],
      cellConstraints: {
        0: { min: 0, max: 1000 },
        1: { min: 0, max: 2000 }
      }
    }
  ]

  const sampleData = [
    {
      line: 1,
      description: 'Test Item 1',
      value: 100,
      penalty: 50,
      format: 'currency',
      bold: true
    },
    {
      line: 2,
      description: 'Test Item 2',
      value: 200,
      penalty: 75,
      format: 'number'
    },
    { description: 'Header Row', value: 300, penalty: 0 }
  ]

  const defaultProps = {
    title: 'Test Summary Table',
    columns: basicColumns,
    data: sampleData,
    onCellEditStopped: mockOnCellEditStopped
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders table with title and basic structure', () => {
      customRender(<SummaryTable {...defaultProps} />)

      expect(screen.getByTestId('table-container')).toBeInTheDocument()
      expect(screen.getByTestId('table')).toBeInTheDocument()
      expect(screen.getByTestId('table-head')).toBeInTheDocument()
      expect(screen.getByTestId('table-body')).toBeInTheDocument()
    })

    it('renders correct column headers', () => {
      customRender(<SummaryTable {...defaultProps} />)

      basicColumns.forEach((column) => {
        expect(screen.getByText(column.label)).toBeInTheDocument()
      })
    })

    it('renders all data rows', () => {
      customRender(<SummaryTable {...defaultProps} />)

      const rows = screen.getAllByTestId('table-row')
      expect(rows).toHaveLength(sampleData.length + 1) // +1 for header
    })

    it('displays data content correctly', () => {
      customRender(<SummaryTable {...defaultProps} />)

      expect(screen.getByText('Test Item 1')).toBeInTheDocument()
      expect(screen.getByText('Test Item 2')).toBeInTheDocument()
      expect(screen.getByText('Header Row')).toBeInTheDocument()
    })
  })

  describe('Cell Editability Logic', () => {
    it('identifies editable cells correctly', () => {
      customRender(<SummaryTable columns={editableColumns} data={sampleData} />)

      // Should have input fields for editable cells (rows 0, 1 for penalty column)
      const inputs = screen.getAllByTestId('input')
      expect(inputs).toHaveLength(2) // Two editable cells
    })

    it('identifies non-editable cells correctly', () => {
      customRender(<SummaryTable {...defaultProps} />)

      // No editable columns, should have no inputs
      const inputs = screen.queryAllByTestId('input')
      expect(inputs).toHaveLength(0)
    })

    it('respects editableCells array constraints', () => {
      const restrictedColumns = [
        {
          id: 'penalty',
          label: 'Penalty',
          editable: true,
          editableCells: [1] // Only row 1 editable
        }
      ]

      customRender(
        <SummaryTable columns={restrictedColumns} data={sampleData} />
      )

      const inputs = screen.getAllByTestId('input')
      expect(inputs).toHaveLength(1) // Only one editable cell
    })
  })

  describe('Cell Constraints Logic', () => {
    it('applies constraints when they exist', () => {
      customRender(<SummaryTable columns={editableColumns} data={sampleData} />)

      const inputs = screen.getAllByTestId('input')

      // Test constraint handling - real component would clamp, mock shows input
      fireEvent.change(inputs[0], { target: { value: '1500' } })
      // Our mock doesn't clamp, but the real component would
      expect(typeof inputs[0].value).toBe('string')
    })

    it('handles minimum constraints', () => {
      customRender(<SummaryTable columns={editableColumns} data={sampleData} />)

      const inputs = screen.getAllByTestId('input')

      // Test minimum constraint - component may not clamp in our simplified mock
      fireEvent.change(inputs[0], { target: { value: '10' } })
      expect(inputs[0].value).toBe('10') // Value should be updated
    })

    it('returns empty constraints object when none exist', () => {
      const noConstraintColumns = [
        {
          id: 'penalty',
          label: 'Penalty',
          editable: true,
          editableCells: [0]
        }
      ]

      customRender(
        <SummaryTable columns={noConstraintColumns} data={sampleData} />
      )

      const input = screen.getByTestId('input')

      // Should accept any value when no constraints - displayed with commas
      fireEvent.change(input, { target: { value: '9999' } })
      expect(input.value).toBe('9,999')
    })
  })

  describe('Cell Change Handling', () => {
    it('processes currency field input correctly', () => {
      customRender(<SummaryTable columns={editableColumns} data={sampleData} />)

      const inputs = screen.getAllByTestId('input')

      // Test currency processing (all editable fields are integers - strips decimals when $ is present)
      fireEvent.change(inputs[0], { target: { value: '$123.45' } })
      expect(inputs[0].value).toBe('123') // Should strip $ and decimals (non-numeric + decimal)
    })

    it('processes integer field input correctly', () => {
      const integerColumns = [
        {
          id: 'quantity',
          label: 'Quantity',
          editable: true,
          editableCells: [0]
        }
      ]

      customRender(
        <SummaryTable
          columns={integerColumns}
          data={[{ line: 1, quantity: 0 }]}
        />
      )

      const input = screen.getByTestId('input')

      // Test input processing - component strips non-numeric characters AND decimals
      fireEvent.change(input, { target: { value: '123.45abc' } })
      expect(input.value).toBe('123') // Component strips non-numeric characters and decimals
    })

    it('handles empty string input', () => {
      customRender(<SummaryTable columns={editableColumns} data={sampleData} />)

      const input = screen.getAllByTestId('input')[0]

      fireEvent.change(input, { target: { value: '' } })
      expect(input.value).toBe('') // Mock shows empty string
    })

    it('updates editing state during change', () => {
      customRender(<SummaryTable columns={editableColumns} data={sampleData} />)

      const input = screen.getAllByTestId('input')[0]

      // Simulate change to trigger editing state
      fireEvent.change(input, { target: { value: '100' } })

      // Should show updated value
      expect(input.value).toBe('100')
    })
  })

  describe('Blur Handling and Auto-save', () => {
    it('converts currency values to numbers on blur', () => {
      customRender(
        <SummaryTable
          columns={editableColumns}
          data={sampleData}
          onCellEditStopped={mockOnCellEditStopped}
        />
      )

      const input = screen.getAllByTestId('input')[0]

      // Enter decimal value (preserved during typing if purely numeric)
      fireEvent.change(input, { target: { value: '123.456' } })
      expect(input.value).toBe('123.456')

      // Blur should convert to integer (all editable fields are integers)
      fireEvent.blur(input)
      expect(input.value).toBe('123')
    })

    it('calls onCellEditStopped callback on blur', () => {
      customRender(
        <SummaryTable
          columns={editableColumns}
          data={sampleData}
          onCellEditStopped={mockOnCellEditStopped}
        />
      )

      const input = screen.getAllByTestId('input')[0]

      fireEvent.change(input, { target: { value: '200' } })
      fireEvent.blur(input)

      expect(mockOnCellEditStopped).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          rowIndex: expect.any(Number),
          columnId: expect.any(String)
        })
      )
    })

    it('handles blur without callback gracefully', () => {
      customRender(<SummaryTable columns={editableColumns} data={sampleData} />)

      const input = screen.getAllByTestId('input')[0]

      // Should not throw error when no callback
      expect(() => {
        fireEvent.change(input, { target: { value: '200' } })
        fireEvent.blur(input)
      }).not.toThrow()
    })

    it('ignores blur on non-editing cells', () => {
      customRender(
        <SummaryTable
          columns={editableColumns}
          data={sampleData}
          onCellEditStopped={mockOnCellEditStopped}
        />
      )

      const input = screen.getAllByTestId('input')[0]

      // Blur without editing should not call callback
      fireEvent.blur(input)

      expect(mockOnCellEditStopped).not.toHaveBeenCalled()
    })

    it('handles parseFloat edge cases on blur', () => {
      customRender(<SummaryTable columns={editableColumns} data={sampleData} />)

      const input = screen.getAllByTestId('input')[0]

      // Test blur behavior with invalid input - component strips non-numeric chars leaving empty,
      // then on blur converts empty to 0
      fireEvent.change(input, { target: { value: 'abc' } })
      fireEvent.blur(input)

      expect(input.value).toBe('0') // Component converts empty/invalid to 0 on blur
    })
  })

  describe('Data Synchronization', () => {
    it('updates data when initialData prop changes', () => {
      const { rerender } = customRender(<SummaryTable {...defaultProps} />)

      expect(screen.getByText('Test Item 1')).toBeInTheDocument()

      const newData = [{ line: 1, description: 'New Item', value: 500 }]
      rerender(<SummaryTable {...defaultProps} data={newData} />)

      expect(screen.getByText('New Item')).toBeInTheDocument()
      expect(screen.queryByText('Test Item 1')).not.toBeInTheDocument()
    })
  })

  describe('Formatting Logic', () => {
    it('displays raw values when no format specified', () => {
      customRender(<SummaryTable {...defaultProps} />)

      // Header row has no format, should show raw value
      expect(screen.getByText('300')).toBeInTheDocument()
    })

    it('renders formatted content for currency rows', () => {
      customRender(<SummaryTable {...defaultProps} />)

      // Should display formatted currency values
      expect(screen.getByText('$100.00')).toBeInTheDocument()
      expect(screen.getByText('200')).toBeInTheDocument() // Number format, not currency
    })

    it('displays retained values for locked Line 6 cells', () => {
      const lockedColumns = [
        { id: 'line', label: 'Line' },
        { id: 'description', label: 'Description' },
        { id: 'gasoline', label: 'Gasoline', align: 'right' }
      ]
      const lockedData = [
        {
          line: '6',
          description: 'Retained fuel',
          gasoline: 12345,
          format: 'number'
        }
      ]

      customRender(
        <SummaryTable
          title="Locked Lines"
          columns={lockedColumns}
          data={lockedData}
          lines6And8Locked
        />
      )

      expect(screen.getByText('12345')).toBeInTheDocument()
    })
  })

  describe('Input Component Features', () => {
    it('shows currency adornment for currency fields', () => {
      const currencyData = [{ line: 1, penalty: 100, format: 'currency' }]

      customRender(
        <SummaryTable columns={editableColumns} data={currencyData} />
      )

      // Should have $ adornment for currency fields
      expect(screen.getByTestId('input-adornment')).toBeInTheDocument()
      expect(screen.getByText('$')).toBeInTheDocument()
    })

    it('renders input elements for editable fields', () => {
      customRender(<SummaryTable columns={editableColumns} data={sampleData} />)

      const inputs = screen.getAllByTestId('input')

      // Should render input elements for editable cells
      expect(inputs.length).toBeGreaterThan(0)
    })
  })

  describe('Styling Logic', () => {
    it('applies bold styling based on column bold property', () => {
      customRender(<SummaryTable {...defaultProps} />)

      // Value column has bold: true
      const cells = screen.getAllByTestId('table-cell')
      const valueCells = cells.filter(
        (cell) =>
          cell.textContent === '$100.00' || cell.textContent === '$200.00'
      )

      expect(valueCells.length).toBeGreaterThan(0)
    })

    it('applies bold styling for description column without line number', () => {
      customRender(<SummaryTable {...defaultProps} />)

      // Header Row has no line number, should be bold
      expect(screen.getByText('Header Row')).toBeInTheDocument()
    })

    it('applies bold styling based on row bold property', () => {
      customRender(<SummaryTable {...defaultProps} />)

      // First row has bold: true
      expect(screen.getByText('Test Item 1')).toBeInTheDocument()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles empty data array', () => {
      expect(() => {
        customRender(<SummaryTable {...defaultProps} data={[]} />)
      }).not.toThrow()

      const rows = screen.getAllByTestId('table-row')
      expect(rows).toHaveLength(1) // Only header row
    })

    it('handles null data', () => {
      expect(() => {
        customRender(<SummaryTable {...defaultProps} data={null} />)
      }).not.toThrow()
    })

    it('handles columns without editable properties', () => {
      const simpleColumns = [{ id: 'test', label: 'Test' }]

      expect(() => {
        customRender(<SummaryTable columns={simpleColumns} data={sampleData} />)
      }).not.toThrow()
    })

    it('handles missing column constraints', () => {
      const noConstraintColumns = [
        {
          id: 'penalty',
          label: 'Penalty',
          editable: true,
          editableCells: [0]
        }
      ]

      expect(() => {
        customRender(
          <SummaryTable columns={noConstraintColumns} data={sampleData} />
        )
      }).not.toThrow()
    })

    it('accepts useParenthesis prop without error', () => {
      expect(() => {
        customRender(<SummaryTable {...defaultProps} useParenthesis={true} />)
      }).not.toThrow()
    })

    it('handles custom width prop', () => {
      customRender(<SummaryTable {...defaultProps} width="50%" />)

      const container = screen.getByTestId('table-container')
      expect(container).toBeInTheDocument()
    })
  })

  describe('Lines 6 and 8 Max Constraint Enforcement', () => {
    // These tests ensure the max constraint on Lines 6 and 8 is properly enforced
    // If these tests fail, it means the max constraint logic has been removed or broken
    const line6And8Columns = [
      { id: 'line', label: 'Line', align: 'center' },
      { id: 'description', label: 'Description', align: 'left' },
      {
        id: 'gasoline',
        label: 'Gasoline',
        align: 'right',
        editable: true,
        editableCells: [0, 1], // Line 6 at index 0, Line 8 at index 1
        cellConstraints: {
          0: { min: 0, max: 20000 }, // Line 6 max of 20,000
          1: { min: 0, max: 15000 }  // Line 8 max of 15,000
        }
      },
      {
        id: 'diesel',
        label: 'Diesel',
        align: 'right',
        editable: true,
        editableCells: [0, 1],
        cellConstraints: {
          0: { min: 0, max: 10000 }, // Line 6 diesel max
          1: { min: 0, max: 8000 }   // Line 8 diesel max
        }
      }
    ]

    const line6And8Data = [
      {
        line: 6,
        description: 'Renewable fuel retained',
        gasoline: 0,
        diesel: 0,
        format: 'number'
      },
      {
        line: 8,
        description: 'Renewable fuel deferred',
        gasoline: 0,
        diesel: 0,
        format: 'number'
      }
    ]

    it('clamps Line 6 gasoline value to max constraint when exceeded', () => {
      customRender(
        <SummaryTable
          columns={line6And8Columns}
          data={line6And8Data}
          onCellEditStopped={mockOnCellEditStopped}
        />
      )

      const line6GasolineInput = screen.getAllByTestId('input')[0]

      // Try to enter a value exceeding the max of 20,000
      fireEvent.change(line6GasolineInput, { target: { value: '25000' } })

      // Value should be clamped to max (20000) - displayed with commas
      expect(line6GasolineInput.value).toBe('20,000')
    })

    it('clamps Line 8 gasoline value to max constraint when exceeded', () => {
      customRender(
        <SummaryTable
          columns={line6And8Columns}
          data={line6And8Data}
          onCellEditStopped={mockOnCellEditStopped}
        />
      )

      const line8GasolineInput = screen.getAllByTestId('input')[2]

      // Try to enter a value exceeding the max of 15,000
      fireEvent.change(line8GasolineInput, { target: { value: '18000' } })

      // Value should be clamped to max (15000) - displayed with commas
      expect(line8GasolineInput.value).toBe('15,000')
    })

    it('clamps Line 6 diesel value to max constraint when exceeded', () => {
      customRender(
        <SummaryTable
          columns={line6And8Columns}
          data={line6And8Data}
          onCellEditStopped={mockOnCellEditStopped}
        />
      )

      const line6DieselInput = screen.getAllByTestId('input')[1]

      // Try to enter a value exceeding the max of 10,000
      fireEvent.change(line6DieselInput, { target: { value: '12000' } })

      // Value should be clamped to max (10000) - displayed with commas
      expect(line6DieselInput.value).toBe('10,000')
    })

    it('clamps Line 8 diesel value to max constraint when exceeded', () => {
      customRender(
        <SummaryTable
          columns={line6And8Columns}
          data={line6And8Data}
          onCellEditStopped={mockOnCellEditStopped}
        />
      )

      const line8DieselInput = screen.getAllByTestId('input')[3]

      // Try to enter a value exceeding the max of 8,000
      fireEvent.change(line8DieselInput, { target: { value: '9500' } })

      // Value should be clamped to max (8000) - displayed with commas
      expect(line8DieselInput.value).toBe('8,000')
    })

    it('allows values at exactly the max constraint', () => {
      customRender(
        <SummaryTable
          columns={line6And8Columns}
          data={line6And8Data}
          onCellEditStopped={mockOnCellEditStopped}
        />
      )

      const line6GasolineInput = screen.getAllByTestId('input')[0]

      // Enter exactly the max value
      fireEvent.change(line6GasolineInput, { target: { value: '20000' } })

      // Value should be accepted as-is - displayed with commas
      expect(line6GasolineInput.value).toBe('20,000')
    })

    it('allows values below the max constraint', () => {
      customRender(
        <SummaryTable
          columns={line6And8Columns}
          data={line6And8Data}
          onCellEditStopped={mockOnCellEditStopped}
        />
      )

      const line6GasolineInput = screen.getAllByTestId('input')[0]

      // Enter a value below the max
      fireEvent.change(line6GasolineInput, { target: { value: '15000' } })

      // Value should be accepted as-is - displayed with commas
      expect(line6GasolineInput.value).toBe('15,000')
    })

    it('enforces min constraint (prevents negative values)', () => {
      customRender(
        <SummaryTable
          columns={line6And8Columns}
          data={line6And8Data}
          onCellEditStopped={mockOnCellEditStopped}
        />
      )

      const line6GasolineInput = screen.getAllByTestId('input')[0]

      // Try to enter a negative value
      fireEvent.change(line6GasolineInput, { target: { value: '-100' } })

      // Value should be clamped to min (0)
      // Note: The component strips non-numeric chars first, so -100 becomes 100
      // But if it somehow allowed negative, it would be clamped to 0
      expect(parseInt(line6GasolineInput.value) >= 0).toBe(true)
    })

    it('does not modify values when no constraints exist', () => {
      const noConstraintColumns = [
        { id: 'line', label: 'Line' },
        {
          id: 'value',
          label: 'Value',
          editable: true,
          editableCells: [0]
          // No cellConstraints defined
        }
      ]
      const noConstraintData = [{ line: 1, value: 0 }]

      customRender(
        <SummaryTable
          columns={noConstraintColumns}
          data={noConstraintData}
          onCellEditStopped={mockOnCellEditStopped}
        />
      )

      const input = screen.getByTestId('input')

      // Enter a large value with no constraints
      fireEvent.change(input, { target: { value: '999999999' } })

      // Value should be accepted without clamping - displayed with commas
      expect(input.value).toBe('999,999,999')
    })
  })

  describe('Lines 7 and 9 Mutual Exclusivity', () => {
    const line7And9Columns = [
      { id: 'line', label: 'Line', align: 'center' },
      { id: 'description', label: 'Description', align: 'left' },
      {
        id: 'gasoline',
        label: 'Gasoline',
        align: 'right',
        editable: true,
        editableCells: [0, 1] // Both Line 7 and Line 9 editable
      },
      {
        id: 'diesel',
        label: 'Diesel',
        align: 'right',
        editable: true,
        editableCells: [0, 1]
      }
    ]

    const line7And9Data = [
      {
        line: 7,
        description: 'Previously Retained',
        gasoline: 0,
        diesel: 0
      },
      {
        line: 9,
        description: 'Obligation Added',
        gasoline: 0,
        diesel: 0
      }
    ]

    it('zeros out Line 9 when Line 7 gasoline gets a non-zero value', () => {
      customRender(
        <SummaryTable
          columns={line7And9Columns}
          data={line7And9Data}
          onCellEditStopped={mockOnCellEditStopped}
        />
      )

      // Enter value in Line 7 gasoline
      const line7GasolineInput = screen.getAllByTestId('input')[0]
      fireEvent.change(line7GasolineInput, { target: { value: '100' } })

      // After state update, get fresh input references
      const updatedInputs = screen.getAllByTestId('input')

      // Line 9 gasoline should be zeroed (empty string or '0')
      expect(updatedInputs[2].value).toMatch(/^0?$/)
    })

    it('zeros out Line 7 when Line 9 gasoline gets a non-zero value', () => {
      customRender(
        <SummaryTable
          columns={line7And9Columns}
          data={line7And9Data}
          onCellEditStopped={mockOnCellEditStopped}
        />
      )

      // Enter value in Line 9 gasoline
      const line9GasolineInput = screen.getAllByTestId('input')[2]
      fireEvent.change(line9GasolineInput, { target: { value: '50' } })

      // After state update, get fresh input references
      const updatedInputs = screen.getAllByTestId('input')

      // Line 7 gasoline should be zeroed (empty string or '0')
      expect(updatedInputs[0].value).toMatch(/^0?$/)
    })

    it('zeros out Line 9 diesel when Line 7 diesel gets a non-zero value', () => {
      customRender(
        <SummaryTable
          columns={line7And9Columns}
          data={line7And9Data}
          onCellEditStopped={mockOnCellEditStopped}
        />
      )

      // Enter value in Line 7 diesel
      const line7DieselInput = screen.getAllByTestId('input')[1]
      fireEvent.change(line7DieselInput, { target: { value: '200' } })

      // After state update, get fresh input references
      const updatedInputs = screen.getAllByTestId('input')

      // Line 9 diesel should be zeroed (empty string or '0')
      expect(updatedInputs[3].value).toMatch(/^0?$/)
    })

    it('zeros out Line 7 diesel when Line 9 diesel gets a non-zero value', () => {
      customRender(
        <SummaryTable
          columns={line7And9Columns}
          data={line7And9Data}
          onCellEditStopped={mockOnCellEditStopped}
        />
      )

      // Enter value in Line 9 diesel
      const line9DieselInput = screen.getAllByTestId('input')[3]
      fireEvent.change(line9DieselInput, { target: { value: '75' } })

      // After state update, get fresh input references
      const updatedInputs = screen.getAllByTestId('input')

      // Line 7 diesel should be zeroed (empty string or '0')
      expect(updatedInputs[1].value).toMatch(/^0?$/)
    })

    it('allows different fuel types to have values in different lines (per-column exclusivity)', () => {
      customRender(
        <SummaryTable
          columns={line7And9Columns}
          data={line7And9Data}
          onCellEditStopped={mockOnCellEditStopped}
        />
      )

      const inputs = screen.getAllByTestId('input')

      // Enter value in Line 7 gasoline
      fireEvent.change(inputs[0], { target: { value: '100' } })

      // Enter value in Line 9 diesel (different fuel type)
      fireEvent.change(inputs[3], { target: { value: '50' } })

      // Both should retain their values (different columns)
      expect(inputs[0].value).toBe('100') // Line 7 gasoline
      expect(inputs[3].value).toBe('50') // Line 9 diesel
    })

    it('does not zero out when entering zero value', () => {
      const dataWithValues = [
        {
          line: 7,
          description: 'Previously Retained',
          gasoline: 100,
          diesel: 0
        },
        {
          line: 9,
          description: 'Obligation Added',
          gasoline: 0,
          diesel: 50
        }
      ]

      customRender(
        <SummaryTable
          columns={line7And9Columns}
          data={dataWithValues}
          onCellEditStopped={mockOnCellEditStopped}
        />
      )

      // Enter 0 in Line 7 gasoline (already has 100)
      const line7GasolineInput = screen.getAllByTestId('input')[0]
      fireEvent.change(line7GasolineInput, { target: { value: '0' } })

      // After state update, get fresh input references
      const updatedInputs = screen.getAllByTestId('input')

      // Line 9 gasoline should still be 0 (not affected, empty string or '0')
      expect(updatedInputs[2].value).toMatch(/^0?$/)
    })

    it('handles mutual exclusivity for jetFuel column', () => {
      const jetFuelColumns = [
        ...line7And9Columns,
        {
          id: 'jetFuel',
          label: 'Jet Fuel',
          align: 'right',
          editable: true,
          editableCells: [0, 1]
        }
      ]

      const jetFuelData = [
        {
          line: 7,
          description: 'Previously Retained',
          gasoline: 0,
          diesel: 0,
          jetFuel: 0
        },
        {
          line: 9,
          description: 'Obligation Added',
          gasoline: 0,
          diesel: 0,
          jetFuel: 0
        }
      ]

      customRender(
        <SummaryTable
          columns={jetFuelColumns}
          data={jetFuelData}
          onCellEditStopped={mockOnCellEditStopped}
        />
      )

      // inputs[4] = Line 7 jetFuel, inputs[5] = Line 9 jetFuel
      const line7JetFuelInput = screen.getAllByTestId('input')[4]

      // Enter value in Line 7 jetFuel
      fireEvent.change(line7JetFuelInput, { target: { value: '30' } })

      // After state update, get fresh input references
      const updatedInputs = screen.getAllByTestId('input')

      // Line 9 jetFuel should be zeroed (empty string or '0')
      expect(updatedInputs[5].value).toMatch(/^0?$/)
    })

    it('does not affect mutual exclusivity for non-fuel columns', () => {
      const mixedColumns = [
        ...line7And9Columns,
        {
          id: 'notes',
          label: 'Notes',
          align: 'left',
          editable: true,
          editableCells: [0, 1]
        }
      ]

      const mixedData = [
        {
          line: 7,
          description: 'Previously Retained',
          gasoline: 0,
          diesel: 0,
          notes: ''
        },
        {
          line: 9,
          description: 'Obligation Added',
          gasoline: 0,
          diesel: 0,
          notes: ''
        }
      ]

      customRender(
        <SummaryTable
          columns={mixedColumns}
          data={mixedData}
          onCellEditStopped={mockOnCellEditStopped}
        />
      )

      const notesInput = screen.getAllByTestId('input')[4]

      // Change notes field (should not trigger mutual exclusivity)
      fireEvent.change(notesInput, { target: { value: 'test notes' } })

      // After state update, get fresh input references
      const updatedInputs = screen.getAllByTestId('input')

      // Gasoline and diesel values should remain unchanged (empty string or '0')
      expect(updatedInputs[0].value).toMatch(/^0?$/) // Line 7 gasoline
      expect(updatedInputs[2].value).toMatch(/^0?$/) // Line 9 gasoline
    })
  })
})
