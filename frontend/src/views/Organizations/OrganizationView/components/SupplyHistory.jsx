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

const getStoredYearFilter = () => {
  if (typeof window === 'undefined') {
    return 'all'
  }
  return sessionStorage.getItem(YEAR_FILTER_STORAGE_KEY) || 'all'
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
    <CardContent sx={{ minWidth: 0 }}>
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
  const gridRef = useRef(null)
  const { data: currentUser } = useCurrentUser()

  // Use passed organizationId prop, fallback to current user's org for backward compatibility
  const organizationId =
    propOrganizationId ?? currentUser?.organization?.organizationId

  const [paginationOptions, setPaginationOptions] = useState(() => ({
    ...defaultInitialPagination
  }))
  const [selectedYear, setSelectedYear] = useState(getStoredYearFilter)
  const [availableYears, setAvailableYears] = useState([])

  // Build filters based on selected year
  const yearFilter = useMemo(() => {
    if (!selectedYear || selectedYear === 'all') {
      return null
    }
    return {
      field: 'compliancePeriod',
      filter: selectedYear,
      type: 'equals',
      filterType: 'text'
    }
  }, [selectedYear])

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
    if (!value || value === 'all') {
      sessionStorage.removeItem(YEAR_FILTER_STORAGE_KEY)
    } else {
      sessionStorage.setItem(YEAR_FILTER_STORAGE_KEY, value)
    }
  }, [])

  // Fetch fuel supply data
  const queryData = useOrganizationFuelSupply(
    organizationId,
    paginationPayload,
    {
      enabled: !!organizationId
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

  const handleYearChange = useCallback(
    (event) => {
      const nextYear = event.target.value
      setSelectedYear(nextYear)
      persistYearFilter(nextYear)
      setPaginationOptions((prev) => ({
        ...prev,
        page: 1
      }))
    },
    [persistYearFilter]
  )

  const handleGridPaginationChange = useCallback((newPagination) => {
    setPaginationOptions((prev) => ({
      ...prev,
      ...newPagination
    }))
  }, [])

  const handleClearFilters = useCallback(() => {
    gridRef.current?.clearFilters?.()
    setSelectedYear('all')
    persistYearFilter('all')
    setPaginationOptions({ ...defaultInitialPagination })
  }, [persistYearFilter])

  const hasGridFilters = (paginationOptions.filters || []).length > 0
  const hasActiveFilters = hasGridFilters || selectedYear !== 'all'

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
      }
    ].filter((card) => card.hasData)
  }, [selectedYearSummary, t])

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
  const showTopFuelCodesChart = topFuelCodesChartData.labels.length > 1

  const hasDashboardContent =
    dashboardMetricCards.length > 0 ||
    showComplianceUnitCreditDebitChart ||
    showFuelTypeVolumeTrendChart ||
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
        left: 8,
        right: 12,
        top: 54,
        bottom: 42,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        name: t('org:supplyHistory.analytics.complianceYear'),
        data: complianceUnitCreditDebitTrendData.labels,
        axisLabel: {
          hideOverlap: true
        }
      },
      yAxis: {
        type: 'value',
        name: t('org:supplyHistory.analytics.complianceUnits'),
        axisLabel: {
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
        left: 8,
        right: 12,
        top: 20,
        bottom: 86,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        name: t('org:supplyHistory.analytics.complianceYear'),
        data: fuelTypeVolumeTrendData.labels,
        axisLabel: {
          hideOverlap: true
        }
      },
      yAxis: {
        type: 'value',
        name: t('org:supplyHistory.analytics.quantity'),
        axisLabel: {
          formatter: (value) => formatCompactAxisNumber(value)
        }
      },
      series: fuelTypeVolumeTrendData.series
    }),
    [fuelTypeVolumeTrendData, t]
  )

  const topFuelCodesChartOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (value) => formatCompactAxisNumber(value)
      },
      grid: {
        left: 8,
        right: 12,
        top: 16,
        bottom: 36,
        containLabel: true
      },
      xAxis: {
        type: 'value',
        name: t('org:supplyHistory.analytics.quantity'),
        axisLabel: {
          formatter: (value) => formatCompactAxisNumber(value)
        }
      },
      yAxis: {
        type: 'category',
        data: topFuelCodesChartData.labels,
        axisLabel: {
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
      <Stack
        spacing={2}
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'flex-end' }}
        sx={{ mb: 3 }}
      >
        <FormControl size="medium" sx={{ minWidth: 120 }}>
          <BCTypography variant="body2" sx={{ mb: 1 }}>
            {t('org:supplyHistory.filterByYear')}
          </BCTypography>
          <Select value={selectedYear} onChange={handleYearChange} displayEmpty>
            <MenuItem value="all">{t('org:supplyHistory.allYears')}</MenuItem>
            {availableYears.map((year) => (
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
            minWidth: { xs: '100%', md: 'fit-content' },
            whiteSpace: 'nowrap'
          }}
        />
      </Stack>

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
        />
      </BCBox>
    </BCBox>
  )
}

export default SupplyHistory
