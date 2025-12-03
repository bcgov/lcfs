import { currencyFormatter } from '@/utils/formatters'

export const useStackedBarOption = (data, theme) => {
  const primary = theme.palette.primary.main
  const info = theme.palette.info.main

  return {
    color: [primary, info],
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 16, right: 24, bottom: 8, top: 40, containLabel: true },
    xAxis: { type: 'category', data: data.map((item) => item.year) },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (val) => (val >= 1000 ? `${val / 1000}k` : val)
      }
    },
    series: [
      {
        name: 'Auto Renewable',
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: data.map((item) => item.autoRenewable)
      },
      {
        name: 'Auto Low Carbon',
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
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'horizontal', bottom: 0 },
    series: [
      {
        name: 'Penalty Mix',
        type: 'pie',
        radius: ['45%', '70%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: palette.background.paper,
          borderWidth: 2
        },
        label: { show: true, formatter: '{b}: {d}%' },
        data: [
          { value: totals.autoRenewable, name: 'Auto Renewable' },
          { value: totals.autoLowCarbon, name: 'Auto Low Carbon' },
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

