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

export const useStackedBarOption = (data, theme) => {
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

  return getStandardChartOptions({
    color: [
      BC_CHART_COLORS.green,
      BC_CHART_COLORS.teal,
      BC_CHART_COLORS.purple
    ],
    tooltip: { trigger: 'item', formatter: formatItemTooltip },
    legend: { orient: 'horizontal', bottom: 0 },
    series: [
      {
        name: 'Penalty mix',
        type: 'pie',
        radius: ['45%', '70%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: palette.background.paper,
          borderWidth: 2
        },
        label: { show: true, formatter: '{b}: {d}%' },
        data: [
          {
            value: totals.autoRenewable,
            name: PENALTY_CHART_LABELS.automaticRenewableFuelPenalty
          },
          {
            value: totals.autoLowCarbon,
            name: PENALTY_CHART_LABELS.automaticLowCarbonFuelPenalty
          },
          {
            value: totals.discretionary,
            name: PENALTY_CHART_LABELS.discretionaryPenalty
          }
        ]
      }
    ]
  })
}

export const useSparklineOption = (labels, data, seriesName = 'Series') => {
  return getStandardChartOptions({
    color: [BC_CHART_COLORS.blue],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
      formatter: (params) => {
        if (!params?.length) return ''
        const point = params[0]
        return `${point.marker}${point.axisValue}: ${currencyFormatter(point.data)}`
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
        formatter: (val) => (val >= 1000 ? `${val / 1000}k` : val)
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
