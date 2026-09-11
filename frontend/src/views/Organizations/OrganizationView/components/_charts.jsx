import { currencyFormatter } from '@/utils/formatters'
import {
  BC_CHART_AXIS_LABEL,
  BC_CHART_CATEGORY_AXIS_LABEL,
  BC_CHART_COLORS,
  BC_CHART_GRID,
  getStandardChartOptions,
  getStandardLineSeriesStyle
} from '@/components/charts/chartStyles'

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

const formatAxisTooltip = (params) => {
  if (!params?.length) return ''

  const year = params[0].axisValueLabel ?? params[0].axisValue ?? ''
  const values = params.map(
    ({ marker = '', seriesName, value }) =>
      `${marker}${seriesName}: ${currencyFormatter(value)}`
  )

  return [year, ...values].join('<br/>')
}

const formatItemTooltip = ({ marker = '', name, value, percent }) =>
  `${marker}${name}: ${currencyFormatter(value)} (${percent}%)`

const formatCompactNumber = (value) =>
  value >= 1000 ? `${value / 1000}k` : value

export const useStackedBarOption = (data) => {
  return getStandardChartOptions({
    color: [BC_CHART_COLORS.green, BC_CHART_COLORS.teal],
    tooltip: { trigger: 'axis', formatter: formatAxisTooltip },
    legend: { top: 0, type: 'scroll' },
    grid: { ...BC_CHART_GRID, top: 48, bottom: 44 },
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
      nameGap: 52,
      nameRotate: 90,
      nameTextStyle: {
        color: BC_CHART_COLORS.text,
        align: 'center'
      },
      axisLabel: {
        ...BC_CHART_AXIS_LABEL,
        formatter: (value) => compactCurrencyFormatter.format(value)
      }
    },
    series: [
      {
        name: PENALTY_CHART_LABELS.automaticRenewableFuelPenalty,
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: data.map((item) => item.autoRenewable)
      },
      {
        name: PENALTY_CHART_LABELS.automaticLowCarbonFuelPenalty,
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: data.map((item) => item.autoLowCarbon)
      }
    ]
  })
}

export const usePenaltyMixOption = (totals, theme) => {
  const palette = theme.palette
  const penaltyMixColors = [
    palette.primary.main,
    palette.warning.main,
    palette.success.main
  ]

  return getStandardChartOptions({
    color: penaltyMixColors,
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
          borderColor: palette.background.paper,
          borderWidth: 2
        },
        label: {
          show: true,
          position: 'inside',
          formatter: '{d}%',
          color: '#ffffff',
          fontWeight: 'bold'
        },
        labelLine: { show: false },
        minShowLabelAngle: 8,
        emphasis: {
          label: {
            show: true,
            formatter: ({ value, percent }) =>
              `${compactCurrencyFormatter.format(value)}\n${percent}%`,
            fontWeight: 'bold'
          }
        },
        data: [
          {
            value: totals.autoRenewable,
            name: PENALTY_CHART_LABELS.automaticRenewableFuelPenalty,
            label: { color: palette.common.white }
          },
          {
            value: totals.autoLowCarbon,
            name: PENALTY_CHART_LABELS.automaticLowCarbonFuelPenalty,
            label: { color: palette.common.black }
          },
          {
            value: totals.discretionary,
            name: PENALTY_CHART_LABELS.discretionaryPenalty,
            label: { color: palette.common.white }
          }
        ]
      }
    ]
  })
}

export const useSparklineOption = (
  labels,
  data,
  seriesName = 'Series',
  { formatCurrency = false } = {}
) => {
  const tooltipValueFormatter = formatCurrency
    ? currencyFormatter
    : (value) => value
  const axisValueFormatter = formatCurrency
    ? (value) => compactCurrencyFormatter.format(value)
    : formatCompactNumber

  return getStandardChartOptions({
    color: [BC_CHART_COLORS.blue],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
      formatter: (params) => {
        if (!params?.length) return ''
        const point = params[0]
        return `${point.marker}${point.axisValue}: ${tooltipValueFormatter(
          point.data
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
