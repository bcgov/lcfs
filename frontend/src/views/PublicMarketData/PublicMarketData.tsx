import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material'
import EnergySavingsLeafOutlinedIcon from '@mui/icons-material/EnergySavingsLeafOutlined'
import ReactECharts from 'echarts-for-react'
import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import {
  useCreditMarketPublicReport,
  useCreditMarketPublicOverview
} from '@/hooks/useCreditMarket'

const NAVY = '#003366'
const GOLD = '#FCBA19'
const LINK = '#1A5A96'
const DARK = '#313132'
const MUTED = '#565656'
const BORDER = '#D8D8D8'

const intFmt = new Intl.NumberFormat('en-CA')
const compactFmt = new Intl.NumberFormat('en-CA', {
  notation: 'compact',
  maximumFractionDigits: 1
})
const price2Fmt = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})
const money0Fmt = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0
})

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]
const fmtPeriod = (p) => {
  const m = /^(\d{4})-(\d{2})$/.exec(p || '')
  return m ? `${MONTHS[+m[2] - 1]} ${m[1]}` : p
}
const priorYearLabel = (p) => {
  const m = /^(\d{4})-(\d{2})$/.exec(p || '')
  return m ? `${MONTHS[+m[2] - 1]} ${+m[1] - 1}` : ''
}

const StatCell = ({ label, value, first }) => (
  <BCBox
    sx={{
      p: '20px 26px',
      borderLeft: first ? 'none' : `1px solid ${BORDER}`,
      flex: 1,
      minWidth: 160
    }}
  >
    <BCTypography sx={{ fontSize: 13, color: MUTED, mb: 0.75 }}>
      {label}
    </BCTypography>
    <BCTypography
      sx={{ fontSize: 30, fontWeight: 700, color: DARK, lineHeight: 1 }}
    >
      {value}
    </BCTypography>
  </BCBox>
)

const csvEscape = (v) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const PublicMarketData = () => {
  const { t } = useTranslation()
  const { data, isLoading } = useCreditMarketPublicReport()
  const { data: overview } = useCreditMarketPublicOverview('year')
  const [gran, setGran] = useState('quarter')

  const seriesKey = { month: 'monthly', quarter: 'quarterly', year: 'annual' }[
    gran
  ]
  const series = data?.[seriesKey] ?? []
  const kpis = data?.kpis
  const allTime = data?.allTime

  const totalCreditsIssued = overview?.totalCreditsIssued
  const carsEquivalent =
    totalCreditsIssued != null ? Math.round(totalCreditsIssued / 4.6) : null

  const chartOption = useMemo(() => {
    const priceName = t('publicDashboard.marketData.kpi.avgPrice')
    const volName = t('publicDashboard.marketData.tables.volume')
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params) => {
          if (!params || !params.length) return ''
          const lines = params
            .map((p) => {
              const value =
                p.value == null
                  ? '—'
                  : p.seriesName === priceName
                    ? price2Fmt.format(p.value)
                    : intFmt.format(Math.round(p.value))
              return `${p.marker}${p.seriesName}: ${value}`
            })
            .join('<br/>')
          return `${params[0].axisValue}<br/>${lines}`
        }
      },
      legend: { data: [priceName, volName], bottom: 0 },
      grid: {
        left: '2%',
        right: '3%',
        bottom: '12%',
        top: '8%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: series.map((p) => p.period),
        axisLabel: { color: '#767676', fontSize: 10 }
      },
      yAxis: [
        {
          type: 'value',
          name: '$/credit',
          axisLabel: { color: '#767676', fontSize: 10 },
          splitLine: { lineStyle: { color: '#ECECEC' } }
        },
        {
          type: 'value',
          splitLine: { show: false },
          axisLabel: { show: false }
        }
      ],
      series: [
        {
          name: volName,
          type: 'bar',
          yAxisIndex: 1,
          barMaxWidth: 26,
          itemStyle: { color: 'rgba(252,186,25,0.75)' },
          data: series.map((p) => p.volume)
        },
        {
          name: priceName,
          type: 'line',
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2.5, color: NAVY },
          itemStyle: { color: '#fff', borderColor: NAVY, borderWidth: 2 },
          connectNulls: true,
          data: series.map((p) => p.weightedAvgPrice)
        }
      ]
    }
  }, [series, t])

  const downloadCsv = () => {
    const header = [
      t('publicDashboard.marketData.tables.period'),
      t('publicDashboard.marketData.tables.transfers'),
      t('publicDashboard.marketData.tables.volume'),
      t('publicDashboard.marketData.tables.avgPrice'),
      t('publicDashboard.marketData.tables.transferValue')
    ]
    const lines = [header.join(',')]
    series.forEach((r) => {
      lines.push(
        [
          fmtPeriod(r.period),
          r.transfers,
          r.volume,
          r.weightedAvgPrice != null ? r.weightedAvgPrice.toFixed(2) : '',
          r.transferValue != null ? r.transferValue.toFixed(2) : ''
        ]
          .map(csvEscape)
          .join(',')
      )
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lcfs-market-${gran}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const kpiCards = [
    {
      key: 'transfers',
      label: t('publicDashboard.marketData.kpi.transfers'),
      metric: kpis?.transfers,
      fmt: (v) => intFmt.format(Math.round(v))
    },
    {
      key: 'volume',
      label: t('publicDashboard.marketData.kpi.totalVolume'),
      metric: kpis?.volume,
      fmt: (v) => intFmt.format(Math.round(v))
    },
    {
      key: 'avgPrice',
      label: t('publicDashboard.marketData.kpi.avgPrice'),
      metric: kpis?.weightedAvgPrice,
      fmt: (v) => price2Fmt.format(v)
    }
  ]

  const reportTables = [
    { key: 'monthly', title: t('publicDashboard.marketData.tables.monthly') },
    {
      key: 'quarterly',
      title: t('publicDashboard.marketData.tables.quarterly')
    },
    { key: 'annual', title: t('publicDashboard.marketData.tables.annual') }
  ]

  if (isLoading) {
    return (
      <BCBox display="flex" justifyContent="center" sx={{ py: 8 }}>
        <CircularProgress />
      </BCBox>
    )
  }

  return (
    <BCBox sx={{ maxWidth: 1120, mx: 'auto', px: { xs: 1, md: 2 }, py: 2 }}>
      {/* Title row */}
      <BCBox
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 3,
          flexWrap: 'wrap',
          mb: 2
        }}
      >
        <BCBox>
          <BCTypography
            variant="h1"
            sx={{ fontSize: 34, fontWeight: 700, color: DARK, mb: 1 }}
          >
            {t('publicDashboard.marketData.title')}
          </BCTypography>
          <BCTypography
            sx={{ fontSize: 16, color: MUTED, maxWidth: 720, lineHeight: 1.55 }}
          >
            {t('publicDashboard.marketData.subtitle')}
          </BCTypography>
        </BCBox>
        <BCBox sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <BCBox
            sx={{
              fontSize: 12,
              color: LINK,
              border: '1px solid #B7CCE0',
              borderRadius: '99px',
              px: 1.5,
              py: 0.5,
              background: '#F4F8FB'
            }}
          >
            {t('publicDashboard.marketData.aggregatedNote')}
          </BCBox>
          <Button
            disableElevation
            onClick={downloadCsv}
            data-test="download-csv"
            sx={{
              backgroundColor: NAVY,
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              textTransform: 'none',
              px: 2.5,
              py: 1.1,
              borderRadius: '4px',
              '&:hover': { backgroundColor: LINK }
            }}
          >
            {t('publicDashboard.marketData.downloadCsv')}
          </Button>
        </BCBox>
      </BCBox>

      {/* CO2 impact band */}
      {totalCreditsIssued != null && totalCreditsIssued > 0 && (
        <BCBox
          data-test="impact-callout"
          sx={{
            backgroundColor: NAVY,
            color: '#fff',
            borderRadius: 2,
            p: { xs: 2.5, md: 3 },
            mb: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 2.5,
            flexWrap: 'wrap'
          }}
        >
          <EnergySavingsLeafOutlinedIcon sx={{ fontSize: 48, color: '#fff' }} />
          <BCBox>
            <BCTypography
              variant="h2"
              sx={{
                fontSize: 40,
                fontWeight: 700,
                color: '#fff',
                lineHeight: 1.1
              }}
            >
              {compactFmt.format(totalCreditsIssued)}
            </BCTypography>
            <BCTypography sx={{ fontSize: 16, color: 'rgba(255,255,255,0.9)' }}>
              {t('publicDashboard.impact.heading')}
            </BCTypography>
            <BCTypography
              sx={{ fontSize: 13.5, color: 'rgba(255,255,255,0.8)', mt: 0.5 }}
            >
              {t('publicDashboard.impact.equivalent', {
                cars: compactFmt.format(carsEquivalent)
              })}
            </BCTypography>
          </BCBox>
        </BCBox>
      )}

      {/* KPI strip */}
      <BCBox
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          border: `1px solid ${BORDER}`,
          borderRadius: '6px',
          overflow: 'hidden',
          mb: 3.5
        }}
      >
        {kpiCards.map((c, i) => {
          const m = c.metric
          const down = m?.deltaPct != null && m.deltaPct < 0
          return (
            <BCBox
              key={c.key}
              data-test={`kpi-${c.key}`}
              sx={{
                p: '20px 26px',
                borderLeft: i === 0 ? 'none' : `1px solid ${BORDER}`,
                flex: 1,
                minWidth: 200,
                background: i === 0 ? '#F8FAFC' : '#fff'
              }}
            >
              <BCTypography sx={{ fontSize: 13, color: MUTED, mb: 0.75 }}>
                {c.label}
                {kpis?.labelPeriod ? ` · ${fmtPeriod(kpis.labelPeriod)}` : ''}
              </BCTypography>
              <BCBox
                sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25 }}
              >
                <BCTypography
                  sx={{
                    fontSize: 34,
                    fontWeight: 700,
                    color: NAVY,
                    lineHeight: 1
                  }}
                >
                  {m?.current != null ? c.fmt(m.current) : '—'}
                </BCTypography>
                {m?.deltaPct != null && (
                  <BCTypography
                    sx={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: down ? '#A12622' : '#2E7D32',
                      background: down ? '#F7E6E5' : '#E7F3E8',
                      borderRadius: '4px',
                      px: 1,
                      py: 0.4
                    }}
                  >
                    {down ? '▾' : '▲'} {Math.abs(m.deltaPct).toFixed(1)}%
                  </BCTypography>
                )}
              </BCBox>
              {m?.prior != null && (
                <BCTypography sx={{ fontSize: 12, color: MUTED, mt: 0.5 }}>
                  {t('publicDashboard.marketData.vsYearAgo', {
                    period: priorYearLabel(kpis?.labelPeriod)
                  })}
                  : {c.fmt(m.prior)}
                </BCTypography>
              )}
            </BCBox>
          )
        })}
      </BCBox>

      {/* All time */}
      <BCTypography
        variant="h2"
        sx={{ fontSize: 20, fontWeight: 700, color: DARK, mb: 1.5 }}
      >
        {t('publicDashboard.marketData.allTimeTitle')}
      </BCTypography>
      <BCBox
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          border: `1px solid ${BORDER}`,
          borderRadius: '6px',
          overflow: 'hidden',
          mb: 3.5
        }}
      >
        <StatCell
          first
          label={t('publicDashboard.marketData.allTime.volume')}
          value={allTime ? intFmt.format(allTime.volume) : '—'}
        />
        <StatCell
          label={t('publicDashboard.marketData.allTime.transfers')}
          value={allTime ? intFmt.format(allTime.transfers) : '—'}
        />
        <StatCell
          label={t('publicDashboard.marketData.allTime.avgPrice')}
          value={
            allTime?.weightedAvgPrice != null
              ? price2Fmt.format(allTime.weightedAvgPrice)
              : '—'
          }
        />
        <StatCell
          label={t('publicDashboard.marketData.allTime.transferValue')}
          value={allTime ? money0Fmt.format(allTime.transferValue) : '—'}
        />
      </BCBox>

      {/* Chart */}
      <BCBox
        sx={{
          border: `1px solid ${BORDER}`,
          borderRadius: '6px',
          p: { xs: 2, md: 3 },
          mb: 4
        }}
      >
        <BCBox
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
            mb: 2
          }}
        >
          <BCBox>
            <BCTypography
              variant="h2"
              sx={{ fontSize: 20, fontWeight: 700, color: DARK }}
            >
              {t('publicDashboard.marketData.chartTitle')}
            </BCTypography>
            <BCTypography sx={{ fontSize: 13.5, color: MUTED }}>
              {t('publicDashboard.marketData.chartSubtitle')}
            </BCTypography>
          </BCBox>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={gran}
            onChange={(_, v) => v && setGran(v)}
            data-test="granularity-toggle"
          >
            <ToggleButton value="month">
              {t('publicDashboard.marketData.granularity.month')}
            </ToggleButton>
            <ToggleButton value="quarter">
              {t('publicDashboard.marketData.granularity.quarter')}
            </ToggleButton>
            <ToggleButton value="year">
              {t('publicDashboard.marketData.granularity.year')}
            </ToggleButton>
          </ToggleButtonGroup>
        </BCBox>
        {series.length > 0 ? (
          <ReactECharts option={chartOption} style={{ height: 380 }} />
        ) : (
          <BCTypography sx={{ fontSize: 14, color: MUTED, py: 4 }}>
            {t('publicDashboard.marketData.tables.noData')}
          </BCTypography>
        )}
      </BCBox>

      {/* Report tables */}
      {reportTables.map((tbl) => {
        const rows = data?.[tbl.key] ?? []
        return (
          <BCBox key={tbl.key} sx={{ mb: 4 }}>
            <BCTypography
              variant="h2"
              sx={{ fontSize: 20, fontWeight: 700, color: DARK, mb: 1.5 }}
            >
              {tbl.title}
            </BCTypography>
            <BCBox
              sx={{
                border: `1px solid ${BORDER}`,
                borderRadius: '6px',
                overflow: 'auto',
                maxHeight: 420
              }}
            >
              <Box
                component="table"
                sx={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 14
                }}
              >
                <Box
                  component="thead"
                  sx={{
                    position: 'sticky',
                    top: 0,
                    background: '#F2F2F2',
                    '& th': {
                      textAlign: 'right',
                      p: '11px 20px',
                      fontWeight: 700,
                      fontSize: 13.5,
                      color: DARK,
                      borderBottom: `2px solid ${BORDER}`,
                      whiteSpace: 'nowrap'
                    },
                    '& th:first-of-type': { textAlign: 'left' }
                  }}
                >
                  <tr>
                    <th>{t('publicDashboard.marketData.tables.period')}</th>
                    <th>{t('publicDashboard.marketData.tables.transfers')}</th>
                    <th>{t('publicDashboard.marketData.tables.volume')}</th>
                    <th>{t('publicDashboard.marketData.tables.avgPrice')}</th>
                    <th>
                      {t('publicDashboard.marketData.tables.transferValue')}
                    </th>
                  </tr>
                </Box>
                <Box
                  component="tbody"
                  sx={{
                    '& td': {
                      textAlign: 'right',
                      p: '10px 20px',
                      color: DARK,
                      borderBottom: '1px solid #ECECEC',
                      whiteSpace: 'nowrap'
                    },
                    '& td:first-of-type': {
                      textAlign: 'left',
                      fontWeight: 600
                    },
                    '& tr:hover': { background: '#F8FAFC' }
                  }}
                >
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        style={{ textAlign: 'left', color: MUTED }}
                      >
                        {t('publicDashboard.marketData.tables.noData')}
                      </td>
                    </tr>
                  ) : (
                    [...rows].reverse().map((r) => (
                      <tr key={r.period}>
                        <td>{fmtPeriod(r.period)}</td>
                        <td>{intFmt.format(r.transfers)}</td>
                        <td>{intFmt.format(r.volume)}</td>
                        <td style={{ fontWeight: 700, color: NAVY }}>
                          {r.weightedAvgPrice != null
                            ? price2Fmt.format(r.weightedAvgPrice)
                            : '—'}
                        </td>
                        <td>{money0Fmt.format(r.transferValue)}</td>
                      </tr>
                    ))
                  )}
                </Box>
              </Box>
            </BCBox>
          </BCBox>
        )
      })}

      {/* About this data */}
      <BCBox
        sx={{
          background: '#F2F7FC',
          border: '1px solid #D8E4EF',
          borderRadius: '6px',
          p: '20px 24px',
          mb: 5
        }}
      >
        <BCTypography
          sx={{ fontSize: 15.5, fontWeight: 700, color: DARK, mb: 0.5 }}
        >
          {t('publicDashboard.marketData.about.title')}
        </BCTypography>
        <BCTypography sx={{ fontSize: 14.5, color: MUTED, lineHeight: 1.55 }}>
          {t('publicDashboard.marketData.about.body')}
        </BCTypography>
      </BCBox>
    </BCBox>
  )
}

export default PublicMarketData
