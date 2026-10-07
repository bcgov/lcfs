import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ThemeProvider from '@mui/material/styles/ThemeProvider'
import {
  SupplyHistory,
  normalizeFuelTypeVolumeTrendRows
} from '../SupplyHistory'
import { roles } from '@/constants/roles'
import theme from '@/themes'

const mockNavigate = vi.fn()
const mockUseOrganizationFuelSupply = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}))

vi.mock('echarts-for-react', () => ({
  default: () => <div data-test="echarts" />
}))

vi.mock('@/hooks/useFuelSupply', () => ({
  useOrganizationFuelSupply: (...args) => mockUseOrganizationFuelSupply(...args)
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: {
      organization: { organizationId: '1' },
      roles: [{ name: roles.government }]
    },
    hasRoles: (role) => role === roles.government
  })
}))

vi.mock('@/views/Transactions/components/OrganizationList', () => ({
  default: ({ onOrgChange }) => (
    <button
      data-test="select-organization"
      onClick={() =>
        onOrgChange({ id: '3', name: 'LCFS Org 3', label: 'LCFS Org 3' })
      }
    >
      Select organization
    </button>
  )
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

  it('shows the total renewable fuel (liquid) volume summary box', () => {
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
            renewableVolumeChange: 250000,
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

  it('navigates to the selected organization supply history route', () => {
    renderComponent()

    fireEvent.click(screen.getByTestId('select-organization'))
    expect(mockNavigate).toHaveBeenCalledWith('/organizations/3/supply-history')
  })

  it('provides aligned, uniquely identified data tables for each chart', async () => {
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
            },
            {
              reportingYear: '2024',
              fuelType: 'Biofuel',
              fuelCategory: 'Other',
              totalVolume: 25,
              fossilDerived: false
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
      /2023: Positive compliance units: \+10 compliance units; Zero or negative compliance units: -2 compliance units/
    )
    expect(
      screen.getByRole('img', {
        name: /Horizontal bar chart of fuel volume by fuel code/
      })
    ).toHaveAccessibleName(/ABC-01: 100\.5 litres\. XYZ-02: 50\.25 litres/)
    expect(
      screen.getByRole('img', {
        name: /Line chart of supply volume by fuel type and compliance year/
      })
    ).toHaveAccessibleName(
      /Fossil-derived diesel: 2023: 1,000 L; 2024: 1,250 L, \+25\.00%/
    )
    expect(
      screen.getByRole('img', {
        name: /Grouped bar chart of year-over-year renewable and non-renewable volume change/
      })
    ).toHaveAccessibleName(/Renewable: 2023: unavailable.*2024: \+75 L/)

    const chartTables = Array.from(
      document.querySelectorAll('table[id$="-data-table"]')
    )
    expect(chartTables).toHaveLength(4)
    expect(new Set(chartTables.map((table) => table.id)).size).toBe(4)
    const chartElementIds = Array.from(
      document.querySelectorAll('[id^="supply-history-"]'),
      (element) => element.id
    )
    expect(new Set(chartElementIds).size).toBe(chartElementIds.length)

    for (const table of chartTables) {
      const disclosure = table.closest('details')
      const summary = disclosure.querySelector('summary')
      expect(summary).toHaveAttribute('aria-controls', table.id)
      const chartPanelId = table.id.replace('-data-table', '')
      expect(
        document.getElementById(`${chartPanelId}-visualization`)
      ).toBeInTheDocument()
      expect(
        document.getElementById(`${chartPanelId}-visualization`)
      ).toHaveAttribute('tabindex', '0')
      await user.click(summary)
      expect(disclosure).toHaveAttribute('open')

      const scrollRegion = disclosure.querySelector('[role="region"]')
      expect(scrollRegion).toHaveAttribute('tabindex', '0')
      expect(scrollRegion).toHaveStyle({ overflowX: 'auto' })
    }

    const complianceTable = screen.getByRole('table', {
      name: 'Net credits and debits generated YoY (compliance units)'
    })
    const complianceRows = within(complianceTable).getAllByRole('row').slice(1)
    expect(complianceRows.map((row) => row.textContent)).toEqual([
      '2023+10-2',
      '2024+20-3'
    ])

    const fuelCodeTable = screen.getByRole('table', {
      name: 'Top 10 fuel codes by volume'
    })
    expect(
      within(fuelCodeTable)
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent)
    ).toEqual(['ABC-01100.5', 'XYZ-0250.25'])

    const fuelTypeTable = screen.getByRole('table', {
      name: 'Volume by fuel type over each compliance period'
    })
    const fuelTypeRows = within(fuelTypeTable).getAllByRole('row').slice(1)
    expect(
      fuelTypeRows
        .map((row) => row.textContent)
        .filter((text) => text.includes('Renewable diesel'))
    ).toEqual([
      '2023Renewable diesel100—',
      '2024Renewable diesel150+50.00% vs. previous year'
    ])
    expect(
      fuelTypeRows.find(
        (row) => row.textContent === '2024Biofuel25Previous year: 0 L'
      )
    ).toBeTruthy()
    expect(
      within(fuelTypeTable).getByRole('columnheader', { name: 'Quantity (L)' })
    ).toBeInTheDocument()

    const renewableTable = screen.getByRole('table', {
      name: 'Fuel supply volume change: renewable vs non-renewable'
    })
    expect(
      within(renewableTable)
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent)
    ).toEqual(['2023——', '2024+75+250'])
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
