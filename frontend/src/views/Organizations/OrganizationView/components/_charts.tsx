import type { TooltipComponentOption } from 'echarts'
import { currencyFormatter } from '@/utils/formatters'
import {
  BC_CHART_AXIS_LABEL,
  BC_CHART_CATEGORY_AXIS_LABEL,
  BC_CHART_COLORS,
  BC_CHART_GRID,
  getStandardChartOptions,
  getStandardLineSeriesStyle
} from '@/components/charts/chartStyles'

type PaletteColor = { main?: string }
type ChartPalette = {
  primary?: PaletteColor
  warning?: PaletteColor
  success?: PaletteColor
  info?: PaletteColor
  white?: PaletteColor
  black?: PaletteColor
  common?: { white?: string; black?: string }
  background?: { paper?: string }
  text?: { main?: string; primary?: string }
}
type ChartTheme = { palette?: ChartPalette }
type PenaltyChartRow = {
  year: string | number
  autoRenewable: number
  autoLowCarbon: number
}
type PenaltyChartTotals = {
  autoRenewable: number
  autoLowCarbon: number
  discretionary: number
}
type TooltipFormatter = Exclude<
  TooltipComponentOption['formatter'],
  string | undefined
>

export const PENALTY_CHART_LABELS = {
  automaticRenewableFuelPenalty: 'Automatic renewable fuel penalty',
  automaticLowCarbonFuelPenalty: 'Automatic low carbon fuel penalty',
  discretionaryPenalty: 'Discretionary penalty',
  totalAutomaticPenalty: 'Total automatic penalty',
  totalPenalties: 'Total penalties'
}

export const AUTO_RENEWABLE_PENALTY_LABEL = 'Renewable fuel target penalty'
export const AUTO_LOW_CARBON_PENALTY_LABEL = 'Low carbon fuel target penalty'

const compactCurrencyFormatter = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  notation: 'compact',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const formatAxisTooltip: TooltipFormatter = (params) => {
  if (!Array.isArray(params) || !params.length) return ''

  const point = params[0] as (typeof params)[0] & {
    axisValueLabel?: string
    axisValue?: string
  }
  const year = point.axisValueLabel ?? point.axisValue ?? ''
  const values = params.map(
    ({ marker = '', seriesName, value }) =>
      `${marker}${seriesName}: ${currencyFormatter(value as number)}`
  )

  return [year, ...values].join('<br/>')
}

const formatItemTooltip: TooltipFormatter = (params) => {
  const {
    marker = '',
    name,
    value,
    percent
  } = params as {
    marker?: string
    name: string
    value: number
    percent: number
  }
  return `${marker}${name}: ${currencyFormatter(value)} (${percent}%)`
}

const formatCompactNumber = (value: number) =>
  value >= 1000 ? `${value / 1000}k` : value

const chartCurrencyLabel = (overrides = {}) => ({
  show: true,
  formatter: ({ value }: { value: number }) =>
    Number(value) === 0 ? '' : compactCurrencyFormatter.format(value),
  color: '#ffffff',
  fontSize: 11,
  fontWeight: 600,
  ...overrides
})

const getPaletteColor = (
  palette: ChartPalette | undefined,
  key: 'primary' | 'warning' | 'success' | 'info',
  fallbackKey?: 'primary' | 'warning' | 'success' | 'info'
) =>
  palette?.[key]?.main ??
  (fallbackKey ? palette?.[fallbackKey]?.main : undefined)

export const useStackedBarOption = (
  data: PenaltyChartRow[],
  theme?: ChartTheme
) => {
  const palette = theme?.palette
  const chartColors = [
    getPaletteColor(palette, 'primary') ?? BC_CHART_COLORS.blue,
    getPaletteColor(palette, 'warning') ?? BC_CHART_COLORS.orange
  ]

  return getStandardChartOptions({
    ...(chartColors.length ? { color: chartColors } : {}),
    tooltip: { trigger: 'axis', formatter: formatAxisTooltip },
    legend: { top: 0, type: 'scroll' },
    grid: { ...BC_CHART_GRID, left: 96, top: 48, bottom: 44 },
    xAxis: {
      type: 'category',
      name: 'Compliance year',
      nameGap: 28,
      data: data.map((item) => item.year),
      axisLabel: BC_CHART_CATEGORY_AXIS_LABEL
    },
    yAxis: {
      type: 'value',
      name: 'Penalty amount',
      nameLocation: 'middle',
      nameGap: 72,
      nameRotate: 90,
      nameTextStyle: {
        color: BC_CHART_COLORS.text,
        align: 'center'
      },
      axisLabel: {
        ...BC_CHART_AXIS_LABEL,
        formatter: (value: number) => compactCurrencyFormatter.format(value)
      }
    },
    series: [
      {
        name: AUTO_RENEWABLE_PENALTY_LABEL,
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        label: chartCurrencyLabel({ position: 'inside' }),
        labelLayout: { hideOverlap: true },
        data: data.map((item) => item.autoRenewable)
      },
      {
        name: AUTO_LOW_CARBON_PENALTY_LABEL,
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        label: chartCurrencyLabel({
          position: 'inside',
          color: BC_CHART_COLORS.text
        }),
        labelLayout: { hideOverlap: true },
        data: data.map((item) => item.autoLowCarbon)
      }
    ]
  })
}

export const usePenaltyMixOption = (
  totals: PenaltyChartTotals,
  theme?: ChartTheme
) => {
  const palette = theme?.palette
  const white =
    palette?.common?.white ?? palette?.white?.main ?? palette?.background?.paper
  const black =
    palette?.common?.black ?? palette?.black?.main ?? palette?.text?.main
  const penaltyMixColors = [
    getPaletteColor(palette, 'primary'),
    getPaletteColor(palette, 'warning'),
    getPaletteColor(palette, 'success', 'info')
  ].filter((color): color is string => Boolean(color))
  const labelColors = [
    white,
    black ?? getPaletteColor(palette, 'primary'),
    white
  ]

  return getStandardChartOptions({
    ...(penaltyMixColors.length ? { color: penaltyMixColors } : {}),
    tooltip: { trigger: 'item', formatter: formatItemTooltip },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      left: 0,
      top: 'middle',
      itemGap: 12,
      textStyle: {
        color: BC_CHART_COLORS.text,
        width: 150,
        overflow: 'break'
      }
    },
    series: [
      {
        name: 'Penalty mix',
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['68%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: palette?.background?.paper,
          borderWidth: 2
        },
        label: {
          show: true,
          position: 'inside',
          formatter: '{d}%',
          color: white,
          fontWeight: 'bold'
        },
        labelLine: { show: false },
        minShowLabelAngle: 8,
        emphasis: {
          label: {
            show: true,
            formatter: ({
              value,
              percent
            }: {
              value: number
              percent: number
            }) => `${compactCurrencyFormatter.format(value)}\n${percent}%`,
            fontWeight: 'bold'
          }
        },
        data: [
          {
            value: totals.autoRenewable,
            name: PENALTY_CHART_LABELS.automaticRenewableFuelPenalty,
            label: { color: labelColors[0] }
          },
          {
            value: totals.autoLowCarbon,
            name: PENALTY_CHART_LABELS.automaticLowCarbonFuelPenalty,
            label: { color: labelColors[1] }
          },
          {
            value: totals.discretionary,
            name: PENALTY_CHART_LABELS.discretionaryPenalty,
            label: { color: labelColors[2] }
          }
        ]
      }
    ]
  })
}

export const useSparklineOption = (
  labels: string[],
  data: number[],
  seriesName = 'Series',
  {
    formatCurrency = false,
    theme
  }: { formatCurrency?: boolean; theme?: ChartTheme } = {}
) => {
  const palette = theme?.palette
  const lineColor = getPaletteColor(palette, 'info', 'primary')
  const tooltipValueFormatter = formatCurrency
    ? currencyFormatter
    : (value: number) => value
  const axisValueFormatter = formatCurrency
    ? (value: number) => compactCurrencyFormatter.format(value)
    : formatCompactNumber

  return getStandardChartOptions({
    ...(lineColor ? { color: [lineColor] } : {}),
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
      formatter: (params) => {
        if (!Array.isArray(params) || !params.length) return ''
        const point = params[0] as (typeof params)[0] & { axisValue?: string }
        return `${point.marker}${point.axisValue}: ${tooltipValueFormatter(
          point.data as number
        )}`
      }
    },
    grid: { left: 40, right: 8, top: 8, bottom: 22, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: {
        ...BC_CHART_AXIS_LABEL,
        fontSize: 10
      },
      axisTick: { show: true },
      axisLine: { show: true }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        ...BC_CHART_AXIS_LABEL,
        fontSize: 10,
        formatter: axisValueFormatter
      },
      splitLine: { lineStyle: { color: BC_CHART_COLORS.gridLine } }
    },
    series: [
      {
        type: 'line',
        smooth: true,
        ...getStandardLineSeriesStyle(2),
        name: seriesName,
        data
      }
    ]
  })
}
