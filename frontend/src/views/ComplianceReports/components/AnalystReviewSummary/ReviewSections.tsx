import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Checkbox,
  Chip,
  FormControlLabel,
  Stack
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { sectionColor, severityColor } from './constants'
import { TypewriterText } from './TypewriterText'
import { formatMetric, getFindingId, isActionableFinding } from './utils'
import type { ReviewSection, ReviewSeverity } from './types'

interface ReviewSectionsProps {
  sections?: ReviewSection[]
  expandedSection: string | null
  setExpandedSection: (section: string | null) => void
  addressedFindingIds: Set<string>
  toggleFindingAddressed: (findingId: string) => void
}

const getSectionHeaderBadge = (section: ReviewSection) => {
  const severities = section.findings.map((finding) => finding.severity)

  if (
    severities.length > 0 &&
    severities.every((severity) => severity === 'informational')
  ) {
    return {
      label: 'informational',
      color: severityColor.informational
    }
  }

  const highestSeverity = (['concern', 'review'] as ReviewSeverity[]).find(
    (severity) => severities.includes(severity)
  )

  if (highestSeverity) {
    return {
      label: highestSeverity,
      color: severityColor[highestSeverity]
    }
  }

  return {
    label: section.status,
    color: sectionColor[section.status] || 'default'
  }
}

export const ReviewSections = ({
  sections,
  expandedSection,
  setExpandedSection,
  addressedFindingIds,
  toggleFindingAddressed
}: ReviewSectionsProps) => (
  <BCBox>
    {sections?.map((section) => {
      const headerBadge = getSectionHeaderBadge(section)

      return (
        <Accordion
          key={section.section}
          expanded={expandedSection === section.section}
          onChange={(_, isExpanded: boolean) =>
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
                color={headerBadge.color}
                label={headerBadge.label}
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
                const findingId = getFindingId(section.section, finding, index)
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
                        color={severityColor[finding.severity] || 'default'}
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
                              onChange={() => toggleFindingAddressed(findingId)}
                            />
                          }
                          label="addressed"
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
      )
    })}
  </BCBox>
)
