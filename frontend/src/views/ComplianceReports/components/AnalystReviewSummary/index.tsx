import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { useGetComplianceReportReviewSummary } from '@/hooks/useComplianceReports'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Chip,
  Divider,
  Stack
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { useEffect, useMemo, useState } from 'react'
import { robotVariants } from './constants'
import { ReviewCharts } from './ReviewCharts'
import { ReviewSections } from './ReviewSections'
import { RobotAvatar } from './RobotAvatar'
import { useTypewriter } from './useTypewriter'
import {
  getAddressedStorageKey,
  getFindingId,
  isActionableFinding,
  uniqueQuestions
} from './utils'
import type { ReviewSummaryData } from './types'

interface AnalystReviewSummaryProps {
  complianceReportId: string | number
}

export const AnalystReviewSummary = ({
  complianceReportId
}: AnalystReviewSummaryProps) => {
  const {
    data: rawData,
    isLoading,
    isError
  } = useGetComplianceReportReviewSummary(complianceReportId, {
    enabled: !!complianceReportId
  })
  const data = rawData as ReviewSummaryData | undefined
  const robot = useMemo(() => {
    const numericId = Number(complianceReportId) || 0
    return robotVariants[numericId % robotVariants.length]
  }, [complianceReportId])
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [addressedFindingIds, setAddressedFindingIds] = useState<Set<string>>(
    new Set()
  )
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
        .filter((findingId): findingId is string => Boolean(findingId))
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
    const parsedValue = storedValue ? (JSON.parse(storedValue) as string[]) : []
    setAddressedFindingIds(new Set(parsedValue))
  }, [complianceReportId])

  const toggleFindingAddressed = (findingId: string) => {
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
          <RobotAvatar robot={robot} size={58} pulse />
          <BCBox>
            <BCTypography variant="subtitle2" color="primary">
              {robot.name} is drafting the pre-screen...
            </BCTypography>
            <BCTypography variant="body2" color="text.secondary">
              Reviewing report checks, comparison data, and follow-up areas.
            </BCTypography>
          </BCBox>
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

          <ReviewSections
            sections={data.sections}
            expandedSection={expandedSection}
            setExpandedSection={setExpandedSection}
            addressedFindingIds={addressedFindingIds}
            toggleFindingAddressed={toggleFindingAddressed}
          />
        </Stack>
      </AccordionDetails>
    </Accordion>
  )
}
