import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { EChartsOption, TooltipComponentOption } from 'echarts'
import type { ComponentProps } from 'react'

import { MetricCardsSection, PenaltySummaryTable } from '../PenaltyComponents'
import {
  buildAutomaticPenaltyRows,
  processSparklineData
} from '../penaltyLogHelpers'
import { penaltyLogColumnDefs, penaltyLogEditorColDefs } from '../_schema'
import {
  usePenaltyMixOption,
  useSparklineOption,
  useStackedBarOption
} from '../../_charts'

vi.mock('@/components/charts/BCMetricCard', () => ({
  BCMetricCard: ({
    value
  }: ComponentProps<
    typeof import('@/components/charts/BCMetricCard').BCMetricCard
  >) => <div>{value}</div>
}))

vi.mock('@/components/charts/BCResponsiveEchart', () => ({
  BCResponsiveEChart: ({
    ariaLabel,
    ariaDescription,
    ariaDescribedBy
  }: ComponentProps<
    typeof import('@/components/charts/BCResponsiveEchart').BCResponsiveEChart
  >) => (
    <div
      data-testid="penalty-chart"
      role="img"
      aria-label={ariaDescription || ariaLabel}
      aria-describedby={ariaDescribedBy}
    />
  )
}))

vi.mock('@/components/BCDataGrid/columns', () => ({
  actions: () => ({}),
  validation: {}
}))

vi.mock(
  '@/components/BCDataGrid/components/Editors/AutocompleteCellEditor',
  () => ({
    AutocompleteCellEditor: () => null
  })
)

vi.mock(
  '@/components/BCDataGrid/components/Filters/BCSelectFloatingFilter',
  () => ({
    BCSelectFloatingFilter: () => null
  })
)

vi.mock('@/components/BCDataGrid/components/Renderers/RequiredHeader', () => ({
  RequiredHeader: () => null
}))

vi.mock('@/utils/grid/eventHandlers', () => ({
  suppressKeyboardEvent: () => false
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: null, isLoading: false })
}))

vi.mock('@/hooks/useOrganization', () => ({
  useOrganizationPenaltyAnalytics: () => ({
    data: null,
    isLoading: false,
    isError: false,
    error: null
  })
}))

vi.mock('@/i18n', () => ({
  default: { t: (key: string) => key }
}))

const theme = {
  palette: {
    primary: { main: '#123456' },
    info: { main: '#234567' },
    warning: { main: '#345678' },
    background: { paper: '#ffffff' }
  }
}

const translations: Partial<Record<string, string>> = {
  'org:penaltyLog.automaticDescriptions.renewable':
    'Renewable fuel target non-compliance penalty total (Line 11, Gasoline + Diesel + Jet fuel)',
  'org:penaltyLog.automaticDescriptions.lowCarbon':
    'Low carbon fuel target non-compliance penalty total (Line 21)'
}
const t = (key: string) => translations[key] ?? key

const getPenaltyAmountFormatter = (columns: ColDef[]) => {
  const formatter = columns.find(
    ({ field }) => field === 'penaltyAmount'
  )?.valueFormatter
  if (typeof formatter !== 'function') {
    throw new Error('Expected a penalty amount formatter')
  }
  // These formatters only read the value from the grid callback parameters.
  return (value: number) =>
    formatter({ value } as ValueFormatterParams<unknown, number, unknown>)
}

const getAxisFormatter = ({ yAxis }: EChartsOption) => {
  const formatter =
    !Array.isArray(yAxis) &&
    yAxis?.type === 'value' &&
    yAxis.axisLabel?.formatter
  if (typeof formatter !== 'function') {
    throw new Error('Expected a penalty chart axis formatter')
  }
  return (value: number) => formatter(value, 0, undefined)
}

type TooltipFormatter = Exclude<
  TooltipComponentOption['formatter'],
  string | undefined
>
type TooltipParams = Parameters<TooltipFormatter>[0]
type TooltipPoint = Exclude<TooltipParams, unknown[]> & { axisValue?: string }

const getTooltipFormatter = ({ tooltip }: EChartsOption) => {
  const formatter = !Array.isArray(tooltip) && tooltip?.formatter
  if (typeof formatter !== 'function') {
    throw new Error('Expected a penalty chart tooltip formatter')
  }
  return (params: TooltipPoint | TooltipPoint[]) => formatter(params, '')
}

const tooltipPoint = (point: Partial<TooltipPoint>): TooltipPoint => ({
  componentType: 'series',
  componentSubType: '',
  componentIndex: 0,
  name: '',
  dataIndex: 0,
  data: 0,
  value: 0,
  $vars: [],
  ...point
})

describe('organization dashboard penalty formatting', () => {
  it('formats every metric card value with two decimal places', () => {
    render(
      <MetricCardsSection
        penaltyTotals={{
          total: 1234,
          totalAutomatic: 1000.5,
          discretionary: 233.56
        }}
        sparklineOptions={{ total: {}, automatic: {}, discretionary: {} }}
      />
    )

    expect(screen.getByText('$1,234.00')).toBeInTheDocument()
    expect(screen.getByText('$1,000.50')).toBeInTheDocument()
    expect(screen.getByText('$233.56')).toBeInTheDocument()
  })

  it('preserves cents and adds trailing zeros throughout the summary', () => {
    render(
      <PenaltySummaryTable
        yearlyPenalties={[
          {
            year: '2025',
            autoRenewable: 123.45,
            autoLowCarbon: 200,
            totalAutomatic: 323.45
          }
        ]}
        penaltyTotals={{
          autoRenewable: 123.45,
          autoLowCarbon: 200,
          discretionary: 50.1,
          totalAutomatic: 323.45
        }}
        penaltyMixOption={{}}
      />
    )

    expect(screen.getAllByText('$123.45')).toHaveLength(2)
    expect(screen.getAllByText('$200.00')).toHaveLength(2)
    expect(screen.getAllByText('$323.45')).toHaveLength(2)
    expect(screen.getByText('$50.10')).toBeInTheDocument()
  })

  it('provides accessible exact amounts and shares for penalty mix chart data', () => {
    const { container } = render(
      <PenaltySummaryTable
        yearlyPenalties={[]}
        penaltyTotals={{
          autoRenewable: 1000,
          autoLowCarbon: 2000,
          discretionary: 3000,
          totalAutomatic: 3000
        }}
        penaltyMixOption={{
          series: [
            {
              type: 'line',
              data: [{ name: 'Ignored series category', value: 10000 }]
            },
            {
              type: 'pie',
              data: [
                { name: 'Renewable fuel target penalty', value: 125.5 },
                { name: 'Low carbon fuel target penalty', value: 250 },
                { name: 'Discretionary penalty', value: 124.5 }
              ]
            }
          ]
        }}
      />
    )

    const chart = screen.getByRole('img', {
      name: /Penalty mix donut chart by penalty type/
    })
    const describedBy = chart.getAttribute('aria-describedby')
    if (describedBy === null) {
      throw new Error('Expected the chart to reference its description')
    }
    const describedByIds = describedBy.split(' ')
    const describedElements = describedByIds.map((id) =>
      document.getElementById(id)
    )
    const tableCaptionId = screen.getByText('Penalty mix data').id
    const table = screen.getByRole('table', { name: 'Penalty mix data' })
    const scrollRegion = screen.getByRole('region', {
      name: 'Penalty mix data'
    })
    const ids = [...container.querySelectorAll('[id]')].map(({ id }) => id)

    expect(describedElements).toHaveLength(2)
    expect(new Set(describedByIds).size).toBe(describedByIds.length)
    expect(new Set(ids).size).toBe(ids.length)
    expect(describedElements.every(Boolean)).toBe(true)
    expect(describedByIds).toContain(tableCaptionId)
    expect(chart).toHaveAccessibleName(
      'Penalty mix donut chart by penalty type. Total penalties: $500.00. Renewable fuel target penalty: $125.50, 25.1% of total. Low carbon fuel target penalty: $250.00, 50.0% of total. Discretionary penalty: $124.50, 24.9% of total. Open the data table for all values.'
    )
    expect(describedElements[0]).toHaveTextContent(
      'Exact penalty amounts and shares of the total are available in the data table.'
    )
    expect(table).toHaveAttribute('aria-labelledby', tableCaptionId)
    expect(table).toHaveAttribute('aria-describedby', describedByIds[0])
    expect(scrollRegion).toHaveAttribute('aria-labelledby', tableCaptionId)
    expect(scrollRegion).toHaveAttribute('tabindex', '0')
    expect(
      screen.getByRole('rowheader', { name: 'Renewable fuel target penalty' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('rowheader', { name: 'Low carbon fuel target penalty' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('rowheader', { name: 'Discretionary penalty' })
    ).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '$125.50' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '$250.00' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '$124.50' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '25.1%' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '50.0%' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '24.9%' })).toBeInTheDocument()
    expect(
      screen.queryByText('Ignored series category')
    ).not.toBeInTheDocument()
  })

  it('formats history and editor penalty amounts with two decimal places', () => {
    const formatHistoryAmount = getPenaltyAmountFormatter(penaltyLogColumnDefs)
    const formatEditorAmount = getPenaltyAmountFormatter(
      penaltyLogEditorColDefs(new Map(), [], (key, options) =>
        typeof options?.defaultValue === 'string' ? options.defaultValue : key
      )
    )

    expect(formatHistoryAmount(1250)).toBe('$1,250.00')
    expect(formatHistoryAmount(1250.75)).toBe('$1,250.75')
    expect(formatEditorAmount(1250)).toBe('$1,250.00')
    expect(formatEditorAmount(1250.75)).toBe('$1,250.75')
  })

  it('formats monetary chart labels by magnitude and keeps exact tooltips', () => {
    const stackedBarOption = useStackedBarOption([], theme)
    const penaltyMixOption = usePenaltyMixOption(
      { autoRenewable: 123.45, autoLowCarbon: 200, discretionary: 50.1 },
      theme
    )
    const genericSparklineOption = useSparklineOption([], [])
    const sparklineOption = useSparklineOption([], [], 'Series', {
      formatCurrency: true
    })

    const formatAxisLabel = getAxisFormatter(stackedBarOption)
    const formatGenericSparklineAxisLabel = getAxisFormatter(
      genericSparklineOption
    )
    const formatSparklineAxisLabel = getAxisFormatter(sparklineOption)

    expect(formatAxisLabel(999.5)).toBe('$999.50')
    expect(formatAxisLabel(1000)).toBe('$1.00K')
    expect(formatAxisLabel(24500)).toBe('$24.50K')
    expect(formatAxisLabel(24000000)).toBe('$24.00M')
    expect(formatGenericSparklineAxisLabel(1000)).toBe('1k')
    expect(formatSparklineAxisLabel(999.5)).toBe('$999.50')
    expect(formatSparklineAxisLabel(1000)).toBe('$1.00K')
    expect(
      getTooltipFormatter(stackedBarOption)([
        tooltipPoint({
          axisValue: '2025',
          marker: '',
          seriesName: 'Renewable fuel target penalty',
          value: 123.45
        }),
        tooltipPoint({
          axisValue: '2025',
          marker: '',
          seriesName: 'Low carbon fuel target penalty',
          value: 200
        })
      ])
    ).toBe(
      '2025<br/>Renewable fuel target penalty: $123.45<br/>Low carbon fuel target penalty: $200.00'
    )
    expect(
      getTooltipFormatter(penaltyMixOption)(
        tooltipPoint({
          marker: '',
          name: 'Renewable fuel target penalty',
          value: 123.45,
          percent: 33.3
        })
      )
    ).toBe('Renewable fuel target penalty: $123.45 (33.3%)')
    expect(
      getTooltipFormatter(sparklineOption)([
        tooltipPoint({ marker: '', axisValue: '2025', data: 50.1 })
      ])
    ).toBe('2025: $50.10')
  })

  it('builds total sparkline values from automatic and discretionary penalties', () => {
    const result = processSparklineData(
      [
        { complianceYear: 2024, penaltyAmount: 25 },
        { complianceYear: '2024', penaltyAmount: '5.5' },
        { complianceYear: 2025, penaltyAmount: 10 }
      ],
      ['2024', '2025', '2026'],
      [{ totalAutomatic: 100 }, { totalAutomatic: 200 }, { totalAutomatic: 0 }]
    )

    expect(result.automatic).toEqual([100, 200, 0])
    expect(result.discretionary).toEqual([30.5, 10, 0])
    expect(result.total).toEqual([130.5, 210, 0])
  })

  it('builds automatic penalty rows from positive summary amounts without requiring status flags', () => {
    const rows = buildAutomaticPenaltyRows(
      [
        {
          compliancePeriodId: 1,
          complianceYear: 2025,
          reportStatus: 'Assessed',
          assessedDate: '2026-04-15T17:30:00Z',
          autoRenewable: 125,
          autoLowCarbon: 250,
          renewableInvoiceSent: false,
          renewablePaymentReceived: false,
          lowCarbonInvoiceSent: false,
          lowCarbonPaymentReceived: false
        }
      ],
      t
    )

    expect(rows).toMatchObject([
      {
        id: 'automatic-renewable-1',
        description:
          'Renewable fuel target non-compliance penalty total (Line 11, Gasoline + Diesel + Jet fuel)',
        penaltyAmount: 125,
        dueDate: '2026-04-15',
        invoiceSent: false,
        paymentReceived: false
      },
      {
        id: 'automatic-low-carbon-1',
        description:
          'Low carbon fuel target non-compliance penalty total (Line 21)',
        penaltyAmount: 250,
        dueDate: '2026-04-15',
        invoiceSent: false,
        paymentReceived: false
      }
    ])
  })

  it('leaves the automatic penalty due date blank until the report is assessed', () => {
    const [row] = buildAutomaticPenaltyRows([
      {
        compliancePeriodId: 1,
        complianceYear: 2025,
        reportStatus: 'Submitted',
        assessedDate: null,
        autoRenewable: 125,
        autoLowCarbon: 0
      }
    ])

    expect(row.dueDate).toBe('')
  })

  it('preserves unavailable automatic penalty status fields as null', () => {
    const rows = buildAutomaticPenaltyRows([
      {
        compliancePeriodId: 1,
        complianceYear: 2025,
        reportStatus: 'Assessed',
        assessedDate: '2026-04-15T17:30:00Z',
        autoRenewable: 125,
        autoLowCarbon: 250
      }
    ])

    expect(rows).toMatchObject([
      {
        id: 'automatic-renewable-1',
        invoiceSent: null,
        paymentReceived: null
      },
      {
        id: 'automatic-low-carbon-1',
        invoiceSent: null,
        paymentReceived: null
      }
    ])
  })

  it('excludes automatic penalty rows whose amount is not positive', () => {
    const rows = buildAutomaticPenaltyRows([
      {
        compliancePeriodId: 1,
        complianceYear: 2025,
        reportStatus: 'Assessed',
        assessedDate: '2026-04-15T17:30:00Z',
        autoRenewable: 0,
        autoLowCarbon: 0,
        renewableInvoiceSent: true,
        lowCarbonPaymentReceived: true
      }
    ])

    expect(rows).toEqual([])
  })
})
