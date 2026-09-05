import BCTypography from '@/components/BCTypography'
import { BCMetricCard } from '@/components/charts/BCMetricCard'
import { BCResponsiveEChart } from '@/components/charts/BCResponsiveEchart'
import { currencyFormatter } from '@/utils/formatters'
import {
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
              <TableCell>Automatic renewable fuel penalty</TableCell>
              <TableCell>Automatic low carbon fuel penalty</TableCell>
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
        <Grid container spacing={1}>
          <Grid item xs={12} sm={3}>
            <Stack spacing={0.5}>
              <BCTypography variant="caption" color="text">
                {i18n.t('org:penaltyLog.metrics.automaticRenewableFuelPenalty')}
              </BCTypography>
              <BCTypography variant="subtitle1" fontWeight="medium">
                {currencyFormatter(penaltyTotals.autoRenewable)}
              </BCTypography>
            </Stack>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Stack spacing={0.5}>
              <BCTypography variant="caption" color="text">
                {i18n.t('org:penaltyLog.metrics.automaticLowCarbonFuelPenalty')}
              </BCTypography>
              <BCTypography variant="subtitle1" fontWeight="medium">
                {currencyFormatter(penaltyTotals.autoLowCarbon)}
              </BCTypography>
            </Stack>
          </Grid>
        </Grid>
        <Grid container spacing={1}>
          <Grid item xs={12} sm={3}>
            <Stack spacing={0.5}>
              <BCTypography variant="caption" color="text">
                {i18n.t('org:penaltyLog.metrics.discretionary')}
              </BCTypography>
              <BCTypography variant="subtitle1" fontWeight="medium">
                {currencyFormatter(penaltyTotals.discretionary)}
              </BCTypography>
            </Stack>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Stack spacing={0.5}>
              <BCTypography variant="caption" color="text">
                {i18n.t('org:penaltyLog.metrics.totalAuto')}
              </BCTypography>
              <BCTypography variant="subtitle1" fontWeight="medium">
                {currencyFormatter(penaltyTotals.totalAutomatic)}
              </BCTypography>
            </Stack>
          </Grid>
          <Grid item xs={12} md={6} mt={{ xs: 1, md: -14 }}>
            <Card sx={{ height: '100%', width: '100%', ...cardBorderSx }}>
              <CardContent>
                <Stack spacing={2}>
                  <BCTypography variant="h6">
                    Penalty mix by penalty type
                  </BCTypography>
                  <BCResponsiveEChart
                    option={penaltyMixOption}
                    height={320}
                    ariaLabel="Penalty mix donut chart by penalty type"
                  />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Stack>
    </CardContent>
  </Card>
)
