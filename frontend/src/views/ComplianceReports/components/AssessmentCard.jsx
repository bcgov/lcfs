import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import Loading from '@/components/Loading.jsx'
import { Role } from '@/components/Role'
import { StyledListItem } from '@/components/StyledListItem'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config.js'
import { roles } from '@/constants/roles'
import { apiRoutes } from '@/constants/routes/index.js'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import {
  useCreateSupplementalReport,
  useGetComplianceReport
} from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useOrganizationSnapshot } from '@/hooks/useOrganizationSnapshot.js'
import { useApiService } from '@/services/useApiService.js'
import { HistoryCard } from '@/views/ComplianceReports/components/HistoryCard.jsx'
import { OrganizationAddress } from '@/views/ComplianceReports/components/OrganizationAddress.jsx'
import { FileDownload } from '@mui/icons-material'
import AssignmentIcon from '@mui/icons-material/Assignment'
import { List, ListItemText, Stack } from '@mui/material'
import Box from '@mui/material/Box'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

export const AssessmentCard = ({
  orgData,
  hasMetRenewables,
  hasMetLowCarbon,
  hasSupplemental,
  isGovernmentUser,
  currentStatus,
  complianceReportId,
  alertRef,
  chain
}) => {
  const { t } = useTranslation(['report', 'org'])
  const navigate = useNavigate()
  const apiService = useApiService()
  const { data: currentUser, isLoading: isCurrentUserLoading } =
    useCurrentUser()

  const [isEditing, setIsEditing] = useState(false)

  const { data: reportData, isLoading: isReportLoading } =
    useGetComplianceReport(
      currentUser?.organization?.organizationId,
      complianceReportId
    )

  const onEdit = () => {
    setIsEditing(true)
  }

  const { data: snapshotData, isLoading: snapshotLoading } =
    useOrganizationSnapshot(complianceReportId)

  const [isDownloading, setIsDownloading] = useState(false)
  const onDownloadReport = async () => {
    setIsDownloading(true)
    try {
      await apiService.download(
        apiRoutes.exportComplianceReport.replace(
          ':reportID',
          complianceReportId
        )
      )
    } finally {
      setIsDownloading(false)
    }
  }

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

  if (isCurrentUserLoading || isReportLoading) {
    return <Loading />
  }

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
        !isEditing &&
        currentStatus === COMPLIANCE_REPORT_STATUSES.DRAFT && {
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
                            hasMet: hasMetRenewables ? 'has met' : 'has not met'
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
                            hasMet: hasMetLowCarbon ? 'has met' : 'has not met'
                          })
                        }}
                      />
                    </ListItemText>
                  </StyledListItem>
                </List>
              </>
            )}{' '}
            {reportData.report.assessmentStatement &&
              ((!isGovernmentUser &&
                [5, 6, 7].includes(reportData.report.currentStatus)) ||
                isGovernmentUser) && (
                <>
                  <BCTypography
                    sx={{ paddingTop: '16px' }}
                    component="div"
                    variant="h6"
                    color="primary"
                  >
                    {t('report:assessmentStatement')}{' '}
                    <span style={{ color: 'red' }}>
                      {isGovernmentUser && t('report:assessmentStatementEdit')}
                    </span>
                  </BCTypography>
                  <List sx={{ padding: 0 }}>
                    <StyledListItem>
                      <ListItemText
                        primaryTypographyProps={{ variant: 'body4' }}
                      >
                        {reportData.report.assessmentStatement}
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
                        size="small"
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
            {currentStatus !== COMPLIANCE_REPORT_STATUSES.DRAFT && (
              <Box>
                <BCButton
                  data-test="download-report"
                  size="small"
                  className="svg-icon-button"
                  variant="outlined"
                  color="primary"
                  onClick={onDownloadReport}
                  startIcon={<FileDownload />}
                  sx={{ mt: 3 }}
                  loading={isDownloading}
                  disabled={isDownloading}
                >
                  {t('report:downloadExcel')}
                </BCButton>
              </Box>
            )}
            <Role roles={[roles.analyst]}>
              <Box>
                <BCButton
                  data-test="create-supplemental"
                  size="small"
                  className="svg-icon-button"
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
