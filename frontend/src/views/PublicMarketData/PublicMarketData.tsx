import { type ReactNode, useMemo, useRef, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import EnergySavingsLeafOutlinedIcon from '@mui/icons-material/EnergySavingsLeafOutlined'
import ExpandMore from '@mui/icons-material/ExpandMore'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import ReactECharts from 'echarts-for-react'
import { useTranslation } from 'react-i18next'
import * as XLSX from 'xlsx'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import {
  useCreditMarketPublicReport,
  useCreditMarketPublicOverview
} from '@/hooks/useCreditMarket'
import BCButton from '@/components/BCButton'

const NAVY = '#003366'
const LINK = '#1A5A96'
const DARK = '#313132'
const MUTED = '#565656'
const BORDER = '#D8D8D8'

type ReportKey = 'monthly' | 'quarterly' | 'annual'
type Granularity = 'month' | 'quarter' | 'year'
type TooltipParam = {
  value: number | null
  seriesName: string
  marker: string
  axisValue: string
}

type MarketReportPeriod = {
  period: string
  transfers: number
  volume: number
  weightedAvgPrice: number | null
  minPrice: number | null
  maxPrice: number | null
  transferValue: number
}

type MetricDelta = {
  current: number | null
  prior: number | null
  deltaPct: number | null
}

type MarketReportKpis = {
  labelPeriod: string | null
  transfers: MetricDelta
  volume: MetricDelta
  weightedAvgPrice: MetricDelta
}

type PublicMarketReportPayload = {
  monthly: MarketReportPeriod[]
  a1Monthly?: MarketReportPeriod[]
  quarterly: MarketReportPeriod[]
  annual: MarketReportPeriod[]
  allTime: {
    transfers: number
    volume: number
    weightedAvgPrice: number | null
    minPrice: number | null
    maxPrice: number | null
    transferValue: number
  }
  kpis: MarketReportKpis
  ytdKpis?: MarketReportKpis
  a1Kpis?: MarketReportKpis
}

type PublicOverviewPayload = {
  totalCreditsIssued?: number
}

type DetailItem = {
  label: string
  value: string
}

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
const percentFmt = new Intl.NumberFormat('en-CA', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1
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
const fmtPeriod = (p?: string | null) => {
  const m = /^(\d{4})-(\d{2})$/.exec(p || '')
  return m ? `${MONTHS[+m[2] - 1]} ${m[1]}` : p
}
const todayStamp = () => new Date().toISOString().slice(0, 10)
const reportTypeName = (key: ReportKey) =>
  ({ monthly: 'monthly', quarterly: 'quarterly', annual: 'annual' })[key]

const CardShell = ({
  children,
  dataTest,
  sx = {}
}: {
  children: ReactNode
  dataTest?: string
  sx?: Record<string, unknown>
}) => (
  <BCBox
    data-test={dataTest}
    sx={{
      border: `1px solid ${BORDER}`,
      borderRadius: '4px',
      background: '#fff',
      p: { xs: 1.5, md: 2 },
      minWidth: 0,
      ...sx
    }}
  >
    {children}
  </BCBox>
)

const MetricCard = ({
  title,
  value,
  caption,
  delta,
  dataTest
}: {
  title: string
  value: string
  caption: string
  delta?: ReactNode
  dataTest?: string
}) => (
  <CardShell dataTest={dataTest} sx={{ minHeight: 172 }}>
    <BCTypography sx={{ fontSize: 15, color: DARK, fontWeight: 700 }}>
      {title}
    </BCTypography>
    <BCTypography
      sx={{
        fontSize: { xs: 40, md: 46 },
        fontWeight: 700,
        color: '#000',
        mt: 3.5,
        lineHeight: 1,
        textAlign: 'center'
      }}
    >
      {value}
    </BCTypography>
    <BCTypography
      sx={{ fontSize: 14, color: DARK, mt: 1.5, textAlign: 'center' }}
    >
      {caption}
    </BCTypography>
    {delta && (
      <BCBox sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        {delta}
      </BCBox>
    )}
  </CardShell>
)

const DetailCard = ({
  title,
  items,
  dataTest
}: {
  title: string
  items: DetailItem[]
  dataTest?: string
}) => (
  <CardShell dataTest={dataTest} sx={{ minHeight: 172 }}>
    <BCTypography sx={{ fontSize: 15, color: DARK, fontWeight: 700, mb: 2.5 }}>
      {title}
    </BCTypography>
    <BCBox sx={{ display: 'grid', gap: 1.15 }}>
      {items.map((item) => (
        <BCBox
          key={item.label}
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: 2,
            alignItems: 'baseline'
          }}
        >
          <BCTypography sx={{ fontSize: 14.5, color: DARK }}>
            {item.label}
          </BCTypography>
          <BCTypography sx={{ fontSize: 14.5, color: '#000', fontWeight: 700 }}>
            {item.value}
          </BCTypography>
        </BCBox>
      ))}
    </BCBox>
  </CardShell>
)

const DefinitionCard = ({ title, body }: { title: string; body: string }) => (
  <CardShell sx={{ minHeight: 140 }}>
    <BCTypography sx={{ fontSize: 15, color: DARK, fontWeight: 700, mb: 2.25 }}>
      {title}
    </BCTypography>
    <BCTypography sx={{ fontSize: 14.5, color: DARK, lineHeight: 1.4 }}>
      {body}
    </BCTypography>
  </CardShell>
)

const DownloadControls = ({
  reportKey,
  title,
  onExcel,
  excelLabel
}: {
  reportKey: ReportKey
  title: string
  onExcel: () => void
  excelLabel: string
}) => (
  <BCBox
    className="no-print"
    sx={{ display: 'flex', justifyContent: 'flex-start', mt: 1.25 }}
  >
    <BCButton
      variant="contained"
      color="primary"
      size="small"
      startIcon={<DownloadOutlinedIcon className="small-icon" />}
      data-test={`download-${reportKey}-xlsx`}
      aria-label={`${title} ${excelLabel}`}
      onClick={onExcel}
      sx={{
        textTransform: 'none',
        borderRadius: '3px',
        backgroundColor: NAVY,
        '&:hover': { backgroundColor: LINK }
      }}
    >
      {excelLabel}
    </BCButton>
  </BCBox>
)

const MarketReportTable = ({
  reportKey,
  rows,
  periodHeader,
  headers,
  noDataLabel
}: {
  reportKey: ReportKey
  rows: MarketReportPeriod[]
  periodHeader: string
  headers: {
    transfers: string
    volume: string
    avgPrice: string
    transferValue: string
  }
  noDataLabel: string
}) => (
  <BCBox
    className="print-table"
    sx={{
      border: `1px solid ${BORDER}`,
      borderRadius: '4px',
      overflow: 'auto',
      maxHeight: 420
    }}
  >
    <Box
      component="table"
      sx={{
        width: '100%',
        minWidth: reportKey === 'monthly' ? 760 : 680,
        borderCollapse: 'separate',
        borderSpacing: 0,
        fontSize: 14
      }}
    >
      <Box
        component="thead"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: '#F2F2F2',
          '& th': {
            textAlign: 'right',
            p: '10px 16px',
            fontWeight: 700,
            fontSize: 13,
            color: LINK,
            borderBottom: `1px solid ${BORDER}`,
            whiteSpace: 'nowrap',
            background: '#F2F2F2'
          },
          '& th:first-of-type': {
            textAlign: 'left',
            ...(reportKey === 'monthly'
              ? {
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  boxShadow: '2px 0 0 #D8D8D8'
                }
              : {})
          }
        }}
      >
        <tr>
          <th>{periodHeader}</th>
          <th>{headers.transfers}</th>
          <th>{headers.volume}</th>
          <th>{headers.avgPrice}</th>
          <th>{headers.transferValue}</th>
        </tr>
      </Box>
      <Box
        component="tbody"
        sx={{
          '& td': {
            textAlign: 'right',
            p: '9px 16px',
            color: DARK,
            borderBottom: '1px solid #ECECEC',
            whiteSpace: 'nowrap',
            background: '#fff'
          },
          '& td:first-of-type': {
            textAlign: 'left',
            color: LINK,
            ...(reportKey === 'monthly'
              ? {
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                  boxShadow: '2px 0 0 #ECECEC'
                }
              : {})
          },
          '& tr:hover td': { background: '#F8FAFC' }
        }}
      >
        {rows.length === 0 ? (
          <tr>
            <td colSpan={5} style={{ textAlign: 'left', color: MUTED }}>
              {noDataLabel}
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
)

const ReportSection = ({
  title,
  children,
  dataTest,
  className
}: {
  title: string
  children: ReactNode
  dataTest?: string
  className?: string
}) => (
  <Accordion
    component="section"
    className={className}
    data-test={dataTest}
    defaultExpanded
    disableGutters
    sx={{
      border: `1px solid ${BORDER}`,
      borderRadius: '4px',
      background: '#fff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
      mb: 3,
      '&:before': { display: 'none' },
      '&.Mui-expanded': { m: '0 0 24px' }
    }}
  >
    <AccordionSummary
      expandIcon={<ExpandMore />}
      sx={{
        minHeight: 58,
        px: { xs: 2, md: 3 },
        '& .MuiAccordionSummary-content': { my: 1.5 }
      }}
    >
      <BCTypography
        variant="h2"
        sx={{ fontSize: 20, fontWeight: 700, color: NAVY }}
      >
        {title}
      </BCTypography>
    </AccordionSummary>
    <AccordionDetails
      sx={{ px: { xs: 2, md: 3 }, pt: 0, pb: { xs: 2, md: 3 } }}
    >
      {children}
    </AccordionDetails>
  </Accordion>
)

export const PublicMarketData = () => {
  const { t } = useTranslation()
  const { data: reportData, isLoading } = useCreditMarketPublicReport()
  const { data: overviewData } = useCreditMarketPublicOverview('year')
  const data = reportData as PublicMarketReportPayload | undefined
  const overview = overviewData as PublicOverviewPayload | undefined
  const [gran, setGran] = useState<Granularity>('quarter')
  const reportRef = useRef<HTMLDivElement | null>(null)

  const seriesKey: ReportKey = {
    month: 'monthly',
    quarter: 'quarterly',
    year: 'annual'
  }[gran] as ReportKey
  const series = data?.[seriesKey] ?? []
  const kpis = data?.kpis
  const ytdKpis = data?.ytdKpis ?? kpis
  const allTime = data?.allTime
  const a1AnnualRows = useMemo(() => {
    const byYear = new Map<
      string,
      { volume: number; transferValue: number }
    >()
    for (const row of data?.a1Monthly ?? []) {
      const year = row.period.slice(0, 4)
      const current = byYear.get(year) ?? { volume: 0, transferValue: 0 }
      current.volume += row.volume
      current.transferValue += row.transferValue
      byYear.set(year, current)
    }
    return Array.from(byYear, ([period, values]) => ({
      period,
      weightedAvgPrice: values.volume
        ? values.transferValue / values.volume
        : null
    }))
  }, [data?.a1Monthly])

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
        formatter: (params: TooltipParam[]) => {
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

  const annualAverageChartOption = useMemo(() => {
    const annualRows = a1AnnualRows
    const title = t(
      'publicDashboard.marketData.trendCharts.annualAverageTitle'
    )
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: TooltipParam[]) =>
          `${params[0]?.axisValue ?? ''}<br/>${params
            .map(
              (p) =>
                `${p.marker}${p.seriesName}: ${
                  p.value == null ? '—' : price2Fmt.format(p.value)
                }`
            )
            .join('<br/>')}`
      },
      title: { text: title, textStyle: { fontSize: 13, color: DARK } },
      grid: { left: '10%', right: '5%', top: '20%', bottom: '15%' },
      xAxis: { type: 'category', data: annualRows.map((p) => p.period) },
      yAxis: {
        type: 'value',
        name: 'CA$',
        axisLabel: { formatter: (value: number) => `CA$${value}` }
      },
      series: [
        {
          name: t('publicDashboard.marketData.trendCharts.weightedAverage'),
          type: 'line',
          smooth: false,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: '#4BA3E3' },
          lineStyle: { color: '#4BA3E3', width: 2 },
          data: annualRows.map((p) => p.weightedAvgPrice)
        }
      ]
    }
  }, [a1AnnualRows, t])

  const transferPriceChartOption = useMemo(() => {
    const annualRows = data?.annual ?? []
    const priceSeries = [
      {
        name: t('publicDashboard.marketData.trendCharts.minimumPrice'),
        color: '#9C7BC0',
        values: annualRows.map((p) => p.minPrice)
      },
      {
        name: t('publicDashboard.marketData.trendCharts.maximumPrice'),
        color: '#E99B54',
        values: annualRows.map((p) => p.maxPrice)
      },
      {
        name: t('publicDashboard.marketData.trendCharts.weightedAverage'),
        color: '#F2C94C',
        values: annualRows.map((p) => p.weightedAvgPrice)
      }
    ]
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: TooltipParam[]) =>
          `${params[0]?.axisValue ?? ''}<br/>${params
            .map(
              (p) =>
                `${p.marker}${p.seriesName}: ${
                  p.value == null ? '—' : price2Fmt.format(p.value)
                }`
            )
            .join('<br/>')}`
      },
      title: {
        text: t('publicDashboard.marketData.trendCharts.transferPriceTitle'),
        textStyle: { fontSize: 13, color: DARK }
      },
      legend: {
        data: priceSeries.map((s) => s.name),
        top: 22,
        textStyle: { fontSize: 10 }
      },
      grid: { left: '10%', right: '5%', top: '30%', bottom: '15%' },
      xAxis: {
        type: 'category',
        data: annualRows.map((p) => p.period),
        name: t('publicDashboard.marketData.trendCharts.transferDate')
      },
      yAxis: {
        type: 'value',
        name: 'CA$',
        axisLabel: { formatter: (value: number) => `CA$${value}` }
      },
      series: priceSeries.map((s) => ({
        name: s.name,
        type: 'line',
        symbol: 'circle',
        symbolSize: 5,
        connectNulls: true,
        itemStyle: { color: s.color },
        lineStyle: { color: s.color, width: 1.5 },
        data: s.values
      }))
    }
  }, [data?.annual, t])

  const tradeVolumeChartOption = useMemo(() => {
    const monthlyRows = data?.monthly ?? []
    const visibleRows = monthlyRows.slice(-36)
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: TooltipParam[]) =>
          `${params[0]?.axisValue ?? ''}<br/>${params
            .map(
              (p) =>
                `${p.marker}${p.seriesName}: ${
                  p.value == null ? '—' : intFmt.format(Math.round(p.value))
                }`
            )
            .join('<br/>')}`
      },
      title: {
        text: t('publicDashboard.marketData.trendCharts.tradeVolumeTitle'),
        textStyle: { fontSize: 13, color: DARK }
      },
      grid: { left: '10%', right: '5%', top: '20%', bottom: '18%' },
      xAxis: {
        type: 'category',
        data: visibleRows.map((p) => p.period),
        name: t('publicDashboard.marketData.trendCharts.monthYear'),
        axisLabel: { interval: 2 }
      },
      yAxis: {
        type: 'value',
        name: t('publicDashboard.marketData.trendCharts.creditVolume')
      },
      series: [
        {
          name: t('publicDashboard.marketData.trendCharts.creditVolume'),
          type: 'bar',
          itemStyle: { color: '#4BA3E3' },
          data: visibleRows.map((p) => p.volume)
        }
      ]
    }
  }, [data?.monthly, t])

  const classificationItems = [
    {
      key: 'a1',
      title: t('publicDashboard.marketData.classifications.a1.title'),
      body: t('publicDashboard.marketData.classifications.a1.body')
    },
    {
      key: 'a',
      title: t('publicDashboard.marketData.classifications.a.title'),
      body: t('publicDashboard.marketData.classifications.a.body')
    },
    {
      key: 'b',
      title: t('publicDashboard.marketData.classifications.b.title'),
      body: t('publicDashboard.marketData.classifications.b.body')
    },
    {
      key: 'c',
      title: t('publicDashboard.marketData.classifications.c.title'),
      body: t('publicDashboard.marketData.classifications.c.body')
    }
  ]

  const tableHeaders = [
    t('publicDashboard.marketData.tables.period'),
    t('publicDashboard.marketData.tables.transfers'),
    t('publicDashboard.marketData.tables.volume'),
    t('publicDashboard.marketData.tables.avgPrice'),
    t('publicDashboard.marketData.tables.transferValue')
  ]
  const periodHeaderFor = (key: ReportKey) =>
    key === 'monthly'
      ? t('publicDashboard.marketData.tables.month')
      : t('publicDashboard.marketData.tables.period')
  const tableColumnLabels = {
    transfers: t('publicDashboard.marketData.tables.transfers'),
    volume: t('publicDashboard.marketData.tables.volume'),
    avgPrice: t('publicDashboard.marketData.tables.avgPrice'),
    transferValue: t('publicDashboard.marketData.tables.transferValue')
  }

  const displayRows = (rows: MarketReportPeriod[]) => [...rows].reverse()

  const tableExportRows = (key: ReportKey, rows: MarketReportPeriod[]) =>
    displayRows(rows).map((r) => ({
      [periodHeaderFor(key)]: fmtPeriod(r.period),
      [tableHeaders[1]]: r.transfers,
      [tableHeaders[2]]: r.volume,
      [tableHeaders[3]]:
        r.weightedAvgPrice != null ? Number(r.weightedAvgPrice.toFixed(2)) : '',
      [tableHeaders[4]]:
        r.transferValue != null ? Number(r.transferValue.toFixed(2)) : ''
    }))

  const fileNameFor = (key: ReportKey, format: 'xlsx') =>
    `lcfs-credit-market-${reportTypeName(key)}-report-${todayStamp()}.${format}`

  const downloadExcel = (key: ReportKey, rows: MarketReportPeriod[]) => {
    const worksheet = XLSX.utils.json_to_sheet(tableExportRows(key, rows))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      `${reportTypeName(key)} report`.slice(0, 31)
    )
    XLSX.writeFile(workbook, fileNameFor(key, 'xlsx'), { bookType: 'xlsx' })
  }

  const downloadPdf = () => {
    window.print()
  }

  const reportTables = [
    {
      key: 'monthly' as ReportKey,
      title: t('publicDashboard.marketData.tables.monthly')
    },
    {
      key: 'quarterly' as ReportKey,
      title: t('publicDashboard.marketData.tables.quarterly')
    },
    {
      key: 'annual' as ReportKey,
      title: t('publicDashboard.marketData.tables.annual')
    }
  ]

  const latestMonthLabel = kpis?.labelPeriod ? fmtPeriod(kpis.labelPeriod) : '—'
  const monthlyRows = data?.monthly ?? []
  const a1MonthlyRows = data?.a1Monthly ?? []
  const latestMonthlyRow = monthlyRows[monthlyRows.length - 1]
  const latestA1MonthlyRow = a1MonthlyRows[a1MonthlyRows.length - 1]
  const allTransfersDetails: DetailItem[] = [
    {
      label: t('publicDashboard.marketData.tables.month'),
      value: latestMonthlyRow ? fmtPeriod(latestMonthlyRow.period) || '—' : '—'
    },
    {
      label: t('publicDashboard.marketData.kpi.transfers'),
      value:
        latestMonthlyRow?.transfers != null
          ? intFmt.format(latestMonthlyRow.transfers)
          : '—'
    },
    {
      label: t('publicDashboard.marketData.tables.volume'),
      value:
        latestMonthlyRow?.volume != null
          ? intFmt.format(latestMonthlyRow.volume)
          : '—'
    },
    {
      label: t('publicDashboard.marketData.tables.minPrice'),
      value:
        latestMonthlyRow?.minPrice != null
          ? price2Fmt.format(latestMonthlyRow.minPrice)
          : '—'
    },
    {
      label: t('publicDashboard.marketData.tables.maxPrice'),
      value:
        latestMonthlyRow?.maxPrice != null
          ? price2Fmt.format(latestMonthlyRow.maxPrice)
          : '—'
    }
  ]
  const a1Details: DetailItem[] = [
    {
      label: t('publicDashboard.marketData.tables.month'),
      value: latestA1MonthlyRow
        ? fmtPeriod(latestA1MonthlyRow.period) || '—'
        : '—'
    },
    {
      label: t('publicDashboard.marketData.kpi.transfers'),
      value:
        latestA1MonthlyRow?.transfers != null
          ? intFmt.format(latestA1MonthlyRow.transfers)
          : '—'
    },
    {
      label: t('publicDashboard.marketData.tables.volume'),
      value:
        latestA1MonthlyRow?.volume != null
          ? intFmt.format(latestA1MonthlyRow.volume)
          : '—'
    },
    {
      label: t('publicDashboard.marketData.tables.minPrice'),
      value:
        latestA1MonthlyRow?.minPrice != null
          ? price2Fmt.format(latestA1MonthlyRow.minPrice)
          : '—'
    },
    {
      label: t('publicDashboard.marketData.tables.maxPrice'),
      value:
        latestA1MonthlyRow?.maxPrice != null
          ? price2Fmt.format(latestA1MonthlyRow.maxPrice)
          : '—'
    }
  ]
  const a1PriceDelta =
    data?.a1Kpis?.weightedAvgPrice.deltaPct != null ? (
      <BCTypography
        sx={{
          fontSize: 14,
          color:
            data.a1Kpis.weightedAvgPrice.deltaPct < 0 ? '#A12622' : '#2E7D32'
        }}
      >
        {data.a1Kpis.weightedAvgPrice.deltaPct < 0 ? '▾' : '▲'}{' '}
        {percentFmt.format(Math.abs(data.a1Kpis.weightedAvgPrice.deltaPct))}%{' '}
        {t('publicDashboard.marketData.vsPreviousMonth', {
          price:
            data.a1Kpis.weightedAvgPrice.prior != null
              ? price2Fmt.format(data.a1Kpis.weightedAvgPrice.prior)
              : '—'
        })}
      </BCTypography>
    ) : null

  if (isLoading) {
    return (
      <BCBox display="flex" justifyContent="center" sx={{ py: 8 }}>
        <CircularProgress />
      </BCBox>
    )
  }

  return (
    <BCBox
      ref={reportRef}
      sx={{
        maxWidth: 1380,
        mx: 'auto',
        px: 0,
        py: { xs: 1, md: 2 },
        '@media print': {
          maxWidth: 'none',
          px: 0,
          py: 0,
          '& .no-print': { display: 'none !important' },
          '& section': {
            breakInside: 'avoid',
            boxShadow: 'none',
            borderColor: '#BDBDBD'
          },
          '& .print-expand .MuiCollapse-root': {
            height: 'auto !important',
            visibility: 'visible !important'
          },
          '& .print-expand .MuiCollapse-wrapper': {
            display: 'block !important'
          },
          '& .print-table': {
            maxHeight: 'none !important',
            overflow: 'visible !important'
          }
        }
      }}
    >
      <BCBox
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', md: 'flex-end' },
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          mb: 3
        }}
      >
        <BCBox sx={{ maxWidth: 760 }}>
          <BCTypography
            variant="h1"
            sx={{ fontSize: 32, fontWeight: 700, color: NAVY, mb: 0.75 }}
          >
            {t('publicDashboard.marketData.title')}
          </BCTypography>
          <BCTypography sx={{ fontSize: 18, color: '#000', lineHeight: 1.65 }}>
            {t('publicDashboard.marketData.subtitle')}
          </BCTypography>
        </BCBox>
        <BCBox
          className="no-print"
          sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}
        >
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
            onClick={downloadPdf}
            data-test="download-pdf"
            startIcon={<PictureAsPdfOutlinedIcon sx={{ fontSize: 18 }} />}
            sx={{
              backgroundColor: '#fff',
              color: NAVY,
              fontWeight: 700,
              fontSize: 14,
              textTransform: 'none',
              px: 2.5,
              py: 1.1,
              borderRadius: '4px',
              border: `1px solid ${NAVY}`,
              '&:hover': { backgroundColor: '#F2F7FC' }
            }}
          >
            {t('publicDashboard.marketData.downloadPdf')}
          </Button>
        </BCBox>
      </BCBox>
      <BCBox sx={{ height: 10, background: NAVY, mb: 2 }} />

      <ReportSection
        title={t('publicDashboard.marketData.sections.currentSnapshot')}
      >
        <BCBox
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(4, minmax(0, 1fr))'
            },
            gap: 1.5
          }}
        >
          <MetricCard
            dataTest="average-price-all"
            title={t('publicDashboard.marketData.snapshot.avgAll')}
            value={
              kpis?.weightedAvgPrice?.current != null
                ? price2Fmt.format(kpis.weightedAvgPrice.current)
                : '—'
            }
            caption={latestMonthLabel || '—'}
          />
          <MetricCard
            dataTest="average-price-a1"
            title={t('publicDashboard.marketData.snapshot.avgA1')}
            value={
              data?.a1Kpis?.weightedAvgPrice?.current != null
                ? price2Fmt.format(data.a1Kpis.weightedAvgPrice.current)
                : '—'
            }
            caption={
              data?.a1Kpis?.labelPeriod
                ? fmtPeriod(data.a1Kpis.labelPeriod) || '—'
                : t('publicDashboard.marketData.snapshot.a1Unavailable')
            }
            delta={a1PriceDelta}
          />
          <DetailCard
            title={t('publicDashboard.marketData.snapshot.allDetails')}
            items={allTransfersDetails}
          />
          <DetailCard
            title={t('publicDashboard.marketData.snapshot.a1Details')}
            items={a1Details}
          />
        </BCBox>
      </ReportSection>

      <ReportSection
        title={t('publicDashboard.marketData.sections.transferClassifications')}
      >
        <BCBox
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(4, minmax(0, 1fr))'
            },
            gap: 1.5
          }}
        >
          {classificationItems.map((item) => (
            <DefinitionCard
              key={item.key}
              title={item.title}
              body={item.body}
            />
          ))}
        </BCBox>
      </ReportSection>

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
                cars: compactFmt.format(carsEquivalent ?? 0)
              })}
            </BCTypography>
          </BCBox>
        </BCBox>
      )}

      <ReportSection
        title={t('publicDashboard.marketData.sections.activityAndStatistics')}
      >
        <BCBox
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1.1fr 0.9fr' },
            gap: 3,
            alignItems: 'start'
          }}
        >
          <BCBox>
            <BCTypography
              variant="h3"
              sx={{ fontSize: 18, fontWeight: 700, color: NAVY, mb: 2 }}
            >
              {t('publicDashboard.marketData.sections.yearToDateActivity')}
            </BCTypography>
            <BCBox
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(2, minmax(0, 1fr))'
                },
                gap: 2
              }}
            >
              <DetailCard
                dataTest="kpi-transfers"
                title={t('publicDashboard.marketData.ytd.transferCount')}
                items={[
                  {
                    label: t('publicDashboard.marketData.ytd.currentTransfers'),
                    value:
                      ytdKpis?.transfers.current != null
                        ? intFmt.format(ytdKpis.transfers.current)
                        : '—'
                  },
                  {
                    label: t(
                      'publicDashboard.marketData.ytd.previousTransfers'
                    ),
                    value:
                      ytdKpis?.transfers.prior != null
                        ? intFmt.format(ytdKpis.transfers.prior)
                        : '—'
                  },
                  {
                    label: t('publicDashboard.marketData.ytd.percentageChange'),
                    value:
                      ytdKpis?.transfers.deltaPct != null
                        ? `${percentFmt.format(ytdKpis.transfers.deltaPct)}%`
                        : '—'
                  }
                ]}
              />
              <DetailCard
                dataTest="kpi-volume"
                title={t('publicDashboard.marketData.ytd.transferVolume')}
                items={[
                  {
                    label: t('publicDashboard.marketData.ytd.currentVolume'),
                    value:
                      ytdKpis?.volume.current != null
                        ? intFmt.format(ytdKpis.volume.current)
                        : '—'
                  },
                  {
                    label: t('publicDashboard.marketData.ytd.previousVolume'),
                    value:
                      ytdKpis?.volume.prior != null
                        ? intFmt.format(ytdKpis.volume.prior)
                        : '—'
                  },
                  {
                    label: t('publicDashboard.marketData.ytd.percentageChange'),
                    value:
                      ytdKpis?.volume.deltaPct != null
                        ? `${percentFmt.format(ytdKpis.volume.deltaPct)}%`
                        : '—'
                  }
                ]}
              />
            </BCBox>
          </BCBox>
          <BCBox>
            <BCTypography
              variant="h3"
              sx={{ fontSize: 18, fontWeight: 700, color: NAVY, mb: 2 }}
            >
              {t('publicDashboard.marketData.sections.cumulativeMarketStats')}
            </BCTypography>
            <DetailCard
              title={t('publicDashboard.marketData.allTimeTitle')}
              items={[
                {
                  label: t('publicDashboard.marketData.allTime.transfers'),
                  value: allTime ? intFmt.format(allTime.transfers) : '—'
                },
                {
                  label: t('publicDashboard.marketData.allTime.volume'),
                  value: allTime ? intFmt.format(allTime.volume) : '—'
                },
                {
                  label: t('publicDashboard.marketData.allTime.minPrice'),
                  value:
                    allTime?.minPrice != null
                      ? price2Fmt.format(allTime.minPrice)
                      : '—'
                },
                {
                  label: t('publicDashboard.marketData.allTime.maxPrice'),
                  value:
                    allTime?.maxPrice != null
                      ? price2Fmt.format(allTime.maxPrice)
                      : '—'
                },
                {
                  label: t('publicDashboard.marketData.allTime.avgPrice'),
                  value:
                    allTime?.weightedAvgPrice != null
                      ? price2Fmt.format(allTime.weightedAvgPrice)
                      : '—'
                },
                {
                  label: t('publicDashboard.marketData.allTime.transferValue'),
                  value: allTime ? money0Fmt.format(allTime.transferValue) : '—'
                }
              ]}
            />
          </BCBox>
        </BCBox>
      </ReportSection>

      <ReportSection
        title={t(
          'publicDashboard.marketData.sections.marketTrendsHistoricalPerformance'
        )}
      >
        <BCBox
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.5,
            mb: 3
          }}
        >
          <CardShell dataTest="annual-average-price-chart">
            <ReactECharts
              option={annualAverageChartOption}
              style={{ height: 250 }}
            />
          </CardShell>
          <CardShell dataTest="transfer-price-trend-chart">
            <ReactECharts
              option={transferPriceChartOption}
              style={{ height: 250 }}
            />
          </CardShell>
          <CardShell
            dataTest="trade-volume-chart"
            sx={{ gridColumn: { md: '1 / -1' } }}
          >
            <ReactECharts
              option={tradeVolumeChartOption}
              style={{ height: 250 }}
            />
          </CardShell>
        </BCBox>
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
              variant="h3"
              sx={{ fontSize: 20, fontWeight: 700, color: DARK }}
            >
              {t('publicDashboard.marketData.chartTitle')}
            </BCTypography>
            <BCTypography sx={{ fontSize: 13.5, color: MUTED }}>
              {t('publicDashboard.marketData.chartSubtitle')}
            </BCTypography>
          </BCBox>
          <ToggleButtonGroup
            className="no-print"
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
      </ReportSection>

      <ReportSection
        title={t('publicDashboard.marketData.sections.detailedReports')}
      >
        {reportTables.map((tbl) => {
          const rows = data?.[tbl.key] ?? []
          return (
            <BCBox key={tbl.key} sx={{ mb: 4 }}>
              <BCBox
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                  flexWrap: 'wrap',
                  mb: 1.5
                }}
              >
                <BCTypography
                  variant="h3"
                  sx={{ fontSize: 20, fontWeight: 700, color: DARK }}
                >
                  {tbl.title}
                </BCTypography>
              </BCBox>
              <MarketReportTable
                reportKey={tbl.key}
                rows={rows}
                periodHeader={periodHeaderFor(tbl.key)}
                headers={tableColumnLabels}
                noDataLabel={t('publicDashboard.marketData.tables.noData')}
              />
              <DownloadControls
                reportKey={tbl.key}
                title={tbl.title}
                excelLabel={t('publicDashboard.marketData.downloadExcel')}
                onExcel={() => downloadExcel(tbl.key, rows)}
              />
            </BCBox>
          )
        })}
      </ReportSection>
    </BCBox>
  )
}

export default PublicMarketData
