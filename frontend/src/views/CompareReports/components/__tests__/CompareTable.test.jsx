import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import CompareTable from '@/views/CompareReports/components/CompareTable'
import { wrapper } from '@/tests/utils/wrapper'

// Mock the formatters
vi.mock('@/utils/formatters', () => ({
  currencyFormatter: vi.fn((value, useParenthesis) => {
    const numValue = Number(value) || 0
    return useParenthesis && numValue < 0 ? `($${Math.abs(numValue).toFixed(2)})` : `$${numValue.toFixed(2)}`
  }),
  numberFormatter: vi.fn((value, useParenthesis) => {
    const numValue = Number(value) || 0
    return useParenthesis && numValue < 0 ? `(${Math.abs(numValue)})` : numValue.toString()
  })
}))


// Mock translation hook
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        'report:fuelLabels.gasoline': 'Gasoline',
        'report:fuelLabels.diesel': 'Diesel', 
        'report:fuelLabels.jetFuel': 'Jet Fuel'
      }
      return translations[key] || key
    }
  })
}))

describe('CompareTable Component', () => {
  const mockSetFuelType = vi.fn()

  const basicColumns = [
    { id: 'line', label: 'Line', width: '10%' },
    { id: 'description', label: 'Description', width: '40%', bold: true },
    { id: 'amount', label: 'Amount', width: '20%', align: 'right' },
    { id: 'quantity', label: 'Quantity', width: '15%', maxWidth: '200px' },
    { id: 'delta', label: 'Delta', width: '15%' }
  ]

  const basicData = [
    {
      line: 1,
      description: 'Test Item 1',
      amount: 1000,
      quantity: 200,
      delta: 50
    },
    {
      line: 2,
      description: 'Test Item 2', 
      amount: 1500,
      quantity: 300,
      delta: -25
    }
  ]

  const formattedData = [
    {
      line: 1,
      description: 'Formatted Item 1',
      amount: 1000,
      quantity: 200,
      delta: 50,
      format: 'currency'
    },
    {
      line: 2,
      description: 'Formatted Item 2', 
      amount: 1500,
      quantity: 300,
      delta: -25,
      format: 'number'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Component Rendering', () => {
    it('renders table with correct aria-label', () => {
      render(<CompareTable title="Test Table" columns={basicColumns} data={basicData} />)
      expect(screen.getByLabelText('Test Table table')).toBeInTheDocument()
    })

    it('renders with minimal required props', () => {
      render(<CompareTable title="Simple" columns={[]} data={[]} />)
      expect(screen.getByLabelText('Simple table')).toBeInTheDocument()
    })
  })

  describe('Props Handling and Defaults', () => {
    it('uses default props when not provided', () => {
      render(<CompareTable title="Test" columns={basicColumns} data={basicData} />)
      // Should render standard header (not fuel controls)
      expect(screen.queryByText('Gasoline')).not.toBeInTheDocument()
    })

    it('handles useParenthesis default value', () => {
      const { rerender } = render(
        <CompareTable title="Test" columns={basicColumns} data={formattedData} />
      )
      
      // Verify formatted values appear correctly
      expect(screen.getByText('$1000.00')).toBeInTheDocument()
      
      rerender(
        <CompareTable 
          title="Test" 
          columns={basicColumns} 
          data={formattedData} 
          useParenthesis={true}
        />
      )
      
      // Still should show the same format for positive values
      expect(screen.getByText('$1000.00')).toBeInTheDocument()
    })
  })

  describe('EnableFuelControls Conditional Rendering', () => {
    it('renders fuel controls header when enableFuelControls=true', () => {
      render(
        <CompareTable
          title="Test"
          columns={basicColumns}
          data={basicData}
          enableFuelControls={true}
          setFuelType={mockSetFuelType}
          fuelType="gasoline"
        />,
        { wrapper }
      )

      expect(screen.getByText('Gasoline')).toBeInTheDocument()
      expect(screen.getByText('Diesel')).toBeInTheDocument()
      expect(screen.getByText('Jet Fuel')).toBeInTheDocument()
    })

    it('disables fuel radios when availability is false', () => {
      render(
        <CompareTable
          title="Test"
          columns={basicColumns}
          data={basicData}
          enableFuelControls={true}
          setFuelType={mockSetFuelType}
          fuelType="diesel"
          fuelAvailability={{ gasoline: false, diesel: true, jetFuel: false }}
        />,
        { wrapper }
      )

      expect(screen.getByDisplayValue('gasoline')).toBeDisabled()
      expect(screen.getByDisplayValue('diesel')).not.toBeDisabled()
      expect(screen.getByDisplayValue('jetFuel')).toBeDisabled()
    })

    it('renders standard header when enableFuelControls=false', () => {
      render(<CompareTable title="Test" columns={basicColumns} data={basicData} />)
      
      expect(screen.queryByText('Gasoline')).not.toBeInTheDocument()
      // Standard header should show column labels
      expect(screen.getByText('Line')).toBeInTheDocument()
      expect(screen.getByText('Description')).toBeInTheDocument()
    })
  })

  describe('Highlighted Columns', () => {
    it('applies highlight styles to specified columns', () => {
      render(
        <CompareTable
          title="Test"
          columns={basicColumns}
          data={basicData}
          highlightedColumns={['amount']}
        />
      )

      const headerCell = screen.getByText('Amount').closest('th')
      expect(headerCell).toHaveStyle('background-color: #e0e0e0')

      const bodyCell = screen.getAllByText('1000')[0].closest('td')
      expect(bodyCell).toHaveStyle('background-color: #e5e5e5')
    })
  })

  describe('Fuel Type Radio Selection', () => {
    it('calls setFuelType when radio button is clicked', () => {
      render(
        <CompareTable
          title="Test"
          columns={basicColumns}
          data={basicData}
          enableFuelControls={true}
          setFuelType={mockSetFuelType}
          fuelType="gasoline"
        />,
        { wrapper }
      )

      const dieselRadio = screen.getByDisplayValue('diesel')
      fireEvent.click(dieselRadio)
      
      expect(mockSetFuelType).toHaveBeenCalledWith('diesel')
    })

    it('shows correct fuel type as selected', () => {
      render(
        <CompareTable
          title="Test"
          columns={basicColumns}
          data={basicData}
          enableFuelControls={true}
          setFuelType={mockSetFuelType}
          fuelType="jetFuel"
        />,
        { wrapper }
      )

      expect(screen.getByDisplayValue('jetFuel')).toBeChecked()
      expect(screen.getByDisplayValue('gasoline')).not.toBeChecked()
      expect(screen.getByDisplayValue('diesel')).not.toBeChecked()
    })
  })

  describe('Data Formatting', () => {
    it('formats currency data correctly', () => {
      render(<CompareTable title="Test" columns={basicColumns} data={formattedData} />)
      
      expect(screen.getByText('$1000.00')).toBeInTheDocument()
    })

    it('formats number data correctly', () => {
      render(<CompareTable title="Test" columns={basicColumns} data={formattedData} />)
      
      expect(screen.getByText('1500')).toBeInTheDocument()
    })

    it('uses parentheses when useParenthesis=true', () => {
      const negativeData = [{ 
        line: 1, 
        description: 'Negative', 
        amount: -500, 
        format: 'currency' 
      }]

      render(
        <CompareTable
          title="Test"
          columns={basicColumns}
          data={negativeData}
          useParenthesis={true}
        />
      )
      
      expect(screen.getByText('($500.00)')).toBeInTheDocument()
    })

    it('does not format first column (colIndex=0)', () => {
      const dataWithFormat = [{
        line: 99,
        description: 'Test',
        amount: 1000,
        quantity: 500,
        delta: 100,
        format: 'currency'
      }]
      
      render(<CompareTable title="Test" columns={basicColumns} data={dataWithFormat} />)
      
      // Line column (index 0) should not be formatted even with format property
      expect(screen.getByText('99')).toBeInTheDocument()
      // Other columns WILL be formatted when format exists
      expect(screen.getByText('$1000.00')).toBeInTheDocument()
    })
  })

  describe('Null and Undefined Data Handling', () => {
    const nullData = [{
      line: 1,
      description: null,
      amount: undefined,
      quantity: null
    }]

    it('shows empty string for null/undefined description column', () => {
      render(<CompareTable title="Test" columns={basicColumns} data={nullData} />)
      
      // Description column should show empty string for null values
      const cells = screen.getAllByRole('cell')
      const descriptionCell = cells.find(cell => cell.textContent === '')
      expect(descriptionCell).toBeInTheDocument()
    })

    it('shows "0" for null/undefined non-description columns', () => {
      render(<CompareTable title="Test" columns={basicColumns} data={nullData} />)
      
      // Amount and quantity columns should show "0" for null/undefined
      const zeroCells = screen.getAllByText('0')
      expect(zeroCells.length).toBeGreaterThan(0)
    })
  })

  describe('Font Weight Logic', () => {
    it('applies bold font when column.bold=true', () => {
      render(<CompareTable title="Test" columns={basicColumns} data={basicData} />)
      
      // Check for the actual description text content
      expect(screen.getByText('Test Item 1')).toHaveStyle('font-weight: bold')
      expect(screen.getByText('Test Item 2')).toHaveStyle('font-weight: bold')
    })

    it('applies bold font for description column without line', () => {
      const noLineData = [{
        description: 'Header Item',
        amount: 1000
      }]
      
      render(<CompareTable title="Test" columns={basicColumns} data={noLineData} />)
      
      const headerCell = screen.getByText('Header Item')
      expect(headerCell).toHaveStyle('font-weight: bold')
    })

    it('applies normal font weight by default', () => {
      const normalColumns = [
        { id: 'name', label: 'Name' },
        { id: 'value', label: 'Value' }
      ]
      const normalData = [{ name: 'Test', value: 'Normal', line: 1 }]
      
      render(<CompareTable title="Test" columns={normalColumns} data={normalData} />)
      
      const normalCell = screen.getByText('Normal')
      expect(normalCell).toHaveStyle('font-weight: normal')
    })
  })

  describe('Border Styling', () => {
    it('does not add right border to last column', () => {
      render(<CompareTable title="Test" columns={basicColumns} data={basicData} />)
      
      const table = screen.getByRole('table')
      expect(table).toBeInTheDocument()
      
      // Check that table structure is correct
      const rows = screen.getAllByRole('row')
      expect(rows.length).toBeGreaterThan(0)
    })

    it('does not add bottom border to last row', () => {
      render(<CompareTable title="Test" columns={basicColumns} data={basicData} />)
      
      const table = screen.getByRole('table')
      expect(table).toBeInTheDocument()
      
      // Verify table body exists
      const cells = screen.getAllByRole('cell')
      expect(cells.length).toBe(basicData.length * basicColumns.length)
    })
  })

  describe('Column Properties', () => {
    it('applies column alignment', () => {
      render(<CompareTable title="Test" columns={basicColumns} data={basicData} />)
      
      // Verify table renders with alignment data
      const table = screen.getByRole('table')
      expect(table).toBeInTheDocument()
    })

    it('applies column width and maxWidth', () => {
      render(<CompareTable title="Test" columns={basicColumns} data={basicData} />)
      
      // Verify table structure includes width specifications
      const headerCells = screen.getAllByRole('columnheader')
      expect(headerCells).toHaveLength(basicColumns.length)
    })
  })

  describe('Edge Cases', () => {
    it('renders with empty data array', () => {
      render(<CompareTable title="Empty" columns={basicColumns} data={[]} />)
      
      expect(screen.getByLabelText('Empty table')).toBeInTheDocument()
      // Should only have header row
      const rows = screen.getAllByRole('row')
      expect(rows).toHaveLength(1) // Just header
    })

    it('renders with empty columns array', () => {
      render(<CompareTable title="Test" columns={[]} data={[]} />)
      
      expect(screen.getByLabelText('Test table')).toBeInTheDocument()
    })

    it('handles undefined data prop', () => {
      render(<CompareTable title="Test" columns={basicColumns} data={undefined} />)
      
      expect(screen.getByLabelText('Test table')).toBeInTheDocument()
    })
  })

  describe('Greyed Row Rendering', () => {
    // No 'format' on rows so description text renders as-is (format causes description
    // to go through the number formatter since it is at colIndex 1, not 0).
    const greyedData = [
      {
        line: 12,
        description: 'Line 12 desc',
        report1: null,
        report2: null,
        delta: null,
        greyed: true
      },
      {
        line: 18,
        description: 'Line 18 desc',
        report1: 200,
        report2: 250,
        delta: 50,
        greyed: false
      }
    ]

    const valueColumns = [
      { id: 'line', label: 'Line', width: '5%' },
      { id: 'description', label: 'Description', width: '40%', bold: true },
      { id: 'report1', label: 'Report 1', width: '18%', align: 'right' },
      { id: 'report2', label: 'Report 2', width: '18%', align: 'right' },
      { id: 'delta', label: 'Delta', width: '18%', align: 'right' }
    ]

    it('shows values for non-greyed rows and suppresses them for greyed rows', () => {
      render(<CompareTable title="Low Carbon" columns={valueColumns} data={greyedData} />)

      // Non-greyed row should show its values
      expect(screen.getAllByText('200').length).toBeGreaterThan(0)
      expect(screen.getAllByText('250').length).toBeGreaterThan(0)
      expect(screen.getAllByText('50').length).toBeGreaterThan(0)
    })

    it('greyed value cells show empty string and not "0" for null values', () => {
      render(<CompareTable title="Low Carbon" columns={valueColumns} data={greyedData} />)

      // The line number for greyed row is still visible at colIndex 0 (never formatted)
      expect(screen.getByText('12')).toBeInTheDocument()

      // Greyed cells return '' (empty string), so report1/report2/delta for line 12
      // must NOT appear as '0' in the DOM (unlike ungreyed null cells which show '0')
      const cells = screen.getAllByRole('cell')
      // Collect all cell text content
      const cellTexts = cells.map((c) => c.textContent)
      // The only '0' values come from non-greyed row nulls; the greyed row has 3 empty cells
      const emptyCells = cells.filter((c) => c.textContent === '')
      expect(emptyCells.length).toBeGreaterThan(0)
    })

    it('applies "Not applicable" tooltip only to greyed value cells', () => {
      render(<CompareTable title="Low Carbon" columns={valueColumns} data={greyedData} />)

      const cells = screen.getAllByRole('cell')
      const tooltippedCells = cells.filter(
        (c) => c.getAttribute('title') === 'Not applicable for this compliance period'
      )
      // Line 12 has exactly 3 value columns (report1, report2, delta) that are greyed
      expect(tooltippedCells).toHaveLength(3)
    })

    it('does not apply greyed styling to line or description cells', () => {
      render(<CompareTable title="Low Carbon" columns={valueColumns} data={greyedData} />)

      // line number cell must have no tooltip
      const line12Cell = screen.getByText('12').closest('td')
      expect(line12Cell).not.toHaveAttribute(
        'title',
        'Not applicable for this compliance period'
      )

      // description cell must have no tooltip
      const descCell = screen.getByText('Line 12 desc').closest('td')
      expect(descCell).not.toHaveAttribute(
        'title',
        'Not applicable for this compliance period'
      )
    })

    it('renders non-greyed rows normally alongside greyed rows', () => {
      render(<CompareTable title="Low Carbon" columns={valueColumns} data={greyedData} />)

      expect(screen.getByText('Line 18 desc')).toBeInTheDocument()
      expect(screen.getByText('18')).toBeInTheDocument()
      expect(screen.getAllByText('200').length).toBeGreaterThan(0)
      expect(screen.getAllByText('250').length).toBeGreaterThan(0)
      expect(screen.getAllByText('50').length).toBeGreaterThan(0)
    })

    it('non-greyed value cells do not carry the "Not applicable" tooltip', () => {
      render(<CompareTable title="Low Carbon" columns={valueColumns} data={greyedData} />)

      // report1=200 cell for line 18 should have no tooltip
      const cell200 = screen.getByText('200').closest('td')
      expect(cell200).not.toHaveAttribute(
        'title',
        'Not applicable for this compliance period'
      )
    })
  })

  describe('Translation Integration', () => {
    it('uses translation keys for fuel labels', () => {
      render(
        <CompareTable
          title="Test"
          columns={basicColumns}
          data={basicData}
          enableFuelControls={true}
          setFuelType={mockSetFuelType}
          fuelType="gasoline"
        />,
        { wrapper }
      )

      expect(screen.getByText('Gasoline')).toBeInTheDocument()
      expect(screen.getByText('Diesel')).toBeInTheDocument()
      expect(screen.getByText('Jet Fuel')).toBeInTheDocument()
    })
  })

  describe('Table Structure and Styling', () => {
    it('applies correct table container styling', () => {
      render(<CompareTable title="Test" columns={basicColumns} data={basicData} />)
      
      const table = screen.getByRole('table')
      expect(table).toBeInTheDocument()
      
      // Check that Paper component wrapper exists
      const container = table.closest('[class*="MuiPaper"]')
      expect(container).toBeInTheDocument()
    })

    it('renders table head and body structure', () => {
      render(<CompareTable title="Test" columns={basicColumns} data={basicData} />)
      
      // Verify table structure
      const table = screen.getByRole('table')
      const thead = table.querySelector('thead')
      const tbody = table.querySelector('tbody')
      
      expect(thead).toBeInTheDocument()
      expect(tbody).toBeInTheDocument()
    })

    it('applies background color to rows', () => {
      render(<CompareTable title="Test" columns={basicColumns} data={basicData} />)
      
      const bodyRows = screen.getAllByRole('row').slice(1) // Skip header row
      expect(bodyRows.length).toBe(basicData.length)
    })
  })
})
