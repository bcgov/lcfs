import { useMemo, useState } from 'react'
import {
  Card,
  CardContent,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress
} from '@mui/material'
import ReactECharts from 'echarts-for-react'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import withRole from '@/utils/withRole'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/routes/routes'
import { useCreditMarketOverview } from '@/hooks/useCreditMarket'

const COLORS = {
  price: '#1976d2',
  median: '#9c27b0',
  band: 'rgba(25, 118, 210, 0.12)',
  volume: 'rgba(76, 175, 80, 0.45)',
  balance: '#2e7d32',
  net: 'rgba(33, 150, 243, 0.55)'
}

const numberFmt = new Intl.NumberFormat('en-CA')
const currencyFmt = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 2
})

const formatCredits = (value) =>
  value == null ? '—' : `${numberFmt.format(Math.round(value))}`
const formatPrice = (value) => (value == null ? '—' : currencyFmt.format(value))

const StatCard = ({ label, value, sublabel, dataTest }) => (
  <Card elevation={2} sx={{ height: '100%' }} data-test={dataTest}>
    <CardContent>
      <BCTypography variant="body2" color="text.secondary">
        {label}
      </BCTypography>
      <BCTypography variant="h4" sx={{ mt: 0.5, fontWeight: 700 }}>
        {value}
      </BCTypography>
      {sublabel && (
        <BCTypography variant="caption" color="text.secondary">
          {sublabel}
        </BCTypography>
      )}
    </CardContent>
  </Card>
)

const ChartCard = ({ title, subtitle, hasData, children }) => (
  <Card elevation={2} sx={{ height: '100%' }}>
    <CardContent>
      <BCTypography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {title}
      </BCTypography>
      {subtitle && (
        <BCTypography variant="caption" color="text.secondary">
          {subtitle}
        </BCTypography>
      )}
      <BCBox sx={{ mt: 2 }}>
        {hasData ? (
          children
        ) : (
          <BCTypography variant="body2" color="text.secondary">
            No data available for the selected period.
          </BCTypography>
        )}
      </BCBox>
    </CardContent>
  </Card>
)

const CreditMarketBase = () => {
  const [interval, setInterval] = useState('quarter')
  const { data, isLoading, isError } = useCreditMarketOverview(interval)

  const priceIndex = data?.priceIndex ?? []
  const marketBalance = data?.marketBalance ?? []
  const concentration = data?.concentration ?? {}

  const periods = useMemo(() => priceIndex.map((p) => p.period), [priceIndex])

  // Latest non-null VWAP for the headline stat.
  const latestVwap = useMemo(() => {
    for (let i = priceIndex.length - 1; i >= 0; i -= 1) {
      if (priceIndex[i].vwap != null) return priceIndex[i].vwap
    }
    return null
  }, [priceIndex])

  const totalVolume = useMemo(
    () => priceIndex.reduce((sum, p) => sum + (p.volume || 0), 0),
    [priceIndex]
  )

  const latestBalance =
    marketBalance.length > 0
      ? marketBalance[marketBalance.length - 1].cumulativeBalance
      : null

  // Combined price curve (VWAP + min/max band + median) with traded volume.
  const priceVolumeOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { data: ['VWAP', 'Median', 'Price range', 'Volume'], bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '12%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: true, data: periods },
      yAxis: [
        { type: 'value', name: '$/credit', scale: true },
        {
          type: 'value',
          name: 'Volume',
          splitLine: { show: false },
          axisLabel: { formatter: (v) => numberFmt.format(v) }
        }
      ],
      series: [
        {
          name: 'min',
          type: 'line',
          stack: 'band',
          symbol: 'none',
          lineStyle: { opacity: 0 },
          data: priceIndex.map((p) => p.minPrice),
          tooltip: { show: false },
          silent: true
        },
        {
          name: 'Price range',
          type: 'line',
          stack: 'band',
          symbol: 'none',
          lineStyle: { opacity: 0 },
          areaStyle: { color: COLORS.band },
          data: priceIndex.map((p) =>
            p.maxPrice != null && p.minPrice != null
              ? p.maxPrice - p.minPrice
              : null
          ),
          tooltip: { show: false },
          silent: true
        },
        {
          name: 'VWAP',
          type: 'line',
          smooth: true,
          symbolSize: 7,
          lineStyle: { width: 3, color: COLORS.price },
          itemStyle: { color: COLORS.price },
          connectNulls: true,
          data: priceIndex.map((p) => p.vwap)
        },
        {
          name: 'Median',
          type: 'line',
          symbol: 'none',
          lineStyle: { type: 'dashed', color: COLORS.median },
          connectNulls: true,
          data: priceIndex.map((p) => p.medianPrice)
        },
        {
          name: 'Volume',
          type: 'bar',
          yAxisIndex: 1,
          barMaxWidth: 28,
          itemStyle: { color: COLORS.volume },
          data: priceIndex.map((p) => p.volume)
        }
      ]
    }),
    [priceIndex, periods]
  )

  const balanceOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { data: ['Net change', 'Outstanding credits'], bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '12%', containLabel: true },
      xAxis: {
        type: 'category',
        data: marketBalance.map((p) => p.period)
      },
      yAxis: {
        type: 'value',
        name: 'Credits',
        axisLabel: { formatter: (v) => numberFmt.format(v) }
      },
      series: [
        {
          name: 'Net change',
          type: 'bar',
          itemStyle: { color: COLORS.net },
          data: marketBalance.map((p) => p.periodNetUnits)
        },
        {
          name: 'Outstanding credits',
          type: 'line',
          smooth: true,
          lineStyle: { width: 3, color: COLORS.balance },
          itemStyle: { color: COLORS.balance },
          areaStyle: { opacity: 0.12, color: COLORS.balance },
          data: marketBalance.map((p) => p.cumulativeBalance)
        }
      ]
    }),
    [marketBalance]
  )

  const hhiOption = useMemo(
    () => ({
      series: [
        {
          type: 'gauge',
          min: 0,
          max: 10000,
          radius: '95%',
          splitNumber: 5,
          axisLine: {
            lineStyle: {
              width: 14,
              color: [
                [0.15, '#2e7d32'],
                [0.25, '#f9a825'],
                [1, '#c62828']
              ]
            }
          },
          pointer: { width: 5 },
          axisLabel: { distance: 18, fontSize: 10 },
          detail: {
            valueAnimation: true,
            fontSize: 28,
            offsetCenter: [0, '70%'],
            formatter: (v) => numberFmt.format(Math.round(v))
          },
          title: { offsetCenter: [0, '95%'], fontSize: 12 },
          data: [{ value: concentration.hhi || 0, name: 'HHI' }]
        }
      ]
    }),
    [concentration.hhi]
  )

  const topHoldersOption = useMemo(() => {
    const holders = concentration.topHolders ?? []
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) =>
          `${params[0].name}: ${(params[0].value * 100).toFixed(1)}%`
      },
      grid: {
        left: '3%',
        right: '8%',
        bottom: '3%',
        top: '6%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        max: 1,
        axisLabel: { formatter: (v) => `${Math.round(v * 100)}%` }
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: holders.map((h) => `Holder ${h.rank}`)
      },
      series: [
        {
          type: 'bar',
          itemStyle: { color: COLORS.price },
          barMaxWidth: 18,
          data: holders.map((h) => h.share)
        }
      ]
    }
  }, [concentration.topHolders])

  if (isLoading) {
    return (
      <BCBox display="flex" justifyContent="center" sx={{ mt: 8 }}>
        <CircularProgress />
      </BCBox>
    )
  }

  if (isError) {
    return (
      <BCBox sx={{ mt: 4 }}>
        <BCTypography variant="body1" color="error">
          Unable to load credit market data.
        </BCTypography>
      </BCBox>
    )
  }

  return (
    <BCBox sx={{ p: 1 }} data-test="credit-market">
      <BCBox
        display="flex"
        justifyContent="space-between"
        alignItems="flex-start"
        flexWrap="wrap"
        gap={2}
      >
        <BCBox>
          <BCTypography variant="h4" sx={{ fontWeight: 700 }}>
            Credit market
          </BCTypography>
          <BCTypography variant="body2" color="text.secondary">
            Settled (recorded) credit transfers across the BC LCFS market.
            Aggregated and anonymized — no individual organization is
            identified.
          </BCTypography>
        </BCBox>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={interval}
          onChange={(_, v) => v && setInterval(v)}
          data-test="interval-toggle"
        >
          <ToggleButton value="month">Monthly</ToggleButton>
          <ToggleButton value="quarter">Quarterly</ToggleButton>
          <ToggleButton value="year">Yearly</ToggleButton>
        </ToggleButtonGroup>
      </BCBox>

      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="Latest VWAP"
            value={formatPrice(latestVwap)}
            sublabel="Volume-weighted avg. price"
            dataTest="stat-vwap"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="Total volume traded"
            value={formatCredits(totalVolume)}
            sublabel="Credits, all periods shown"
            dataTest="stat-volume"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="Outstanding credits"
            value={formatCredits(latestBalance)}
            sublabel="Province-wide balance"
            dataTest="stat-balance"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="Market concentration"
            value={
              concentration.hhi != null
                ? numberFmt.format(Math.round(concentration.hhi))
                : '—'
            }
            sublabel={`HHI · top 5 hold ${
              concentration.top5Share != null
                ? `${Math.round(concentration.top5Share * 100)}%`
                : '—'
            }`}
            dataTest="stat-hhi"
          />
        </Grid>

        <Grid item xs={12}>
          <ChartCard
            title="Credit price index & traded volume"
            subtitle="VWAP with min–max range; bars show credits traded per period"
            hasData={priceIndex.length > 0}
          >
            <ReactECharts option={priceVolumeOption} style={{ height: 380 }} />
          </ChartCard>
        </Grid>

        <Grid item xs={12} md={7}>
          <ChartCard
            title="Market balance"
            subtitle="Province-wide outstanding credits and net change per period"
            hasData={marketBalance.length > 0}
          >
            <ReactECharts option={balanceOption} style={{ height: 340 }} />
          </ChartCard>
        </Grid>

        <Grid item xs={12} md={5}>
          <ChartCard
            title="Ownership concentration"
            subtitle="Herfindahl-Hirschman Index of credit holdings (anonymized)"
            hasData={(concentration.totalHolders || 0) > 0}
          >
            <Grid container>
              <Grid item xs={12} sm={5}>
                <ReactECharts option={hhiOption} style={{ height: 220 }} />
              </Grid>
              <Grid item xs={12} sm={7}>
                <BCTypography
                  variant="caption"
                  color="text.secondary"
                  sx={{ pl: 1 }}
                >
                  Largest holders’ share
                </BCTypography>
                <ReactECharts
                  option={topHoldersOption}
                  style={{ height: 220 }}
                />
              </Grid>
            </Grid>
          </ChartCard>
        </Grid>
      </Grid>
    </BCBox>
  )
}

export const CreditMarket = withRole(
  CreditMarketBase,
  [roles.government],
  ROUTES.DASHBOARD
)
CreditMarket.displayName = 'CreditMarket'
