import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MetricCardsSection, PenaltySummaryTable } from '../PenaltyComponents'
import { buildAutomaticPenaltyRows } from '../PenaltyLog'
import { penaltyLogColumnDefs, penaltyLogEditorColDefs } from '../_schema'
import {
  usePenaltyMixOption,
  useSparklineOption,
  useStackedBarOption
} from '../../_charts'

vi.mock('@/components/charts/BCMetricCard', () => ({
  BCMetricCard: ({ value }) => <div>{value}</div>
}))

vi.mock('@/components/charts/BCResponsiveEchart', () => ({
  BCResponsiveEChart: () => <div data-testid="penalty-chart" />
}))

vi.mock('@/components/BCDataGrid/columns', () => ({
  actions: () => ({}),
  validation: {}
}))

vi.mock('@/components/BCDataGrid/components', () => ({
  AutocompleteCellEditor: () => null,
  BCSelectFloatingFilter: () => null,
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
  default: { t: (key) => key }
}))

const theme = {
  palette: {
    primary: { main: '#123456' },
    info: { main: '#234567' },
    warning: { main: '#345678' },
    background: { paper: '#ffffff' }
  }
}

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

  it('formats history and editor penalty amounts with two decimal places', () => {
    const historyAmountColumn = penaltyLogColumnDefs.find(
      ({ field }) => field === 'penaltyAmount'
    )
    const editorAmountColumn = penaltyLogEditorColDefs(
      new Map(),
      [],
      (_key, options) => options?.defaultValue ?? _key
    ).find(({ field }) => field === 'penaltyAmount')

    expect(historyAmountColumn.valueFormatter({ value: 1250 })).toBe(
      '$1,250.00'
    )
    expect(historyAmountColumn.valueFormatter({ value: 1250.75 })).toBe(
      '$1,250.75'
    )
    expect(editorAmountColumn.valueFormatter({ value: 1250 })).toBe('$1,250.00')
    expect(editorAmountColumn.valueFormatter({ value: 1250.75 })).toBe(
      '$1,250.75'
    )
  })

  it('formats monetary chart labels by magnitude and keeps exact tooltips', () => {
    const stackedBarOption = useStackedBarOption([], theme)
    const penaltyMixOption = usePenaltyMixOption(
      { autoRenewable: 123.45, autoLowCarbon: 200, discretionary: 50.1 },
      theme
    )
    const sparklineOption = useSparklineOption([], [], theme)

    const formatAxisLabel = stackedBarOption.yAxis.axisLabel.formatter

    expect(formatAxisLabel(999.5)).toBe('$999.50')
    expect(formatAxisLabel(1000)).toBe('$1.00K')
    expect(formatAxisLabel(24500)).toBe('$24.50K')
    expect(formatAxisLabel(24000000)).toBe('$24.00M')
    expect(
      stackedBarOption.tooltip.formatter([
        {
          axisValue: '2025',
          marker: '',
          seriesName: 'Renewable fuel target penalty',
          value: 123.45
        },
        {
          axisValue: '2025',
          marker: '',
          seriesName: 'Low carbon fuel target penalty',
          value: 200
        }
      ])
    ).toBe(
      '2025<br/>Renewable fuel target penalty: $123.45<br/>Low carbon fuel target penalty: $200.00'
    )
    expect(
      penaltyMixOption.tooltip.formatter({
        marker: '',
        name: 'Renewable fuel target penalty',
        value: 123.45,
        percent: 33.3
      })
    ).toBe('Renewable fuel target penalty: $123.45 (33.3%)')
    expect(
      sparklineOption.tooltip.formatter([
        { marker: '', axisValue: '2025', data: 50.1 }
      ])
    ).toBe('2025: $50.10')
  })

  it('builds automatic penalty rows from positive summary amounts without requiring status flags', () => {
    const rows = buildAutomaticPenaltyRows([
      {
        compliancePeriodId: 1,
        complianceYear: 2025,
        autoRenewable: 125,
        autoLowCarbon: 250,
        renewableInvoiceSent: false,
        renewablePaymentReceived: false,
        lowCarbonInvoiceSent: false,
        lowCarbonPaymentReceived: false
      }
    ])

    expect(rows).toMatchObject([
      {
        id: 'automatic-renewable-1',
        penaltyAmount: 125,
        dueDate: '2026-03-31',
        invoiceSent: false,
        paymentReceived: false
      },
      {
        id: 'automatic-low-carbon-1',
        penaltyAmount: 250,
        dueDate: '2026-03-31',
        invoiceSent: false,
        paymentReceived: false
      }
    ])
  })
})
