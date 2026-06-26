import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import ReactECharts from 'echarts-for-react'
import type {
  ComparisonSeries,
  ComplianceUnitPoint,
  ReviewChartData
} from './types'

interface HistoricalChartGroup {
  title: string
  labels: string[]
  periodLabels: string[]
  valuesByPeriod: Map<string, Map<string, number>>
}

interface ComplianceUnitChartGroup {
  fuelTypes: string[]
  schedules: string[]
  values: Map<string, number>
}

type HistoricalChartMode = 'trend' | 'horizontal-bars' | 'grouped-bars'

const chartGrid = {
  left: 8,
  right: 16,
  bottom: 8,
  top: 48,
  containLabel: true
}

const getHistoricalChartMode = (
  group: HistoricalChartGroup
): HistoricalChartMode => {
  if (group.periodLabels.length >= 3 && group.labels.length <= 6) {
    return 'trend'
  }
  if (group.labels.length > 6) {
    return 'horizontal-bars'
  }
  return 'grouped-bars'
}

const getHistoricalChartModeLabel = (group: HistoricalChartGroup) => {
  const mode = getHistoricalChartMode(group)
  if (mode === 'trend') return 'trend'
  if (mode === 'horizontal-bars') return 'wide variance'
  return 'comparison'
}

const buildSupplementalImpactChartOptions = (series: ComparisonSeries) => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' }
  },
  legend: {
    top: 0
  },
  grid: chartGrid,
  xAxis: {
    type: 'category',
    data: series.points.map((point) => point.label),
    axisLabel: {
      rotate: series.points.length > 4 ? 30 : 0,
      overflow: 'truncate',
      width: 100
    }
  },
  yAxis: {
    type: 'value'
  },
  series: [
    {
      name: series.comparisonLabel,
      type: 'bar',
      data: series.points.map((point) => point.comparisonValue)
    },
    {
      name: series.currentLabel,
      type: 'bar',
      data: series.points.map((point) => point.currentValue)
    },
    {
      name: 'Delta',
      type: 'line',
      data: series.points.map((point) => point.delta),
      yAxisIndex: 0
    }
  ]
})

const groupHistoricalSeries = (
  historicalSeries: ComparisonSeries[]
): HistoricalChartGroup[] => {
  const grouped = new Map<
    string,
    {
      title: string
      currentLabel: string
      periods: Map<string, Map<string, number>>
      labels: Set<string>
    }
  >()

  historicalSeries.forEach((series) => {
    if (!grouped.has(series.title)) {
      grouped.set(series.title, {
        title: series.title,
        currentLabel: series.currentLabel,
        periods: new Map([[series.currentLabel, new Map()]]),
        labels: new Set()
      })
    }

    const group = grouped.get(series.title)!
    if (!group.periods.has(series.comparisonLabel)) {
      group.periods.set(series.comparisonLabel, new Map())
    }

    series.points.forEach((point) => {
      group.labels.add(point.label)
      group.periods
        .get(series.currentLabel)!
        .set(point.label, point.currentValue)
      group.periods
        .get(series.comparisonLabel)!
        .set(point.label, point.comparisonValue)
    })
  })

  return Array.from(grouped.values()).map((group) => ({
    title: group.title,
    labels: Array.from(group.labels),
    periodLabels: Array.from(group.periods.keys()).sort((a, b) => {
      if (a === group.currentLabel) return 1
      if (b === group.currentLabel) return -1
      return Number(a) - Number(b)
    }),
    valuesByPeriod: group.periods
  }))
}

const buildHistoricalChartOptions = (group: HistoricalChartGroup) => {
  const mode = getHistoricalChartMode(group)

  if (mode === 'trend') {
    return {
      tooltip: { trigger: 'axis' },
      legend: { top: 0, type: 'scroll' },
      grid: chartGrid,
      xAxis: {
        type: 'category',
        data: group.periodLabels
      },
      yAxis: {
        type: 'value'
      },
      series: group.labels.map((label) => ({
        name: label,
        type: 'line',
        smooth: true,
        symbolSize: 7,
        data: group.periodLabels.map(
          (period) => group.valuesByPeriod.get(period)?.get(label) || 0
        )
      }))
    }
  }

  if (mode === 'horizontal-bars') {
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      legend: { top: 0, type: 'scroll' },
      grid: chartGrid,
      xAxis: {
        type: 'value'
      },
      yAxis: {
        type: 'category',
        data: group.labels,
        axisLabel: {
          overflow: 'truncate',
          width: 120
        }
      },
      series: group.periodLabels.map((period) => ({
        name: period,
        type: 'bar',
        data: group.labels.map(
          (label) => group.valuesByPeriod.get(period)?.get(label) || 0
        )
      }))
    }
  }

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    legend: {
      top: 0,
      type: 'scroll'
    },
    grid: chartGrid,
    xAxis: {
      type: 'category',
      data: group.labels,
      axisLabel: {
        rotate: group.labels.length > 4 ? 30 : 0,
        overflow: 'truncate',
        width: 100
      }
    },
    yAxis: {
      type: 'value'
    },
    series: group.periodLabels.map((period) => ({
      name: period,
      type: 'bar',
      data: group.labels.map(
        (label) => group.valuesByPeriod.get(period)?.get(label) || 0
      )
    }))
  }
}

const groupComplianceUnitSeries = (
  points: ComplianceUnitPoint[] = []
): ComplianceUnitChartGroup => {
  const fuelTypes = new Set<string>()
  const schedules = new Set<string>()
  const values = new Map<string, number>()

  points.forEach((point) => {
    fuelTypes.add(point.fuelType)
    schedules.add(point.schedule)
    values.set(
      `${point.schedule}|${point.fuelType}`,
      point.complianceUnits || 0
    )
  })

  return {
    fuelTypes: Array.from(fuelTypes),
    schedules: Array.from(schedules),
    values
  }
}

const buildComplianceUnitChartOptions = (group: ComplianceUnitChartGroup) => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' }
  },
  legend: {
    top: 0,
    type: 'scroll'
  },
  grid: chartGrid,
  xAxis: {
    type: 'category',
    data: group.fuelTypes,
    axisLabel: {
      rotate: group.fuelTypes.length > 4 ? 30 : 0,
      overflow: 'truncate',
      width: 100
    }
  },
  yAxis: {
    type: 'value',
    name: 'Compliance units'
  },
  series: group.schedules.map((schedule) => ({
    name: schedule,
    type: 'bar',
    stack: 'compliance-units',
    emphasis: {
      focus: 'series'
    },
    data: group.fuelTypes.map(
      (fuelType) => group.values.get(`${schedule}|${fuelType}`) || 0
    )
  }))
})

interface ReviewChartsProps {
  chartData?: ReviewChartData
}

export const ReviewCharts = ({ chartData }: ReviewChartsProps) => {
  const historical = chartData?.historicalVariance || []
  const supplemental = chartData?.supplementalImpact || []
  const complianceUnits = chartData?.complianceUnitsByFuel || []
  const groupedHistorical = groupHistoricalSeries(
    historical.filter((item) => item.points?.length > 0)
  )
  const supplementalSeries = supplemental.filter(
    (item) => item.points?.length > 0
  )
  const complianceUnitGroup = groupComplianceUnitSeries(complianceUnits)

  if (
    !groupedHistorical.length &&
    !supplementalSeries.length &&
    !complianceUnits.length
  ) {
    return null
  }

  return (
    <BCBox>
      <BCTypography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
        Comparison charts
      </BCTypography>
      <BCBox
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
          gap: 2
        }}
      >
        {complianceUnits.length > 0 && (
          <BCBox
            sx={{
              border: '1px solid rgba(0, 0, 0, 0.12)',
              borderRadius: '4px',
              p: 1
            }}
          >
            <BCTypography variant="body2" sx={{ mb: 1 }}>
              Compliance units by fuel and schedule
            </BCTypography>
            <ReactECharts
              option={buildComplianceUnitChartOptions(complianceUnitGroup)}
              style={{ height: 280, width: '100%' }}
              notMerge
              lazyUpdate
            />
          </BCBox>
        )}
        {groupedHistorical.map((item) => (
          <BCBox
            key={item.title}
            sx={{
              border: '1px solid rgba(0, 0, 0, 0.12)',
              borderRadius: '4px',
              p: 1
            }}
          >
            <BCTypography variant="body2" sx={{ mb: 1 }}>
              {item.title} ({getHistoricalChartModeLabel(item)})
            </BCTypography>
            <ReactECharts
              option={buildHistoricalChartOptions(item)}
              style={{ height: 280, width: '100%' }}
              notMerge
              lazyUpdate
            />
          </BCBox>
        ))}
        {supplementalSeries.map((item) => (
          <BCBox
            key={`${item.title}-${item.comparisonLabel}-${item.currentLabel}`}
            sx={{
              border: '1px solid rgba(0, 0, 0, 0.12)',
              borderRadius: '4px',
              p: 1
            }}
          >
            <BCTypography variant="body2" sx={{ mb: 1 }}>
              {item.title}
            </BCTypography>
            <ReactECharts
              option={buildSupplementalImpactChartOptions(item)}
              style={{ height: 280, width: '100%' }}
              notMerge
              lazyUpdate
            />
          </BCBox>
        ))}
      </BCBox>
    </BCBox>
  )
}
