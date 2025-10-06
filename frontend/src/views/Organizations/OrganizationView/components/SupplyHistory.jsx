import React, { useState, useRef, useMemo, useCallback } from 'react'
import { Grid, FormControl, Select, MenuItem, Card, CardContent, Box } from '@mui/material'
import { BarChart } from '@mui/x-charts/BarChart'
import { LineChart } from '@mui/x-charts/LineChart'
import { PieChart } from '@mui/x-charts/PieChart'

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

  const [pagination, setPagination] = useState({ page: 1, size: 10 })
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
  const { data, isLoading } = useOrganizationFuelSupply(
    organizationId,
    {
      page: pagination.page,
      size: pagination.size,
      filters
    },
    {
      enabled: !!organizationId
    }
  )

  const fuelSupplies = data?.fuelSupplies || []
  const analytics = data?.analytics || {}
  const paginationData = data?.pagination || {}

  // Extract unique years for filter dropdown
  const availableYears = useMemo(() => {
    if (!analytics.totalByYear) return []
    return Object.keys(analytics.totalByYear).sort((a, b) => Number(b) - Number(a))
  }, [analytics.totalByYear])

  const handleYearChange = (event) => {
    setSelectedYear(event.target.value)
    setPagination({ ...pagination, page: 1 }) // Reset to first page
  }

  const handleGridPaginationChange = useCallback((newPagination) => {
    setPagination(newPagination)
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

  return (
    <BCBox p={2}>
      <BCTypography variant="h5" color="primary" sx={{ mb: 3 }}>
        {t('org:supplyHistory.title')}
      </BCTypography>

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
          ref={gridRef}
          columnDefs={supplyHistoryColDefs()}
          defaultColDef={defaultColDef}
          gridOptions={gridOptions}
          rowData={fuelSupplies}
          pagination={true}
          paginationPageSize={pagination.size}
          onPaginationChanged={handleGridPaginationChange}
          serverSidePagination={true}
          serverSidePaginationData={paginationData}
          loading={isLoading}
          enableAdvancedFilters={false}
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
                <BarChart
                  xAxis={[
                    {
                      scaleType: 'band',
                      data: fuelTypeChartData.labels,
                      label: t('org:supplyHistory.columns.fuelType')
                    }
                  ]}
                  series={[
                    {
                      data: fuelTypeChartData.values,
                      label: t('org:supplyHistory.analytics.quantity')
                    }
                  ]}
                  height={300}
                  margin={{ top: 10, right: 10, bottom: 70, left: 60 }}
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
                <LineChart
                  xAxis={[
                    {
                      scaleType: 'band',
                      data: volumeOverTimeChartData.labels
                    }
                  ]}
                  series={[
                    {
                      data: volumeOverTimeChartData.values,
                      label: t('org:supplyHistory.analytics.totalVolume'),
                      area: true
                    }
                  ]}
                  height={300}
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
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <PieChart
                    series={[
                      {
                        data: categoryChartData,
                        highlightScope: { faded: 'global', highlighted: 'item' },
                        faded: {
                          innerRadius: 30,
                          additionalRadius: -30,
                          color: 'gray'
                        }
                      }
                    ]}
                    height={300}
                    width={400}
                  />
                </Box>
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
                <BarChart
                  yAxis={[
                    {
                      scaleType: 'band',
                      data: provisionChartData.labels
                    }
                  ]}
                  series={[
                    {
                      data: provisionChartData.values,
                      label: t('org:supplyHistory.analytics.quantity')
                    }
                  ]}
                  height={300}
                  layout="horizontal"
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
                <BarChart
                  yAxis={[
                    {
                      scaleType: 'band',
                      data: topFuelCodesChartData.labels
                    }
                  ]}
                  series={[
                    {
                      data: topFuelCodesChartData.values,
                      label: t('org:supplyHistory.analytics.quantity')
                    }
                  ]}
                  height={400}
                  layout="horizontal"
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
