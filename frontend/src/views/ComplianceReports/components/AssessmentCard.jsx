import React, { useMemo } from 'react'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { Role } from '@/components/Role'
import { StyledListItem } from '@/components/StyledListItem'
import { roles } from '@/constants/roles'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { useCreateSupplementalReport } from '@/hooks/useComplianceReports'
import AssignmentIcon from '@mui/icons-material/Assignment'
import { List, ListItemText, Stack } from '@mui/material'
import Box from '@mui/material/Box'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config.js'
import { HistoryCard } from '@/views/ComplianceReports/components/HistoryCard.jsx'
import { OrganizationAddress } from '@/views/ComplianceReports/components/OrganizationAddress.jsx'
import { useOrganizationSnapshot } from '@/hooks/useOrganizationSnapshot.js'
import Loading from '@/components/Loading.jsx'

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
  const { t } = useTranslation(['report', 'org'])
  const navigate = useNavigate()

  const [isEditing, setIsEditing] = React.useState(false)

  const onEdit = () => {
    setIsEditing(true)
  }

  const { data: snapshotData, isLoading: snapshotLoading } =
    useOrganizationSnapshot(complianceReportId)

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

  const filteredChain = useMemo(() => {
    return chain.filter((report) => {
      return report.history && report.history.length > 0
    })
  }, [chain])

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
      editButton={
        !isEditing && {
          onClick: onEdit,
          text: 'Edit',
          id: 'edit'
        }
      }
      content={
        <>
          <Stack direction="column" spacing={0.5}>
            <BCTypography variant="h6" color="primary">
              {orgData?.name}{' '}
              {snapshotData?.isEdited && t('report:addressEdited')}
            </BCTypography>

            {snapshotLoading && <Loading />}
            {!snapshotLoading && (
              <OrganizationAddress
                snapshotData={snapshotData}
                complianceReportId={complianceReportId}
                isEditing={isEditing}
                setIsEditing={setIsEditing}
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
            {filteredChain.length > 0 &&
              currentStatus !== COMPLIANCE_REPORT_STATUSES.DRAFT && (
                <>
                  <BCTypography
                    sx={{ paddingTop: '16px' }}
                    component="div"
                    variant="h6"
                    color="primary"
                  >
                    {t('report:reportHistory')}
                  </BCTypography>
                  {filteredChain.map((report) => (
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
