import React, { useMemo } from 'react'
import { List, ListItemText, styled } from '@mui/material'
import MuiAccordion from '@mui/material/Accordion'
import MuiAccordionSummary, {
  accordionSummaryClasses
} from '@mui/material/AccordionSummary'
import MuiAccordionDetails from '@mui/material/AccordionDetails'
import { useCurrentUser } from '@/hooks/useCurrentUser.js'
import { useTranslation } from 'react-i18next'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'
import BCTypography from '@/components/BCTypography/index.jsx'
import { StyledListItem } from '@/components/StyledListItem.jsx'
import { timezoneFormatter } from '@/utils/formatters.js'
import { ExpandMore } from '@mui/icons-material'

const Accordion = styled((props) => (
  <MuiAccordion disableGutters elevation={0} square {...props} />
))(() => ({
  border: `none`,
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
  const filteredHistory = useMemo(() => {
    if (!report.history || report.history.length === 0) {
      return []
    }
    // Sort the history array by date in descending order
    return [...report.history]
      .sort((a, b) => {
        return new Date(b.createDate) - new Date(a.createDate)
      })
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
      {filteredHistory.length > 0 && (
        <AccordionDetails>
          <List>
            {filteredHistory.map((item, index) => (
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
                            value: item?.createDate
                          }),
                          displayName:
                            item.displayName ||
                            `${item.userProfile.firstName} ${item.userProfile.lastName}`
                        }
                      )
                    }}
                  />
                </ListItemText>
                {[COMPLIANCE_REPORT_STATUSES.ASSESSED, 'AssessedBy'].includes(
                  item.status.status
                ) && (
                  <List sx={{ p: 0, m: 0 }}>
                    <StyledListItem disablePadding>
                      <ListItemText
                        primaryTypographyProps={{ variant: 'body4' }}
                      >
                        <strong>
                          {t('report:complianceReportHistory.renewableTarget')}
                          :&nbsp;
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
                      <ListItemText
                        primaryTypographyProps={{ variant: 'body4' }}
                      >
                        <strong>
                          {t('report:complianceReportHistory.lowCarbonTarget')}
                          :&nbsp;
                        </strong>
                        {t('report:assessmentLn2', {
                          name: report.organization.name,
                          hasMet:
                            report.summary.line21NonCompliancePenaltyPayable <=
                            0
                              ? 'has met'
                              : 'has not met'
                        })}
                      </ListItemText>
                    </StyledListItem>
                    {report.assessmentStatement && (
                      <StyledListItem disablePadding>
                        <ListItemText
                          primaryTypographyProps={{ variant: 'body4' }}
                        >
                          <strong>
                            {t(
                              'report:complianceReportHistory.directorStatement'
                            )}
                            :&nbsp;
                          </strong>
                          {report.assessmentStatement}
                        </ListItemText>
                      </StyledListItem>
                    )}
                  </List>
                )}
              </StyledListItem>
            ))}
          </List>
        </AccordionDetails>
      )}
    </Accordion>
  )
}
