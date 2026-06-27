import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { FormControl, InputLabel, MenuItem, Select, Stack } from '@mui/material'
import { useMemo, useState } from 'react'
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
  fuelLabels: string[]
  schedules: string[]
  values: Map<string, number>
}

interface SunburstNode {
  name: string
  value?: number
  children?: SunburstNode[]
}

interface FuelCodeSunburstFilters {
  complianceYear: string
  fuelType: string
}

type HistoricalChartMode = 'trend' | 'horizontal-bars' | 'grouped-bars'

const ALL_FILTER_VALUE = 'all'

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
  if (isFuelCodeSunburstGroup(group)) return 'fuel-code hierarchy'
  const mode = getHistoricalChartMode(group)
  if (mode === 'trend') return 'trend'
  if (mode === 'horizontal-bars') return 'wide variance'
  return 'comparison'
}

const isFuelCodeSunburstGroup = (group: HistoricalChartGroup) =>
  group.title === 'Fuel supply by fuel code'

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
  if (isFuelCodeSunburstGroup(group)) {
    return buildFuelCodeSunburstOptions(group, {
      complianceYear: ALL_FILTER_VALUE,
      fuelType: ALL_FILTER_VALUE
    })
  }

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

const parseFuelCodeLabel = (label: string) => {
  const match = label.match(/^(.*?) \((.*?) - (.*?)\)$/)
  if (!match) {
    return {
      fuelType: 'Unknown fuel type',
      fuelCode: label
    }
  }

  return {
    fuelType: `${match[2]} - ${match[3]}`,
    fuelCode: match[1]
  }
}

const getFuelCodeSunburstFilterOptions = (group: HistoricalChartGroup) => {
  const fuelTypes = new Set<string>()

  group.labels.forEach((label) => {
    fuelTypes.add(parseFuelCodeLabel(label).fuelType)
  })

  return {
    complianceYears: group.periodLabels,
    fuelTypes: Array.from(fuelTypes).sort()
  }
}

const buildFuelCodeSunburstOptions = (
  group: HistoricalChartGroup,
  filters: FuelCodeSunburstFilters
) => {
  const fuelTypeMap = new Map<string, Map<string, SunburstNode[]>>()

  group.labels.forEach((label) => {
    const { fuelType, fuelCode } = parseFuelCodeLabel(label)
    if (
      filters.fuelType !== ALL_FILTER_VALUE &&
      filters.fuelType !== fuelType
    ) {
      return
    }

    if (!fuelTypeMap.has(fuelType)) {
      fuelTypeMap.set(fuelType, new Map())
    }

    const fuelCodeMap = fuelTypeMap.get(fuelType)!
    if (!fuelCodeMap.has(fuelCode)) {
      fuelCodeMap.set(fuelCode, [])
    }

    group.periodLabels.forEach((period) => {
      if (
        filters.complianceYear !== ALL_FILTER_VALUE &&
        filters.complianceYear !== period
      ) {
        return
      }

      const value = group.valuesByPeriod.get(period)?.get(label) || 0
      if (value === 0) {
        return
      }

      fuelCodeMap.get(fuelCode)!.push({
        name: period,
        value
      })
    })
  })

  const data = Array.from(fuelTypeMap.entries())
    .map(([fuelType, fuelCodes]) => ({
      name: fuelType,
      children: Array.from(fuelCodes.entries())
        .map(([fuelCode, years]) => ({
          name: fuelCode,
          children: years
        }))
        .filter((fuelCode) => fuelCode.children.length > 0)
    }))
    .filter((fuelType) => fuelType.children.length > 0)

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const treePath = params.treePathInfo
          ?.slice(1)
          .map((item: { name: string }) => item.name)
          .join(' / ')
        const value =
          typeof params.value === 'number'
            ? Number(params.value).toLocaleString()
            : ''
        return value ? `${treePath}<br/>Quantity supplied: ${value}` : treePath
      }
    },
    series: [
      {
        type: 'sunburst',
        data,
        radius: [0, '92%'],
        sort: undefined,
        emphasis: {
          focus: 'ancestor'
        },
        levels: [
          {},
          {
            r0: '0%',
            r: '32%',
            itemStyle: {
              borderWidth: 2
            },
            label: {
              rotate: 'tangential'
            }
          },
          {
            r0: '32%',
            r: '66%',
            label: {
              align: 'right'
            }
          },
          {
            r0: '66%',
            r: '92%',
            label: {
              position: 'outside',
              padding: 3,
              silent: false
            },
            itemStyle: {
              borderWidth: 3
            }
          }
        ]
      }
    ]
  }
}

const FuelCodeSunburstChartCard = ({
  group
}: {
  group: HistoricalChartGroup
}) => {
  const [complianceYear, setComplianceYear] = useState(ALL_FILTER_VALUE)
  const [fuelType, setFuelType] = useState(ALL_FILTER_VALUE)
  const filterOptions = useMemo(
    () => getFuelCodeSunburstFilterOptions(group),
    [group]
  )
  const chartOptions = useMemo(
    () =>
      buildFuelCodeSunburstOptions(group, {
        complianceYear,
        fuelType
      }),
    [complianceYear, fuelType, group]
  )

  return (
    <BCBox
      sx={{
        border: '1px solid rgba(0, 0, 0, 0.12)',
        borderRadius: '4px',
        p: 1,
        gridColumn: { xl: '1 / -1' }
      }}
    >
      <BCTypography variant="body2">
        {group.title} ({getHistoricalChartModeLabel(group)})
      </BCTypography>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: 1 }}
      >
        <ReactECharts
          option={chartOptions}
          style={{ height: 520, width: '100%' }}
          notMerge
          lazyUpdate
        />
        <Stack direction={'column'} spacing={8} sx={{ pt: 2 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="fuel-code-year-filter-label">
              Compliance year
            </InputLabel>
            <Select
              labelId="fuel-code-year-filter-label"
              label="Compliance year"
              value={complianceYear}
              onChange={(event) => setComplianceYear(event.target.value)}
            >
              <MenuItem value={ALL_FILTER_VALUE}>All years</MenuItem>
              {filterOptions.complianceYears.map((year) => (
                <MenuItem key={year} value={year}>
                  {year}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 190 }}>
            <InputLabel id="fuel-code-type-filter-label">Fuel type</InputLabel>
            <Select
              labelId="fuel-code-type-filter-label"
              label="Fuel type"
              value={fuelType}
              onChange={(event) => setFuelType(event.target.value)}
            >
              <MenuItem value={ALL_FILTER_VALUE}>All fuel types</MenuItem>
              {filterOptions.fuelTypes.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Stack>
    </BCBox>
  )
}

const groupComplianceUnitSeries = (
  points: ComplianceUnitPoint[] = []
): ComplianceUnitChartGroup => {
  const fuelLabels = new Set<string>()
  const schedules = new Set<string>()
  const values = new Map<string, number>()

  points.forEach((point) => {
    const fuelCategory = point.fuelCategory || 'Unknown fuel category'
    const fuelLabel = `${fuelCategory} - ${point.fuelType || 'Unknown fuel type'}`
    fuelLabels.add(fuelLabel)
    schedules.add(point.schedule)
    const valueKey = `${point.schedule}|${fuelLabel}`
    values.set(
      valueKey,
      (values.get(valueKey) || 0) + (point.complianceUnits || 0)
    )
  })

  return {
    fuelLabels: Array.from(fuelLabels),
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
    data: group.fuelLabels,
    axisLabel: {
      rotate: group.fuelLabels.length > 4 ? 30 : 0,
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
    data: group.fuelLabels.map(
      (fuelLabel) => group.values.get(`${schedule}|${fuelLabel}`) || 0
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
              Compliance units by fuel category, type, and schedule
            </BCTypography>
            <ReactECharts
              option={buildComplianceUnitChartOptions(complianceUnitGroup)}
              style={{ height: 280, width: '100%' }}
              notMerge
              lazyUpdate
            />
          </BCBox>
        )}
        {groupedHistorical.map((item) =>
          isFuelCodeSunburstGroup(item) ? (
            <FuelCodeSunburstChartCard key={item.title} group={item} />
          ) : (
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
                style={{
                  height: 280,
                  width: '100%'
                }}
                notMerge
                lazyUpdate
              />
            </BCBox>
          )
        )}
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
