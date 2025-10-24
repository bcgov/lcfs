import React, { useState, useRef, useMemo, useCallback } from 'react'
import { Grid, FormControl, Select, MenuItem, Card, CardContent, Box } from '@mui/material'
import ReactECharts from 'echarts-for-react'

import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { useOrganizationFuelSupply } from '@/hooks/useFuelSupply'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTranslation } from 'react-i18next'
import { formatNumberWithCommas } from '@/utils/formatters'

import {
  supplyHistoryColDefs,
  defaultColDef,
  gridOptions
} from './_supplyHistorySchema'

export const SupplyHistory = ({ organizationId: propOrganizationId }) => {
  const { t } = useTranslation(['org'])
  const gridRef = useRef(null)
  const { data: currentUser } = useCurrentUser()

  // Use passed organizationId prop, fallback to current user's org for backward compatibility
  const organizationId = propOrganizationId ?? currentUser?.organization?.organizationId

  const [paginationOptions, setPaginationOptions] = useState({
    page: 1,
    size: 10,
    sortOrders: [],
    filters: []
  })
  const [selectedYear, setSelectedYear] = useState('all')

  // Build filters based on selected year
  const filters = useMemo(() => {
    if (!selectedYear || selectedYear === 'all') {
      return []
    }
    return [
      {
        field: 'compliancePeriod',
        filter: selectedYear,
        type: 'text',
        filter_type: 'equals'
      }
    ]
  }, [selectedYear])

  // Fetch fuel supply data
  const queryData = useOrganizationFuelSupply(
    organizationId,
    {
      page: paginationOptions.page,
      size: paginationOptions.size,
      filters
    },
    {
      enabled: !!organizationId
    }
  )

  const fuelSupplies = queryData?.data?.fuelSupplies || []
  const analytics = queryData?.data?.analytics || {}
  const paginationData = queryData?.data?.pagination || {}

  // Extract unique years for filter dropdown
  const availableYears = useMemo(() => {
    if (!analytics.totalByYear) return []
    return Object.keys(analytics.totalByYear).sort((a, b) => Number(b) - Number(a))
  }, [analytics.totalByYear])

  const handleYearChange = (event) => {
    setSelectedYear(event.target.value)
    setPaginationOptions({ ...paginationOptions, page: 1 }) // Reset to first page
  }

  const handleGridPaginationChange = useCallback((newPagination) => {
    setPaginationOptions((prev) => ({
      ...prev,
      ...newPagination
    }))
  }, [])

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
    if (!fuelSupplies || fuelSupplies.length === 0) return { labels: [], values: [] }

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
  const fuelTypeChartOption = useMemo(() => ({
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
    series: [{
      name: t('org:supplyHistory.analytics.quantity'),
      type: 'bar',
      data: fuelTypeChartData.values,
      itemStyle: {
        color: '#1976d2'
      }
    }]
  }), [fuelTypeChartData, t])

  const volumeOverTimeChartOption = useMemo(() => ({
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
    series: [{
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
    }]
  }), [volumeOverTimeChartData, t])

  const categoryChartOption = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [{
      type: 'pie',
      radius: '65%',
      data: categoryChartData.map(item => ({
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
    }]
  }), [categoryChartData])

  const provisionChartOption = useMemo(() => ({
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
    series: [{
      name: t('org:supplyHistory.analytics.quantity'),
      type: 'bar',
      data: provisionChartData.values,
      itemStyle: {
        color: '#1976d2'
      }
    }]
  }), [provisionChartData, t])

  const topFuelCodesChartOption = useMemo(() => ({
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
    series: [{
      name: t('org:supplyHistory.analytics.quantity'),
      type: 'bar',
      data: topFuelCodesChartData.values,
      itemStyle: {
        color: '#1976d2'
      }
    }]
  }), [topFuelCodesChartData, t])

  return (
    <BCBox py={0}>
      {/* Year Filter */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <BCTypography variant="body2" sx={{ mb: 1 }}>
              {t('org:supplyHistory.filterByYear')}
            </BCTypography>
            <Select
              value={selectedYear}
              onChange={handleYearChange}
              displayEmpty
            >
              <MenuItem value="all">{t('org:supplyHistory.allYears')}</MenuItem>
              {availableYears.map((year) => (
                <MenuItem key={year} value={year}>
                  {year}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <BCTypography variant="subtitle2" color="text.secondary">
                {t('org:supplyHistory.analytics.totalVolume')}
              </BCTypography>
              <BCTypography variant="h4" color="primary">
                {formatNumberWithCommas({ value: analytics.totalVolume || 0 })}
              </BCTypography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <BCTypography variant="subtitle2" color="text.secondary">
                {t('org:supplyHistory.analytics.totalFuelTypes')}
              </BCTypography>
              <BCTypography variant="h4" color="primary">
                {analytics.totalFuelTypes || 0}
              </BCTypography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <BCTypography variant="subtitle2" color="text.secondary">
                {t('org:supplyHistory.analytics.totalReports')}
              </BCTypography>
              <BCTypography variant="h4" color="primary">
                {analytics.totalReports || 0}
              </BCTypography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <BCTypography variant="subtitle2" color="text.secondary">
                {t('org:supplyHistory.analytics.mostRecentSubmission')}
              </BCTypography>
              <BCTypography variant="h6" color="primary">
                {analytics.mostRecentSubmission
                  ? new Date(analytics.mostRecentSubmission).toLocaleDateString(
                      'en-CA'
                    )
                  : t('org:supplyHistory.analytics.noData')}
              </BCTypography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Data Grid */}
      <BCBox sx={{ mb: 4 }}>
        <BCGridViewer
          gridRef={gridRef}
          gridKey="supply-history"
          columnDefs={supplyHistoryColDefs()}
          defaultColDef={defaultColDef}
          gridOptions={gridOptions}
          queryData={queryData}
          dataKey="fuelSupplies"
          paginationOptions={paginationOptions}
          onPaginationChange={handleGridPaginationChange}
          enableAdvancedFilters={false}
          enablePageCaching={false}
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
                <ReactECharts option={fuelTypeChartOption} style={{ height: 300 }} />
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
                <ReactECharts option={volumeOverTimeChartOption} style={{ height: 300 }} />
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
                <ReactECharts option={categoryChartOption} style={{ height: 300 }} />
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
                <ReactECharts option={provisionChartOption} style={{ height: 300 }} />
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
                <ReactECharts option={topFuelCodesChartOption} style={{ height: 400 }} />
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
