import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import { useTheme } from '@mui/material/styles'
import { useParams } from 'react-router-dom'

import BCBox from '@/components/BCBox'
import '@/components/BCTypography';
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
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useOrganizationPenaltyAnalytics } from '@/hooks/useOrganization'

import { compareYears, normalizeYear } from '@/utils/helper'
import {
  usePenaltyMixOption,
  useSparklineOption,
  useStackedBarOption
} from '../_charts'
import {
  buildAutomaticPenaltyRows,
  processSparklineData
} from './penaltyLogHelpers'
import {
  MetricCardsSection,
  PenaltySummaryTable,
  StackedBarChart
} from './PenaltyComponents'
import {
  AutomaticPenaltyLogGrid,
  DiscretionaryPenaltyLogGrid
} from './PenaltyGrids'

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer
])

// Helper function to process yearly penalties
const processYearlyPenalties = (rawYearlyPenalties, allYears) => {
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
}

// Helper function to process penalty totals
const processPenaltyTotals = (rawTotals) => {
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
}

export const PenaltyLog = () => {
  const { t } = useTranslation(['org'])
  const theme = useTheme()
  const { orgID } = useParams()
  const { data: currentUser, isLoading: currentUserLoading } = useCurrentUser()

  const organizationId = orgID ?? currentUser?.organization?.organizationId

  const {
    data: penaltyAnalytics,
    isLoading: analyticsLoading,
    isError: analyticsIsError,
    error: analyticsError
  } = useOrganizationPenaltyAnalytics(organizationId)

  const rawYearlyPenalties = useMemo(
    () => penaltyAnalytics?.yearlyPenalties ?? [],
    [penaltyAnalytics?.yearlyPenalties]
  )
  const rawPenaltyLogs = useMemo(
    () => penaltyAnalytics?.penaltyLogs ?? [],
    [penaltyAnalytics?.penaltyLogs]
  )
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

  const yearlyPenalties = useMemo(
    () => processYearlyPenalties(rawYearlyPenalties, allYears),
    [allYears, rawYearlyPenalties]
  )

  const automaticPenaltyRows = useMemo(
    () => buildAutomaticPenaltyRows(rawYearlyPenalties, t),
    [rawYearlyPenalties, t]
  )

  const penaltyTotals = useMemo(
    () => processPenaltyTotals(rawTotals),
    [rawTotals]
  )

  const yearLabels = allYears

  const sparklineData = useMemo(
    () => processSparklineData(rawPenaltyLogs, yearLabels, yearlyPenalties),
    [yearlyPenalties, rawPenaltyLogs, yearLabels]
  )

  const stackedBarOption = useStackedBarOption(yearlyPenalties, theme)
  const penaltyMixOption = usePenaltyMixOption(penaltyTotals, theme)

  const totalSparklineOption = useSparklineOption(
    yearLabels,
    sparklineData.total,
    t('org:penaltyLog.totalPenalties'),
    { formatCurrency: true, theme }
  )
  const automaticSparklineOption = useSparklineOption(
    yearLabels,
    sparklineData.automatic,
    t('org:penaltyLog.autoPenalties'),
    { formatCurrency: true, theme }
  )
  const discretionarySparklineOption = useSparklineOption(
    yearLabels,
    sparklineData.discretionary,
    t('org:penaltyLog.discretionaryPenalties'),
    { formatCurrency: true, theme }
  )
  const sparklineOptions = {
    total: totalSparklineOption,
    automatic: automaticSparklineOption,
    discretionary: discretionarySparklineOption
  }

  if (analyticsLoading || currentUserLoading) {
    return <Loading />
  }

  if (!organizationId) {
    return (
      <BCAlert severity="info">
        {t('org:penaltyLog.noOrganizationSelected')}
      </BCAlert>
    )
  }

  const analyticsErrorMessage =
    analyticsError?.response?.data?.detail ?? analyticsError?.message ?? ''

  return (
    <BCBox p={0} sx={{ width: '100%' }}>
      {analyticsIsError && (
        <BCAlert severity="error" sx={{ mb: 2 }}>
          {t('org:penaltyLog.analyticsError')}
          {analyticsErrorMessage ? ` (${analyticsErrorMessage})` : ''}
        </BCAlert>
      )}
      <Stack spacing={2} sx={{ width: '100%' }}>
        <AutomaticPenaltyLogGrid
          automaticPenaltyRows={automaticPenaltyRows}
          loading={analyticsLoading}
        />
        <Grid container spacing={2}>
          <Grid item xs={12} md={4} ml={-2}>
            <MetricCardsSection
              penaltyTotals={penaltyTotals}
              sparklineOptions={sparklineOptions}
            />
          </Grid>
          <Grid item xs={12} md={8}>
            <StackedBarChart stackedBarOption={stackedBarOption} />
          </Grid>
        </Grid>
        <PenaltySummaryTable
          yearlyPenalties={yearlyPenalties}
          penaltyTotals={penaltyTotals}
          penaltyMixOption={penaltyMixOption}
        />
      </Stack>
      <DiscretionaryPenaltyLogGrid organizationId={organizationId} />
    </BCBox>
  )
}
