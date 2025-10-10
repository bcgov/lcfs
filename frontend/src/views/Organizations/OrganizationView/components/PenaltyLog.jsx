import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Card,
  CardContent,
  Divider,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { useNavigate, useParams } from 'react-router-dom'

import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { defaultInitialPagination } from '@/constants/schedules.js'
import Loading from '@/components/Loading'
import BCAlert from '@/components/BCAlert'

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
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useOrganizationPenaltyAnalytics,
  useOrganizationPenaltyLogs
} from '@/hooks/useOrganization'
import { ROUTES, buildPath } from '@/routes/routes'
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

const normalizeYear = (value) => {
  if (value === null || value === undefined || value === '') {
    return 'N/A'
  }
  return String(value)
}

const compareYears = (a, b) => {
  const numA = Number(a)
  const numB = Number(b)
  const isNumA = !Number.isNaN(numA)
  const isNumB = !Number.isNaN(numB)

  if (isNumA && isNumB) {
    return numA - numB
  }
  if (isNumA) return -1
  if (isNumB) return 1

  return String(a ?? '').localeCompare(String(b ?? ''), undefined, {
    sensitivity: 'base'
  })
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

const useSparklineOption = (labels, data, theme, seriesName = 'Series') =>
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
        data: labels
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
  }, [data, labels, seriesName, theme])

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
  const { orgID } = useParams()
  const navigate = useNavigate()
  const { data: currentUser, isLoading: currentUserLoading } = useCurrentUser()

  const organizationId = orgID ?? currentUser?.organization?.organizationId

  const {
    data: penaltyAnalytics,
    isLoading: analyticsLoading,
    isError: analyticsIsError,
    error: analyticsError
  } = useOrganizationPenaltyAnalytics(organizationId)

  const rawYearlyPenalties = penaltyAnalytics?.yearlyPenalties ?? []
  const rawPenaltyLogs = penaltyAnalytics?.penaltyLogs ?? []
  const rawTotals = penaltyAnalytics?.totals

  const allYears = useMemo(() => {
    const yearSet = new Set()

    const addYear = (value) => {
      yearSet.add(normalizeYear(value))
    }

    rawYearlyPenalties.forEach((item) => addYear(item?.complianceYear))
    rawPenaltyLogs.forEach((item) => addYear(item?.complianceYear))

    const years = Array.from(yearSet)
    years.sort(compareYears)
    return years
  }, [rawPenaltyLogs, rawYearlyPenalties])

  const yearlyPenalties = useMemo(() => {
    const dataByYear = new Map()
    rawYearlyPenalties.forEach((item) => {
      dataByYear.set(normalizeYear(item?.complianceYear), item)
    })

    return allYears.map((yearLabel) => {
      const source = dataByYear.get(yearLabel)
      const autoRenewable = Number(source?.autoRenewable ?? 0)
      const autoLowCarbon = Number(source?.autoLowCarbon ?? 0)
      const totalAutomatic =
        source?.totalAutomatic !== undefined
          ? Number(source.totalAutomatic)
          : autoRenewable + autoLowCarbon

      const numericYear = Number(yearLabel)
      const complianceYear = Number.isNaN(numericYear) ? yearLabel : numericYear

      return {
        year: yearLabel,
        complianceYear,
        autoRenewable,
        autoLowCarbon,
        totalAutomatic
      }
    })
  }, [allYears, rawYearlyPenalties])

  const penaltyTotals = useMemo(() => {
    const autoRenewable = Number(rawTotals?.autoRenewable ?? 0)
    const autoLowCarbon = Number(rawTotals?.autoLowCarbon ?? 0)
    const discretionary = Number(rawTotals?.discretionary ?? 0)
    const totalAutomatic =
      rawTotals?.totalAutomatic !== undefined
        ? Number(rawTotals.totalAutomatic)
        : autoRenewable + autoLowCarbon
    const total =
      rawTotals?.total !== undefined
        ? Number(rawTotals.total)
        : totalAutomatic + discretionary

    return {
      autoRenewable,
      autoLowCarbon,
      discretionary,
      totalAutomatic,
      total
    }
  }, [rawTotals])

  const yearLabels = allYears

  const totalSparklineData = useMemo(
    () => yearlyPenalties.map((item) => item.totalAutomatic),
    [yearlyPenalties]
  )

  const automaticSparklineData = useMemo(
    () => yearlyPenalties.map((item) => item.autoRenewable),
    [yearlyPenalties]
  )

  const discretionarySparklineData = useMemo(() => {
    const sums = new Map()
    rawPenaltyLogs.forEach((entry) => {
      const key = normalizeYear(entry?.complianceYear)
      const amount = Number(entry?.penaltyAmount ?? 0)
      sums.set(key, (sums.get(key) ?? 0) + amount)
    })

    return yearLabels.map((year) => sums.get(year) ?? 0)
  }, [rawPenaltyLogs, yearLabels])

  const stackedBarOption = useStackedBarOption(yearlyPenalties, theme)
  const penaltyMixOption = usePenaltyMixOption(penaltyTotals, theme)

  const totalSparkline = useSparklineOption(
    yearLabels,
    totalSparklineData,
    theme,
    'Total penalties'
  )
  const automaticSparkline = useSparklineOption(
    yearLabels,
    automaticSparklineData,
    theme,
    'Automatic penalties'
  )
  const discretionarySparkline = useSparklineOption(
    yearLabels,
    discretionarySparklineData,
    theme,
    'Discretionary penalties'
  )

  const penaltyLogGridRef = useRef(null)
  const [paginationOptions, setPaginationOptions] = useState(
    defaultInitialPagination
  )

  const penaltyLogsQuery = useOrganizationPenaltyLogs(
    organizationId,
    paginationOptions,
    {
      enabled: !!organizationId
    }
  )

  const booleanValueFormatter = useCallback(({ value }) => {
    if (value === null || value === undefined) return ''
    return value ? 'Yes' : 'No'
  }, [])

  const getPenaltyRowId = useCallback((params) => {
    const identifier =
      params.data?.penaltyLogId ??
      params.data?.penalty_log_id ??
      params.data?.id
    return identifier !== undefined && identifier !== null
      ? String(identifier)
      : ''
  }, [])

  const penaltyLogColumnDefs = useMemo(
    () => [
      {
        headerName: 'Compliance year',
        field: 'complianceYear',
        filter: 'agTextColumnFilter',
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
        minWidth: 190,
        filter: 'agSetColumnFilter',
        valueFormatter: booleanValueFormatter
      },
      {
        headerName: 'Whether contravention was deliberate',
        field: 'deliberate',
        minWidth: 340,
        filter: 'agSetColumnFilter',
        valueFormatter: booleanValueFormatter
      },
      {
        headerName: 'Efforts taken to correct',
        field: 'effortsToCorrect',
        minWidth: 230,
        filter: 'agSetColumnFilter',
        valueFormatter: booleanValueFormatter
      },
      {
        headerName: 'Economic benefit derived from contravention',
        field: 'economicBenefitDerived',
        minWidth: 390,
        filter: 'agSetColumnFilter',
        valueFormatter: booleanValueFormatter
      },
      {
        headerName: 'Efforts to prevent recurrence',
        field: 'effortsToPreventRecurrence',
        minWidth: 270,
        filter: 'agSetColumnFilter',
        valueFormatter: booleanValueFormatter
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
    [booleanValueFormatter]
  )

  const penaltyLogDefaultColDef = useMemo(
    () => ({
      flex: 1,
      minWidth: 180
    }),
    []
  )

  const handleClearFilters = useCallback(() => {
    try {
      penaltyLogGridRef.current?.clearFilters?.()
    } catch (e) {
      // no-op
    }
    setPaginationOptions({ ...defaultInitialPagination })
  }, [])

  const handlePaginationChange = useCallback((newPagination) => {
    setPaginationOptions((prev) => ({ ...prev, ...newPagination }))
  }, [])

  if (analyticsLoading || currentUserLoading) {
    return <Loading />
  }

  if (!organizationId) {
    return (
      <BCAlert severity="info">
        {t(
          'org:penaltyLog.noOrganizationSelected',
          'Select an organization to view penalty analytics.'
        )}
      </BCAlert>
    )
  }

  const analyticsErrorMessage =
    analyticsError?.response?.data?.detail ?? analyticsError?.message ?? ''

  const analyticsErrorAlert = analyticsIsError ? (
    <BCAlert severity="error" sx={{ mb: 2 }}>
      {t(
        'org:penaltyLog.analyticsError',
        'Unable to load penalty analytics data.'
      )}
      {analyticsErrorMessage ? ` (${analyticsErrorMessage})` : ''}
    </BCAlert>
  ) : null

  return (
    <BCBox p={0} sx={{ maxWidth: '100%' }}>
      {analyticsErrorAlert}
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
                            {formatCurrency(row.totalAutomatic)}
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
              onClick={() => {
                if (!organizationId) return
                navigate(
                  buildPath(ROUTES.ORGANIZATIONS.PENALTY_LOG_MANAGE, {
                    orgID: organizationId
                  })
                )
              }}
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
            queryData={penaltyLogsQuery}
            dataKey="penaltyLogs"
            paginationOptions={paginationOptions}
            onPaginationChange={handlePaginationChange}
            getRowId={getPenaltyRowId}
            loading={penaltyLogsQuery.isLoading}
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
