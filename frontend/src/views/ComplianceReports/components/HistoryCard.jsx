import BCTypography from '@/components/BCTypography/index.jsx'
import { StyledListItem } from '@/components/StyledListItem.jsx'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'
import { useCurrentUser } from '@/hooks/useCurrentUser.js'
import { timezoneFormatter } from '@/utils/formatters.js'
import { ExpandMore } from '@mui/icons-material'
import { List, ListItemText, styled } from '@mui/material'
import MuiAccordion from '@mui/material/Accordion'
import MuiAccordionDetails from '@mui/material/AccordionDetails'
import MuiAccordionSummary, {
  accordionSummaryClasses
} from '@mui/material/AccordionSummary'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

const Accordion = styled((props) => (
  <MuiAccordion disableGutters elevation={0} square {...props} />
))(() => ({
  border: 'none',
  '&::before': {
    display: 'none'
  }
}))

const AccordionSummary = styled((props) => (
  <MuiAccordionSummary
    expandIcon={<ExpandMore sx={{ fontSize: '0.9rem' }} />}
    {...props}
  />
))(() => ({
  minHeight: 'unset',
  padding: 0,
  flexDirection: 'row-reverse',
  [`& .${accordionSummaryClasses.content}`]: {
    margin: 0
  },
  [`& .${accordionSummaryClasses.expanded}`]: {
    margin: 0
  }
}))

const AccordionDetails = styled(MuiAccordionDetails)(() => ({
  paddingLeft: '1rem',
  paddingTop: 0,
  paddingBottom: 0
}))

export const HistoryCard = ({ report, defaultExpanded = false }) => {
  const { data: currentUser } = useCurrentUser()
  const isGovernmentUser = currentUser?.isGovernmentUser
  const { t } = useTranslation(['report'])

  const isCurrentAssessed =
    report.currentStatus?.status === COMPLIANCE_REPORT_STATUSES.ASSESSED

  /**
   * Helper: build the two assessment list items.
   * We use it twice – once top‑level for gov users (pre‑assessment)
   * and once nested under the Assessed history entry for all users.
   */
  const AssessmentLines = () => (
    <>
      <StyledListItem disablePadding>
        <ListItemText primaryTypographyProps={{ variant: 'body4' }}>
          <strong>
            {t('report:complianceReportHistory.renewableTarget')}:&nbsp;
          </strong>
          {t('report:assessmentLn1', {
            name: report.organization.name,
            hasMet:
              report.summary.line11FossilDerivedBaseFuelTotal <= 0
                ? 'has met'
                : 'has not met'
          })}
        </ListItemText>
      </StyledListItem>
      <StyledListItem disablePadding>
        <ListItemText primaryTypographyProps={{ variant: 'body4' }}>
          <strong>
            {t('report:complianceReportHistory.lowCarbonTarget')}:&nbsp;
          </strong>
          {t('report:assessmentLn2', {
            name: report.organization.name,
            hasMet:
              report.summary.line21NonCompliancePenaltyPayable <= 0
                ? 'has met'
                : 'has not met'
          })}
        </ListItemText>
      </StyledListItem>
    </>
  )

  const sortedHistory = useMemo(() => {
    if (!Array.isArray(report.history) || report.history.length === 0) return []

    return [...report.history]
      .sort((a, b) => new Date(b.createDate) - new Date(a.createDate))
      .map((item) => {
        if (
          item.status.status === COMPLIANCE_REPORT_STATUSES.ASSESSED &&
          !isGovernmentUser
        ) {
          item.status.status = 'AssessedBy'
        }
        return item
      })
  }, [isGovernmentUser, report.history])

  return (
    <Accordion defaultExpanded={defaultExpanded}>
      <AccordionSummary
        expandIcon={<ExpandMore sx={{ width: '2rem', height: '2rem' }} />}
        aria-controls="panel1-content"
      >
        <BCTypography color="link" variant="body2">
          {report.version === 0
            ? `${report.compliancePeriod.description} Compliance Report`
            : report.nickname}
          : {report.currentStatus.status}
        </BCTypography>
      </AccordionSummary>

      {sortedHistory.length > 0 && (
        <AccordionDetails>
          <List>
            {report.assessmentStatement &&
              ((!isGovernmentUser && isCurrentAssessed) ||
                isGovernmentUser) && (
                <StyledListItem disablePadding>
                  <ListItemText
                    data-test="list-item"
                    primaryTypographyProps={{ variant: 'body4' }}
                  >
                    <strong>
                      {t('report:complianceReportHistory.directorStatement')}:
                    </strong>{' '}
                    {report.assessmentStatement}
                  </ListItemText>
                </StyledListItem>
              )}

            {/* GOV users – show assessment lines immediately (top‑level) until Assessed */}
            {isGovernmentUser && !isCurrentAssessed && <AssessmentLines />}

            {/* History timeline */}
            {sortedHistory.map((item, index) => {
              const showNestedAssessment = [
                COMPLIANCE_REPORT_STATUSES.ASSESSED,
                'AssessedBy'
              ].includes(item.status.status)

              return (
                <StyledListItem key={index} disablePadding>
                  <ListItemText
                    data-test="list-item"
                    primaryTypographyProps={{ variant: 'body4' }}
                  >
                    <span
                      dangerouslySetInnerHTML={{
                        __html: t(
                          `report:complianceReportHistory.${item.status.status}`,
                          {
                            createDate: timezoneFormatter({
                              value: item.createDate
                            }),
                            displayName:
                              item.displayName ||
                              `${item.userProfile.firstName} ${item.userProfile.lastName}`
                          }
                        )
                      }}
                    />
                  </ListItemText>

                  {/* Nested assessment – appears once the status is Assessed */}
                  {showNestedAssessment && (
                    <List sx={{ p: 0, m: 0 }}>
                      <AssessmentLines />
                    </List>
                  )}
                </StyledListItem>
              )
            })}
          </List>
        </AccordionDetails>
      )}
    </Accordion>
  )
}
