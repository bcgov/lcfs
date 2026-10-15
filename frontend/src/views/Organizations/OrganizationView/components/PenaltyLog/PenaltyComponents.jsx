import { useId } from 'react'
import BCTypography from '@/components/BCTypography'
import { BCMetricCard } from '@/components/charts/BCMetricCard'
import { BCResponsiveEChart } from '@/components/charts/BCResponsiveEchart'
import { currencyFormatter } from '@/utils/formatters'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableContainer from '@mui/material/TableContainer'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import {
  faGaugeHigh,
  faSackDollar,
  faScaleBalanced
} from '@fortawesome/free-solid-svg-icons'
import i18n from '@/i18n'

const cardBorderSx = {
  border: '1px solid',
  borderColor: 'divider'
}

// Component for metric cards section
export const MetricCardsSection = ({ penaltyTotals, sparklineOptions }) => (
  <Stack spacing={1} sx={{ width: '100%' }}>
    <BCMetricCard
      title={i18n.t('org:penaltyLog.metrics.totalPenalties')}
      value={currencyFormatter(penaltyTotals.total)}
      subtitle={i18n.t('org:penaltyLog.metrics.yearToDate')}
      option={sparklineOptions.total}
      ariaLabel={i18n.t('org:penaltyLog.metrics.totalPenaltiesTrend')}
      icon={faSackDollar}
    />
    <BCMetricCard
      title={i18n.t('org:penaltyLog.metrics.totalAuto')}
      value={currencyFormatter(penaltyTotals.totalAutomatic)}
      subtitle={i18n.t('org:penaltyLog.metrics.totalSubtitle')}
      option={sparklineOptions.automatic}
      ariaLabel={i18n.t('org:penaltyLog.metrics.automaticPenaltiesTrend')}
      icon={faGaugeHigh}
    />
    <BCMetricCard
      title={i18n.t('org:penaltyLog.metrics.discretionary')}
      value={currencyFormatter(penaltyTotals.discretionary)}
      subtitle={i18n.t('org:penaltyLog.metrics.discretionarySubtitle')}
      option={sparklineOptions.discretionary}
      ariaLabel={i18n.t('org:penaltyLog.metrics.discretionaryPenaltiesTrend')}
      icon={faScaleBalanced}
    />
  </Stack>
)

// Component for stacked bar chart
export const StackedBarChart = ({ stackedBarOption }) => (
  <Card sx={{ height: '100%', width: '100%', ...cardBorderSx }}>
    <CardContent>
      <Stack spacing={2}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <BCTypography variant="h6">
            Automatic fuel penalties by compliance year
          </BCTypography>
          <BCTypography variant="caption" color="text">
            Stacked view
          </BCTypography>
        </Stack>
        <BCResponsiveEChart
          option={stackedBarOption}
          height={320}
          ariaLabel="Automatic renewable fuel penalty and automatic low carbon fuel penalty stacked bar chart by compliance year"
        />
      </Stack>
    </CardContent>
  </Card>
)

const PenaltyMixCard = ({ penaltyMixOption }) => {
  const idPrefix = useId()
  const penaltyMixDescriptionId = `${idPrefix}-penalty-mix-description`
  const penaltyMixTableCaptionId = `${idPrefix}-penalty-mix-table-caption`
  const penaltyMixSeries = Array.isArray(penaltyMixOption?.series)
    ? penaltyMixOption.series.find((series) => series.type === 'pie')
    : undefined
  const penaltyMixData = Array.isArray(penaltyMixSeries?.data)
    ? penaltyMixSeries.data
    : []
  const penaltyMixTotal = penaltyMixData.reduce((sum, item) => {
    const value = Number(item?.value)
    return Number.isFinite(value) && value > 0 ? sum + value : sum
  }, 0)
  const penaltyMixRows = penaltyMixData.map((item, index) => {
    const value = Number(item?.value)
    const share =
      penaltyMixTotal > 0 && Number.isFinite(value) && value > 0
        ? Math.round((value / penaltyMixTotal) * 1000) / 10
        : 0

    return {
      key: `${item?.name ?? 'category'}-${index}`,
      name: item?.name ?? '',
      amount: currencyFormatter(item?.value),
      share: `${share.toFixed(1)}%`
    }
  })
  const announcedRows = penaltyMixRows.slice(0, 5)
  const additionalCategories = penaltyMixRows.length - announcedRows.length
  const penaltyMixAnnouncement = penaltyMixRows.length
    ? `Penalty mix donut chart by penalty type. Total penalties: ${currencyFormatter(penaltyMixTotal)}. ${announcedRows
        .map(
          ({ name, amount, share }) => `${name}: ${amount}, ${share} of total.`
        )
        .join(' ')}${
        additionalCategories > 0
          ? ` ${additionalCategories} more categories are listed in the data table.`
          : ''
      } Open the data table for all values.`
    : 'Penalty mix donut chart by penalty type. No penalty mix data is available.'

  return (
    <Card sx={{ height: '100%', width: '100%', ...cardBorderSx }}>
      <CardContent>
        <Stack spacing={2}>
          <BCTypography variant="h6">Penalty mix by penalty type</BCTypography>
          <BCTypography id={penaltyMixDescriptionId} variant="body2">
            Exact penalty amounts and shares of the total are available in the
            data table.
          </BCTypography>
          <BCResponsiveEChart
            option={penaltyMixOption}
            height={320}
            ariaLabel="Penalty mix donut chart by penalty type"
            ariaDescription={penaltyMixAnnouncement}
            ariaDescribedBy={`${penaltyMixDescriptionId} ${penaltyMixTableCaptionId}`}
          />
          <TableContainer
            role="region"
            aria-labelledby={penaltyMixTableCaptionId}
            tabIndex={0}
            sx={{
              maxWidth: '100%',
              overflowX: 'auto',
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px'
              }
            }}
          >
            <Table
              size="small"
              aria-labelledby={penaltyMixTableCaptionId}
              aria-describedby={penaltyMixDescriptionId}
              sx={{ minWidth: 420 }}
            >
              <caption
                id={penaltyMixTableCaptionId}
                style={{
                  captionSide: 'top',
                  paddingBottom: '8px',
                  textAlign: 'left'
                }}
              >
                Penalty mix data
              </caption>
              <TableHead>
                <TableRow>
                  <TableCell scope="col">Penalty category</TableCell>
                  <TableCell scope="col" align="right">
                    Amount
                  </TableCell>
                  <TableCell scope="col" align="right">
                    Share of total
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {penaltyMixRows.length > 0 ? (
                  penaltyMixRows.map(({ key, name, amount, share }) => (
                    <TableRow key={key}>
                      <TableCell component="th" scope="row">
                        {name}
                      </TableCell>
                      <TableCell align="right">{amount}</TableCell>
                      <TableCell align="right">{share}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3}>
                      No penalty mix data available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </CardContent>
    </Card>
  )
}

// Component for penalty summary table
export const PenaltySummaryTable = ({
  yearlyPenalties,
  penaltyTotals,
  penaltyMixOption
}) => (
  <Card sx={{ height: '100%', width: '100%', ...cardBorderSx }}>
    <CardContent>
      <Stack spacing={2}>
        <BCTypography variant="h6">Penalty log</BCTypography>
        <Divider light />
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Year</TableCell>
              <TableCell>
                {i18n.t('org:penaltyLog.metrics.autoRenewable')}
              </TableCell>
              <TableCell>
                {i18n.t('org:penaltyLog.metrics.autoLowCarbon')}
              </TableCell>
              <TableCell>Total automatic</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {yearlyPenalties.map((row) => (
              <TableRow key={row.year} hover>
                <TableCell>{row.year}</TableCell>
                <TableCell>{currencyFormatter(row.autoRenewable)}</TableCell>
                <TableCell>{currencyFormatter(row.autoLowCarbon)}</TableCell>
                <TableCell>{currencyFormatter(row.totalAutomatic)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Divider light />
        <BCTypography variant="h6">
          {i18n.t('org:penaltyLog.metrics.totalPenalties')}
        </BCTypography>
        <Grid container spacing={2} alignItems="stretch">
          <Grid item xs={12} md={6}>
            <Grid container spacing={1}>
              <Grid item xs={12} sm={6}>
                <Stack spacing={0.5}>
                  <BCTypography variant="caption" color="text">
                    {i18n.t(
                      'org:penaltyLog.metrics.automaticRenewableFuelPenalty'
                    )}
                  </BCTypography>
                  <BCTypography variant="subtitle1" fontWeight="medium">
                    {currencyFormatter(penaltyTotals.autoRenewable)}
                  </BCTypography>
                </Stack>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Stack spacing={0.5}>
                  <BCTypography variant="caption" color="text">
                    {i18n.t(
                      'org:penaltyLog.metrics.automaticLowCarbonFuelPenalty'
                    )}
                  </BCTypography>
                  <BCTypography variant="subtitle1" fontWeight="medium">
                    {currencyFormatter(penaltyTotals.autoLowCarbon)}
                  </BCTypography>
                </Stack>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Stack spacing={0.5}>
                  <BCTypography variant="caption" color="text">
                    {i18n.t('org:penaltyLog.metrics.discretionary')}
                  </BCTypography>
                  <BCTypography variant="subtitle1" fontWeight="medium">
                    {currencyFormatter(penaltyTotals.discretionary)}
                  </BCTypography>
                </Stack>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Stack spacing={0.5}>
                  <BCTypography variant="caption" color="text">
                    {i18n.t('org:penaltyLog.metrics.totalAuto')}
                  </BCTypography>
                  <BCTypography variant="subtitle1" fontWeight="medium">
                    {currencyFormatter(penaltyTotals.totalAutomatic)}
                  </BCTypography>
                </Stack>
              </Grid>
            </Grid>
          </Grid>
          <Grid item xs={12} md={6}>
            <PenaltyMixCard penaltyMixOption={penaltyMixOption} />
          </Grid>
        </Grid>
      </Stack>
    </CardContent>
  </Card>
)
