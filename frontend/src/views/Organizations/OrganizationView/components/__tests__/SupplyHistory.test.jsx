import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ThemeProvider from '@mui/material/styles/ThemeProvider'
import {
  SupplyHistory,
  normalizeFuelTypeVolumeTrendRows
} from '../SupplyHistory'
import { supplyHistoryColDefs } from '../_supplyHistorySchema'
import theme from '@/themes'

const mockUseOrganizationFuelSupply = vi.fn()

vi.mock('echarts-for-react', () => ({
  default: () => <div data-test="echarts" />
}))

vi.mock('@/components/charts/BCResponsiveEchart', () => ({
  BCResponsiveEChart: ({ ariaLabel, ariaDescription, ariaDescribedBy }) => (
    <div
      role="img"
      aria-label={ariaDescription || ariaLabel}
      aria-describedby={ariaDescribedBy}
      tabIndex={0}
      data-test="responsive-echarts"
    />
  )
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

  it('shows the fuel category breakdown only when category data exists', () => {
    const { unmount } = renderComponent()
    expect(
      screen.queryByText('Fuel category breakdown')
    ).not.toBeInTheDocument()
    unmount()

    mockUseOrganizationFuelSupply.mockReturnValue({
      ...queryData,
      data: {
        ...queryData.data,
        analytics: {
          ...queryData.data.analytics,
          fuelCategoryTrend: [
            {
              reportingYear: '2025',
              fuelCategory: 'Diesel',
              totalEnergy: 1000,
              totalLitres: 25,
              totalComplianceUnits: 1
            }
          ]
        }
      }
    })
    renderComponent()

    expect(screen.getByText('Fuel category breakdown')).toBeInTheDocument()
    expect(screen.getByTestId('fuel-category-toggle-Diesel')).toHaveTextContent(
      '1k MJ · 100%'
    )
  })

  it('uses a set compliance period filter for the selected year range', async () => {
    const user = userEvent.setup()
    renderComponent()

    const [fromSelect, toSelect] = screen.getAllByRole('combobox')
    await user.click(fromSelect)
    await user.click(screen.getByRole('option', { name: '2023' }))
    await user.click(toSelect)
    expect(
      screen.queryByRole('option', { name: '2023' })
    ).not.toBeInTheDocument()
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

  it('uses a date-only filter for the submission date column', () => {
    const submissionDateCol = supplyHistoryColDefs().find(
      (col) => col.field === 'reportSubmissionDate'
    )

    expect(submissionDateCol.filter).toBe('agDateColumnFilter')
    expect(submissionDateCol.floatingFilterComponent).toBeDefined()
    expect(
      submissionDateCol.valueFormatter({
        value: '2025-04-01T03:00:00+00:00'
      })
    ).toBe('2025-03-31')
    expect(
      submissionDateCol.filterParams.comparator(
        new Date(2025, 2, 31),
        '2025-04-01T03:00:00+00:00'
      )
    ).toBe(0)
  })

  it('announces chart values and provides expandable, keyboard-scrollable data tables', async () => {
    const user = userEvent.setup()
    mockUseOrganizationFuelSupply.mockReturnValue({
      ...queryData,
      data: {
        ...queryData.data,
        analytics: {
          ...queryData.data.analytics,
          complianceUnitCreditDebitTrend: [
            {
              reportingYear: '2023',
              complianceUnitGroup: 'Positive compliance units',
              complianceUnits: 10
            },
            {
              reportingYear: '2023',
              complianceUnitGroup: 'Zero or negative compliance units',
              complianceUnits: -2
            },
            {
              reportingYear: '2024',
              complianceUnitGroup: 'Positive compliance units',
              complianceUnits: 20
            },
            {
              reportingYear: '2024',
              complianceUnitGroup: 'Zero or negative compliance units',
              complianceUnits: -3
            }
          ],
          topFuelCodes: [
            { fuelCode: 'ABC-01', totalVolume: 100.5 },
            { fuelCode: 'XYZ-02', totalVolume: 50.25 }
          ],
          fuelTypeVolumeTrend: [
            {
              reportingYear: '2023',
              fuelType: 'Fossil-derived diesel',
              fuelCategory: 'Diesel',
              totalVolume: 1000,
              fossilDerived: true
            },
            {
              reportingYear: '2024',
              fuelType: 'Fossil-derived diesel',
              fuelCategory: 'Diesel',
              totalVolume: 1250,
              fossilDerived: true
            },
            {
              reportingYear: '2023',
              fuelType: 'Renewable diesel',
              fuelCategory: 'Diesel',
              totalVolume: 100,
              fossilDerived: false
            },
            {
              reportingYear: '2024',
              fuelType: 'Renewable diesel',
              fuelCategory: 'Diesel',
              totalVolume: 150,
              fossilDerived: false
            }
          ],
          renewableLiquidFuelVolumeTrend: [
            {
              reportingYear: '2023',
              renewableCategory: 'Renewable',
              totalVolume: 100
            },
            {
              reportingYear: '2023',
              renewableCategory: 'Non-renewable',
              totalVolume: 1000
            },
            {
              reportingYear: '2024',
              renewableCategory: 'Renewable',
              totalVolume: 150
            },
            {
              reportingYear: '2024',
              renewableCategory: 'Non-renewable',
              totalVolume: 1250
            }
          ]
        }
      }
    })

    renderComponent()

    expect(
      screen.getByRole('img', {
        name: /Line chart of positive and zero or negative compliance units/
      })
    ).toHaveAccessibleName(
      /2024: Positive compliance units: \+20\.00 compliance units; Zero or negative compliance units: -3\.00 compliance units/
    )
    expect(
      screen.getByRole('img', {
        name: /Horizontal bar chart of fuel volume by fuel code/
      })
    ).toHaveAccessibleName(/ABC-01: Quantity \(L\): 100\.50/)
    expect(
      screen.getByRole('img', {
        name: /Line chart of supply volume by fuel type and compliance year/
      })
    ).toHaveAccessibleName(
      /2024: Fossil-derived diesel: 1,250\.00 L \(\+25\.00%/
    )
    expect(
      screen.getByRole('img', {
        name: /Grouped bar chart of year-over-year renewable and non-renewable volume change/
      })
    ).toHaveAccessibleName(
      /2024: Renewable: \+50\.00 L; Non-renewable: \+250\.00 L/
    )

    const tables = Array.from(
      document.querySelectorAll('table[id$="-data-table"]')
    )
    expect(tables).toHaveLength(4)
    for (const table of tables) {
      const disclosure = table.closest('details')
      const summary = within(disclosure).getByText(
        `View data table for ${table.querySelector('caption').textContent.replace(' data values', '')}`
      )
      expect(summary).toHaveAttribute('aria-controls', table.id)
      await user.click(summary)
      expect(disclosure).toHaveAttribute('open')
      const scrollRegion = disclosure.querySelector('[role="region"]')
      expect(scrollRegion).toHaveAttribute('tabindex', '0')
      expect(scrollRegion).toHaveStyle({ overflowX: 'auto' })
    }

    const fuelTypeTable = screen.getByRole('table', {
      name: 'Volume by fuel type over each compliance period data values'
    })
    expect(
      within(fuelTypeTable).getByText(
        /1,250\.00 L \(\+25\.00% vs\. previous year\)/
      )
    ).toBeInTheDocument()
    expect(
      within(fuelTypeTable).getByRole('columnheader', {
        name: 'Fossil-derived diesel'
      })
    ).toBeInTheDocument()
  })

  it('shows the renewable liquid volume metric without the legacy compliance unit metric', () => {
    mockUseOrganizationFuelSupply.mockReturnValue({
      ...queryData,
      data: {
        ...queryData.data,
        analytics: {
          ...queryData.data.analytics,
          selectedYearSummary: {
            reportingYear: '2025',
            priorYear: '2024',
            totalRenewableVolume: 1250000,
            priorYearRenewableVolume: 1000000,
            renewableVolumePctChangeYoy: 25
          }
        }
      }
    })
    renderComponent()

    expect(
      screen.getByText('Total renewable fuel (liquid) volume')
    ).toBeInTheDocument()
    expect(screen.getByText('1.25M L')).toBeInTheDocument()
    expect(screen.getByText('+25.00% vs. previous year')).toBeInTheDocument()
    expect(screen.getByText('Previous year: 2024 • 1M L')).toBeInTheDocument()
    expect(
      screen.queryByText('Compliance units per unit of supply')
    ).not.toBeInTheDocument()
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
      screen.queryByText(
        /Includes liquid gasoline, diesel, and jet fuel supply only/
      )
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Top 10 fuel codes by volume')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Volume by fuel type over each compliance period')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(
        /Net credits and debits generated YoY \(compliance units\)/
      )
    ).not.toBeInTheDocument()
  })

  it('sums duplicate supply history fuel type rows', () => {
    expect(
      normalizeFuelTypeVolumeTrendRows([
        {
          reportingYear: '2023',
          fuelType: 'Fossil-derived diesel',
          fuelCategory: 'Diesel',
          totalVolume: 100,
          fossilDerived: true
        },
        {
          reportingYear: '2023',
          fuelType: 'Fossil-derived diesel',
          fuelCategory: 'Diesel',
          totalVolume: 50,
          fossilDerived: true
        },
        {
          reportingYear: '2024',
          fuelType: 'Fossil-derived diesel',
          fuelCategory: 'Diesel',
          totalVolume: 200,
          fossilDerived: true
        }
      ])
    ).toEqual([
      {
        reportingYear: '2023',
        fuelType: 'Fossil-derived diesel',
        fuelCategory: 'Diesel',
        totalVolume: 150,
        fossilDerived: true
      },
      {
        reportingYear: '2024',
        fuelType: 'Fossil-derived diesel',
        fuelCategory: 'Diesel',
        totalVolume: 200,
        fossilDerived: true
      }
    ])
  })
})
