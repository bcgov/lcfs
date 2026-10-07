import React, { useCallback, useId, useMemo, useState } from 'react'
import {
  Card,
  CardContent,
  Collapse,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material'
import ReactECharts from 'echarts-for-react'
import { useTranslation } from 'react-i18next'

import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import {
  BC_CHART_AXIS_LABEL,
  BC_CHART_CATEGORY_AXIS_LABEL,
  BC_CHART_COLORS,
  BC_CHART_GRID
} from '@/components/charts/chartStyles'

import {
  abbreviateNumber,
  formatCompactAxisNumber,
  formatPlainNumber
} from './_supplyHistoryFormatters'

const STRIPE_COLOR = 'rgba(255, 255, 255, 0.35)'

// Fixed colour and pattern per category, so hiding one never repaints the
// others and colour is never the only cue. Blue/orange/magenta keep their
// separation under the common colour-vision deficiencies.
export const FUEL_CATEGORIES = [
  { name: 'Gasoline', color: BC_CHART_COLORS.blue, stripeAngle: null },
  { name: 'Diesel', color: BC_CHART_COLORS.orange, stripeAngle: 45 },
  { name: 'Jet fuel', color: BC_CHART_COLORS.magenta, stripeAngle: -45 }
]

// Quantities within a category mix litres, kg, kWh and m³, so energy is the
// default measure; volume only counts litre-denominated rows.
const MEASURES = {
  energy: {
    field: 'totalEnergy',
    labelKey: 'measureEnergy',
    unit: 'MJ',
    decimals: 0,
    showShare: true
  },
  litres: {
    field: 'totalLitres',
    labelKey: 'measureLitres',
    unit: 'L',
    decimals: 0,
    showShare: true
  },
  complianceUnits: {
    field: 'totalComplianceUnits',
    labelKey: 'measureComplianceUnits',
    unit: '',
    decimals: 2,
    // A share of a net (credit minus debit) total is not meaningful.
    showShare: false
  }
}

const toDecal = (stripeAngle) =>
  stripeAngle === null
    ? undefined
    : {
        symbol: 'rect',
        symbolSize: 1,
        dashArrayX: [1, 0],
        dashArrayY: [2, 6],
        rotation: (-stripeAngle * Math.PI) / 180,
        color: STRIPE_COLOR
      }

const toSwatchBackground = ({ color, stripeAngle }) =>
  stripeAngle === null
    ? color
    : `repeating-linear-gradient(${stripeAngle + 90}deg, ${STRIPE_COLOR} 0 2px, transparent 2px 8px), ${color}`

// MUI only marks keyboard focus with a faint ripple; give it a visible ring.
const focusVisibleSx = {
  '&.Mui-focusVisible': {
    outline: '2px solid',
    outlineColor: 'primary.main',
    outlineOffset: 2,
    zIndex: 1
  }
}

const formatShare = (share) =>
  share === null ? '' : `${Number(share.toFixed(1))}%`

const CategorySwatch = ({ category, muted = false }) => (
  <BCBox
    component="span"
    aria-hidden="true"
    sx={{
      display: 'inline-block',
      width: 14,
      height: 14,
      borderRadius: '3px',
      flexShrink: 0,
      background: toSwatchBackground(category),
      opacity: muted ? 0.35 : 1
    }}
  />
)

export const FuelCategoryBreakdown = ({ rows = [] }) => {
  const { t } = useTranslation(['org'])
  const tableId = useId()
  const categoriesHelpId = useId()
  const [measureKey, setMeasureKey] = useState('energy')
  const [visibleCategories, setVisibleCategories] = useState(() =>
    FUEL_CATEGORIES.map((category) => category.name)
  )
  const [showTable, setShowTable] = useState(false)

  const measure = MEASURES[measureKey]
  const measureLabel = t(`org:supplyHistory.analytics.${measure.labelKey}`)

  const data = useMemo(() => {
    const years = Array.from(
      new Set(rows.map((row) => row.reportingYear))
    ).sort()
    const valuesByYear = {}
    rows.forEach((row) => {
      valuesByYear[row.reportingYear] ||= {}
      valuesByYear[row.reportingYear][row.fuelCategory] =
        Number(row[measure.field]) || 0
    })
    const valueFor = (year, categoryName) =>
      valuesByYear[year]?.[categoryName] ?? 0
    const yearTotals = Object.fromEntries(
      years.map((year) => [
        year,
        FUEL_CATEGORIES.reduce(
          (sum, category) => sum + valueFor(year, category.name),
          0
        )
      ])
    )
    const categoryTotals = Object.fromEntries(
      FUEL_CATEGORIES.map((category) => [
        category.name,
        years.reduce((sum, year) => sum + valueFor(year, category.name), 0)
      ])
    )
    const grandTotal = Object.values(categoryTotals).reduce(
      (sum, value) => sum + value,
      0
    )
    const shareOf = (value, total) =>
      measure.showShare && total > 0 ? (value / total) * 100 : null

    return {
      years,
      valueFor,
      yearTotals,
      categoryTotals,
      grandTotal,
      shareOf
    }
  }, [rows, measure])

  const formatCompactValue = useCallback(
    (value) => abbreviateNumber(value, { unitLabel: measure.unit }),
    [measure.unit]
  )

  const ariaDescription = useMemo(() => {
    const totals = FUEL_CATEGORIES.map((category) => {
      const value = data.categoryTotals[category.name]
      const share = data.shareOf(value, data.grandTotal)
      return `${category.name}: ${formatCompactValue(value)}${
        share === null ? '' : ` (${formatShare(share)})`
      }`
    }).join('; ')
    return t('org:supplyHistory.analytics.categoryBreakdownAria', {
      measure: measureLabel,
      firstYear: data.years[0],
      lastYear: data.years[data.years.length - 1],
      totals
    })
  }, [data, formatCompactValue, measureLabel, t])

  const chartOption = useMemo(
    () => ({
      aria: {
        enabled: true,
        label: { description: ariaDescription }
      },
      tooltip: {
        trigger: 'axis',
        appendToBody: true,
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          if (!params?.length) {
            return ''
          }
          const year = params[0].axisValue
          const yearTotal = data.yearTotals[year]
          const lines = params
            .map((param) => {
              const share = data.shareOf(param.value, yearTotal)
              const shareText = share === null ? '' : ` (${formatShare(share)})`
              return `<div>${param.marker}${param.seriesName}: ${formatCompactValue(
                param.value
              )}${shareText}</div>`
            })
            .join('')
          return `<div style="font-weight:600;margin-bottom:4px;">${year}</div>${lines}<div style="margin-top:4px;">${t(
            'org:supplyHistory.analytics.total'
          )}: ${formatCompactValue(yearTotal)}</div>`
        }
      },
      legend: { show: false },
      grid: {
        ...BC_CHART_GRID,
        top: 20,
        bottom: 40
      },
      xAxis: {
        type: 'category',
        name: t('org:supplyHistory.analytics.complianceYear'),
        nameGap: 28,
        data: data.years,
        axisLabel: BC_CHART_CATEGORY_AXIS_LABEL
      },
      yAxis: {
        type: 'value',
        name: measureLabel,
        nameLocation: 'middle',
        nameGap: 52,
        nameRotate: 90,
        nameTextStyle: {
          color: BC_CHART_COLORS.text,
          align: 'center'
        },
        axisLabel: {
          ...BC_CHART_AXIS_LABEL,
          formatter: (value) => formatCompactAxisNumber(value)
        }
      },
      series: FUEL_CATEGORIES.filter((category) =>
        visibleCategories.includes(category.name)
      ).map((category) => ({
        name: category.name,
        type: 'bar',
        stack: 'fuelCategory',
        barMaxWidth: 56,
        emphasis: { focus: 'series' },
        itemStyle: {
          color: category.color,
          decal: toDecal(category.stripeAngle),
          borderColor: '#ffffff',
          borderWidth: 1
        },
        data: data.years.map((year) => data.valueFor(year, category.name))
      }))
    }),
    [
      ariaDescription,
      data,
      formatCompactValue,
      measureLabel,
      t,
      visibleCategories
    ]
  )

  const handleMeasureChange = (_, nextMeasure) => {
    if (nextMeasure) {
      setMeasureKey(nextMeasure)
    }
  }

  const toggleCategory = (categoryName) => {
    setVisibleCategories((current) => {
      if (!current.includes(categoryName)) {
        return [...current, categoryName]
      }
      // Keep at least one category on screen.
      return current.length > 1
        ? current.filter((name) => name !== categoryName)
        : current
    })
  }

  return (
    <Card
      elevation={2}
      sx={{ height: '100%', overflow: 'hidden', minWidth: 0 }}
    >
      <CardContent sx={{ minWidth: 0, overflow: 'hidden' }}>
        <BCTypography variant="subtitle1" sx={{ mb: 0.5 }}>
          {t('org:supplyHistory.analytics.categoryBreakdown')}
        </BCTypography>
        <BCTypography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('org:supplyHistory.analytics.categoryBreakdownHelp')}
        </BCTypography>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          sx={{ mb: 2 }}
        >
          <ToggleButtonGroup
            size="small"
            exclusive
            value={measureKey}
            onChange={handleMeasureChange}
            aria-label={t('org:supplyHistory.analytics.measure')}
            data-test="fuel-category-measure"
          >
            {Object.entries(MEASURES).map(([key, option]) => (
              <ToggleButton
                key={key}
                value={key}
                sx={{ textTransform: 'none', ...focusVisibleSx }}
              >
                {t(`org:supplyHistory.analytics.${option.labelKey}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            role="group"
            aria-label={t('org:supplyHistory.analytics.fuelCategories')}
            aria-describedby={categoriesHelpId}
          >
            {FUEL_CATEGORIES.map((category) => {
              const isVisible = visibleCategories.includes(category.name)
              const total = data.categoryTotals[category.name]
              const share = data.shareOf(total, data.grandTotal)
              return (
                <ToggleButton
                  key={category.name}
                  value={category.name}
                  size="small"
                  selected={isVisible}
                  onChange={() => toggleCategory(category.name)}
                  data-test={`fuel-category-toggle-${category.name}`}
                  sx={{
                    ...focusVisibleSx,
                    textTransform: 'none',
                    gap: 1,
                    px: 1.5,
                    py: 0.5,
                    justifyContent: 'flex-start',
                    textAlign: 'left'
                  }}
                >
                  <CategorySwatch category={category} muted={!isVisible} />
                  <BCBox
                    component="span"
                    sx={{ display: 'flex', flexDirection: 'column' }}
                  >
                    <BCBox
                      component="span"
                      sx={{ fontWeight: 600, lineHeight: 1.3 }}
                    >
                      {category.name}
                    </BCBox>
                    <BCBox
                      component="span"
                      sx={{ fontSize: '0.75rem', lineHeight: 1.3 }}
                    >
                      {formatCompactValue(total)}
                      {share === null ? '' : ` · ${formatShare(share)}`}
                    </BCBox>
                  </BCBox>
                </ToggleButton>
              )
            })}
          </Stack>
        </Stack>
        <BCTypography
          id={categoriesHelpId}
          variant="caption"
          color="text.secondary"
          component="p"
          sx={{ mb: 1 }}
        >
          {t('org:supplyHistory.analytics.fuelCategoriesHelp')}
          {measureKey === 'litres' &&
            ` ${t('org:supplyHistory.analytics.litresNote')}`}
        </BCTypography>

        <BCBox sx={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
          <ReactECharts
            option={chartOption}
            notMerge
            lazyUpdate
            style={{ height: 360, width: '100%', minWidth: 0 }}
          />
        </BCBox>

        <BCButton
          variant="outlined"
          color="primary"
          size="small"
          onClick={() => setShowTable((current) => !current)}
          aria-expanded={showTable}
          aria-controls={tableId}
          sx={{ mt: 1 }}
        >
          {showTable
            ? t('org:supplyHistory.analytics.hideDataTable')
            : t('org:supplyHistory.analytics.showDataTable')}
        </BCButton>

        <Collapse in={showTable} unmountOnExit>
          <TableContainer id={tableId} sx={{ mt: 2, overflowX: 'auto' }}>
            <Table size="small" data-test="fuel-category-table">
              <caption>
                {t('org:supplyHistory.analytics.categoryTableCaption', {
                  measure: measureLabel
                })}
              </caption>
              <TableHead>
                <TableRow>
                  <TableCell component="th" scope="col">
                    {t('org:supplyHistory.analytics.complianceYear')}
                  </TableCell>
                  {FUEL_CATEGORIES.map((category) => (
                    <TableCell
                      key={category.name}
                      component="th"
                      scope="col"
                      align="right"
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        justifyContent="flex-end"
                        component="span"
                      >
                        <CategorySwatch category={category} />
                        <span>{category.name}</span>
                      </Stack>
                    </TableCell>
                  ))}
                  <TableCell component="th" scope="col" align="right">
                    {t('org:supplyHistory.analytics.total')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.years.map((year) => (
                  <TableRow key={year}>
                    <TableCell component="th" scope="row">
                      {year}
                    </TableCell>
                    {FUEL_CATEGORIES.map((category) => (
                      <TableCell key={category.name} align="right">
                        {formatPlainNumber(
                          data.valueFor(year, category.name),
                          measure.decimals
                        )}
                      </TableCell>
                    ))}
                    <TableCell align="right">
                      {formatPlainNumber(
                        data.yearTotals[year],
                        measure.decimals
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ '& th, & td': { fontWeight: 600 } }}>
                  <TableCell component="th" scope="row">
                    {t('org:supplyHistory.analytics.total')}
                  </TableCell>
                  {FUEL_CATEGORIES.map((category) => {
                    const total = data.categoryTotals[category.name]
                    const share = data.shareOf(total, data.grandTotal)
                    return (
                      <TableCell key={category.name} align="right">
                        {formatPlainNumber(total, measure.decimals)}
                        {share !== null && (
                          <BCBox
                            component="span"
                            sx={{ display: 'block', fontWeight: 400 }}
                          >
                            {t('org:supplyHistory.analytics.shareOfTotal', {
                              share: formatShare(share)
                            })}
                          </BCBox>
                        )}
                      </TableCell>
                    )
                  })}
                  <TableCell align="right">
                    {formatPlainNumber(data.grandTotal, measure.decimals)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>
      </CardContent>
    </Card>
  )
}

export default FuelCategoryBreakdown
