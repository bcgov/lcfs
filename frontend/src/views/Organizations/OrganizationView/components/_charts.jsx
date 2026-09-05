import { currencyFormatter } from '@/utils/formatters'

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

export const useStackedBarOption = (data, theme) => {
  const primary = theme.palette.primary.main
  const info = theme.palette.info.main

  return {
    color: [primary, info],
    tooltip: { trigger: 'axis', formatter: formatAxisTooltip },
    legend: { top: 0 },
    grid: { left: 16, right: 24, bottom: 8, top: 40, containLabel: true },
    xAxis: { type: 'category', data: data.map((item) => item.year) },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value) => compactCurrencyFormatter.format(value)
      }
    },
    series: [
      {
        name: AUTO_RENEWABLE_PENALTY_LABEL,
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: data.map((item) => item.autoRenewable)
      },
      {
        name: AUTO_LOW_CARBON_PENALTY_LABEL,
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: data.map((item) => item.autoLowCarbon)
      }
    ]
  }
}

export const usePenaltyMixOption = (totals, theme) => {
  const palette = theme.palette

  return {
    color: [palette.primary.main, palette.info.main, palette.warning.main],
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
          { value: totals.autoRenewable, name: AUTO_RENEWABLE_PENALTY_LABEL },
          { value: totals.autoLowCarbon, name: AUTO_LOW_CARBON_PENALTY_LABEL },
          { value: totals.discretionary, name: 'Discretionary' }
        ]
      }
    ]
  }
}

export const useSparklineOption = (
  labels,
  data,
  theme,
  seriesName = 'Series'
) => {
  const primary = theme.palette.primary.main

  return {
    color: [primary],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
      formatter: (params) => {
        if (!params?.length) return ''
        const point = params[0]
        return `${point.marker}${point.axisValue}: ${currencyFormatter(point.data)}`
      }
    },
    grid: { left: 0, right: 0, top: 4, bottom: 0 },
    xAxis: {
      type: 'category',
      show: false,
      data: labels
    },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'none',
        name: seriesName,
        data
      }
    ]
  }
}
