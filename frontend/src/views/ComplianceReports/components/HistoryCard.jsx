import { useCallback, useEffect, useState, useMemo } from 'react'
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
import { useTranslation } from 'react-i18next'
import { roles } from '@/constants/roles.js'

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

export const HistoryCard = ({
  report,
  defaultExpanded = false,
  assessedMessage = undefined,
  reportVersion = 0,
  currentStatus = null
}) => {
  const { data: currentUser, hasRoles } = useCurrentUser()
  const isGovernmentUser = currentUser?.isGovernmentUser
  const { t } = useTranslation(['report'])

  // Basic status checks
  const isCurrentAssessed =
    report.currentStatus?.status === COMPLIANCE_REPORT_STATUSES.ASSESSED
  const isSupplementalReport = reportVersion > 0

  // User permission checks
  const canEditAssessmentStatement = useMemo(() => {
    if (!isGovernmentUser) return false

    const currentStatus = report.currentStatus?.status
    const roleStatusMap = {
      [roles.analyst]: [
        COMPLIANCE_REPORT_STATUSES.SUBMITTED,
        COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT
      ],
      [roles.compliance_manager]: [
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST
      ],
      [roles.director]: [COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER]
    }

    return Object.entries(roleStatusMap).some(
      ([role, statuses]) => hasRoles(role) && statuses.includes(currentStatus)
    )
  }, [isGovernmentUser, hasRoles, report.currentStatus?.status])

  // Display conditions - what to show/hide
  const shouldShowTopLevelAssessmentLines =
    isGovernmentUser &&
    !isCurrentAssessed &&
    defaultExpanded &&
    report?.currentStatus?.status !== COMPLIANCE_REPORT_STATUSES.DRAFT

  const shouldShowDirectorStatement =
    assessedMessage &&
    ((!isGovernmentUser && isCurrentAssessed) || isGovernmentUser)

  const shouldShowEditableIndicator =
    isGovernmentUser && canEditAssessmentStatement

  /**
   * Helper: build the two assessment list items.
   * We use it twice – once top‑level for gov users (pre‑assessment)
   * and once nested under the Assessed history entry for all users.
   */
  const AssessmentLines = () => {
    // Check if the report is marked as non-assessment
    if (report.isNonAssessment) {
      return (
        <StyledListItem disablePadding>
          <ListItemText slotProps={{ primary: { variant: 'body4' } }}>
            <strong>{t('report:notSubjectToAssessment')}:&nbsp;</strong>
            {t('report:notSubjectToAssessmentHistoryMessage')}
          </ListItemText>
        </StyledListItem>
      )
    }

    // Default assessment lines for normal reports
    return (
      <>
        {report?.summary?.totalRenewableFuelSupplied > 0 && (
          <StyledListItem disablePadding>
            <ListItemText slotProps={{ primary: { variant: 'body4' } }}>
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
        )}
        <StyledListItem disablePadding>
          <ListItemText slotProps={{ primary: { variant: 'body4' } }}>
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
  }

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
            {/* GOV users – show assessment lines immediately (top‑level) until Assessed */}
            {shouldShowTopLevelAssessmentLines && <AssessmentLines />}

            {/* Director statement – show to government users and non-government users if assessed */}
            {shouldShowDirectorStatement && (
              <StyledListItem disablePadding>
                <ListItemText
                  data-test="list-item"
                  slotProps={{ primary: { variant: 'body4' } }}
                >
                  <strong>
                    {t('report:complianceReportHistory.directorStatement')}
                  </strong>
                  {shouldShowEditableIndicator && (
                    <span style={{ color: '#d8292f' }}>
                      {' '}
                      {t('report:complianceReportHistory.canBeEdited')}
                    </span>
                  )}
                  : {assessedMessage}
                </ListItemText>
              </StyledListItem>
            )}

            {/* History timeline */}
            {sortedHistory.map((item, index) => {
              const showNestedAssessment = [
                COMPLIANCE_REPORT_STATUSES.ASSESSED,
                'AssessedBy'
              ].includes(item.status.status)

              const hideHistoryLine =
                report?.complianceReportId === item?.complianceReportId &&
                report?.currentStatus.status ===
                  COMPLIANCE_REPORT_STATUSES.DRAFT &&
                item?.status?.status !== COMPLIANCE_REPORT_STATUSES.DRAFT

              return (
                !hideHistoryLine && (
                  <StyledListItem key={index} disablePadding>
                    <ListItemText
                      data-test="list-item"
                      slotProps={{ primary: { variant: 'body4' } }}
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
              )
            })}
          </List>
        </AccordionDetails>
      )}
    </Accordion>
  )
}
