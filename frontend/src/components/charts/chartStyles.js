export const BC_CHART_COLORS = {
  green: '#026833',
  teal: '#006085',
  blue: '#0d74d1',
  indigo: '#345ef1',
  purple: '#5936ee',
  magenta: '#c9006b',
  red: '#a41034',
  orange: '#ae6429',
  gray: '#68666f',
  brightGreen: '#01c075',
  brightTeal: '#02c2c6',
  brightBlue: '#0e88e7',
  darkPurple: '#57116a',
  text: '#405074',
  axisText: '#5f6675',
  gridLine: '#dfe6f1'
}

export const BC_CHART_PALETTE = [
  BC_CHART_COLORS.green,
  BC_CHART_COLORS.teal,
  BC_CHART_COLORS.blue,
  BC_CHART_COLORS.indigo,
  BC_CHART_COLORS.purple,
  BC_CHART_COLORS.magenta,
  BC_CHART_COLORS.orange,
  BC_CHART_COLORS.red,
  BC_CHART_COLORS.gray,
  BC_CHART_COLORS.darkPurple,
  BC_CHART_COLORS.brightBlue
]

export const BC_CHART_GRID = {
  left: 64,
  right: 24,
  bottom: 56,
  top: 56,
  containLabel: true
}

export const BC_CHART_AXIS_LABEL = {
  color: BC_CHART_COLORS.axisText,
  hideOverlap: true
}

export const BC_CHART_CATEGORY_AXIS_LABEL = {
  ...BC_CHART_AXIS_LABEL,
  show: true,
  interval: 0,
  margin: 10
}

export const bcChartTextStyle = {
  color: BC_CHART_COLORS.text,
  align: 'center'
}

export const getChartColor = (index = 0) =>
  BC_CHART_PALETTE[index % BC_CHART_PALETTE.length]

export const getStandardLineSeriesStyle = (index = 0) => {
  const color = getChartColor(index)
  return {
    symbol: 'circle',
    symbolSize: 7,
    itemStyle: {
      color,
      borderColor: '#ffffff',
      borderWidth: 1
    },
    lineStyle: {
      color,
      width: 2
    }
  }
}

export const getStandardBarSeriesStyle = (index = 0) => ({
  itemStyle: {
    color: getChartColor(index)
  }
})

export const getStandardChartOptions = (overrides = {}) => ({
  color: BC_CHART_PALETTE,
  ...overrides
})
