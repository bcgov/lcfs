import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { Role } from '@/components/Role'
import { StyledListItem } from '@/components/StyledListItem'
import { roles } from '@/constants/roles'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { useCreateSupplementalReport } from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { constructAddress } from '@/utils/constructAddress'
import { timezoneFormatter } from '@/utils/formatters'
import AssignmentIcon from '@mui/icons-material/Assignment'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { List, ListItemText, Stack, styled } from '@mui/material'
import MuiAccordion from '@mui/material/Accordion'
import MuiAccordionDetails from '@mui/material/AccordionDetails'
import MuiAccordionSummary, {
  accordionSummaryClasses
} from '@mui/material/AccordionSummary'
import Box from '@mui/material/Box'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config.js'

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
    expandIcon={<ExpandMoreIcon sx={{ fontSize: '0.9rem' }} />}
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

const HistoryCard = ({ report }) => {
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
      .filter((item) => item.status.status !== COMPLIANCE_REPORT_STATUSES.DRAFT)
  }, [isGovernmentUser, report.history])
  return (
    <Accordion>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ width: '2rem', height: '2rem' }} />}
        aria-controls="panel1-content"
      >
        <BCTypography color="link" variant="body2">
          {report.version === 0
            ? `${report.compliancePeriod.description} Compliance Report`
            : report.nickname}
          : {report.currentStatus.status}
        </BCTypography>
      </AccordionSummary>
      <AccordionDetails>
        <List>
          {filteredHistory.map((item, index) => (
            <StyledListItem key={index} disablePadding>
              <ListItemText primaryTypographyProps={{ variant: 'body4' }}>
                <span
                  dangerouslySetInnerHTML={{
                    __html: t(
                      `report:complianceReportHistory.${item.status.status}`,
                      {
                        createDate: timezoneFormatter({
                          value: item?.createDate
                        }),
                        firstName: item.userProfile.firstName,
                        lastName: item.userProfile.lastName
                      }
                    )
                  }}
                />
              </ListItemText>
            </StyledListItem>
          ))}
        </List>
      </AccordionDetails>
    </Accordion>
  )
}

export const AssessmentCard = ({
  orgData,
  hasMet,
  hasSupplemental,
  isGovernmentUser,
  currentStatus,
  complianceReportId,
  alertRef,
  chain
}) => {
  const { t } = useTranslation(['report'])
  const navigate = useNavigate()

  const { mutate: createSupplementalReport, isLoading } =
    useCreateSupplementalReport(complianceReportId, {
      onSuccess: (data) => {
        // Navigate to the new report's page
        const newReportId = data.data.complianceReportId
        const compliancePeriodYear = data.data.compliancePeriod.description
        navigate(
          `/compliance-reporting/${compliancePeriodYear}/${newReportId}`,
          {
            state: {
              message: t('report:supplementalCreated'),
              severity: 'success'
            }
          }
        )
      },
      onError: (error) => {
        alertRef.current?.triggerAlert({
          message: error.message,
          severity: 'error'
        })
      }
    })

  return (
    <BCWidgetCard
      component="div"
      style={{ height: 'fit-content', flexGrow: 1 }}
      title={
        currentStatus === COMPLIANCE_REPORT_STATUSES.ASSESSED ||
        isGovernmentUser ||
        hasSupplemental
          ? t('report:assessment')
          : t('report:orgDetails')
      }
      content={
        <>
          <Stack direction="column" spacing={0.5}>
            <BCTypography variant="h6" color="primary">
              {orgData?.name}
            </BCTypography>
            <List sx={{ padding: 0 }}>
              <StyledListItem>
                <ListItemText primaryTypographyProps={{ variant: 'body4' }}>
                  {t('report:serviceAddrLabel')}:
                  {orgData && constructAddress(orgData.orgAddress)}
                </ListItemText>
              </StyledListItem>
              <StyledListItem>
                <ListItemText primaryTypographyProps={{ variant: 'body4' }}>
                  {t('report:bcAddrLabel')}:{' '}
                  {orgData && constructAddress(orgData.orgAttorneyAddress)}
                </ListItemText>
              </StyledListItem>
            </List>

            {!isGovernmentUser && (
              <BCTypography
                component="div"
                variant="body4"
                dangerouslySetInnerHTML={{
                  __html: t('report:contactForAddrChange')
                }}
              />
            )}
            {(isGovernmentUser ||
              hasSupplemental ||
              currentStatus === COMPLIANCE_REPORT_STATUSES.ASSESSED) && (
              <>
                <BCTypography
                  sx={{ paddingTop: '16px' }}
                  variant="h6"
                  color="primary"
                >
                  {t('report:renewableFuelTarget')}
                </BCTypography>
                <List sx={{ padding: 0 }}>
                  <StyledListItem>
                    <ListItemText primaryTypographyProps={{ variant: 'body4' }}>
                      <span
                        dangerouslySetInnerHTML={{
                          __html: t('report:assessmentLn1', {
                            name: orgData.name,
                            hasMet: hasMet ? 'has met' : 'has not met'
                          })
                        }}
                      />
                    </ListItemText>
                  </StyledListItem>
                </List>
                <BCTypography
                  sx={{ paddingTop: '16px' }}
                  variant="h6"
                  color="primary"
                >
                  {t('report:lowCarbonFuelTargetSummary')}
                </BCTypography>
                <List sx={{ padding: 0 }}>
                  <StyledListItem>
                    <ListItemText primaryTypographyProps={{ variant: 'body4' }}>
                      <span
                        dangerouslySetInnerHTML={{
                          __html: t('report:assessmentLn2', {
                            name: orgData.name,
                            hasMet: hasMet ? 'has met' : 'has not met'
                          })
                        }}
                      />
                    </ListItemText>
                  </StyledListItem>
                </List>
              </>
            )}
            {!!chain.length && (
              <>
                <BCTypography
                  sx={{ paddingTop: '16px' }}
                  component="div"
                  variant="h6"
                  color="primary"
                >
                  {t('report:reportHistory')}
                </BCTypography>
                {chain.map((report) => (
                  <HistoryCard key={report.version} report={report} />
                ))}
              </>
            )}

            <Role roles={[roles.supplier]}>
              {isFeatureEnabled(FEATURE_FLAGS.SUPPLEMENTAL_REPORTING) &&
                currentStatus === COMPLIANCE_REPORT_STATUSES.ASSESSED && (
                  <>
                    <BCTypography
                      sx={{ paddingTop: '16px' }}
                      component="div"
                      variant="body4"
                    >
                      {t('report:supplementalWarning')}
                    </BCTypography>
                    <Box>
                      <BCButton
                        data-test="create-supplemental"
                        size="large"
                        variant="contained"
                        color="primary"
                        onClick={() => {
                          createSupplementalReport()
                        }}
                        startIcon={<AssignmentIcon />}
                        sx={{ mt: 2 }}
                        disabled={isLoading}
                      >
                        {t('report:createSupplementalRptBtn')}
                      </BCButton>
                    </Box>
                  </>
                )}
            </Role>
            <Role roles={[roles.analyst]}>
              <Box>
                <BCButton
                  data-test="create-supplemental"
                  size="large"
                  variant="contained"
                  color="primary"
                  onClick={() => {
                    alert('TODO')
                  }}
                  startIcon={<AssignmentIcon />}
                  sx={{ mt: 2 }}
                  disabled={isLoading}
                >
                  {t('report:createReassessmentBtn')}
                </BCButton>
              </Box>
            </Role>
          </Stack>
        </>
      }
    />
  )
}
