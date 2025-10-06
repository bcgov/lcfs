import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'

import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { defaultInitialPagination } from '@/constants/schedules.js'

import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TooltipComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import BCButton from '@/components/BCButton'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faGaugeHigh,
  faSackDollar,
  faScaleBalanced
} from '@fortawesome/free-solid-svg-icons'

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer
])

const yearlyPenalties = [
  { year: 2021, autoRenewable: 40000, autoLowCarbon: 10000 },
  { year: 2022, autoRenewable: 10000, autoLowCarbon: 40000 },
  { year: 2023, autoRenewable: 0, autoLowCarbon: 50000 },
  { year: 2024, autoRenewable: 100000, autoLowCarbon: 0 }
]

const penaltyTotals = {
  autoRenewable: 150000,
  autoLowCarbon: 100000,
  discretionary: 50000,
  totalAutomatic: 250000,
  total: 300000
}

const penaltyLogRows = [
  {
    id: '2024-single',
    complianceYear: 2024,
    contraventionType: 'Single contravention',
    offenceHistory: 'Yes',
    deliberate: 'No',
    effortsToCorrect: 'No',
    economicBenefitDerived: 'Yes',
    effortsToPreventRecurrence: 'No',
    notes: 'Penalty issued following routine audit.',
    penaltyAmount: 25000
  },
  {
    id: '2023-continuous',
    complianceYear: 2023,
    contraventionType: 'Continuous contravention',
    offenceHistory: 'Yes',
    deliberate: 'Yes',
    effortsToCorrect: 'No',
    economicBenefitDerived: 'Yes',
    effortsToPreventRecurrence: 'No',
    notes: 'Director determined escalation due to repeated issues.',
    penaltyAmount: 42000
  },
  {
    id: '2022-single',
    complianceYear: 2022,
    contraventionType: 'Single contravention',
    offenceHistory: 'Yes',
    deliberate: 'No',
    effortsToCorrect: 'No',
    economicBenefitDerived: 'Yes',
    effortsToPreventRecurrence: 'No',
    notes: 'Self-disclosed by organization.',
    penaltyAmount: 15000
  }
]

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0
  }).format(value)

const cardBorderSx = {
  border: '1px solid',
  borderColor: 'divider'
}

const useStackedBarOption = (data, theme) =>
  useMemo(() => {
    const primary = theme.palette.primary.main
    const info = theme.palette.info.main

    return {
      color: [primary, info],
      tooltip: { trigger: 'axis' },
      legend: { top: 0 },
      grid: { left: 16, right: 24, bottom: 8, top: 40, containLabel: true },
      xAxis: { type: 'category', data: data.map((item) => item.year) },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (val) => (val >= 1000 ? `${val / 1000}k` : val)
        }
      },
      series: [
        {
          name: 'Auto Renewable',
          type: 'bar',
          stack: 'total',
          emphasis: { focus: 'series' },
          data: data.map((item) => item.autoRenewable)
        },
        {
          name: 'Auto Low Carbon',
          type: 'bar',
          stack: 'total',
          emphasis: { focus: 'series' },
          data: data.map((item) => item.autoLowCarbon)
        }
      ]
    }
  }, [data, theme])

const usePenaltyMixOption = (totals, theme) =>
  useMemo(() => {
    const palette = theme.palette

    return {
      color: [palette.primary.main, palette.info.main, palette.warning.main],
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { orient: 'horizontal', bottom: 0 },
      series: [
        {
          name: 'Penalty Mix',
          type: 'pie',
          radius: ['45%', '70%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderColor: palette.background.paper,
            borderWidth: 2
          },
          label: { show: true, formatter: '{b}: {d}%' },
          data: [
            { value: totals.autoRenewable, name: 'Auto Renewable' },
            { value: totals.autoLowCarbon, name: 'Auto Low Carbon' },
            { value: totals.discretionary, name: 'Discretionary' }
          ]
        }
      ]
    }
  }, [theme, totals])

const useSparklineOption = (data, theme, seriesName = 'Series') =>
  useMemo(() => {
    const primary = theme.palette.primary.main

    return {
      color: [primary],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
        formatter: (params) => {
          if (!params?.length) return ''
          const point = params[0]
          return `${point.marker}${point.axisValue}: ${formatCurrency(point.data)}`
        }
      },
      grid: { left: 0, right: 0, top: 4, bottom: 0 },
      xAxis: {
        type: 'category',
        show: false,
        data: yearlyPenalties.map((item) => item.year)
      },
      yAxis: { type: 'value', show: false },
      series: [
        {
          type: 'line',
          smooth: true,
          symbol: 'none',
          name: seriesName,
          data
        }
      ]
    }
  }, [data, seriesName, theme])

function ResponsiveEChart({ option, height, ariaLabel }) {
  const chartRef = useRef(null)
  const chartInstance = useRef(null)

  useEffect(() => {
    if (!chartRef.current) return

    chartInstance.current = echarts.init(chartRef.current)

    const handleResize = () => {
      chartInstance.current?.resize()
    }

    let resizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(handleResize)
      resizeObserver.observe(chartRef.current)
    } else {
      window.addEventListener('resize', handleResize)
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect()
      } else {
        window.removeEventListener('resize', handleResize)
      }

      chartInstance.current?.dispose()
      chartInstance.current = null
    }
  }, [])

  useEffect(() => {
    if (!chartInstance.current || !option) return
    chartInstance.current.setOption(option, true)
  }, [option])

  return (
    <Box ref={chartRef} aria-label={ariaLabel} sx={{ width: '100%', height }} />
  )
}

ResponsiveEChart.propTypes = {
  option: PropTypes.object.isRequired,
  height: PropTypes.number,
  ariaLabel: PropTypes.string
}

ResponsiveEChart.defaultProps = {
  height: 300,
  ariaLabel: undefined
}

function MetricCard({ title, value, subtitle, option, ariaLabel, icon }) {
  const theme = useTheme()
  const accentColor = theme.palette.primary.main
  const resolvedIcon = icon || faSackDollar

  return (
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 16px 40px rgba(15, 23, 42, 0.1)',
        border: '0.5px solid rgba(15, 23, 42, 0.4)'
      }}
    >
      {/* <Box
        sx={{
          position: 'absolute',
          bottom: -104,
          right: -140,
          width: 210,
          height: 244,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(theme.palette.secondary.main, 0.5)} 0%, transparent 90%)`,
          pointerEvents: 'none'
        }}
        aria-hidden
      /> */}
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        <Grid container spacing={1}>
          <Grid item xs={12} sm={5}>
            <Stack direction="row" spacing={2} alignItems="center">
              {/* <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `linear-gradient(135deg, ${alpha(accentColor, 0.18)} 0%, ${alpha(accentColor, 0.32)} 100%)`,
                  color: theme.palette.primary.main,
                  flexShrink: 0
                }}
                aria-hidden
              >
                <FontAwesomeIcon icon={resolvedIcon} size="lg" />
              </Box> */}
              <Stack spacing={0.5}>
                <BCTypography variant="h6" fontWeight="bold">
                  {value}
                </BCTypography>
                <BCTypography variant="subtitle2" color="text.secondary">
                  {title}
                </BCTypography>
                {subtitle && (
                  <BCTypography variant="caption" color="text.secondary">
                    {subtitle}
                  </BCTypography>
                )}
              </Stack>
            </Stack>
          </Grid>
          <Grid item xs={12} sm={7}>
            {option && (
              <ResponsiveEChart
                option={option}
                height={72}
                ariaLabel={ariaLabel}
              />
            )}
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}

MetricCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  option: PropTypes.object,
  ariaLabel: PropTypes.string,
  icon: PropTypes.object
}

MetricCard.defaultProps = {
  subtitle: undefined,
  option: undefined,
  ariaLabel: undefined,
  icon: undefined
}

export default function PenaltyLog() {
  const { t } = useTranslation(['org'])
  const theme = useTheme()

  const stackedBarOption = useStackedBarOption(yearlyPenalties, theme)
  const penaltyMixOption = usePenaltyMixOption(penaltyTotals, theme)

  const totalSparkline = useSparklineOption(
    yearlyPenalties.map((item) => item.autoRenewable + item.autoLowCarbon),
    theme,
    'Total penalties'
  )
  const automaticSparkline = useSparklineOption(
    yearlyPenalties.map((item) => item.autoRenewable),
    theme,
    'Automatic penalties'
  )
  const discretionarySparkline = useSparklineOption(
    yearlyPenalties.map(
      () => penaltyTotals.discretionary / yearlyPenalties.length
    ),
    theme,
    'Discretionary penalties'
  )

  const penaltyLogGridRef = useRef(null)
  const [paginationOptions, setPaginationOptions] = useState(
    defaultInitialPagination
  )

  const penaltyLogColumnDefs = useMemo(
    () => [
      {
        headerName: 'Compliance year',
        field: 'complianceYear',
        filter: 'agNumberColumnFilter',
        minWidth: 180
      },
      {
        headerName: 'Continuous or single contravention',
        field: 'contraventionType',
        minWidth: 320
      },
      {
        headerName: 'History of offences',
        field: 'offenceHistory',
        minWidth: 190
      },
      {
        headerName: 'Whether contravention was deliberate',
        field: 'deliberate',
        minWidth: 340
      },
      {
        headerName: 'Efforts taken to correct',
        field: 'effortsToCorrect',
        minWidth: 230
      },
      {
        headerName: 'Economic benefit derived from contravention',
        field: 'economicBenefitDerived',
        minWidth: 390
      },
      {
        headerName: 'Efforts to prevent recurrence',
        field: 'effortsToPreventRecurrence',
        minWidth: 270
      },
      {
        headerName: 'Any additional factors (notes)',
        field: 'notes',
        minWidth: 400
      },
      {
        headerName: 'Amount of penalty ($CAD)',
        field: 'penaltyAmount',
        filter: 'agNumberColumnFilter',
        valueFormatter: ({ value }) =>
          value === null || value === undefined ? '' : formatCurrency(value),
        minWidth: 260
      }
    ],
    []
  )

  const penaltyLogDefaultColDef = useMemo(
    () => ({
      flex: 1,
      minWidth: 180
    }),
    []
  )

  const processedPenaltyRows = useMemo(() => {
    const applyTextFilter = (value, filter) => {
      if (!filter.filter) return true
      const cell = value?.toString().toLowerCase() || ''
      const target = filter.filter.toString().toLowerCase()

      switch (filter.type) {
        case 'equals':
          return cell === target
        case 'notEqual':
          return cell !== target
        case 'startsWith':
          return cell.startsWith(target)
        case 'endsWith':
          return cell.endsWith(target)
        default:
          return cell.includes(target)
      }
    }

    const applyNumberFilter = (value, filter) => {
      if (filter.filter === null || filter.filter === undefined) return true
      const numericValue = Number(value)
      const numericFilter = Number(filter.filter)
      if (Number.isNaN(numericValue) || Number.isNaN(numericFilter))
        return false

      switch (filter.type) {
        case 'equals':
          return numericValue === numericFilter
        case 'notEqual':
          return numericValue !== numericFilter
        case 'greaterThan':
          return numericValue > numericFilter
        case 'greaterThanOrEqual':
          return numericValue >= numericFilter
        case 'lessThan':
          return numericValue < numericFilter
        case 'lessThanOrEqual':
          return numericValue <= numericFilter
        default:
          return true
      }
    }

    const applySetFilter = (value, filter) => {
      if (!filter?.values || filter.values.length === 0) return true
      const formattedValue = value?.toString() ?? ''
      return filter.values.includes(formattedValue)
    }

    const compareValues = (a, b) => {
      if (a === b) return 0
      if (a === null || a === undefined) return -1
      if (b === null || b === undefined) return 1
      if (typeof a === 'number' && typeof b === 'number') {
        return a > b ? 1 : -1
      }
      return a.toString().localeCompare(b.toString(), undefined, {
        sensitivity: 'base'
      })
    }

    let rows = penaltyLogRows.slice()

    if (paginationOptions.filters?.length) {
      rows = rows.filter((row) =>
        paginationOptions.filters.every((filter) => {
          const cellValue = row[filter.field]

          if (filter.filterType === 'number') {
            return applyNumberFilter(cellValue, filter)
          }

          if (filter.filterType === 'set') {
            return applySetFilter(cellValue, filter)
          }

          return applyTextFilter(cellValue, filter)
        })
      )
    }

    if (paginationOptions.sortOrders?.length) {
      rows = rows.sort((aRow, bRow) => {
        for (const sort of paginationOptions.sortOrders) {
          const comparison = compareValues(aRow[sort.field], bRow[sort.field])
          if (comparison !== 0) {
            return sort.direction === 'asc' ? comparison : -comparison
          }
        }
        return 0
      })
    }

    return rows
  }, [paginationOptions.filters, paginationOptions.sortOrders])

  const totalRecords = processedPenaltyRows.length

  useEffect(() => {
    const totalPages =
      paginationOptions.size > 0
        ? Math.max(1, Math.ceil(totalRecords / paginationOptions.size))
        : 1

    if (paginationOptions.page > totalPages) {
      setPaginationOptions((prev) => ({ ...prev, page: totalPages }))
    }
  }, [totalRecords, paginationOptions.page, paginationOptions.size])

  const penaltyLogQueryData = useMemo(() => {
    const { page, size } = paginationOptions
    const startIndex = (page - 1) * size
    const endIndex = startIndex + size
    const paginatedRows = processedPenaltyRows.slice(startIndex, endIndex)

    return {
      data: {
        penaltyLogs: paginatedRows,
        pagination: {
          page,
          size,
          total: totalRecords
        }
      },
      error: null,
      isError: false,
      isLoading: false
    }
  }, [
    processedPenaltyRows,
    paginationOptions.page,
    paginationOptions.size,
    totalRecords
  ])

  const handleClearFilters = useCallback(() => {
    try {
      penaltyLogGridRef.current?.clearFilters?.()
    } catch (e) {
      // no-op
    }
    setPaginationOptions((prev) => ({ ...prev, page: 1, filters: [] }))
  }, [])

  return (
    <BCBox p={0} sx={{ maxWidth: '100%' }}>
      <BCTypography variant="h5" color="primary" fontWeight="medium" my={1}>
        {t('org:sections.penaltyLog.title')}
      </BCTypography>
      <Stack spacing={1} ml={-1}>
        <Grid container spacing={1} flexDirection={'row'}>
          <Grid item xs={12} md={4}>
            <Stack spacing={1}>
              <MetricCard
                title="Total penalties"
                value={formatCurrency(penaltyTotals.total)}
                subtitle="Year to date"
                option={totalSparkline}
                ariaLabel="Total penalties trend"
                icon={faSackDollar}
              />
              <MetricCard
                title="Total automatic"
                value={formatCurrency(penaltyTotals.totalAutomatic)}
                subtitle="Auto Renewable + Auto Low Carbon"
                option={automaticSparkline}
                ariaLabel="Automatic penalties trend"
                icon={faGaugeHigh}
              />
              <MetricCard
                title="Discretionary"
                value={formatCurrency(penaltyTotals.discretionary)}
                subtitle="Assessed by director"
                option={discretionarySparkline}
                ariaLabel="Discretionary penalties trend"
                icon={faScaleBalanced}
              />
            </Stack>
          </Grid>
          <Grid item xs={12} md={8}>
            <Card sx={{ height: '100%', ...cardBorderSx }}>
              <CardContent>
                <Stack spacing={2}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <BCTypography variant="h6">
                      Automatic penalties by year
                    </BCTypography>
                    <BCTypography variant="caption" color="text">
                      Stacked view
                    </BCTypography>
                  </Stack>
                  <ResponsiveEChart
                    option={stackedBarOption}
                    height={320}
                    ariaLabel="Automatic penalties stacked bar chart"
                  />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        <Grid container spacing={1}>
          <Grid item xs={12} md={12}>
            <Card sx={{ height: '100%', ...cardBorderSx }}>
              <CardContent>
                <Stack spacing={2}>
                  <BCTypography variant="h6">Penalty log</BCTypography>
                  <Divider light />
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Year</TableCell>
                        <TableCell>Auto Renewable</TableCell>
                        <TableCell>Auto Low Carbon</TableCell>
                        <TableCell>Total Automatic</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {yearlyPenalties.map((row) => (
                        <TableRow key={row.year} hover>
                          <TableCell>{row.year}</TableCell>
                          <TableCell>
                            {formatCurrency(row.autoRenewable)}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(row.autoLowCarbon)}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(
                              row.autoRenewable + row.autoLowCarbon
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Divider light />
                  <BCTypography variant="h6">Total penalties</BCTypography>
                  <Grid container spacing={1}>
                    <Grid item xs={12} sm={3}>
                      <Stack spacing={0.5}>
                        <BCTypography variant="caption" color="text">
                          Auto Renewable
                        </BCTypography>
                        <BCTypography variant="subtitle1" fontWeight="medium">
                          {formatCurrency(penaltyTotals.autoRenewable)}
                        </BCTypography>
                      </Stack>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <Stack spacing={0.5}>
                        <BCTypography variant="caption" color="text">
                          Auto Low Carbon
                        </BCTypography>
                        <BCTypography variant="subtitle1" fontWeight="medium">
                          {formatCurrency(penaltyTotals.autoLowCarbon)}
                        </BCTypography>
                      </Stack>
                    </Grid>
                  </Grid>
                  <Grid container spacing={1}>
                    <Grid item xs={12} sm={3}>
                      <Stack spacing={0.5}>
                        <BCTypography variant="caption" color="text">
                          Discretionary
                        </BCTypography>
                        <BCTypography variant="subtitle1" fontWeight="medium">
                          {formatCurrency(penaltyTotals.discretionary)}
                        </BCTypography>
                      </Stack>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <Stack spacing={0.5}>
                        <BCTypography variant="caption" color="text">
                          Total automatic
                        </BCTypography>
                        <BCTypography variant="subtitle1" fontWeight="medium">
                          {formatCurrency(penaltyTotals.totalAutomatic)}
                        </BCTypography>
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={6} mt={{ xs: 1, md: -14 }}>
                      <Card sx={{ height: '100%', ...cardBorderSx }}>
                        <CardContent>
                          <Stack spacing={2}>
                            <BCTypography variant="h6">
                              Penalty mix
                            </BCTypography>
                            <ResponsiveEChart
                              option={penaltyMixOption}
                              height={320}
                              ariaLabel="Penalty mix donut chart"
                            />
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Stack>
      <Stack spacing={2} mt={4}>
        <BCTypography variant="h5" color="primary" fontWeight="medium">
          {t('org:penaltyLog.history')}
        </BCTypography>
        <Stack spacing={2} direction={{ md: 'row', xs: 'column' }}>
          <Role roles={[roles.government]}>
            <BCButton
              variant="contained"
              size="small"
              color="primary"
              onClick={() => {}}
            >
              <BCTypography variant="subtitle2">
                {t('org:penaltyLog.addPenaltyBtn')}
              </BCTypography>
            </BCButton>
          </Role>
          <ClearFiltersButton
            onClick={handleClearFilters}
            sx={{
              minWidth: 'fit-content',
              whiteSpace: 'nowrap'
            }}
          />
        </Stack>
        <BCBox component="div" sx={{ width: '100%' }}>
          <BCGridViewer
            gridKey="penalty-log-history"
            gridRef={penaltyLogGridRef}
            columnDefs={penaltyLogColumnDefs}
            defaultColDef={penaltyLogDefaultColDef}
            queryData={penaltyLogQueryData}
            dataKey="penaltyLogs"
            paginationOptions={paginationOptions}
            onPaginationChange={setPaginationOptions}
            getRowId={(params) => params.data.id}
            enablePageCaching={false}
            autoSizeStrategy={{
              type: 'fitCellContents',
              defaultMinWidth: 120,
              defaultMaxWidth: 600
            }}
          />
        </BCBox>
      </Stack>
    </BCBox>
  )
}
