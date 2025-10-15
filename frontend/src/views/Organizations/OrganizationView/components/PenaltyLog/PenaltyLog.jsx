import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Grid, Stack } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useParams } from 'react-router-dom'

import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
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
  MetricCardsSection,
  PenaltySummaryTable,
  StackedBarChart
} from './PenaltyComponents'
import { PenaltyHistoryGrid } from './PenaltyHistoryGrid'

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

// Helper function to process discretionary sparkline data
const processDiscretionaryData = (rawPenaltyLogs, yearLabels) => {
  const sums = new Map()
  rawPenaltyLogs.forEach((entry) => {
    const key = normalizeYear(entry?.complianceYear)
    const amount = Number(entry?.penaltyAmount ?? 0)
    sums.set(key, (sums.get(key) ?? 0) + amount)
  })

  return yearLabels.map((year) => sums.get(year) ?? 0)
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

  const yearlyPenalties = useMemo(
    () => processYearlyPenalties(rawYearlyPenalties, allYears),
    [allYears, rawYearlyPenalties]
  )

  const penaltyTotals = useMemo(
    () => processPenaltyTotals(rawTotals),
    [rawTotals]
  )

  const yearLabels = allYears

  const sparklineData = useMemo(
    () => ({
      total: yearlyPenalties.map((item) => item.totalAutomatic),
      automatic: yearlyPenalties.map((item) => item.autoRenewable),
      discretionary: processDiscretionaryData(rawPenaltyLogs, yearLabels)
    }),
    [yearlyPenalties, rawPenaltyLogs, yearLabels]
  )

  const stackedBarOption = useStackedBarOption(yearlyPenalties, theme)
  const penaltyMixOption = usePenaltyMixOption(penaltyTotals, theme)

  const sparklineOptions = useMemo(
    () => ({
      total: useSparklineOption(
        yearLabels,
        sparklineData.total,
        theme,
        t('org:penaltyLog.totalPenalties')
      ),
      automatic: useSparklineOption(
        yearLabels,
        sparklineData.automatic,
        theme,
        t('org:penaltyLog.autoPenalties')
      ),
      discretionary: useSparklineOption(
        yearLabels,
        sparklineData.discretionary,
        theme,
        t('org:penaltyLog.discretionaryPenalties')
      )
    }),
    [yearLabels, sparklineData, theme]
  )

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
      <BCTypography variant="h5" color="primary" fontWeight="medium" my={1}>
        {t('org:sections.penaltyLog.title')}
      </BCTypography>
      <Stack spacing={2} sx={{ width: '100%' }}>
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
      <PenaltyHistoryGrid organizationId={organizationId} />
    </BCBox>
  )
}
