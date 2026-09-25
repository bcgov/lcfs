import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { BCResponsiveEChart } from '@/components/charts/BCResponsiveEchart'
import {
  BC_CHART_AXIS_LABEL,
  BC_CHART_COLORS,
  BC_CHART_GRID,
  getStandardBarSeriesStyle,
  getStandardChartOptions,
  getStandardLineSeriesStyle
} from '@/components/charts/chartStyles'
import { FormControl, InputLabel, MenuItem, Select, Stack } from '@mui/material'
import { useMemo, useState } from 'react'
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

const chartGrid = { ...BC_CHART_GRID, bottom: 44 }
const chartAxisLabel = BC_CHART_AXIS_LABEL
const srOnlySx = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  left: 0,
  m: -1,
  maxHeight: 1,
  maxWidth: 1,
  overflow: 'hidden',
  p: 0,
  position: 'absolute',
  top: 0,
  width: 1
} as const

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
  if (isSupplyFseCorrelationGroup(group)) return 'correlation'
  if (isFuelPresenceHeatmapGroup(group)) return 'presence heatmap'
  const mode = getHistoricalChartMode(group)
  if (mode === 'trend') return 'trend'
  if (mode === 'horizontal-bars') return 'wide variance'
  return 'comparison'
}

const formatAccessibleNumber = (value: number) => value.toLocaleString()

const getHistoricalChartAriaLabel = (group: HistoricalChartGroup) => {
  const samplePoints = group.labels.slice(0, 4).map((label) => {
    const values = group.periodLabels
      .map((period) => {
        const value = group.valuesByPeriod.get(period)?.get(label) || 0
        return `${period}: ${formatAccessibleNumber(value)}`
      })
      .join(', ')
    return `${label}. ${values}.`
  })
  return `${group.title}. ${getHistoricalChartModeLabel(group)} chart. Periods: ${group.periodLabels.join(', ')}. ${samplePoints.join(' ')}`
}

const getSupplementalChartAriaLabel = (series: ComparisonSeries) => {
  const pointSummary = series.points
    .slice(0, 5)
    .map(
      (point) =>
        `${point.label}: ${series.comparisonLabel} ${formatAccessibleNumber(point.comparisonValue)}, ${series.currentLabel} ${formatAccessibleNumber(point.currentValue)}, delta ${formatAccessibleNumber(point.delta)}`
    )
    .join('. ')
  return `${series.title}. Comparison between ${series.comparisonLabel} and ${series.currentLabel}. ${pointSummary}.`
}

const getComplianceUnitsChartAriaLabel = (group: ComplianceUnitChartGroup) => {
  const sampleLabels = group.fuelLabels.slice(0, 4).map((fuelLabel) => {
    const scheduleValues = group.schedules
      .map((schedule) => {
        const value = group.values.get(`${schedule}|${fuelLabel}`) || 0
        return `${schedule}: ${formatAccessibleNumber(value)}`
      })
      .join(', ')
    return `${fuelLabel}. ${scheduleValues}.`
  })
  return `Compliance units by fuel category, type, and schedule. ${sampleLabels.join(' ')}`
}

const AccessibleChartSummary = ({
  title,
  ariaLabel,
  rows,
  id
}: {
  title: string
  ariaLabel: string
  rows: Array<{ label: string; values: Array<{ key: string; value: string }> }>
  id: string
}) => (
  <BCBox id={id} sx={srOnlySx}>
    <BCTypography component="p">{ariaLabel}</BCTypography>
    <table>
      <caption>{title}</caption>
      <thead>
        <tr>
          <th scope="col">Label</th>
          {rows[0]?.values.map((item) => (
            <th key={item.key} scope="col">
              {item.key}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            {row.values.map((item) => (
              <td key={`${row.label}-${item.key}`}>{item.value}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </BCBox>
)

const getHistoricalAccessibleRows = (group: HistoricalChartGroup) =>
  group.labels.map((label) => ({
    label,
    values: group.periodLabels.map((period) => ({
      key: period,
      value: formatAccessibleNumber(
        group.valuesByPeriod.get(period)?.get(label) || 0
      )
    }))
  }))

const getSupplementalAccessibleRows = (series: ComparisonSeries) =>
  series.points.map((point) => ({
    label: point.label,
    values: [
      {
        key: series.comparisonLabel,
        value: formatAccessibleNumber(point.comparisonValue)
      },
      {
        key: series.currentLabel,
        value: formatAccessibleNumber(point.currentValue)
      },
      {
        key: 'Delta',
        value: formatAccessibleNumber(point.delta)
      }
    ]
  }))

const getComplianceUnitAccessibleRows = (group: ComplianceUnitChartGroup) =>
  group.fuelLabels.map((fuelLabel) => ({
    label: fuelLabel,
    values: group.schedules.map((schedule) => ({
      key: schedule,
      value: formatAccessibleNumber(group.values.get(`${schedule}|${fuelLabel}`) || 0)
    }))
  }))

const isFuelCodeSunburstGroup = (group: HistoricalChartGroup) =>
  group.title === 'Fuel supply by fuel code'

const isFseUsageUtilizationGroup = (group: HistoricalChartGroup) =>
  group.title === 'FSE kWh usage and capacity utilization'

const isSupplyFseCorrelationGroup = (group: HistoricalChartGroup) =>
  group.title === 'Fuel supply and FSE count trend'

const isFuelPresenceHeatmapGroup = (group: HistoricalChartGroup) =>
  group.title === 'Fuel supply presence by fuel category and type'

const buildSupplementalImpactChartOptions = (series: ComparisonSeries) =>
  getStandardChartOptions({
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
        ...chartAxisLabel,
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
        ...getStandardBarSeriesStyle(0),
        data: series.points.map((point) => point.comparisonValue)
      },
      {
        name: series.currentLabel,
        type: 'bar',
        ...getStandardBarSeriesStyle(1),
        data: series.points.map((point) => point.currentValue)
      },
      {
        name: 'Delta',
        type: 'line',
        ...getStandardLineSeriesStyle(2),
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
  if (isSupplyFseCorrelationGroup(group)) {
    return buildSupplyFseCorrelationChartOptions(group)
  }
  if (isFuelPresenceHeatmapGroup(group)) {
    return buildFuelPresenceHeatmapOptions(group)
  }
  if (isFseUsageUtilizationGroup(group)) {
    return buildFseUsageUtilizationChartOptions(group)
  }

  const mode = getHistoricalChartMode(group)

  if (mode === 'trend') {
    return getStandardChartOptions({
      tooltip: { trigger: 'axis' },
      legend: { top: 0, type: 'scroll' },
      grid: chartGrid,
      xAxis: {
        type: 'category',
        data: group.periodLabels,
        axisLabel: chartAxisLabel
      },
      yAxis: {
        type: 'value',
        axisLabel: chartAxisLabel
      },
      series: group.labels.map((label, index) => ({
        name: label,
        type: 'line',
        smooth: true,
        ...getStandardLineSeriesStyle(index),
        data: group.periodLabels.map(
          (period) => group.valuesByPeriod.get(period)?.get(label) || 0
        )
      }))
    })
  }

  if (mode === 'horizontal-bars') {
    return getStandardChartOptions({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      legend: { top: 0, type: 'scroll' },
      grid: chartGrid,
      xAxis: {
        type: 'value',
        axisLabel: chartAxisLabel
      },
      yAxis: {
        type: 'category',
        data: group.labels,
        axisLabel: {
          ...chartAxisLabel,
          overflow: 'truncate',
          width: 120
        }
      },
      series: group.periodLabels.map((period, index) => ({
        name: period,
        type: 'bar',
        ...getStandardBarSeriesStyle(index),
        data: group.labels.map(
          (label) => group.valuesByPeriod.get(period)?.get(label) || 0
        )
      }))
    })
  }

  return getStandardChartOptions({
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
        ...chartAxisLabel,
        rotate: group.labels.length > 4 ? 30 : 0,
        overflow: 'truncate',
        width: 100
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: chartAxisLabel
    },
    series: group.periodLabels.map((period, index) => ({
      name: period,
      type: 'bar',
      ...getStandardBarSeriesStyle(index),
      data: group.labels.map(
        (label) => group.valuesByPeriod.get(period)?.get(label) || 0
      )
    }))
  })
}

const buildFseUsageUtilizationChartOptions = (group: HistoricalChartGroup) =>
  getStandardChartOptions({
    tooltip: { trigger: 'axis' },
    legend: { top: 0, type: 'scroll' },
    grid: {
      ...chartGrid,
      right: 56
    },
    xAxis: {
      type: 'category',
      data: group.periodLabels,
      axisLabel: chartAxisLabel
    },
    yAxis: [
      {
        type: 'value',
        name: 'kWh usage',
        nameLocation: 'middle',
        nameGap: 48,
        nameRotate: 90,
        nameTextStyle: {
          color: BC_CHART_COLORS.text,
          align: 'center'
        },
        axisLabel: chartAxisLabel
      },
      {
        type: 'value',
        name: 'Utilization %',
        nameLocation: 'middle',
        nameGap: 48,
        nameRotate: 90,
        nameTextStyle: {
          color: BC_CHART_COLORS.text,
          align: 'center'
        },
        axisLabel: {
          ...chartAxisLabel,
          formatter: '{value}%'
        }
      }
    ],
    series: group.labels.map((label, index) => ({
      name: label,
      type: 'line',
      smooth: true,
      ...getStandardLineSeriesStyle(index),
      yAxisIndex: label === 'Average capacity utilization' ? 1 : 0,
      data: group.periodLabels.map(
        (period) => group.valuesByPeriod.get(period)?.get(label) || 0
      )
    }))
  })

const buildSupplyFseCorrelationChartOptions = (group: HistoricalChartGroup) =>
  getStandardChartOptions({
    tooltip: { trigger: 'axis' },
    legend: { top: 0, type: 'scroll' },
    grid: {
      ...chartGrid,
      right: 56
    },
    xAxis: {
      type: 'category',
      data: group.periodLabels,
      axisLabel: chartAxisLabel
    },
    yAxis: [
      {
        type: 'value',
        name: 'Supply volume',
        nameLocation: 'middle',
        nameGap: 48,
        nameRotate: 90,
        nameTextStyle: {
          color: BC_CHART_COLORS.text,
          align: 'center'
        },
        axisLabel: chartAxisLabel
      },
      {
        type: 'value',
        name: 'FSE count',
        nameLocation: 'middle',
        nameGap: 48,
        nameRotate: 90,
        nameTextStyle: {
          color: BC_CHART_COLORS.text,
          align: 'center'
        },
        axisLabel: chartAxisLabel
      }
    ],
    series: group.labels.map((label, index) => ({
      name: label,
      type: 'line',
      smooth: true,
      ...getStandardLineSeriesStyle(index),
      yAxisIndex: label === 'FSE count' ? 1 : 0,
      data: group.periodLabels.map(
        (period) => group.valuesByPeriod.get(period)?.get(label) || 0
      )
    }))
  })

const buildFuelPresenceHeatmapOptions = (group: HistoricalChartGroup) => {
  const quantities = group.labels.flatMap((label) =>
    group.periodLabels.map(
      (period) => group.valuesByPeriod.get(period)?.get(label) || 0
    )
  )
  const nonZeroQuantities = quantities.filter((quantity) => quantity > 0)
  const maxLogQuantity = nonZeroQuantities.length
    ? Math.max(...nonZeroQuantities.map((quantity) => Math.log10(quantity + 1)))
    : 0
  const heatmapData = group.labels.flatMap((label, yIndex) =>
    group.periodLabels.map((period, xIndex) => {
      const quantity = group.valuesByPeriod.get(period)?.get(label) || 0
      return {
        value: [xIndex, yIndex, quantity, Math.log10(quantity + 1)]
      }
    })
  )

  return getStandardChartOptions({
    tooltip: {
      position: 'top',
      formatter: (params: any) => {
        const [xIndex, yIndex, quantity] = params.value || []
        const period = group.periodLabels[xIndex]
        const fuel = group.labels[yIndex]
        return `${fuel}<br/>${period}<br/>${
          quantity > 0 ? 'Reported' : 'Not reported'
        }<br/>Quantity: ${Number(quantity || 0).toLocaleString()}`
      }
    },
    grid: {
      ...chartGrid,
      top: 36,
      height: '68%'
    },
    xAxis: {
      type: 'category',
      data: group.periodLabels,
      splitArea: { show: true },
      axisLabel: chartAxisLabel
    },
    yAxis: {
      type: 'category',
      data: group.labels,
      splitArea: { show: true },
      axisLabel: {
        ...chartAxisLabel,
        overflow: 'truncate',
        width: 140
      }
    },
    visualMap: {
      min: 0,
      max: maxLogQuantity || 1,
      calculable: false,
      dimension: 3,
      type: 'continuous',
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      text: ['Higher volume', 'Missing'],
      inRange: {
        color: ['#dbeafe', '#60a5fa', '#1d4ed8']
      },
      outOfRange: {
        color: ['#f3f6fb']
      }
    },
    series: [
      {
        name: 'Fuel presence',
        type: 'heatmap',
        data: heatmapData,
        label: {
          show: false
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 8
          }
        }
      }
    ]
  })
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

  return getStandardChartOptions({
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
  })
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
  const ariaLabel = useMemo(() => getHistoricalChartAriaLabel(group), [group])
  const summaryId = `chart-summary-${group.title.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <BCBox
      sx={{
        border: '1px solid rgba(0, 0, 0, 0.12)',
        borderRadius: '4px',
        p: 1,
        minWidth: 0,
        overflow: 'hidden',
        gridColumn: { xl: '1 / -1' }
      }}
    >
      <BCTypography variant="body2">
        {group.title} ({getHistoricalChartModeLabel(group)})
      </BCTypography>
      <AccessibleChartSummary
        id={summaryId}
        title={group.title}
        ariaLabel={ariaLabel}
        rows={getHistoricalAccessibleRows(group)}
      />
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: 1 }}
      >
        <BCResponsiveEChart
          option={chartOptions}
          height={520}
          ariaLabel={ariaLabel}
          ariaDescribedBy={summaryId}
          sx={{ flex: 1, minWidth: 0 }}
        />
        <Stack direction={'column'} spacing={8} sx={{ pt: 2, flexShrink: 0 }}>
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

const buildComplianceUnitChartOptions = (group: ComplianceUnitChartGroup) =>
  getStandardChartOptions({
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
        ...chartAxisLabel,
        rotate: group.fuelLabels.length > 4 ? 30 : 0,
        overflow: 'truncate',
        width: 100
      }
    },
    yAxis: {
      type: 'value',
      name: 'Compliance units',
      nameLocation: 'middle',
      nameGap: 52,
      nameRotate: 90,
      nameTextStyle: {
        color: BC_CHART_COLORS.text,
        align: 'center'
      },
      axisLabel: chartAxisLabel
    },
    series: group.schedules.map((schedule, index) => ({
      name: schedule,
      type: 'bar',
      stack: 'compliance-units',
      ...getStandardBarSeriesStyle(index),
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
              p: 1,
              minWidth: 0,
              overflow: 'hidden'
            }}
          >
            <BCTypography variant="body2" sx={{ mb: 1 }}>
              Compliance units by fuel category, type, and schedule
            </BCTypography>
            <AccessibleChartSummary
              id="compliance-units-chart-summary"
              title="Compliance units by fuel category, type, and schedule"
              ariaLabel={getComplianceUnitsChartAriaLabel(complianceUnitGroup)}
              rows={getComplianceUnitAccessibleRows(complianceUnitGroup)}
            />
            <BCResponsiveEChart
              option={buildComplianceUnitChartOptions(complianceUnitGroup)}
              height={280}
              ariaLabel={getComplianceUnitsChartAriaLabel(complianceUnitGroup)}
              ariaDescribedBy="compliance-units-chart-summary"
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
                p: 1,
                minWidth: 0,
                overflow: 'hidden'
              }}
            >
              <BCTypography variant="body2" sx={{ mb: 1 }}>
                {item.title} ({getHistoricalChartModeLabel(item)})
              </BCTypography>
              <AccessibleChartSummary
                id={`chart-summary-${item.title.replace(/\s+/g, '-').toLowerCase()}`}
                title={item.title}
                ariaLabel={getHistoricalChartAriaLabel(item)}
                rows={getHistoricalAccessibleRows(item)}
              />
              <BCResponsiveEChart
                option={buildHistoricalChartOptions(item)}
                height={280}
                ariaLabel={getHistoricalChartAriaLabel(item)}
                ariaDescribedBy={`chart-summary-${item.title.replace(/\s+/g, '-').toLowerCase()}`}
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
              p: 1,
              minWidth: 0,
              overflow: 'hidden'
            }}
          >
            <BCTypography variant="body2" sx={{ mb: 1 }}>
              {item.title}
            </BCTypography>
            <AccessibleChartSummary
              id={`chart-summary-${item.title.replace(/\s+/g, '-').toLowerCase()}-${item.currentLabel}-${item.comparisonLabel}`}
              title={item.title}
              ariaLabel={getSupplementalChartAriaLabel(item)}
              rows={getSupplementalAccessibleRows(item)}
            />
            <BCResponsiveEChart
              option={buildSupplementalImpactChartOptions(item)}
              height={280}
              ariaLabel={getSupplementalChartAriaLabel(item)}
              ariaDescribedBy={`chart-summary-${item.title.replace(/\s+/g, '-').toLowerCase()}-${item.currentLabel}-${item.comparisonLabel}`}
            />
          </BCBox>
        ))}
      </BCBox>
    </BCBox>
  )
}
