import { fireEvent, render, screen } from '@testing-library/react'
import CompareTable from '@/views/CompareReports/components/CompareTable'
import { wrapper } from '@/tests/utils/wrapper'

describe('CompareTable Component', () => {
  const columns = [
    { id: 'line', label: 'Line', width: '10%' },
    { id: 'description', label: 'Description', width: '40%', bold: true },
    { id: 'amount', label: 'Amount', width: '25%' },
    { id: 'quantity', label: 'Quantity', width: '25%' },
    { id: 'delta', label: 'Delta', width: '25%' }
  ]

  const data = [
    {
      line: 1,
      description: 'Test Item 1',
      amount: 1000,
      quantity: 200,
      format: 'currency'
    },
    {
      line: 2,
      description: 'Test Item 2',
      amount: 1500,
      quantity: 300,
      format: 'number'
    }
  ]

  it('renders table with correct title', () => {
    render(<CompareTable title="Test Table" columns={columns} data={data} />)
    expect(screen.getByLabelText(/test table/i)).toBeInTheDocument()
  })

  it('renders correct number of rows and columns', () => {
    render(<CompareTable title="Test Table" columns={columns} data={data} />)
    const rows = screen.getAllByRole('row')
    const headerCells = screen.getAllByRole('columnheader')
    const bodyCells = screen.getAllByRole('cell')

    // Check header row
    expect(headerCells).toHaveLength(columns.length)

    // Check body rows
    expect(rows).toHaveLength(data.length + 1) // +1 for header row
    expect(bodyCells).toHaveLength(data.length * columns.length)
  })

  it('applies correct formatting to data', () => {
    render(<CompareTable title="Test Table" columns={columns} data={data} />)

    // Check formatted values in the document
    expect(screen.getByText('$1,000.00')).toBeInTheDocument()
    expect(screen.getByText('$200.00')).toBeInTheDocument()
    expect(screen.getByText('1,500')).toBeInTheDocument()
    expect(screen.getByText('300')).toBeInTheDocument()
  })

  it('applies bold style to description column', () => {
    render(<CompareTable title="Test Table" columns={columns} data={data} />)
    const descriptionCells = screen.getAllByText(/test item/i)

    descriptionCells.forEach((cell) => {
      expect(cell).toHaveStyle('font-weight: bold')
    })
  })

  it('changes fuel type and updates table data', async () => {
    let fuelType = 'diesel'
    const setFuelType = (newType) => {
      fuelType = newType
    }

    render(
      <CompareTable
        columns={columns}
        data={data}
        enableFuelControls={true}
        setFuelType={setFuelType}
        fuelType={fuelType}
      />,
      { wrapper }
    )

    const gasolineRadio = screen.getByLabelText(/gasoline/i)
    const dieselRadio = screen.getByLabelText(/diesel/i)

    fireEvent.click(dieselRadio)

    expect(gasolineRadio).not.toBeChecked()
    expect(dieselRadio).toBeChecked()
  })
})
