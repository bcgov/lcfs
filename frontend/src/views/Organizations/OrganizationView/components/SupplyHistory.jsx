import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import {
  Grid,
  FormControl,
  Select,
  MenuItem,
  Card,
  CardContent,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material'
import { ExpandMore } from '@mui/icons-material'
import ReactECharts from 'echarts-for-react'

import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { useOrganizationFuelSupply } from '@/hooks/useFuelSupply'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/routes/routes'
import OrganizationList from '@/views/Transactions/components/OrganizationList'
import { formatNumberWithCommas } from '@/utils/formatters'
import { defaultInitialPagination } from '@/constants/schedules'

import {
  supplyHistoryColDefs,
  defaultColDef,
  gridOptions
} from './_supplyHistorySchema'

const GRID_KEY = 'organization-supply-history'
const YEAR_FILTER_STORAGE_KEY = `${GRID_KEY}-year-filter`
const CHART_COLORS = {
  green: '#009E73',
  orange: '#D55E00',
  blue: '#0072B2',
  sky: '#56B4E9',
  yellow: '#F0E442',
  purple: '#CC79A7',
  vermillion: '#E69F00',
  neutralText: '#405074'
}
const CHART_PALETTE = [
  CHART_COLORS.blue,
  CHART_COLORS.green,
  CHART_COLORS.orange,
  CHART_COLORS.sky,
  CHART_COLORS.purple,
  CHART_COLORS.vermillion,
  '#332288',
  '#88CCEE'
]
const CHART_GRID = {
  left: 64,
  right: 24,
  top: 56,
  bottom: 56,
  containLabel: true
}
const CHART_AXIS_LABEL = {
  color: '#5f6675',
  hideOverlap: true
}
const CHART_CATEGORY_AXIS_LABEL = {
  ...CHART_AXIS_LABEL,
  show: true,
  interval: 0,
  margin: 10
}

const getStoredYearRange = () => {
  if (typeof window === 'undefined') {
    return { from: '', to: '' }
  }
  const storedValue = sessionStorage.getItem(YEAR_FILTER_STORAGE_KEY)
  if (!storedValue || storedValue === 'all') {
    return { from: '', to: '' }
  }
  try {
    const parsedValue = JSON.parse(storedValue)
    if (parsedValue?.from || parsedValue?.to) {
      return {
        from: parsedValue.from ? String(parsedValue.from) : '',
        to: parsedValue.to ? String(parsedValue.to) : ''
      }
    }
    if (Array.isArray(parsedValue)) {
      const sortedYears = parsedValue.map(String).sort()
      return {
        from: sortedYears[0] || '',
        to: sortedYears[sortedYears.length - 1] || ''
      }
    }
  } catch {
    // Legacy stored values were plain strings.
  }
  return { from: storedValue, to: '' }
}

const getYearsInRange = ({ from, to }) => {
  if (!from && !to) {
    return []
  }
  if (!from) {
    return [String(to)]
  }
  if (!to) {
    return [String(from)]
  }

  const start = Number(from)
  const end = Number(to)
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return [String(from), String(to)]
  }

  return Array.from({ length: end - start + 1 }, (_, index) =>
    String(start + index)
  )
}

const abbreviateNumber = (value, { unitLabel = '', prefix = '' } = {}) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }

  const absValue = Math.abs(value)
  const thresholds = [
    { limit: 1e12, suffix: 'T' },
    { limit: 1e9, suffix: 'B' },
    { limit: 1e6, suffix: 'M' },
    { limit: 1e3, suffix: 'k' }
  ]

  let scaledValue = value
  let suffix = ''

  for (const threshold of thresholds) {
    if (absValue >= threshold.limit) {
      scaledValue = value / threshold.limit
      suffix = threshold.suffix
      break
    }
  }

  const precision =
    Math.abs(scaledValue) >= 100 ? 0 : Math.abs(scaledValue) >= 10 ? 1 : 2
  const formattedValue = Number(scaledValue.toFixed(precision))

  const unitText = unitLabel ? ` ${unitLabel}` : ''

  return `${prefix}${formattedValue}${suffix}${unitText}`.trim()
}

const formatSignedPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—'
  }
  const numericValue = Number(value)
  const sign = numericValue > 0 ? '+' : ''
  return `${sign}${numericValue.toFixed(2)}%`
}

const formatPlainNumber = (value, decimals = 0) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—'
  }
  return formatNumberWithCommas({ value: Number(value).toFixed(decimals) })
}

const formatDisplayDate = (value) => {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date)
}

const formatCompactAxisNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return ''
  }
  return abbreviateNumber(value)
}

const getComparisonColor = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'text'
  }
  if (Number(value) > 0) return 'success'
  if (Number(value) < 0) return 'error'
  return 'text'
}

const hasNumericValue = (value) =>
  value !== null && value !== undefined && !Number.isNaN(Number(value))

const SupplyMetricCard = ({ title, value, period, comparisons = [] }) => (
  <Card
    elevation={1}
    sx={{
      height: '100%',
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 2
    }}
  >
    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
      <BCTypography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        {title}
      </BCTypography>
      <BCTypography
        variant="h4"
        component="div"
        fontWeight="bold"
        color="primary"
        sx={{ lineHeight: 1.1 }}
      >
        {value}
      </BCTypography>
      {period && (
        <BCTypography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {period}
        </BCTypography>
      )}
      <Stack spacing={0.25} sx={{ mt: 1 }}>
        {comparisons.map((comparison) => (
          <BCTypography
            key={comparison.label}
            variant="caption"
            color={comparison.color}
            fontWeight={comparison.color === 'text' ? 'normal' : 'bold'}
          >
            {comparison.label}
          </BCTypography>
        ))}
      </Stack>
    </CardContent>
  </Card>
)

const ChartPanel = ({ title, option, height = 340 }) => (
  <Card
    elevation={2}
    sx={{
      height: '100%',
      overflow: 'hidden',
      minWidth: 0
    }}
  >
    <CardContent sx={{ minWidth: 0, overflow: 'hidden' }}>
      <BCTypography variant="subtitle1" sx={{ mb: 2 }}>
        {title}
      </BCTypography>
      <BCBox sx={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
        <ReactECharts
          option={option}
          notMerge
          lazyUpdate
          style={{ height, width: '100%', minWidth: 0 }}
        />
      </BCBox>
    </CardContent>
  </Card>
)

export const SupplyHistory = ({ organizationId: propOrganizationId }) => {
  const { t } = useTranslation(['org'])
  const navigate = useNavigate()
  const gridRef = useRef(null)
  const { data: currentUser, hasRoles } = useCurrentUser()
  const isGovernment = hasRoles(roles.government)

  // Use passed organizationId prop, fallback to current user's org for backward compatibility
  const defaultOrganizationId =
    propOrganizationId ?? currentUser?.organization?.organizationId
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(
    defaultOrganizationId
  )

  const [paginationOptions, setPaginationOptions] = useState(() => ({
    ...defaultInitialPagination
  }))
  const [selectedYearRange, setSelectedYearRange] = useState(getStoredYearRange)
  const [availableYears, setAvailableYears] = useState([])
  const selectedYears = useMemo(
    () => getYearsInRange(selectedYearRange),
    [selectedYearRange]
  )

  useEffect(() => {
    setSelectedOrganizationId(defaultOrganizationId)
  }, [defaultOrganizationId])

  // Build filters based on selected years
  const yearFilter = useMemo(() => {
    if (!selectedYears.length) {
      return null
    }
    return {
      field: 'compliancePeriod',
      values: selectedYears,
      type: 'set',
      filterType: 'set'
    }
  }, [selectedYears])

  const combinedFilters = useMemo(() => {
    if (!yearFilter) {
      return paginationOptions.filters || []
    }

    const otherFilters = (paginationOptions.filters || []).filter(
      (filter) => filter.field !== 'compliancePeriod'
    )

    return [...otherFilters, yearFilter]
  }, [paginationOptions.filters, yearFilter])

  const paginationPayload = useMemo(
    () => ({
      ...paginationOptions,
      filters: combinedFilters
    }),
    [paginationOptions, combinedFilters]
  )

  const persistYearFilter = useCallback((value) => {
    if (typeof window === 'undefined') {
      return
    }
    if (!value?.from && !value?.to) {
      sessionStorage.removeItem(YEAR_FILTER_STORAGE_KEY)
    } else {
      sessionStorage.setItem(YEAR_FILTER_STORAGE_KEY, JSON.stringify(value))
    }
  }, [])

  // Fetch fuel supply data
  const queryData = useOrganizationFuelSupply(
    selectedOrganizationId,
    paginationPayload,
    {
      enabled: !!selectedOrganizationId
    }
  )

  const analytics = queryData?.data?.analytics || {}
  const selectedYearSummary = analytics.selectedYearSummary || {}

  // Maintain a stable list of available years even after filtering
  useEffect(() => {
    if (!analytics.totalByYear) return
    const nextYears = Object.keys(analytics.totalByYear)
    if (nextYears.length === 0) return

    setAvailableYears((prev) => {
      const merged = Array.from(new Set([...prev, ...nextYears]))
      return merged.sort((a, b) => Number(b) - Number(a))
    })
  }, [analytics.totalByYear])

  const updateYearRange = useCallback(
    (nextRange) => {
      setSelectedYearRange(nextRange)
      persistYearFilter(nextRange)
      setPaginationOptions((prev) => ({
        ...prev,
        page: 1
      }))
    },
    [persistYearFilter]
  )

  const handleFromYearChange = useCallback(
    (event) => {
      const from = event.target.value
      const to =
        selectedYearRange.to && Number(selectedYearRange.to) <= Number(from)
          ? ''
          : selectedYearRange.to
      updateYearRange({ from, to })
    },
    [selectedYearRange.to, updateYearRange]
  )

  const handleToYearChange = useCallback(
    (event) => {
      const to = event.target.value
      const from =
        selectedYearRange.from && Number(selectedYearRange.from) >= Number(to)
          ? ''
          : selectedYearRange.from
      updateYearRange({ from, to })
    },
    [selectedYearRange.from, updateYearRange]
  )

  const handleOrganizationChange = useCallback(
    ({ id }) => {
      if (!id) {
        return
      }
      setSelectedOrganizationId(id)
      setAvailableYears([])
      setPaginationOptions((prev) => ({
        ...prev,
        page: 1
      }))
      navigate(
        ROUTES.ORGANIZATIONS.SUPPLY_HISTORY.replace(
          ':orgID',
          String(id)
        )
      )
    },
    [navigate]
  )

  const handleGridPaginationChange = useCallback((newPagination) => {
    setPaginationOptions((prev) => ({
      ...prev,
      ...newPagination
    }))
  }, [])

  const handleClearFilters = useCallback(() => {
    gridRef.current?.clearFilters?.()
    const emptyRange = { from: '', to: '' }
    setSelectedYearRange(emptyRange)
    persistYearFilter(emptyRange)
    setPaginationOptions({ ...defaultInitialPagination })
  }, [persistYearFilter])

  const hasGridFilters = (paginationOptions.filters || []).length > 0
  const hasActiveFilters = hasGridFilters || selectedYears.length > 0
  const yearOptionsAscending = useMemo(
    () => [...availableYears].sort((a, b) => Number(a) - Number(b)),
    [availableYears]
  )
  const fromYearOptions = useMemo(
    () =>
      selectedYearRange.to
        ? yearOptionsAscending.filter(
            (year) => Number(year) < Number(selectedYearRange.to)
          )
        : yearOptionsAscending,
    [selectedYearRange.to, yearOptionsAscending]
  )
  const toYearOptions = useMemo(
    () =>
      selectedYearRange.from
        ? yearOptionsAscending.filter(
            (year) => Number(year) > Number(selectedYearRange.from)
          )
        : yearOptionsAscending,
    [selectedYearRange.from, yearOptionsAscending]
  )

  const dashboardMetricCards = useMemo(() => {
    const year = selectedYearSummary.reportingYear || '—'
    const priorYear = selectedYearSummary.priorYear
    const previousVolume = selectedYearSummary.priorYearVolume
    const previousComplianceUnits = selectedYearSummary.priorYearComplianceUnits

    return [
      {
        key: 'volume-yoy',
        hasData: hasNumericValue(selectedYearSummary.totalVolume),
        title: t('org:supplyHistory.analytics.fuelVolumeSupplyTrend'),
        value: abbreviateNumber(selectedYearSummary.totalVolume || 0, {
          unitLabel: 'L'
        }),
        period: year,
        comparisons: [
          {
            label: `${formatSignedPercent(
              selectedYearSummary.volumePctChangeYoy
            )} ${t('org:supplyHistory.analytics.vsPreviousYear')}`,
            color: getComparisonColor(selectedYearSummary.volumePctChangeYoy)
          },
          {
            label: `${t('org:supplyHistory.analytics.previousYear')}: ${
              priorYear || t('org:supplyHistory.analytics.noData')
            } • ${abbreviateNumber(previousVolume, { unitLabel: 'L' })}`,
            color: 'text'
          }
        ]
      },
      {
        key: 'net-compliance-units',
        hasData: hasNumericValue(selectedYearSummary.totalComplianceUnits),
        title: t('org:supplyHistory.analytics.netComplianceUnitVolume'),
        value: formatPlainNumber(selectedYearSummary.totalComplianceUnits, 2),
        period: year,
        comparisons: [
          {
            label: `${formatSignedPercent(
              selectedYearSummary.complianceUnitsPctChangeYoy
            )} ${t('org:supplyHistory.analytics.vsPreviousYear')}`,
            color: getComparisonColor(
              selectedYearSummary.complianceUnitsPctChangeYoy
            )
          },
          {
            label: `${t('org:supplyHistory.analytics.previousYear')}: ${
              priorYear || t('org:supplyHistory.analytics.noData')
            } • ${formatPlainNumber(previousComplianceUnits, 2)}`,
            color: 'text'
          }
        ]
      },
      {
        key: 'cu-efficiency',
        hasData: hasNumericValue(
          selectedYearSummary.complianceUnitsPerUnitSupply
        ),
        title: t('org:supplyHistory.analytics.complianceUnitsPerUnitSupply'),
        value: formatPlainNumber(
          selectedYearSummary.complianceUnitsPerUnitSupply,
          6
        ),
        period: year,
        comparisons: [
          {
            label: `${formatPlainNumber(
              selectedYearSummary.complianceUnitsPerUnitSupplyChange,
              6
            )} ${t('org:supplyHistory.analytics.vsPreviousYear')}`,
            color: getComparisonColor(
              selectedYearSummary.complianceUnitsPerUnitSupplyChange
            )
          },
          {
            label: `${t('org:supplyHistory.analytics.previousYear')}: ${formatPlainNumber(
              selectedYearSummary.priorYearComplianceUnitsPerUnitSupply,
              6
            )}`,
            color: 'text'
          }
        ]
      },
      {
        key: 'submission-activity',
        hasData: Number(analytics.totalReports || 0) > 0,
        title: t('org:supplyHistory.analytics.totalReports'),
        value: formatPlainNumber(analytics.totalReports),
        period:
          selectedYears.length === 0
            ? t('org:supplyHistory.allYears')
            : selectedYears.join(', '),
        comparisons: analytics.mostRecentSubmission
          ? [
              {
                label: `${t(
                  'org:supplyHistory.analytics.mostRecentSubmission'
                )}: ${formatDisplayDate(analytics.mostRecentSubmission)}`,
                color: 'text'
              }
            ]
          : []
      }
    ].filter((card) => card.hasData)
  }, [
    analytics.mostRecentSubmission,
    analytics.totalReports,
    selectedYears,
    selectedYearSummary,
    t
  ])

  const complianceUnitCreditDebitTrendData = useMemo(() => {
    const rows = analytics.complianceUnitCreditDebitTrend || []
    const years = Array.from(
      new Set(rows.map((row) => row.reportingYear))
    ).sort()
    const groups = [
      'Positive compliance units',
      'Zero or negative compliance units'
    ]

    return {
      labels: years,
      series: groups.map((group) => ({
        name: group,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        data: years.map((year) => {
          const match = rows.find(
            (row) =>
              row.reportingYear === year && row.complianceUnitGroup === group
          )
          return match?.complianceUnits ?? 0
        })
      }))
    }
  }, [analytics.complianceUnitCreditDebitTrend])

  const fuelTypeVolumeTrendData = useMemo(() => {
    const rows = analytics.fuelTypeVolumeTrend || []
    const years = Array.from(
      new Set(rows.map((row) => row.reportingYear))
    ).sort()
    const topFuelTypes = Array.from(
      rows
        .reduce((acc, row) => {
          acc.set(row.fuelType, (acc.get(row.fuelType) || 0) + row.totalVolume)
          return acc
        }, new Map())
        .entries()
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([fuelType]) => fuelType)

    return {
      labels: years,
      series: topFuelTypes.map((fuelType) => ({
        name: fuelType,
        type: 'line',
        smooth: true,
        data: years.map((year) => {
          const match = rows.find(
            (row) => row.reportingYear === year && row.fuelType === fuelType
          )
          return match?.totalVolume ?? 0
        })
      }))
    }
  }, [analytics.fuelTypeVolumeTrend])

  const renewableSupplyVolumeChangeData = useMemo(() => {
    const rows = analytics.fuelTypeVolumeTrend || []
    const years = Array.from(
      new Set(rows.map((row) => row.reportingYear))
    ).sort()
    const groups = [
      t('org:supplyHistory.analytics.renewable'),
      t('org:supplyHistory.analytics.nonRenewable')
    ]
    const totalsByYearAndGroup = rows.reduce((acc, row) => {
      const year = row.reportingYear
      const group = row.fossilDerived
        ? t('org:supplyHistory.analytics.nonRenewable')
        : t('org:supplyHistory.analytics.renewable')
      acc[year] ||= {}
      acc[year][group] = (acc[year][group] || 0) + (row.totalVolume || 0)
      return acc
    }, {})

    return {
      labels: years,
      series: groups.map((group) => ({
        name: group,
        type: 'bar',
        data: years.map((year, index) => {
          const current = totalsByYearAndGroup[year]?.[group] || 0
          if (index === 0) return null
          const previousYear = years[index - 1]
          const previous = totalsByYearAndGroup[previousYear]?.[group] || 0
          return current - previous
        })
      }))
    }
  }, [analytics.fuelTypeVolumeTrend, t])

  const topFuelCodesChartData = useMemo(() => {
    const rows = analytics.topFuelCodes || []
    return {
      labels: rows.map((row) => row.fuelCode),
      values: rows.map((row) => row.totalVolume)
    }
  }, [analytics.topFuelCodes])

  const showComplianceUnitCreditDebitChart =
    complianceUnitCreditDebitTrendData.labels.length > 1
  const showFuelTypeVolumeTrendChart = fuelTypeVolumeTrendData.labels.length > 1
  const showRenewableSupplyVolumeChangeChart =
    renewableSupplyVolumeChangeData.labels.length > 1
  const showTopFuelCodesChart = topFuelCodesChartData.labels.length > 1

  const hasDashboardContent =
    dashboardMetricCards.length > 0 ||
    showComplianceUnitCreditDebitChart ||
    showFuelTypeVolumeTrendChart ||
    showRenewableSupplyVolumeChangeChart ||
    showTopFuelCodesChart

  const complianceUnitCreditDebitTrendOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value) => formatCompactAxisNumber(value)
      },
      legend: {
        top: 0,
        left: 0,
        right: 0,
        icon: 'circle',
        type: 'scroll'
      },
      grid: {
        ...CHART_GRID,
        top: 66
      },
      xAxis: {
        type: 'category',
        name: t('org:supplyHistory.analytics.complianceYear'),
        nameGap: 28,
        data: complianceUnitCreditDebitTrendData.labels,
        axisLabel: CHART_CATEGORY_AXIS_LABEL
      },
      yAxis: {
        type: 'value',
        name: t('org:supplyHistory.analytics.complianceUnits'),
        nameLocation: 'middle',
        nameGap: 52,
        nameRotate: 90,
        nameTextStyle: {
          color: CHART_COLORS.neutralText,
          align: 'center'
        },
        axisLabel: {
          ...CHART_AXIS_LABEL,
          formatter: (value) => formatCompactAxisNumber(value)
        }
      },
      series: complianceUnitCreditDebitTrendData.series.map((series) => {
        const isPositive = series.name === 'Positive compliance units'
        const lineColor = isPositive ? CHART_COLORS.green : CHART_COLORS.orange
        return {
          ...series,
          areaStyle: {
            color: isPositive
              ? 'rgba(0, 158, 115, 0.2)'
              : 'rgba(213, 94, 0, 0.16)'
          },
          itemStyle: {
            color: lineColor
          },
          lineStyle: {
            color: lineColor,
            width: 2
          },
          label: {
            show: true,
            formatter: ({ value }) => formatCompactAxisNumber(value),
            color: CHART_COLORS.neutralText,
            overflow: 'truncate',
            width: 56
          }
        }
      })
    }),
    [complianceUnitCreditDebitTrendData, t]
  )

  const fuelTypeVolumeTrendOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value) => formatCompactAxisNumber(value)
      },
      legend: {
        type: 'scroll',
        bottom: 0,
        left: 8,
        right: 8
      },
      color: CHART_PALETTE,
      grid: {
        ...CHART_GRID,
        top: 20,
        bottom: 108
      },
      xAxis: {
        type: 'category',
        name: t('org:supplyHistory.analytics.complianceYear'),
        nameGap: 28,
        data: fuelTypeVolumeTrendData.labels,
        axisLabel: CHART_CATEGORY_AXIS_LABEL
      },
      yAxis: {
        type: 'value',
        name: t('org:supplyHistory.analytics.quantity'),
        nameLocation: 'middle',
        nameGap: 52,
        nameRotate: 90,
        nameTextStyle: {
          color: CHART_COLORS.neutralText,
          align: 'center'
        },
        axisLabel: {
          ...CHART_AXIS_LABEL,
          formatter: (value) => formatCompactAxisNumber(value)
        }
      },
      series: fuelTypeVolumeTrendData.series
    }),
    [fuelTypeVolumeTrendData, t]
  )

  const renewableSupplyVolumeChangeOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (value) => formatCompactAxisNumber(value)
      },
      legend: {
        bottom: 0,
        left: 8,
        right: 8
      },
      grid: {
        ...CHART_GRID,
        top: 20,
        bottom: 96
      },
      xAxis: {
        type: 'category',
        name: t('org:supplyHistory.analytics.complianceYear'),
        nameGap: 28,
        data: renewableSupplyVolumeChangeData.labels,
        axisLabel: CHART_CATEGORY_AXIS_LABEL
      },
      yAxis: {
        type: 'value',
        name: t('org:supplyHistory.analytics.volumeChange'),
        nameLocation: 'middle',
        nameGap: 52,
        nameRotate: 90,
        nameTextStyle: {
          color: CHART_COLORS.neutralText,
          align: 'center'
        },
        axisLabel: {
          ...CHART_AXIS_LABEL,
          formatter: (value) => formatCompactAxisNumber(value)
        }
      },
      series: renewableSupplyVolumeChangeData.series.map((series) => ({
        ...series,
        itemStyle: {
          color:
            series.name === t('org:supplyHistory.analytics.renewable')
              ? CHART_COLORS.green
              : CHART_COLORS.orange
        }
      }))
    }),
    [renewableSupplyVolumeChangeData, t]
  )

  const topFuelCodesChartOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (value) => formatCompactAxisNumber(value)
      },
      grid: {
        ...CHART_GRID,
        top: 16,
        bottom: 48
      },
      xAxis: {
        type: 'value',
        name: t('org:supplyHistory.analytics.quantity'),
        nameLocation: 'middle',
        nameGap: 36,
        nameTextStyle: {
          color: CHART_COLORS.neutralText,
          align: 'center'
        },
        axisLabel: {
          ...CHART_AXIS_LABEL,
          formatter: (value) => formatCompactAxisNumber(value)
        }
      },
      yAxis: {
        type: 'category',
        data: topFuelCodesChartData.labels,
        axisLabel: {
          ...CHART_AXIS_LABEL,
          width: 96,
          overflow: 'truncate'
        }
      },
      series: [
        {
          name: t('org:supplyHistory.analytics.quantity'),
          type: 'bar',
          data: topFuelCodesChartData.values,
          itemStyle: {
            color: CHART_COLORS.blue
          }
        }
      ]
    }),
    [topFuelCodesChartData, t]
  )

  return (
    <BCBox py={0}>
      {/* Filters */}
      <Grid container spacing={2} alignItems="flex-end" sx={{ mb: 3 }}>
        <Grid item xs={12} lg={6}>
          <Stack
            direction="row"
            spacing={1.5}
            mb={2}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
          >
            <BCTypography variant="body2" color="primary">
              {t('org:supplyHistory.filterByYear')}
            </BCTypography>
            <FormControl size="small" sx={{ minWidth: 128 }}>
              <Select
                value={selectedYearRange.from}
                onChange={handleFromYearChange}
                displayEmpty
              >
                <MenuItem value="">{t('org:supplyHistory.fromYear')}</MenuItem>
                {fromYearOptions.map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <BCTypography variant="body2" color="primary">
              {t('org:supplyHistory.toYear')}
            </BCTypography>
            <FormControl size="small" sx={{ minWidth: 128 }}>
              <Select
                value={selectedYearRange.to}
                onChange={handleToYearChange}
                displayEmpty
              >
                <MenuItem value="">{t('org:supplyHistory.toYear')}</MenuItem>
                {toYearOptions.map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <ClearFiltersButton
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
              sx={{
                minWidth: { xs: '100%', sm: 'fit-content' },
                whiteSpace: 'nowrap'
              }}
            />
          </Stack>
        </Grid>
        {isGovernment && (
          <Grid
            item
            xs={12}
            lg={6}
            sx={{
              display: 'flex',
              justifyContent: { xs: 'flex-start', lg: 'flex-end' }
            }}
          >
            <OrganizationList
              selectedOrg={{ id: selectedOrganizationId }}
              onOrgChange={handleOrganizationChange}
              onlyRegistered={false}
              includeAllOption={false}
              label={t('org:supplyHistory.showOrganization')}
              placeholder={t('org:supplyHistory.selectOrganization')}
              showSelectedLabel={false}
            />
          </Grid>
        )}
      </Grid>

      {hasDashboardContent && (
        <Accordion defaultExpanded sx={{ mb: 4 }}>
          <AccordionSummary
            expandIcon={<ExpandMore sx={{ width: '2rem', height: '2rem' }} />}
            sx={{
              '& .MuiAccordionSummary-content': {
                alignItems: 'center'
              }
            }}
          >
            <BCBox>
              <BCTypography variant="h6" color="primary">
                {t('org:supplyHistory.analytics.dashboardTitle')}
              </BCTypography>
              <BCTypography variant="body2" color="text.secondary">
                {t('org:supplyHistory.analytics.dashboardDescription')}
              </BCTypography>
            </BCBox>
          </AccordionSummary>
          <AccordionDetails sx={{ minWidth: 0, overflow: 'hidden' }}>
            {dashboardMetricCards.length > 0 && (
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {dashboardMetricCards.map((card) => (
                  <Grid
                    item
                    xs={12}
                    sm={6}
                    lg={3}
                    key={card.key}
                    sx={{ minWidth: 0 }}
                  >
                    <SupplyMetricCard {...card} />
                  </Grid>
                ))}
              </Grid>
            )}

            <Grid container spacing={3} sx={{ minWidth: 0 }}>
              {showComplianceUnitCreditDebitChart && (
                <Grid item xs={12} md={6} sx={{ minWidth: 0 }}>
                  <ChartPanel
                    title={t('org:supplyHistory.analytics.netCreditsDebitsYoy')}
                    option={complianceUnitCreditDebitTrendOption}
                    height={320}
                  />
                </Grid>
              )}

              {showTopFuelCodesChart && (
                <Grid item xs={12} md={6} sx={{ minWidth: 0 }}>
                  <ChartPanel
                    title={t('org:supplyHistory.analytics.topFuelCodes')}
                    option={topFuelCodesChartOption}
                    height={360}
                  />
                </Grid>
              )}

              {showFuelTypeVolumeTrendChart && (
                <Grid item xs={12} sx={{ minWidth: 0 }}>
                  <ChartPanel
                    title={t('org:supplyHistory.analytics.fuelTypeVolumeTrend')}
                    option={fuelTypeVolumeTrendOption}
                    height={380}
                  />
                </Grid>
              )}

              {showRenewableSupplyVolumeChangeChart && (
                <Grid item xs={12} sx={{ minWidth: 0 }}>
                  <ChartPanel
                    title={t(
                      'org:supplyHistory.analytics.renewableSupplyVolumeChange'
                    )}
                    option={renewableSupplyVolumeChangeOption}
                    height={360}
                  />
                </Grid>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Data Grid */}
      <BCBox sx={{ mb: 4 }}>
        <BCGridViewer
          gridRef={gridRef}
          gridKey={GRID_KEY}
          columnDefs={supplyHistoryColDefs()}
          defaultColDef={defaultColDef}
          gridOptions={gridOptions}
          queryData={queryData}
          dataKey="fuelSupplies"
          paginationOptions={paginationOptions}
          onPaginationChange={handleGridPaginationChange}
          onClearFilters={handleClearFilters}
        />
      </BCBox>
    </BCBox>
  )
}

export default SupplyHistory
