import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import {
  Grid,
  FormControl,
  Select,
  MenuItem,
  Card,
  CardContent,
  Stack
} from '@mui/material'
import ReactECharts from 'echarts-for-react'

import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { BCMetricCard } from '@/components/charts/BCMetricCard'
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

  const fuelSupplies = queryData?.data?.fuelSupplies || []
  const analytics = queryData?.data?.analytics || {}
  const paginationData = queryData?.data?.pagination || {}

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

  const metricCards = useMemo(() => {
    const totalVolume = analytics.totalVolume || 0
    const totalFuelTypes = analytics.totalFuelTypes || 0
    const totalReports = analytics.totalReports || 0
    const mostRecentSubmission = analytics.mostRecentSubmission
      ? new Date(analytics.mostRecentSubmission).toLocaleDateString('en-CA')
      : t('org:supplyHistory.analytics.noData')

    return [
      {
        key: 'total-volume',
        title: t('org:supplyHistory.analytics.totalVolume'),
        value: abbreviateNumber(totalVolume, { unitLabel: 'L' })
      },
      {
        key: 'total-fuel-types',
        title: t('org:supplyHistory.analytics.totalFuelTypes'),
        value: abbreviateNumber(totalFuelTypes)
      },
      {
        key: 'total-reports',
        title: t('org:supplyHistory.analytics.totalReports'),
        value: abbreviateNumber(totalReports)
      },
      {
        key: 'recent-submission',
        title: t('org:supplyHistory.analytics.mostRecentSubmission'),
        value: mostRecentSubmission
      }
    ]
  }, [
    analytics.totalFuelTypes,
    analytics.totalReports,
    analytics.totalVolume,
    analytics.mostRecentSubmission,
    t
  ])

  // Prepare chart data
  const fuelTypeChartData = useMemo(() => {
    if (!analytics.totalByFuelType) return { labels: [], values: [] }
    const entries = Object.entries(analytics.totalByFuelType)
    return {
      labels: entries.map(([key]) => key),
      values: entries.map(([, value]) => value)
    }
  }, [analytics.totalByFuelType])

  const volumeOverTimeChartData = useMemo(() => {
    if (!analytics.totalByYear) return { labels: [], values: [] }
    const entries = Object.entries(analytics.totalByYear).sort((a, b) =>
      a[0].localeCompare(b[0])
    )
    return {
      labels: entries.map(([key]) => key),
      values: entries.map(([, value]) => value)
    }
  }, [analytics.totalByYear])

  const categoryChartData = useMemo(() => {
    if (!analytics.totalByFuelCategory) return []
    return Object.entries(analytics.totalByFuelCategory).map(
      ([label, value], index) => ({
        id: index,
        value,
        label
      })
    )
  }, [analytics.totalByFuelCategory])

  const provisionChartData = useMemo(() => {
    if (!analytics.totalByProvision) return { labels: [], series: [] }
    const entries = Object.entries(analytics.totalByProvision)
    return {
      labels: entries.map(([key]) => key),
      values: entries.map(([, value]) => value)
    }
  }, [analytics.totalByProvision])

  // Top 10 fuel codes
  const topFuelCodesChartData = useMemo(() => {
    if (!fuelSupplies || fuelSupplies.length === 0)
      return { labels: [], values: [] }

    // Aggregate by fuel code
    const fuelCodeTotals = {}
    fuelSupplies.forEach((supply) => {
      if (supply.fuelCode) {
        fuelCodeTotals[supply.fuelCode] =
          (fuelCodeTotals[supply.fuelCode] || 0) + supply.fuelQuantity
      }
    })

    // Sort and take top 10
    const sortedEntries = Object.entries(fuelCodeTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    return {
      labels: sortedEntries.map(([key]) => key),
      values: sortedEntries.map(([, value]) => value)
    }
  }, [fuelSupplies])

  // ECharts Options
  const fuelTypeChartOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: fuelTypeChartData.labels,
        axisLabel: {
          rotate: 45,
          interval: 0
        }
      },
      yAxis: {
        type: 'value',
        name: t('org:supplyHistory.analytics.quantity')
      },
      series: [
        {
          name: t('org:supplyHistory.analytics.quantity'),
          type: 'bar',
          data: fuelTypeChartData.values,
          itemStyle: {
            color: '#1976d2'
          }
        }
      ]
    }),
    [fuelTypeChartData, t]
  )

  const volumeOverTimeChartOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis'
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: volumeOverTimeChartData.labels,
        boundaryGap: false
      },
      yAxis: {
        type: 'value',
        name: t('org:supplyHistory.analytics.totalVolume')
      },
      series: [
        {
          name: t('org:supplyHistory.analytics.totalVolume'),
          type: 'line',
          data: volumeOverTimeChartData.values,
          areaStyle: {
            color: 'rgba(25, 118, 210, 0.2)'
          },
          itemStyle: {
            color: '#1976d2'
          },
          lineStyle: {
            color: '#1976d2'
          }
        }
      ]
    }),
    [volumeOverTimeChartData, t]
  )

  const categoryChartOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left'
      },
      series: [
        {
          type: 'pie',
          radius: '65%',
          data: categoryChartData.map((item) => ({
            name: item.label,
            value: item.value
          })),
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    }),
    [categoryChartData]
  )

  const provisionChartOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      grid: {
        left: '20%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        name: t('org:supplyHistory.analytics.quantity')
      },
      yAxis: {
        type: 'category',
        data: provisionChartData.labels
      },
      series: [
        {
          name: t('org:supplyHistory.analytics.quantity'),
          type: 'bar',
          data: provisionChartData.values,
          itemStyle: {
            color: '#1976d2'
          }
        }
      ]
    }),
    [provisionChartData, t]
  )

  const topFuelCodesChartOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      grid: {
        left: '15%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        name: t('org:supplyHistory.analytics.quantity')
      },
      yAxis: {
        type: 'category',
        data: topFuelCodesChartData.labels
      },
      series: [
        {
          name: t('org:supplyHistory.analytics.quantity'),
          type: 'bar',
          data: topFuelCodesChartData.values,
          itemStyle: {
            color: '#1976d2'
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

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {metricCards.map((card) => (
          <Grid item xs={12} sm={6} md={3} key={card.key}>
            <BCMetricCard {...card} />
          </Grid>
        ))}
      </Grid>

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

      {/* Analytics Charts */}
      <BCTypography variant="h6" color="primary" sx={{ mb: 2, mt: 4 }}>
        {t('org:supplyHistory.analytics.chartsTitle')}
      </BCTypography>

      <Grid container spacing={3}>
        {/* Fuel Type Distribution */}
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <BCTypography variant="subtitle1" sx={{ mb: 2 }}>
                {t('org:supplyHistory.analytics.fuelTypeDistribution')}
              </BCTypography>
              {fuelTypeChartData.labels.length > 0 ? (
                <ReactECharts
                  option={fuelTypeChartOption}
                  style={{ height: 300 }}
                />
              ) : (
                <BCTypography variant="body2" color="text.secondary">
                  {t('org:supplyHistory.analytics.noData')}
                </BCTypography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Volume Over Time */}
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <BCTypography variant="subtitle1" sx={{ mb: 2 }}>
                {t('org:supplyHistory.analytics.volumeOverTime')}
              </BCTypography>
              {volumeOverTimeChartData.labels.length > 0 ? (
                <ReactECharts
                  option={volumeOverTimeChartOption}
                  style={{ height: 300 }}
                />
              ) : (
                <BCTypography variant="body2" color="text.secondary">
                  {t('org:supplyHistory.analytics.noData')}
                </BCTypography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Fuel Category Breakdown */}
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <BCTypography variant="subtitle1" sx={{ mb: 2 }}>
                {t('org:supplyHistory.analytics.categoryBreakdown')}
              </BCTypography>
              {categoryChartData.length > 0 ? (
                <ReactECharts
                  option={categoryChartOption}
                  style={{ height: 300 }}
                />
              ) : (
                <BCTypography variant="body2" color="text.secondary">
                  {t('org:supplyHistory.analytics.noData')}
                </BCTypography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Provision Distribution */}
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <BCTypography variant="subtitle1" sx={{ mb: 2 }}>
                {t('org:supplyHistory.analytics.provisionDistribution')}
              </BCTypography>
              {provisionChartData.labels.length > 0 ? (
                <ReactECharts
                  option={provisionChartOption}
                  style={{ height: 300 }}
                />
              ) : (
                <BCTypography variant="body2" color="text.secondary">
                  {t('org:supplyHistory.analytics.noData')}
                </BCTypography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Top Fuel Codes */}
        <Grid item xs={12}>
          <Card elevation={2}>
            <CardContent>
              <BCTypography variant="subtitle1" sx={{ mb: 2 }}>
                {t('org:supplyHistory.analytics.topFuelCodes')}
              </BCTypography>
              {topFuelCodesChartData.labels.length > 0 ? (
                <ReactECharts
                  option={topFuelCodesChartOption}
                  style={{ height: 400 }}
                />
              ) : (
                <BCTypography variant="body2" color="text.secondary">
                  {t('org:supplyHistory.analytics.noData')}
                </BCTypography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </BCBox>
  )
}

export default SupplyHistory
