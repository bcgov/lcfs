import React, { useMemo, useState } from 'react'
import {
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material'
import Tooltip from '@mui/material/Tooltip'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import ReactECharts from 'echarts-for-react'
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { useOrganizationAllocationAgreementAnalytics } from '@/hooks/useOrganization'
import { formatNumberWithCommas } from '@/utils/formatters'
import { useTranslation } from 'react-i18next'

const formatNumber = (value, decimals = 0) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-'
  }
  return formatNumberWithCommas({ value: Number(value).toFixed(decimals) })
}

const formatSignedNumber = (value, decimals = 0) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-'
  }
  const numericValue = Number(value)
  const sign = numericValue > 0 ? '+' : ''
  return `${sign}${formatNumber(numericValue, decimals)}`
}

const formatSignedPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-'
  }
  const numericValue = Number(value)
  const sign = numericValue > 0 ? '+' : ''
  return `${sign}${numericValue.toFixed(2)}%`
}

const getChangeColor = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'text'
  }
  if (Number(value) > 0) return 'success'
  if (Number(value) < 0) return 'error'
  return 'text'
}

const CHART_COLORS = {
  blue: '#0072B2',
  green: '#009E73',
  orange: '#D55E00',
  purple: '#CC79A7',
  neutralText: '#405074'
}

const MetricCard = ({ title, value, period, comparison, comparisonColor }) => (
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
      <BCTypography variant="subtitle2" color="text" sx={{ mb: 1 }}>
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
        <BCTypography variant="body2" color="text" sx={{ mt: 0.5 }}>
          {period}
        </BCTypography>
      )}
      {comparison && (
        <BCTypography
          variant="caption"
          color={comparisonColor}
          fontWeight={comparisonColor === 'text' ? 'normal' : 'bold'}
          sx={{ display: 'block', mt: 1 }}
        >
          {comparison}
        </BCTypography>
      )}
    </CardContent>
  </Card>
)

const LabelWithTooltip = ({ label, tooltip }) => {
  if (!tooltip) {
    return label
  }

  return (
    <Stack
      direction="row"
      spacing={0.5}
      alignItems="center"
      component="span"
      sx={{ display: 'inline-flex' }}
    >
      <span>{label}</span>
      <Tooltip title={tooltip} arrow>
        <InfoOutlinedIcon
          fontSize="small"
          color="info"
          sx={{ cursor: 'help' }}
        />
      </Tooltip>
    </Stack>
  )
}

const ChartPanel = ({ title, option, height = 320 }) => (
  <Card elevation={1} sx={{ height: '100%', overflow: 'hidden', minWidth: 0 }}>
    <CardContent sx={{ minWidth: 0 }}>
      <BCTypography variant="h6" color="primary" sx={{ mb: 2 }}>
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

const PivotStatusChip = ({ status, t }) => {
  if (status === 'added') {
    return (
      <Chip
        size="small"
        color="success"
        label={t('org:allocationAgreementHistory.added')}
      />
    )
  }
  if (status === 'removed') {
    return (
      <Chip
        size="small"
        color="error"
        label={t('org:allocationAgreementHistory.removed')}
      />
    )
  }
  if (status === 'present') {
    return (
      <Chip
        size="small"
        variant="outlined"
        label={t('org:allocationAgreementHistory.present')}
      />
    )
  }
  return (
    <BCTypography variant="body2" color="text">
      -
    </BCTypography>
  )
}

export const AllocationAgreementHistory = ({ organizationId }) => {
  const { t } = useTranslation(['org'])
  const [selectedYear, setSelectedYear] = useState('all')
  const { data, isLoading, isError } =
    useOrganizationAllocationAgreementAnalytics(organizationId, {
      enabled: !!organizationId
    })

  const years = useMemo(() => data?.years || [], [data?.years])
  const filteredYears = useMemo(() => {
    if (selectedYear === 'all') {
      return years
    }
    return years.filter((year) => String(year.complianceYear) === selectedYear)
  }, [selectedYear, years])
  const availableYears = useMemo(
    () => years.map((year) => String(year.complianceYear)),
    [years]
  )
  const latestYear = filteredYears.length
    ? filteredYears[filteredYears.length - 1]
    : null
  const priorYear = useMemo(() => {
    if (!latestYear) return null
    const latestIndex = years.findIndex(
      (year) => year.complianceYear === latestYear.complianceYear
    )
    return latestIndex > 0 ? years[latestIndex - 1] : null
  }, [latestYear, years])
  const metricPivotRows = useMemo(
    () => [
      {
        key: 'allocatedOrganizations',
        label: t('org:allocationAgreementHistory.allocatedOrganizations'),
        value: (year) => formatNumber(year.allocatedOrganizationCount)
      },
      {
        key: 'fseReported',
        label: (
          <LabelWithTooltip
            label={t('org:allocationAgreementHistory.fseReported')}
            tooltip={t('org:allocationAgreementHistory.fseReportedTooltip')}
          />
        ),
        value: (year) => formatNumber(year.totalFse, 2)
      },
      {
        key: 'fseChange',
        label: t('org:allocationAgreementHistory.fseChange'),
        value: (year) => formatSignedNumber(year.fseChange, 2),
        color: (year) => getChangeColor(year.fseChange)
      },
      {
        key: 'fsePctChange',
        label: t('org:allocationAgreementHistory.fsePctChange'),
        value: (year) => formatSignedPercent(year.fsePctChange),
        color: (year) => getChangeColor(year.fsePctChange)
      },
      {
        key: 'added',
        label: t('org:allocationAgreementHistory.addedOrganizations'),
        value: (year) => formatNumber(year.addedOrganizations.length)
      },
      {
        key: 'removed',
        label: t('org:allocationAgreementHistory.removedOrganizations'),
        value: (year) => formatNumber(year.removedOrganizations.length)
      }
    ],
    [t]
  )
  const allocateePivotRows = useMemo(() => {
    const organizationNames = new Set()
    filteredYears.forEach((year) => {
      ;[
        ...(year.allocatedOrganizations || []),
        ...(year.addedOrganizations || []),
        ...(year.removedOrganizations || [])
      ].forEach((name) => organizationNames.add(name))
    })

    return Array.from(organizationNames)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        name,
        statuses: filteredYears.reduce((acc, year) => {
          const added = year.addedOrganizations || []
          const removed = year.removedOrganizations || []
          const allocated = year.allocatedOrganizations || []

          if (added.includes(name)) {
            acc[year.complianceYear] = 'added'
          } else if (removed.includes(name)) {
            acc[year.complianceYear] = 'removed'
          } else if (allocated.includes(name)) {
            acc[year.complianceYear] = 'present'
          } else {
            acc[year.complianceYear] = 'none'
          }
          return acc
        }, {})
      }))
  }, [filteredYears])
  const showCharts = filteredYears.length > 1
  const fseTrendChartOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value) => formatNumber(value, 2)
      },
      grid: { left: 8, right: 12, top: 18, bottom: 42, containLabel: true },
      xAxis: {
        type: 'category',
        data: filteredYears.map((year) => year.complianceYear),
        axisLabel: { hideOverlap: true }
      },
      yAxis: {
        type: 'value',
        name: t('org:allocationAgreementHistory.fseReported')
      },
      series: [
        {
          name: t('org:allocationAgreementHistory.fseReported'),
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          data: filteredYears.map((year) => year.totalFse),
          itemStyle: { color: CHART_COLORS.green },
          lineStyle: { color: CHART_COLORS.green, width: 2 },
          areaStyle: { color: 'rgba(0, 158, 115, 0.18)' }
        }
      ]
    }),
    [filteredYears, t]
  )
  const allocateeMovementChartOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { bottom: 0, left: 8, right: 8 },
      grid: { left: 8, right: 12, top: 18, bottom: 70, containLabel: true },
      xAxis: {
        type: 'category',
        data: filteredYears.map((year) => year.complianceYear),
        axisLabel: { hideOverlap: true }
      },
      yAxis: {
        type: 'value',
        name: t('org:allocationAgreementHistory.organizationsShort')
      },
      series: [
        {
          name: t('org:allocationAgreementHistory.addedOrganizations'),
          type: 'bar',
          stack: 'movement',
          data: filteredYears.map((year) => year.addedOrganizations.length),
          itemStyle: { color: CHART_COLORS.green }
        },
        {
          name: t('org:allocationAgreementHistory.removedOrganizations'),
          type: 'bar',
          stack: 'movement',
          data: filteredYears.map((year) => -year.removedOrganizations.length),
          itemStyle: { color: CHART_COLORS.orange }
        }
      ]
    }),
    [filteredYears, t]
  )

  if (isLoading) {
    return <Loading />
  }

  if (isError) {
    return (
      <BCAlert severity="error">
        {t('org:allocationAgreementHistory.errorLoading')}
      </BCAlert>
    )
  }

  if (!years.length) {
    return (
      <BCAlert severity="info">
        {t('org:allocationAgreementHistory.noData')}
      </BCAlert>
    )
  }

  return (
    <BCBox>
      <BCTypography variant="body2" color="text" sx={{ mb: 2 }}>
        {t('org:allocationAgreementHistory.description', {
          allocator: data?.allocatorOrganizationName || ''
        })}
      </BCTypography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', sm: 'flex-end' }}
        sx={{ mb: 3 }}
      >
        <FormControl size="medium" sx={{ minWidth: 180 }}>
          <BCTypography variant="body2" sx={{ mb: 1 }}>
            {t('org:allocationAgreementHistory.filterByYear')}
          </BCTypography>
          <Select
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
            displayEmpty
          >
            <MenuItem value="all">
              {t('org:allocationAgreementHistory.allYears')}
            </MenuItem>
            {availableYears.map((year) => (
              <MenuItem key={year} value={year}>
                {year}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {latestYear && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <MetricCard
              title={t('org:allocationAgreementHistory.allocatedOrganizations')}
              value={formatNumber(latestYear.allocatedOrganizationCount)}
              period={latestYear.complianceYear}
              comparison={
                priorYear
                  ? `${formatSignedNumber(
                      latestYear.allocatedOrganizationCount -
                        priorYear.allocatedOrganizationCount
                    )} ${t('org:allocationAgreementHistory.vsPreviousYear')}`
                  : null
              }
              comparisonColor={getChangeColor(
                priorYear
                  ? latestYear.allocatedOrganizationCount -
                      priorYear.allocatedOrganizationCount
                  : null
              )}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <MetricCard
              title={
                <LabelWithTooltip
                  label={t('org:allocationAgreementHistory.fseReported')}
                  tooltip={t(
                    'org:allocationAgreementHistory.fseReportedTooltip'
                  )}
                />
              }
              value={formatNumber(latestYear.totalFse, 2)}
              period={latestYear.complianceYear}
              comparison={
                latestYear.fseChange !== null &&
                latestYear.fseChange !== undefined
                  ? `${formatSignedNumber(latestYear.fseChange, 2)} (${formatSignedPercent(
                      latestYear.fsePctChange
                    )}) ${t('org:allocationAgreementHistory.vsPreviousYear')}`
                  : null
              }
              comparisonColor={getChangeColor(latestYear.fseChange)}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <MetricCard
              title={t('org:allocationAgreementHistory.allocateeChanges')}
              value={`+${latestYear.addedOrganizations.length} / -${latestYear.removedOrganizations.length}`}
              period={latestYear.complianceYear}
              comparison={t(
                'org:allocationAgreementHistory.addedRemovedOrganizations'
              )}
              comparisonColor="text"
            />
          </Grid>
        </Grid>
      )}

      {showCharts && (
        <Grid container spacing={3} sx={{ mb: 3, minWidth: 0 }}>
          <Grid item xs={12} lg={6} sx={{ minWidth: 0 }}>
            <ChartPanel
              title={t('org:allocationAgreementHistory.fseTrend')}
              option={fseTrendChartOption}
            />
          </Grid>
          <Grid item xs={12} lg={6} sx={{ minWidth: 0 }}>
            <ChartPanel
              title={t('org:allocationAgreementHistory.allocateeMovement')}
              option={allocateeMovementChartOption}
            />
          </Grid>
        </Grid>
      )}

      <Card elevation={1} sx={{ mb: 3, overflow: 'hidden' }}>
        <CardContent>
          <BCTypography variant="h6" color="primary" sx={{ mb: 2 }}>
            {t('org:allocationAgreementHistory.metricPivot')}
          </BCTypography>
          <TableContainer sx={{ maxWidth: '100%', overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      minWidth: 220,
                      position: 'sticky',
                      left: 0,
                      bgcolor: 'background.paper',
                      zIndex: 1
                    }}
                  >
                    {t('org:allocationAgreementHistory.metric')}
                  </TableCell>
                  {filteredYears.map((year) => (
                    <TableCell key={year.complianceYear} align="right">
                      {year.complianceYear}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {metricPivotRows.map((row) => (
                  <TableRow key={row.key} hover>
                    <TableCell
                      sx={{
                        minWidth: 220,
                        position: 'sticky',
                        left: 0,
                        bgcolor: 'background.paper',
                        zIndex: 1
                      }}
                    >
                      {row.label}
                    </TableCell>
                    {filteredYears.map((year) => {
                      const color = row.color?.(year) || 'text'
                      return (
                        <TableCell key={year.complianceYear} align="right">
                          <BCTypography
                            variant="body2"
                            color={color}
                            fontWeight={color === 'text' ? 'regular' : 'bold'}
                          >
                            {row.value(year)}
                          </BCTypography>
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Card elevation={1} sx={{ overflow: 'hidden' }}>
        <CardContent>
          <BCTypography variant="h6" color="primary" sx={{ mb: 2 }}>
            {t('org:allocationAgreementHistory.allocateePivot')}
          </BCTypography>
          <TableContainer sx={{ maxWidth: '100%', overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      minWidth: 260,
                      position: 'sticky',
                      left: 0,
                      bgcolor: 'background.paper',
                      zIndex: 1
                    }}
                  >
                    {t('org:allocationAgreementHistory.organizations')}
                  </TableCell>
                  {filteredYears.map((year) => (
                    <TableCell key={year.complianceYear} align="center">
                      {year.complianceYear}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {allocateePivotRows.map((row) => (
                  <TableRow key={row.name} hover>
                    <TableCell
                      sx={{
                        minWidth: 260,
                        position: 'sticky',
                        left: 0,
                        bgcolor: 'background.paper',
                        zIndex: 1
                      }}
                    >
                      {row.name}
                    </TableCell>
                    {filteredYears.map((year) => (
                      <TableCell key={year.complianceYear} align="center">
                        <PivotStatusChip
                          status={row.statuses[year.complianceYear]}
                          t={t}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </BCBox>
  )
}

export default AllocationAgreementHistory
