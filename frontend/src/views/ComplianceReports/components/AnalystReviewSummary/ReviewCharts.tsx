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
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import { useId, useMemo, useState } from 'react'
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
  unitsByPeriod: Map<string, Map<string, string | null | undefined>>
  comparisonDetailsByLabel: Map<string, Array<{ key: string; value: string }>>
}

interface ComplianceUnitChartGroup {
  fuelLabels: string[]
  schedules: string[]
  values: Map<string, number>
}

interface SunburstNode {
  name: string
  value?: number
  units?: string | null
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
  if (isFuelCodeSunburstGroup(group)) return 'fuel-code sunburst'
  if (isSupplyFseCorrelationGroup(group) || isFseUsageUtilizationGroup(group)) {
    return 'dual-axis line'
  }
  if (isFuelPresenceHeatmapGroup(group)) return 'heatmap'
  const mode = getHistoricalChartMode(group)
  if (mode === 'trend') return 'line'
  if (mode === 'horizontal-bars') return 'horizontal bar'
  return 'grouped bar'
}

const formatAccessibleNumber = (value: number) => value.toLocaleString()

const MAX_ANNOUNCED_CATEGORIES = 5

const getAccessibleRowsSummary = (
  rows: Array<{ label: string; values: Array<{ key: string; value: string }> }>
) => {
  if (!rows.length) return 'No values are available for this chart.'

  const announcedRows = rows.slice(0, MAX_ANNOUNCED_CATEGORIES)
  const rowDescriptions = announcedRows.map((row) => {
    const values = row.values
      .map(({ key, value }) => `${key}: ${value}`)
      .join('; ')
    return `${row.label}: ${values}.`
  })
  const remainingCount = rows.length - announcedRows.length
  const remainingDescription = remainingCount
    ? ` ${remainingCount} more categories are available in the data table.`
    : ''

  return `${rowDescriptions.join(' ')}${remainingDescription} Open the data table for all values.`
}

const getHistoricalChartAriaLabel = (group: HistoricalChartGroup) => {
  return `${group.title}. ${getHistoricalChartModeLabel(group)} chart.`
}

const getHistoricalChartAriaDescription = (group: HistoricalChartGroup) => {
  return `${group.title}. ${getHistoricalChartModeLabel(group)} chart. ${getAccessibleRowsSummary(getHistoricalAccessibleRows(group))}`
}

const getSupplementalChartAriaLabel = (series: ComparisonSeries) => {
  return `${series.title}. Comparison between ${series.comparisonLabel} and ${series.currentLabel}.`
}

const getSupplementalChartAriaDescription = (series: ComparisonSeries) => {
  return `${series.title}. Comparison chart with bars for ${series.comparisonLabel} and ${series.currentLabel}, and a line for the delta. ${getAccessibleRowsSummary(getSupplementalAccessibleRows(series))}`
}

const getComplianceUnitsChartAriaLabel = () => {
  return 'Compliance units by fuel category, type, and schedule.'
}

const getComplianceUnitsChartAriaDescription = (
  group: ComplianceUnitChartGroup
) => {
  return `Stacked bar chart of compliance units by fuel category and type, split by schedule. ${getAccessibleRowsSummary(getComplianceUnitAccessibleRows(group))}`
}

const AccessibleChartSummary = ({
  title,
  rows,
  id
}: {
  title: string
  rows: Array<{ label: string; values: Array<{ key: string; value: string }> }>
  id: string
}) => {
  const columns = Array.from(
    new Set(rows.flatMap((row) => row.values.map((item) => item.key)))
  )

  return (
    <BCBox id={id}>
      <details>
        <summary>View data table for {title}</summary>
        <BCBox
          role="region"
          aria-label={`${title} data table`}
          tabIndex={0}
          sx={{ maxWidth: '100%', overflowX: 'auto' }}
        >
          <table>
            <caption>{title} data values</caption>
            <thead>
              <tr>
                <th scope="col">Label</th>
                {columns.map((key) => (
                  <th key={key} scope="col">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const valueByKey = new Map(
                  row.values.map((item) => [item.key, item.value])
                )
                return (
                  <tr key={`${row.label}-${rowIndex}`}>
                    <th scope="row">{row.label}</th>
                    {columns.map((key) => (
                      <td key={`${rowIndex}-${key}`}>
                        {valueByKey.get(key) ?? '—'}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </BCBox>
      </details>
    </BCBox>
  )
}

const getHistoricalAccessibleRows = (group: HistoricalChartGroup) =>
  group.labels.map((label) => ({
    label,
    values: [
      ...group.periodLabels.map((period) => ({
        key: period,
        value: `${formatAccessibleNumber(
          group.valuesByPeriod.get(period)?.get(label) || 0
        )}${group.unitsByPeriod.get(period)?.get(label) ? ` ${group.unitsByPeriod.get(period)?.get(label)}` : ''}`
      })),
      ...(group.comparisonDetailsByLabel.get(label) || [])
    ]
  }))

const getSupplementalAccessibleRows = (series: ComparisonSeries) =>
  series.points.map((point) => ({
    label: point.label,
    values: [
      {
        key: series.comparisonLabel,
        value: `${formatAccessibleNumber(point.comparisonValue)}${point.units ? ` ${point.units}` : ''}`
      },
      {
        key: series.currentLabel,
        value: `${formatAccessibleNumber(point.currentValue)}${point.units ? ` ${point.units}` : ''}`
      },
      {
        key: 'Delta',
        value: `${formatAccessibleNumber(point.delta)}${point.units ? ` ${point.units}` : ''}`
      },
      ...(point.percentChange == null
        ? []
        : [
            {
              key: 'Percent change',
              value: `${formatAccessibleNumber(point.percentChange)}%`
            }
          ])
    ]
  }))

const getComplianceUnitAccessibleRows = (group: ComplianceUnitChartGroup) =>
  group.fuelLabels.map((fuelLabel) => ({
    label: fuelLabel,
    values: group.schedules.map((schedule) => ({
      key: schedule,
      value: `${formatAccessibleNumber(group.values.get(`${schedule}|${fuelLabel}`) || 0)} compliance units`
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
      unitsByPeriod: Map<string, Map<string, string | null | undefined>>
      comparisonDetailsByLabel: Map<
        string,
        Array<{ key: string; value: string }>
      >
    }
  >()

  historicalSeries.forEach((series) => {
    if (!grouped.has(series.title)) {
      grouped.set(series.title, {
        title: series.title,
        currentLabel: series.currentLabel,
        periods: new Map([[series.currentLabel, new Map()]]),
        labels: new Set(),
        unitsByPeriod: new Map([[series.currentLabel, new Map()]]),
        comparisonDetailsByLabel: new Map()
      })
    }

    const group = grouped.get(series.title)!
    for (const period of [series.comparisonLabel, series.currentLabel]) {
      if (!group.periods.has(period)) {
        group.periods.set(period, new Map())
        group.unitsByPeriod.set(period, new Map())
      }
    }

    series.points.forEach((point) => {
      group.labels.add(point.label)
      group.unitsByPeriod
        .get(series.currentLabel)!
        .set(point.label, point.units)
      group.unitsByPeriod
        .get(series.comparisonLabel)!
        .set(point.label, point.units)
      group.periods
        .get(series.currentLabel)!
        .set(point.label, point.currentValue)
      group.periods
        .get(series.comparisonLabel)!
        .set(point.label, point.comparisonValue)

      const details = group.comparisonDetailsByLabel.get(point.label) || []
      const interval = `${series.comparisonLabel} to ${series.currentLabel}`
      const unitSuffix = point.units ? ` ${point.units}` : ''
      details.push({
        key: `${interval} delta`,
        value: `${formatAccessibleNumber(point.delta)}${unitSuffix}`
      })
      if (point.percentChange != null) {
        details.push({
          key: `${interval} percent change`,
          value: `${formatAccessibleNumber(point.percentChange)}%`
        })
      }
      group.comparisonDetailsByLabel.set(point.label, details)
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
    valuesByPeriod: group.periods,
    unitsByPeriod: group.unitsByPeriod,
    comparisonDetailsByLabel: group.comparisonDetailsByLabel
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

const buildFuelCodeSunburstData = (
  group: HistoricalChartGroup,
  filters: FuelCodeSunburstFilters
): SunburstNode[] => {
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
        value,
        units: group.unitsByPeriod.get(period)?.get(label)
      })
    })
  })

  return Array.from(fuelTypeMap.entries())
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
}

const getFuelCodeSunburstAccessibleRows = (data: SunburstNode[]) =>
  data.flatMap((fuelType) =>
    (fuelType.children || []).map((fuelCode) => ({
      label: `${fuelType.name} / ${fuelCode.name}`,
      values: (fuelCode.children || []).map((year) => ({
        key: year.name,
        value: `${formatAccessibleNumber(year.value || 0)}${year.units ? ` ${year.units}` : ''}`
      }))
    }))
  )

const getFuelCodeSunburstAriaLabel = (
  group: HistoricalChartGroup,
  filters: FuelCodeSunburstFilters
) => {
  const yearDescription =
    filters.complianceYear === ALL_FILTER_VALUE
      ? 'all compliance years'
      : `compliance year ${filters.complianceYear}`
  const fuelTypeDescription =
    filters.fuelType === ALL_FILTER_VALUE ? 'all fuel types' : filters.fuelType
  return `${group.title}. Fuel-code hierarchy chart filtered to ${yearDescription} and ${fuelTypeDescription}.`
}

const getFuelCodeSunburstAriaDescription = (
  group: HistoricalChartGroup,
  filters: FuelCodeSunburstFilters,
  data: SunburstNode[]
) => {
  const yearDescription =
    filters.complianceYear === ALL_FILTER_VALUE
      ? 'all compliance years'
      : `compliance year ${filters.complianceYear}`
  const fuelTypeDescription =
    filters.fuelType === ALL_FILTER_VALUE ? 'all fuel types' : filters.fuelType
  const rows = getFuelCodeSunburstAccessibleRows(data)
  return `${group.title}. Sunburst chart filtered to ${yearDescription} and ${fuelTypeDescription}. ${getAccessibleRowsSummary(rows)}`
}

const buildFuelCodeSunburstOptions = (
  group: HistoricalChartGroup,
  filters: FuelCodeSunburstFilters
) => {
  const data = buildFuelCodeSunburstData(group, filters)

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
        const units = params.data?.units ? ` ${params.data.units}` : ''
        return value
          ? `${treePath}<br/>Quantity supplied: ${value}${units}`
          : treePath
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
  const id = useId()
  const summaryId = `chart-summary-${id}`
  const yearFilterLabelId = `fuel-code-year-filter-label-${id}`
  const fuelTypeFilterLabelId = `fuel-code-type-filter-label-${id}`
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
  const sunburstData = useMemo(
    () => buildFuelCodeSunburstData(group, { complianceYear, fuelType }),
    [complianceYear, fuelType, group]
  )
  const ariaLabel = useMemo(
    () => getFuelCodeSunburstAriaLabel(group, { complianceYear, fuelType }),
    [complianceYear, fuelType, group, sunburstData]
  )
  const ariaDescription = useMemo(
    () =>
      getFuelCodeSunburstAriaDescription(
        group,
        { complianceYear, fuelType },
        sunburstData
      ),
    [complianceYear, fuelType, group, sunburstData]
  )

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
        rows={getFuelCodeSunburstAccessibleRows(sunburstData)}
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
          ariaDescription={ariaDescription}
          ariaDescribedBy={summaryId}
          sx={{ flex: 1, minWidth: 0 }}
        />
        <Stack direction={'column'} spacing={8} sx={{ pt: 2, flexShrink: 0 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id={yearFilterLabelId}>Compliance year</InputLabel>
            <Select
              labelId={yearFilterLabelId}
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
            <InputLabel id={fuelTypeFilterLabelId}>Fuel type</InputLabel>
            <Select
              labelId={fuelTypeFilterLabelId}
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

const ComplianceUnitsChartCard = ({
  group
}: {
  group: ComplianceUnitChartGroup
}) => {
  const summaryId = `chart-summary-${useId()}`
  const title = 'Compliance units by fuel category, type, and schedule'
  const ariaLabel = getComplianceUnitsChartAriaLabel()
  const ariaDescription = getComplianceUnitsChartAriaDescription(group)

  return (
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
        {title}
      </BCTypography>
      <AccessibleChartSummary
        id={summaryId}
        title={title}
        rows={getComplianceUnitAccessibleRows(group)}
      />
      <BCResponsiveEChart
        option={buildComplianceUnitChartOptions(group)}
        height={280}
        ariaLabel={ariaLabel}
        ariaDescription={ariaDescription}
        ariaDescribedBy={summaryId}
      />
    </BCBox>
  )
}

const HistoricalChartCard = ({ group }: { group: HistoricalChartGroup }) => {
  const summaryId = `chart-summary-${useId()}`
  const ariaLabel = getHistoricalChartAriaLabel(group)
  const ariaDescription = getHistoricalChartAriaDescription(group)

  return (
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
        {group.title} ({getHistoricalChartModeLabel(group)})
      </BCTypography>
      <AccessibleChartSummary
        id={summaryId}
        title={group.title}
        rows={getHistoricalAccessibleRows(group)}
      />
      <BCResponsiveEChart
        option={buildHistoricalChartOptions(group)}
        height={280}
        ariaLabel={ariaLabel}
        ariaDescription={ariaDescription}
        ariaDescribedBy={summaryId}
      />
    </BCBox>
  )
}

const SupplementalChartCard = ({ series }: { series: ComparisonSeries }) => {
  const summaryId = `chart-summary-${useId()}`
  const ariaLabel = getSupplementalChartAriaLabel(series)
  const ariaDescription = getSupplementalChartAriaDescription(series)

  return (
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
        {series.title}
      </BCTypography>
      <AccessibleChartSummary
        id={summaryId}
        title={series.title}
        rows={getSupplementalAccessibleRows(series)}
      />
      <BCResponsiveEChart
        option={buildSupplementalImpactChartOptions(series)}
        height={280}
        ariaLabel={ariaLabel}
        ariaDescription={ariaDescription}
        ariaDescribedBy={summaryId}
      />
    </BCBox>
  )
}

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
          <ComplianceUnitsChartCard group={complianceUnitGroup} />
        )}
        {groupedHistorical.map((item) =>
          isFuelCodeSunburstGroup(item) ? (
            <FuelCodeSunburstChartCard key={item.title} group={item} />
          ) : (
            <HistoricalChartCard key={item.title} group={item} />
          )
        )}
        {supplementalSeries.map((item) => (
          <SupplementalChartCard
            key={`${item.title}-${item.comparisonLabel}-${item.currentLabel}`}
            series={item}
          />
        ))}
      </BCBox>
    </BCBox>
  )
}
