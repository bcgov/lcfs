import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import { SupplyHistory } from '../SupplyHistory'
import theme from '@/themes'

const mockUseOrganizationFuelSupply = vi.fn()

vi.mock('echarts-for-react', () => ({
  default: () => <div data-test="echarts" />
}))

vi.mock('@/hooks/useFuelSupply', () => ({
  useOrganizationFuelSupply: (...args) => mockUseOrganizationFuelSupply(...args)
}))

vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: () => <div data-test="grid" />
}))

const queryData = {
  data: {
    fuelSupplies: [],
    analytics: {
      totalByYear: { 2023: 100, 2024: 200, 2025: 300 },
      selectedYearSummary: {},
      renewableLiquidFuelVolumeTrend: [
        {
          reportingYear: '2023',
          renewableCategory: 'Renewable',
          totalVolume: 100
        },
        {
          reportingYear: '2023',
          renewableCategory: 'Non-renewable',
          totalVolume: 50
        },
        {
          reportingYear: '2024',
          renewableCategory: 'Renewable',
          totalVolume: 125
        },
        {
          reportingYear: '2024',
          renewableCategory: 'Non-renewable',
          totalVolume: 75
        }
      ],
      totalReports: 0
    },
    pagination: { page: 1, size: 10, total: 0, totalPages: 0 }
  },
  isLoading: false,
  isError: false
}

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <SupplyHistory organizationId="1" />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('SupplyHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mockUseOrganizationFuelSupply.mockReturnValue(queryData)
  })

  it('uses a set compliance period filter for the selected year range', async () => {
    const user = userEvent.setup()
    renderComponent()

    const [fromSelect, toSelect] = screen.getAllByRole('combobox')
    await user.click(fromSelect)
    await user.click(screen.getByRole('option', { name: '2023' }))
    await user.click(toSelect)
    expect(screen.queryByRole('option', { name: '2023' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: '2025' }))

    await waitFor(() => {
      expect(mockUseOrganizationFuelSupply).toHaveBeenLastCalledWith(
        '1',
        expect.objectContaining({
          filters: [
            {
              field: 'compliancePeriod',
              values: ['2023', '2024', '2025'],
              type: 'set',
              filterType: 'set'
            }
          ]
        }),
        { enabled: true }
      )
    })
  })

  it('describes the fuel types included in the renewable volume chart', () => {
    renderComponent()

    expect(
      screen.getByText(/Includes liquid gasoline, diesel, and jet fuel supply only/)
    ).toBeInTheDocument()
    expect(screen.getByText(/renewable naphtha/)).toBeInTheDocument()
    expect(
      screen.getByText(/biodiesel, HDRD, other diesel fuel/)
    ).toBeInTheDocument()
    expect(screen.getByText(/alternative jet fuel/)).toBeInTheDocument()
    expect(
      screen.getByText(/Non-renewable includes liquid gasoline, diesel, and jet fuel/)
    ).toBeInTheDocument()
  })

  it('does not render charts that only contain zero or empty data', () => {
    mockUseOrganizationFuelSupply.mockReturnValue({
      ...queryData,
      data: {
        ...queryData.data,
        analytics: {
          totalByYear: { 2023: 0, 2024: 0 },
          selectedYearSummary: {},
          complianceUnitCreditDebitTrend: [
            {
              reportingYear: '2023',
              complianceUnitGroup: 'Positive compliance units',
              complianceUnits: 0
            },
            {
              reportingYear: '2024',
              complianceUnitGroup: 'Positive compliance units',
              complianceUnits: 0
            }
          ],
          fuelTypeVolumeTrend: [
            {
              reportingYear: '2023',
              fuelType: 'Ethanol',
              totalVolume: 0
            },
            {
              reportingYear: '2024',
              fuelType: 'Ethanol',
              totalVolume: 0
            }
          ],
          renewableLiquidFuelVolumeTrend: [
            {
              reportingYear: '2023',
              renewableCategory: 'Renewable',
              totalVolume: 100
            },
            {
              reportingYear: '2024',
              renewableCategory: 'Renewable',
              totalVolume: 100
            }
          ],
          topFuelCodes: [
            { fuelCode: 'BCLCF1', totalVolume: 0 },
            { fuelCode: 'BCLCF2', totalVolume: 0 }
          ],
          totalReports: 0
        }
      }
    })

    renderComponent()

    expect(
      screen.queryByText(/Includes liquid gasoline, diesel, and jet fuel supply only/)
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Top 10 fuel codes by volume')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Volume by fuel type over each compliance period')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(
        /Net credits and debits generated YoY \(compliance units\)/
      )
    ).not.toBeInTheDocument()
  })
})
