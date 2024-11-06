import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { List, ListItemText, Stack, Typography } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { timezoneFormatter } from '@/utils/formatters'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { constructAddress } from '@/utils/constructAddress'
import BCButton from '@/components/BCButton'
import AssignmentIcon from '@mui/icons-material/Assignment'
import { useCreateSupplementalReport } from '@/hooks/useComplianceReports'
import Box from '@mui/material/Box'
import { useNavigate } from 'react-router-dom'
import { StyledListItem } from '@/components/StyledListItem'
import { roles } from '@/constants/roles'
import { Role } from '@/components/Role'

export const AssessmentCard = ({
  orgData,
  hasMet,
  history,
  hasSupplemental,
  isGovernmentUser,
  currentStatus,
  complianceReportId,
  alertRef
}) => {
  const { t } = useTranslation(['report'])
  const navigate = useNavigate()

  const filteredHistory = useMemo(() => {
    if (!history || history.length === 0) {
      return []
    }
    // Sort the history array by date in descending order
    return [...history]
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
      .filter(
        (item) =>
          item.status.status !== COMPLIANCE_REPORT_STATUSES.DRAFT ||
          hasSupplemental
      )
  }, [history, isGovernmentUser, hasSupplemental])

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
            <Typography variant="h6" color="primary">
              {orgData.name}
            </Typography>
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
              <Typography
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
                <Typography
                  sx={{ paddingTop: '16px' }}
                  variant="h6"
                  color="primary"
                >
                  {t('report:renewableFuelTarget')}
                </Typography>
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
                <Typography
                  sx={{ paddingTop: '16px' }}
                  variant="h6"
                  color="primary"
                >
                  {t('report:lowCarbonFuelTargetSummary')}
                </Typography>
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
            {!!filteredHistory.length && (
              <>
                <Typography
                  sx={{ paddingTop: '16px' }}
                  component="div"
                  variant="h6"
                  color="primary"
                >
                  {t(`report:reportHistory`)}
                </Typography>
                <List sx={{ padding: 0 }}>
                  {filteredHistory.map((item, index) => (
                    <StyledListItem key={index} disablePadding>
                      <ListItemText
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
              </>
            )}
            <Role roles={[roles.supplier]}>
              {currentStatus === COMPLIANCE_REPORT_STATUSES.ASSESSED && (
                <>
                  <Typography
                    sx={{ paddingTop: '16px' }}
                    component="div"
                    variant="body4"
                  >
                    {t('report:supplementalWarning')}
                  </Typography>
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
