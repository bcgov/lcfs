import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { FuelCategoryBreakdown } from '../FuelCategoryBreakdown'

const mockEChart = vi.fn()

vi.mock('echarts-for-react', () => ({
  default: (props) => {
    mockEChart(props)
    return <div data-test="echarts" />
  }
}))

const rows = [
  {
    reportingYear: '2023',
    fuelCategory: 'Gasoline',
    totalEnergy: 600,
    totalLitres: 10,
    totalComplianceUnits: 5
  },
  {
    reportingYear: '2023',
    fuelCategory: 'Diesel',
    totalEnergy: 300,
    totalLitres: 20,
    totalComplianceUnits: -2
  },
  {
    reportingYear: '2024',
    fuelCategory: 'Gasoline',
    totalEnergy: 900,
    totalLitres: 30,
    totalComplianceUnits: 4
  },
  {
    reportingYear: '2024',
    fuelCategory: 'Diesel',
    totalEnergy: 150,
    totalLitres: 0,
    totalComplianceUnits: 1
  },
  {
    reportingYear: '2024',
    fuelCategory: 'Jet fuel',
    totalEnergy: 50,
    totalLitres: 5,
    totalComplianceUnits: 0.5
  }
]

const renderBreakdown = () =>
  render(
    <ThemeProvider theme={theme}>
      <FuelCategoryBreakdown rows={rows} />
    </ThemeProvider>
  )

const lastOption = () => mockEChart.mock.calls.at(-1)[0].option
const seriesData = () =>
  Object.fromEntries(lastOption().series.map((s) => [s.name, s.data]))

describe('FuelCategoryBreakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stacks energy by fuel category for each year, filling missing years with zero', () => {
    renderBreakdown()

    const option = lastOption()
    expect(option.xAxis.data).toEqual(['2023', '2024'])
    expect(option.series.map((s) => s.stack)).toEqual([
      'fuelCategory',
      'fuelCategory',
      'fuelCategory'
    ])
    expect(seriesData()).toEqual({
      Gasoline: [600, 900],
      Diesel: [300, 150],
      'Jet fuel': [0, 50]
    })
    expect(option.aria.enabled).toBe(true)
    expect(option.aria.label.description).toContain('Gasoline: 1.5k MJ (75%)')
  })

  it('shows each category total and share on its toggle', () => {
    renderBreakdown()

    expect(
      screen.getByTestId('fuel-category-toggle-Gasoline')
    ).toHaveTextContent('1.5k MJ · 75%')
    expect(screen.getByTestId('fuel-category-toggle-Diesel')).toHaveTextContent(
      '450 MJ · 22.5%'
    )
    expect(
      screen.getByTestId('fuel-category-toggle-Jet fuel')
    ).toHaveTextContent('50 MJ · 2.5%')
  })

  it('switches to litres and compliance units', async () => {
    const user = userEvent.setup()
    renderBreakdown()

    await user.click(screen.getByRole('button', { name: 'Volume (L)' }))
    expect(seriesData()).toEqual({
      Gasoline: [10, 30],
      Diesel: [20, 0],
      'Jet fuel': [0, 5]
    })
    expect(lastOption().yAxis.name).toBe('Volume (L)')
    expect(
      screen.getByText(/Volume only includes fuels reported in litres/)
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Compliance units' }))
    expect(seriesData()).toEqual({
      Gasoline: [5, 4],
      Diesel: [-2, 1],
      'Jet fuel': [0, 0.5]
    })
    // Net compliance units have no meaningful share of total.
    expect(
      screen.getByTestId('fuel-category-toggle-Gasoline')
    ).toHaveTextContent(/^Gasoline9$/)
  })

  it('hides and shows categories from the keyboard, keeping at least one', async () => {
    const user = userEvent.setup()
    renderBreakdown()

    const diesel = screen.getByTestId('fuel-category-toggle-Diesel')
    expect(diesel).toHaveAttribute('aria-pressed', 'true')

    diesel.focus()
    await user.keyboard('{Enter}')
    expect(diesel).toHaveAttribute('aria-pressed', 'false')
    expect(Object.keys(seriesData())).toEqual(['Gasoline', 'Jet fuel'])

    await user.keyboard(' ')
    expect(diesel).toHaveAttribute('aria-pressed', 'true')
    expect(Object.keys(seriesData())).toEqual([
      'Gasoline',
      'Diesel',
      'Jet fuel'
    ])

    await user.click(screen.getByTestId('fuel-category-toggle-Gasoline'))
    await user.click(screen.getByTestId('fuel-category-toggle-Jet fuel'))
    await user.click(diesel)
    expect(diesel).toHaveAttribute('aria-pressed', 'true')
    expect(Object.keys(seriesData())).toEqual(['Diesel'])
  })

  it('reveals a data table with yearly values and category totals', async () => {
    const user = userEvent.setup()
    renderBreakdown()

    const toggle = screen.getByRole('button', { name: 'Show data table' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('fuel-category-table')).not.toBeInTheDocument()

    await user.click(toggle)
    expect(
      screen.getByRole('button', { name: 'Hide data table' })
    ).toHaveAttribute('aria-expanded', 'true')

    const table = screen.getByRole('table', {
      name: 'Energy (MJ) by fuel category and compliance year'
    })
    const [, row2023, row2024, totalRow] = within(table).getAllByRole('row')
    expect(
      within(row2023)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual(['600', '300', '0', '900'])
    expect(
      within(row2024)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual(['900', '150', '50', '1,100'])
    expect(
      within(totalRow)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual([
      '1,50075% of total',
      '45022.5% of total',
      '502.5% of total',
      '2,000'
    ])
  })
})
