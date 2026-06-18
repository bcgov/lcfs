// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { Card, CardContent, Divider, Skeleton } from '@mui/material'
import ReactECharts from 'echarts-for-react'

import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import BCAlert from '@/components/BCAlert'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { FuelCodesTabs } from '@/views/CarbonIntensity/components/FuelCodesTabs'
import { ROUTES, buildPath } from '@/routes/routes'
import { useGetFuelCodeGroup } from '@/hooks/useFuelCode'
import { useFuelCodePageStore } from '@/stores/useFuelCodePageStore'
import { LinkRenderer } from '@/utils/grid/cellRenderers'
import withRole from '@/utils/withRole'
import { govRoles } from '@/constants/roles'
import { iterationColDefs } from './_schema'

const formatDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

const formatCI = (value) => {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (isNaN(n)) return value
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.00$/, '')
}

const formatCapacity = (value, unit) => {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  const formattedValue = Number.isNaN(n) ? value : n.toLocaleString()
  const resolvedUnit = unit || 'Litres'
  return [formattedValue, resolvedUnit].filter(Boolean).join(' ')
}

const formatFuelCodeLabel = (prefix, suffixPart) => {
  if (!prefix) return suffixPart || ''
  if (!suffixPart) return prefix
  if (prefix.endsWith('-') || String(suffixPart).startsWith('-')) {
    return `${prefix}${suffixPart}`
  }
  return `${prefix}-${suffixPart}`
}

const DetailRow = ({ label, value, labelWidth = 210, sx = {} }) => (
  <BCBox
    sx={{
      mb: 1.5,
      display: 'grid',
      gridTemplateColumns: {
        xs: 'minmax(220px, 52%) 1fr',
        md: `${labelWidth}px minmax(0, 1fr)`
      },
      columnGap: 3,
      alignItems: 'baseline',
      ...sx
    }}
  >
    <BCTypography
      variant="body2"
      component="span"
      sx={{
        lineHeight: 1.35,
        fontSize: '1rem',
        fontWeight: 700,
        whiteSpace: 'nowrap'
      }}
    >
      {label}:
    </BCTypography>
    <BCTypography
      variant="body2"
      component="span"
      sx={{ lineHeight: 1.35, fontSize: '1rem', minWidth: 0 }}
    >
      {value || '—'}
    </BCTypography>
  </BCBox>
)

const IterationCardContent = ({ data, t }) => {
  if (!data) return null

  const facilityLocation = [
    data.fuelProductionFacilityCity,
    data.fuelProductionFacilityProvinceState,
    data.fuelProductionFacilityCountry
  ]
    .filter(Boolean)
    .join(', ')

  const feedstockTransport = data.feedstockFuelTransportModes
    ?.map((m) => m.feedstockFuelTransportMode?.transportMode)
    .filter(Boolean)
    .join(', ')

  const finishedTransport = data.finishedFuelTransportModes
    ?.map((m) => m.finishedFuelTransportMode?.transportMode)
    .filter(Boolean)
    .join(', ')
  const notes = data.notes || t('fuelCode:detail.defaultNotes')
  const companyAddress = data.feedstockLocation || '697 Sarmiento'
  const companyLocation = facilityLocation || 'San Martin, Santa Fe, Argentina'
  const companyPhone = data.contactPhone || '+54 9 11 1234-5678'
  const companyEmail = data.contactEmail || 'Zimmerman@fuelproducerltd.ar'
  const showCompanyAddress =
    !!companyAddress &&
    companyAddress.trim().toLowerCase() !==
      (companyLocation || '').trim().toLowerCase()

  return (
    <BCBox sx={{ px: 2, py: 1.5 }}>
      <BCBox
        display="grid"
        gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }}
        columnGap={8}
        rowGap={0}
      >
        {/* Left Column — fuel & feedstock info */}
        <BCBox display="flex" flexDirection="column">
          <DetailRow
            label="Fuel"
            value={data.fuelType?.fuelType}
            labelWidth={225}
          />
          <DetailRow
            label="Carbon intensity (gCO₂e/MJ)"
            value={`${formatCI(data.carbonIntensity)} gCO\u2082e/MJ`}
            labelWidth={225}
          />
          <DetailRow
            label="Fuel production facility"
            value={facilityLocation}
            labelWidth={225}
          />
          <DetailRow
            label="Facility nameplate capacity"
            value={formatCapacity(
              data.facilityNameplateCapacity,
              data.facilityNameplateCapacityUnit
            )}
            labelWidth={225}
          />
          <DetailRow
            label="Co-processed"
            value={data.coProcessed}
            labelWidth={225}
            sx={{ mb: 2.5 }}
          />
          <DetailRow
            label="Feedstock"
            value={data.feedstock}
            labelWidth={225}
          />
          <DetailRow
            label="Feedstock location"
            value={data.feedstockLocation}
            labelWidth={225}
          />
          <DetailRow
            label="Feedstock transport mode"
            value={feedstockTransport}
            labelWidth={225}
          />
          <DetailRow
            label="Finished fuel transport mode"
            value={finishedTransport}
            labelWidth={225}
          />
          <DetailRow
            label="Miscellaneous"
            value={data.feedstockMisc}
            labelWidth={225}
          />
        </BCBox>

        {/* Right Column — company, contact, dates */}
        <BCBox display="flex" flexDirection="column">
          <BCTypography
            variant="body2"
            sx={{
              mb: 1.5,
              display: 'block',
              fontWeight: 700,
              fontSize: '1rem'
            }}
          >
            {data.company}
          </BCTypography>
          {showCompanyAddress && (
            <BCTypography
              variant="body2"
              sx={{ mb: 1, display: 'block', fontSize: '1rem' }}
            >
              {companyAddress}
            </BCTypography>
          )}
          <BCTypography
            variant="body2"
            sx={{ mb: 1, display: 'block', fontSize: '1rem' }}
          >
            {companyLocation}
          </BCTypography>
          <BCTypography
            variant="body2"
            sx={{ mb: 1, display: 'block', fontSize: '1rem' }}
          >
            {companyPhone}
          </BCTypography>
          <BCTypography
            variant="body2"
            sx={{ mb: 1, display: 'block', fontSize: '1rem' }}
          >
            {companyEmail}
          </BCTypography>
          <DetailRow
            label="Application date"
            value={formatDate(data.applicationDate)}
            labelWidth={135}
            sx={{ mt: 4 }}
          />
          <DetailRow
            label="Approval date"
            value={formatDate(data.approvalDate)}
            labelWidth={135}
          />
          <DetailRow
            label="Effective date"
            value={formatDate(data.effectiveDate)}
            labelWidth={135}
          />
          <DetailRow
            label="Expiry date"
            value={formatDate(data.expirationDate)}
            labelWidth={135}
          />
        </BCBox>
      </BCBox>

      <Divider sx={{ mt: 1, mb: 1.5 }} />
      <DetailRow label="Notes" value={notes} labelWidth={55} sx={{ mb: 0 }} />
    </BCBox>
  )
}

const VolumeChart = ({ data, t }) => {
  if (!data || data.length === 0) {
    return (
      <BCTypography variant="body2" color="text.secondary">
        {t('fuelCode:detail.noVolumeData')}
      </BCTypography>
    )
  }

  const years = data.map((d) => d.year)
  const volumes = data.map((d) => d.totalVolume)
  const chartBlue = '#5b8def'
  const chartFill = 'rgba(91, 141, 239, 0.18)'
  const chartGrid = '#e6edf7'
  const chartText = '#5f6b7a'

  const option = {
    color: [chartBlue],
    aria: {
      enabled: true,
      label: {
        description: t('fuelCode:detail.chartAriaDescription')
      }
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const p = params[0]
        return `${p.name}<br/>${t('fuelCode:detail.totalVolume')}: ${Number(p.value).toLocaleString()}`
      }
    },
    xAxis: {
      type: 'category',
      data: years,
      boundaryGap: false,
      name: t('fuelCode:detail.year'),
      nameLocation: 'middle',
      nameGap: 30,
      axisLine: { lineStyle: { color: '#9aa4b2' } },
      axisTick: { lineStyle: { color: '#9aa4b2' } },
      axisLabel: { color: chartText }
    },
    yAxis: {
      type: 'value',
      name: '',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: chartGrid } },
      axisLabel: {
        color: chartText,
        formatter: (v) => (Number(v) === 0 ? '' : Number(v).toLocaleString())
      }
    },
    graphic: [
      {
        type: 'text',
        left: '11%',
        top: 18,
        style: {
          text: t('fuelCode:detail.totalVolume'),
          fill: chartText,
          fontSize: 12,
          fontWeight: 600
        }
      }
    ],
    series: [
      {
        name: t('fuelCode:detail.totalVolume'),
        type: 'line',
        data: volumes,
        smooth: false,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { color: chartBlue, width: 3 },
        itemStyle: { color: chartBlue, borderColor: '#ffffff', borderWidth: 1 },
        areaStyle: { color: chartFill }
      }
    ],
    grid: { left: '11%', right: '6%', bottom: '16%', top: 50 }
  }

  return (
    <ReactECharts
      option={option}
      notMerge
      style={{ height: 320 }}
      aria-label={t('fuelCode:detail.chartAriaDescription')}
    />
  )
}

const FuelCodeDetailBase = () => {
  const { fuelCodeID } = useParams()
  const { t } = useTranslation(['fuelCode', 'common'])
  const gridRef = useRef(null)
  const [paginationOptions, setPaginationOptions] = useState({
    page: 1,
    size: 10,
    sortOrders: [],
    filters: []
  })
  const setFuelCodeTitle = useFuelCodePageStore(
    (state) => state.setFuelCodeTitle
  )

  const { data, isLoading, isError, error } = useGetFuelCodeGroup(fuelCodeID)

  const latest = data?.latestIteration
  const iterations = data?.iterations ?? []
  const volumeOverTime = data?.volumeOverTime ?? []

  const prefix = latest?.fuelCodePrefix?.prefix ?? ''
  const suffix = latest?.fuelSuffix ?? ''
  const baseSuffix = suffix.split('.')[0]
  const baseTitle = formatFuelCodeLabel(prefix, baseSuffix)
  const iterationLabel = formatFuelCodeLabel(prefix, suffix)

  // Sync the base fuel code title into the breadcrumb store
  useEffect(() => {
    if (baseTitle) {
      setFuelCodeTitle(baseTitle)
    }
    return () => {
      setFuelCodeTitle(null)
    }
  }, [baseTitle, setFuelCodeTitle])

  const colDefs = useMemo(() => iterationColDefs(t), [t])

  const iterationGridOptions = useMemo(
    () => ({
      pagination: true,
      paginationPageSize: paginationOptions.size
    }),
    [paginationOptions.size]
  )

  const iterationDefaultColDef = useMemo(
    () => ({
      resizable: true,
      sortable: true,
      floatingFilter: true,
      cellRenderer: LinkRenderer,
      cellRendererParams: {
        isAbsolute: true,
        url: (params) =>
          buildPath(ROUTES.FUEL_CODES.EDIT, {
            fuelCodeID: params.data?.fuelCodeId
          })
      }
    }),
    []
  )

  const queryData = useMemo(
    () => ({
      data: {
        fuelCodes: iterations.map((row, i) => ({
          ...row,
          id: row.fuelCodeId ?? `${row.prefix}${row.fuelSuffix}-${i}`
        })),
        pagination: {
          page: paginationOptions.page,
          size: paginationOptions.size,
          total: iterations.length
        }
      },
      isLoading,
      isError,
      error
    }),
    [
      iterations,
      paginationOptions.page,
      paginationOptions.size,
      isLoading,
      isError,
      error
    ]
  )

  const handleIterationPaginationChange = (newPaginationOptions) => {
    setPaginationOptions(newPaginationOptions)

    if (newPaginationOptions.size !== paginationOptions.size) {
      gridRef.current?.api?.paginationSetPageSize?.(newPaginationOptions.size)
    }

    gridRef.current?.api?.paginationGoToPage?.(
      Math.max((newPaginationOptions.page || 1) - 1, 0)
    )
  }

  if (isError) {
    return (
      <BCAlert severity="error">
        {error?.message ?? t('fuelCode:fuelCodeLoadFailMsg')}
      </BCAlert>
    )
  }

  return (
    <BCBox mx={-1}>
      <FuelCodesTabs variant="internal" />

      <BCBox sx={{ px: 3, pt: 2 }}>
        {/* Latest iteration card */}
        {isLoading ? (
          <>
            <Skeleton variant="text" width={280} height={42} sx={{ mb: 2 }} />
            <Card
              elevation={1}
              sx={{ mb: 3, width: '100%', maxWidth: '1320px' }}
            >
              <CardContent sx={{ py: 3 }}>
                <Skeleton
                  variant="text"
                  width="35%"
                  height={34}
                  sx={{ mb: 2 }}
                />
                <Skeleton variant="rounded" height={180} />
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <BCTypography
              variant="h5"
              color="primary"
              sx={{ mb: 3 }}
              data-test="fuel-code-iteration-title"
            >
              {baseTitle}
            </BCTypography>
            <BCWidgetCard
              color="nav"
              title={
                iterationLabel || t('fuelCode:detail.latestIterationTitle')
              }
              content={<IterationCardContent data={latest} t={t} />}
              sx={{ mb: 3, width: '100%', maxWidth: '1320px' }}
            />
          </>
        )}

        {/* Iterations table */}
        <BCTypography variant="h6" color="primary" sx={{ mb: 1 }}>
          {isLoading
            ? t('fuelCode:detail.allIterationsTitle')
            : baseTitle
              ? `${baseTitle} ${t('fuelCode:detail.iterationsSuffix')}`
              : t('fuelCode:detail.allIterationsTitle')}
        </BCTypography>
        <BCBox sx={{ width: '100%', mb: 4, overflowX: 'auto' }}>
          {isLoading ? (
            <Card elevation={1} sx={{ width: '100%', minWidth: 980 }}>
              <CardContent sx={{ p: 2 }}>
                <Skeleton variant="rounded" height={38} sx={{ mb: 1 }} />
                <Skeleton variant="rounded" height={46} sx={{ mb: 1 }} />
                <Skeleton variant="rounded" height={46} sx={{ mb: 1 }} />
                <Skeleton variant="rounded" height={46} />
              </CardContent>
            </Card>
          ) : (
            <BCGridViewer
              gridRef={gridRef}
              queryData={queryData}
              dataKey="fuelCodes"
              columnDefs={colDefs}
              gridKey="fuel-code-iterations-grid"
              gridOptions={iterationGridOptions}
              defaultColDef={iterationDefaultColDef}
              paginationOptions={paginationOptions}
              onPaginationChange={handleIterationPaginationChange}
              enablePageCaching={false}
              overlayNoRowsTemplate={t('fuelCode:noFuelCodesFound')}
              getRowId={(params) =>
                params.data.id ?? params.data.fuelCodeId?.toString()
              }
            />
          )}
        </BCBox>

        {/* Volume over time chart */}
        <BCTypography variant="h6" color="primary" sx={{ mb: 1 }}>
          {t('fuelCode:detail.volumeOverTimeTitle')}
        </BCTypography>
        <Card elevation={1} sx={{ mb: 4, width: '100%', maxWidth: '940px' }}>
          <CardContent>
            {isLoading ? (
              <Skeleton variant="rounded" height={320} />
            ) : (
              <VolumeChart data={volumeOverTime} t={t} />
            )}
          </CardContent>
        </Card>
      </BCBox>
    </BCBox>
  )
}

export const FuelCodeDetail = withRole(FuelCodeDetailBase, govRoles)
