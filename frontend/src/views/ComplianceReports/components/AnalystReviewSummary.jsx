import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { useGetComplianceReportReviewSummary } from '@/hooks/useComplianceReports'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  Stack
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ReactECharts from 'echarts-for-react'
import { useEffect, useMemo, useState } from 'react'
import analystReviewRobot from '@/assets/images/analyst-review-robot.gif'

const severityColor = {
  concern: 'error',
  review: 'warning',
  informational: 'info'
}

const sectionColor = {
  concern: 'error',
  review: 'warning',
  clear: 'success'
}

const robotVariants = [
  { name: 'Methy review', color: '#0f766e', background: '#ccfbf1' },
  { name: 'Methy summary', color: '#1d4ed8', background: '#dbeafe' },
  { name: 'Methy triage', color: '#7c3aed', background: '#ede9fe' }
]

const RobotAvatar = ({ robot, size = 46, pulse = false }) => (
  <BCBox
    sx={{
      width: size,
      height: size,
      borderRadius: '50%',
      backgroundColor: robot.background,
      display: 'grid',
      placeItems: 'center',
      flex: '0 0 auto',
      overflow: 'hidden',
      boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.08)',
      animation: pulse ? 'aiPulse 1.3s ease-in-out infinite' : 'none',
      '@keyframes aiPulse': {
        '0%, 100%': { transform: 'scale(1)', opacity: 0.82 },
        '50%': { transform: 'scale(1.06)', opacity: 1 }
      }
    }}
  >
    <BCBox
      component="img"
      src={analystReviewRobot}
      alt=""
      aria-hidden="true"
      sx={{
        width: Math.round(size * 0.86),
        height: Math.round(size * 0.86),
        objectFit: 'contain'
      }}
    />
  </BCBox>
)

const useTypewriter = (text, delay = 18) => {
  const [displayText, setDisplayText] = useState('')

  useEffect(() => {
    if (!text) {
      setDisplayText('')
      return undefined
    }

    let index = 0
    setDisplayText('')
    const interval = window.setInterval(() => {
      index = Math.min(index + 2, text.length)
      setDisplayText(text.slice(0, index))
      if (index >= text.length) {
        window.clearInterval(interval)
      }
    }, delay)

    return () => window.clearInterval(interval)
  }, [text, delay])

  return displayText
}

const TypewriterText = ({ text, active = true, delay = 18 }) => {
  const displayText = useTypewriter(active ? text : '', delay)

  if (!active) {
    return text
  }

  return (
    <>
      {displayText}
      {displayText !== text && (
        <BCBox
          component="span"
          sx={{
            display: 'inline-block',
            width: '0.55em',
            ml: 0.25,
            borderRight: '2px solid currentColor',
            animation: 'cursorBlink 0.8s steps(2, start) infinite',
            '@keyframes cursorBlink': {
              '0%, 45%': { opacity: 1 },
              '46%, 100%': { opacity: 0 }
            }
          }}
        >
          &nbsp;
        </BCBox>
      )}
    </>
  )
}

const formatMetric = (metric) => {
  const parts = [`${metric.label}: ${metric.value ?? 'n/a'}`]
  if (metric.comparisonValue !== null && metric.comparisonValue !== undefined) {
    parts.push(`comparison ${metric.comparisonValue}`)
  }
  if (metric.delta !== null && metric.delta !== undefined) {
    parts.push(`delta ${metric.delta}`)
  }
  if (metric.percentChange !== null && metric.percentChange !== undefined) {
    parts.push(`${metric.percentChange}%`)
  }
  if (metric.units) {
    parts.push(metric.units)
  }
  return parts.join(' | ')
}

const getAddressedStorageKey = (complianceReportId) =>
  `analyst-review-addressed-${complianceReportId}`

const getFindingId = (sectionName, finding, index) =>
  [sectionName, finding.severity, finding.source, finding.title, index].join(
    '|'
  )

const isActionableFinding = (finding) =>
  finding.severity === 'concern' || finding.severity === 'review'

const uniqueQuestions = (questions = []) => {
  const seen = new Set()
  return questions.filter((question) => {
    const normalizedQuestion = question
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
    if (seen.has(normalizedQuestion)) {
      return false
    }
    seen.add(normalizedQuestion)
    return true
  })
}

const buildComparisonChartOptions = (series) => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' }
  },
  legend: {
    top: 0
  },
  grid: {
    left: 8,
    right: 16,
    bottom: 8,
    top: 40,
    containLabel: true
  },
  xAxis: {
    type: 'category',
    data: series.points.map((point) => point.label),
    axisLabel: {
      rotate: series.points.length > 4 ? 30 : 0,
      overflow: 'truncate',
      width: 100
    }
  },
  yAxis: {
    type: 'value'
  },
  series: [
    {
      name: series.comparisonLabel,
      type: 'bar',
      data: series.points.map((point) => point.comparisonValue)
    },
    {
      name: series.currentLabel,
      type: 'bar',
      data: series.points.map((point) => point.currentValue)
    },
    {
      name: 'Delta',
      type: 'line',
      data: series.points.map((point) => point.delta),
      yAxisIndex: 0
    }
  ]
})

const groupHistoricalSeries = (historicalSeries) => {
  const grouped = new Map()

  historicalSeries.forEach((series) => {
    if (!grouped.has(series.title)) {
      grouped.set(series.title, {
        title: series.title,
        currentLabel: series.currentLabel,
        periods: new Map([[series.currentLabel, new Map()]]),
        labels: new Set()
      })
    }

    const group = grouped.get(series.title)
    if (!group.periods.has(series.comparisonLabel)) {
      group.periods.set(series.comparisonLabel, new Map())
    }

    series.points.forEach((point) => {
      group.labels.add(point.label)
      group.periods
        .get(series.currentLabel)
        .set(point.label, point.currentValue)
      group.periods
        .get(series.comparisonLabel)
        .set(point.label, point.comparisonValue)
    })
  })

  return Array.from(grouped.values()).map((group) => ({
    title: group.title,
    labels: Array.from(group.labels),
    periodLabels: Array.from(group.periods.keys()).sort((a, b) => {
      if (a === group.currentLabel) return 1
      if (b === group.currentLabel) return -1
      return Number(a) - Number(b)
    }),
    valuesByPeriod: group.periods
  }))
}

const buildHistoricalChartOptions = (group) => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' }
  },
  legend: {
    top: 0,
    type: 'scroll'
  },
  grid: {
    left: 8,
    right: 16,
    bottom: 8,
    top: 48,
    containLabel: true
  },
  xAxis: {
    type: 'category',
    data: group.labels,
    axisLabel: {
      rotate: group.labels.length > 4 ? 30 : 0,
      overflow: 'truncate',
      width: 100
    }
  },
  yAxis: {
    type: 'value'
  },
  series: group.periodLabels.map((period) => ({
    name: period,
    type: 'bar',
    data: group.labels.map(
      (label) => group.valuesByPeriod.get(period).get(label) || 0
    )
  }))
})

const ReviewCharts = ({ chartData }) => {
  const historical = chartData?.historicalVariance || []
  const supplemental = chartData?.supplementalImpact || []
  const groupedHistorical = groupHistoricalSeries(
    historical.filter((item) => item.points?.length > 0)
  )
  const supplementalSeries = supplemental.filter(
    (item) => item.points?.length > 0
  )

  if (!groupedHistorical.length && !supplementalSeries.length) {
    return null
  }

  return (
    <BCBox>
      <BCTypography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
        Comparison charts
      </BCTypography>
      <BCBox
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
          gap: 2
        }}
      >
        {groupedHistorical.map((item) => (
          <BCBox
            key={item.title}
            sx={{
              border: '1px solid rgba(0, 0, 0, 0.12)',
              borderRadius: '4px',
              p: 1
            }}
          >
            <BCTypography variant="body2" sx={{ mb: 1 }}>
              {item.title}
            </BCTypography>
            <ReactECharts
              option={buildHistoricalChartOptions(item)}
              style={{ height: 280, width: '100%' }}
              notMerge
              lazyUpdate
            />
          </BCBox>
        ))}
        {supplementalSeries.map((item) => (
          <BCBox
            key={`${item.title}-${item.comparisonLabel}-${item.currentLabel}`}
            sx={{
              border: '1px solid rgba(0, 0, 0, 0.12)',
              borderRadius: '4px',
              p: 1
            }}
          >
            <BCTypography variant="body2" sx={{ mb: 1 }}>
              {item.title}
            </BCTypography>
            <ReactECharts
              option={buildComparisonChartOptions(item)}
              style={{ height: 280, width: '100%' }}
              notMerge
              lazyUpdate
            />
          </BCBox>
        ))}
      </BCBox>
    </BCBox>
  )
}

export const AnalystReviewSummary = ({ complianceReportId }) => {
  const { data, isLoading, isError } = useGetComplianceReportReviewSummary(
    complianceReportId,
    {
      enabled: !!complianceReportId
    }
  )
  const robot = useMemo(() => {
    const numericId = Number(complianceReportId) || 0
    return robotVariants[numericId % robotVariants.length]
  }, [complianceReportId])
  const [expandedSection, setExpandedSection] = useState(null)
  const [addressedFindingIds, setAddressedFindingIds] = useState(new Set())
  const typedSummary = useTypewriter(data?.summary || '')
  const isDrafting = !!data?.summary && typedSummary !== data.summary
  const actionableFindingIds = useMemo(() => {
    if (!data?.sections) {
      return []
    }

    return data.sections.flatMap((section) =>
      section.findings
        .map((finding, index) =>
          isActionableFinding(finding)
            ? getFindingId(section.section, finding, index)
            : null
        )
        .filter(Boolean)
    )
  }, [data?.sections])
  const topFollowUpQuestions = useMemo(
    () => uniqueQuestions(data?.topFollowUpQuestions),
    [data?.topFollowUpQuestions]
  )

  useEffect(() => {
    if (!complianceReportId) {
      setAddressedFindingIds(new Set())
      return
    }

    const storedValue = window.localStorage.getItem(
      getAddressedStorageKey(complianceReportId)
    )
    setAddressedFindingIds(new Set(storedValue ? JSON.parse(storedValue) : []))
  }, [complianceReportId])

  const toggleFindingAddressed = (findingId) => {
    setAddressedFindingIds((previous) => {
      const next = new Set(previous)
      if (next.has(findingId)) {
        next.delete(findingId)
      } else {
        next.add(findingId)
      }
      window.localStorage.setItem(
        getAddressedStorageKey(complianceReportId),
        JSON.stringify(Array.from(next))
      )
      return next
    })
  }

  if (isLoading) {
    return (
      <BCBox
        sx={{
          border: '1px solid rgba(0, 0, 0, 0.18)',
          borderRadius: '4px',
          p: 2,
          mb: 6,
          backgroundColor: '#fff'
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <RobotAvatar robot={robot} size={44} pulse />
          <Loading message={`${robot.name} is drafting the pre-screen...`} />
        </Stack>
      </BCBox>
    )
  }

  if (isError || !data) {
    return (
      <BCAlert severity="warning" noFade sx={{ mb: 2 }}>
        Methy pre-screen is unavailable.
      </BCAlert>
    )
  }

  const findings = data.sections?.flatMap((section) => section.findings) || []
  const counts = findings.reduce(
    (acc, finding) => {
      acc[finding.severity] = (acc[finding.severity] || 0) + 1
      return acc
    },
    { concern: 0, review: 0, informational: 0 }
  )
  const actionableCount = actionableFindingIds.length
  const addressedCount = actionableFindingIds.filter((findingId) =>
    addressedFindingIds.has(findingId)
  ).length

  return (
    <Accordion
      data-test="analyst-review-summary"
      disableGutters
      elevation={0}
      sx={{
        border: '1px solid rgba(0, 0, 0, 0.18)',
        borderRadius: '8px',
        backgroundColor: '#fff',
        '&:before': { display: 'none' }
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ width: '2rem', height: '2rem' }} />}
        sx={{
          alignItems: 'flex-start',
          '& .MuiAccordionSummary-content': {
            my: 2
          }
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          spacing={1}
          sx={{ width: '100%' }}
        >
          <BCBox>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <RobotAvatar robot={robot} />
              <BCBox>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <BCTypography variant="h6" color="primary">
                    Methy pre-screen
                  </BCTypography>
                  <Chip
                    size="small"
                    icon={<AutoAwesomeIcon />}
                    label={isDrafting ? 'Drafting' : 'Draft ready'}
                    color={isDrafting ? 'info' : 'success'}
                    variant="outlined"
                  />
                </Stack>
                <BCTypography variant="caption" display="block">
                  {robot.name} generated this from deterministic review checks.
                </BCTypography>
                <BCTypography variant="body2" sx={{ minHeight: 22 }}>
                  {typedSummary}
                  {isDrafting && (
                    <BCBox
                      component="span"
                      sx={{
                        display: 'inline-block',
                        width: '0.55em',
                        ml: 0.25,
                        borderRight: '2px solid currentColor',
                        animation: 'cursorBlink 0.8s steps(2, start) infinite',
                        '@keyframes cursorBlink': {
                          '0%, 45%': { opacity: 1 },
                          '46%, 100%': { opacity: 0 }
                        }
                      }}
                    >
                      &nbsp;
                    </BCBox>
                  )}
                </BCTypography>
              </BCBox>
            </Stack>
          </BCBox>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              color="error"
              label={`${counts.concern || 0} concerns`}
            />
            <Chip
              size="small"
              color="warning"
              label={`${counts.review || 0} review`}
            />
            <Chip
              size="small"
              color="info"
              label={`${counts.informational || 0} info`}
            />
            {actionableCount > 0 && (
              <Chip
                size="small"
                color={
                  addressedCount === actionableCount ? 'success' : 'default'
                }
                variant="outlined"
                label={`${addressedCount}/${actionableCount} addressed`}
              />
            )}
          </Stack>
        </Stack>
      </AccordionSummary>

      <AccordionDetails sx={{ pt: 0 }}>
        <Stack spacing={1.5}>
          <BCAlert severity="info" noFade>
            Deterministic checks only and it must not determine compliance,
            approve or reject reports, calculate authoritative values, or make
            enforcement decisions.
          </BCAlert>

          {topFollowUpQuestions.length > 0 && (
            <BCBox>
              <BCTypography variant="subtitle2" color="primary">
                Top follow-up questions
              </BCTypography>
              <Stack
                component="ol"
                sx={{ pl: 3, mt: 0.5, mb: 0 }}
                spacing={0.5}
              >
                {topFollowUpQuestions.map((question) => (
                  <BCTypography component="li" variant="body2" key={question}>
                    {question}
                  </BCTypography>
                ))}
              </Stack>
            </BCBox>
          )}

          <ReviewCharts chartData={data.chartData} />

          <Divider />

          <BCBox>
            {data.sections?.map((section) => (
              <Accordion
                key={section.section}
                expanded={expandedSection === section.section}
                onChange={(_, isExpanded) =>
                  setExpandedSection(isExpanded ? section.section : null)
                }
                disableGutters
                elevation={0}
                sx={{
                  borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
                  '&:before': { display: 'none' }
                }}
              >
                <AccordionSummary
                  expandIcon={
                    <ExpandMoreIcon sx={{ width: '2rem', height: '2rem' }} />
                  }
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      size="small"
                      color={sectionColor[section.status] || 'default'}
                      label={section.status}
                    />
                    <BCTypography variant="subtitle2">
                      <TypewriterText
                        text={section.section}
                        active={expandedSection === section.section}
                        delay={24}
                      />
                    </BCTypography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1.5}>
                    {section.findings.map((finding, index) => {
                      const findingId = getFindingId(
                        section.section,
                        finding,
                        index
                      )
                      const isActionable = isActionableFinding(finding)
                      const isAddressed = addressedFindingIds.has(findingId)

                      return (
                        <BCBox
                          key={findingId}
                          sx={{
                            opacity: isActionable && isAddressed ? 0.7 : 1,
                            borderLeft:
                              isActionable && isAddressed
                                ? '3px solid rgba(46, 125, 50, 0.55)'
                                : '3px solid transparent',
                            pl: isActionable ? 1 : 0
                          }}
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            flexWrap="wrap"
                            useFlexGap
                          >
                            <Chip
                              size="small"
                              color={
                                severityColor[finding.severity] || 'default'
                              }
                              label={finding.severity}
                            />
                            <BCTypography variant="subtitle2">
                              {finding.title}
                            </BCTypography>
                            {isActionable && (
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    size="small"
                                    checked={isAddressed}
                                    onChange={() =>
                                      toggleFindingAddressed(findingId)
                                    }
                                  />
                                }
                                label="Addressed"
                                sx={{
                                  ml: 0,
                                  '& .MuiFormControlLabel-label': {
                                    fontSize: '0.8125rem'
                                  }
                                }}
                              />
                            )}
                          </Stack>
                          <BCTypography variant="body2" sx={{ mt: 0.5 }}>
                            {finding.detail}
                          </BCTypography>
                          <BCTypography variant="caption" display="block">
                            Source: {finding.source} | Confidence:{' '}
                            {finding.confidence}
                          </BCTypography>
                          {finding.evidence?.map((metric) => (
                            <BCTypography
                              key={`${finding.title}-${metric.label}`}
                              variant="caption"
                              display="block"
                            >
                              {formatMetric(metric)}
                            </BCTypography>
                          ))}
                          {finding.suggestedFollowUp && (
                            <BCTypography variant="body2" sx={{ mt: 0.5 }}>
                              Follow-up: {finding.suggestedFollowUp}
                            </BCTypography>
                          )}
                        </BCBox>
                      )
                    })}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ))}
          </BCBox>
        </Stack>
      </AccordionDetails>
    </Accordion>
  )
}
