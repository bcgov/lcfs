import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import Loading from '@/components/Loading.jsx'
import { Role } from '@/components/Role'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config.js'
import { roles } from '@/constants/roles'
import { apiRoutes } from '@/constants/routes/index.js'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { useCreateSupplementalReport } from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useOrganizationSnapshot } from '@/hooks/useOrganizationSnapshot.js'
import { useApiService } from '@/services/useApiService.js'
import { HistoryCard } from '@/views/ComplianceReports/components/HistoryCard.jsx'
import { OrganizationAddress } from '@/views/ComplianceReports/components/OrganizationAddress.jsx'
import { Assignment, FileDownload } from '@mui/icons-material'
import { Stack } from '@mui/material'
import Box from '@mui/material/Box'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

export const AssessmentCard = ({
  orgData,
  hasSupplemental,
  isGovernmentUser,
  currentStatus,
  complianceReportId,
  alertRef,
  chain,
  isQuarterlyReport = false,
  reportVersion = 0
}) => {
  const { t } = useTranslation(['report', 'org'])
  const navigate = useNavigate()
  const apiService = useApiService()
  const { hasRoles } = useCurrentUser()

  const [isEditing, setIsEditing] = useState(false)

  const onEdit = () => {
    setIsEditing(true)
  }

  const { data: snapshotData, isLoading: snapshotLoading } =
    useOrganizationSnapshot(complianceReportId)

  const [isDownloading, setIsDownloading] = useState(false)
  const onDownloadReport = async () => {
    setIsDownloading(true)
    try {
      const endpoint = apiRoutes.exportComplianceReport.replace(
        ':reportID',
        complianceReportId
      )
      await apiService.download({ url: endpoint })
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

        navigate(`/compliance-reporting/${compliancePeriodYear}/${newReportId}`)

        // Use alertRef to display the success message
        alertRef?.current?.triggerAlert({
          message: t('report:supplementalCreated'),
          severity: 'success'
        })
      },
      onError: (error) => {
        alertRef?.current?.triggerAlert({
          message: error.message,
          severity: 'error'
        })
      }
    })

  const filteredChain = useMemo(() => {
    return chain.filter((report) => report.history && report.history.length > 0)
  }, [chain])

  const isAddressEditable = useMemo(() => {
    return (
      !isEditing &&
      (currentStatus === COMPLIANCE_REPORT_STATUSES.DRAFT ||
        (hasRoles(roles.analyst) &&
          currentStatus === COMPLIANCE_REPORT_STATUSES.SUBMITTED))
    )
  }, [isEditing, currentStatus, hasRoles])

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
        (isAddressEditable && {
          onClick: onEdit,
          text: 'Edit',
          id: 'edit'
        }) ||
        null
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
                  {filteredChain.map((report, index) => {
                    const assessmentStatement = filteredChain.find(
                      (r) =>
                        r?.assessmentStatement !== null &&
                        r?.assessmentStatement !== undefined
                    )?.assessmentStatement

                    // Hide assessment statement for supplemental reports (version > 0) for IDIR users
                    const shouldShowAssessment =
                      index === 0 &&
                      assessmentStatement &&
                      !(isGovernmentUser && report.version > 0)

                    return (
                      <HistoryCard
                        defaultExpanded={index === 0}
                        key={report.version}
                        report={report}
                        assessedMessage={
                          shouldShowAssessment ? assessmentStatement : false
                        }
                        reportVersion={report.version}
                        currentStatus={currentStatus}
                      />
                    )
                  })}
                </>
              )}
            <Role roles={[roles.supplier]}>
              {isFeatureEnabled(FEATURE_FLAGS.SUPPLEMENTAL_REPORTING) &&
                currentStatus === COMPLIANCE_REPORT_STATUSES.ASSESSED && (
                  <BCTypography
                    sx={{ paddingTop: '16px' }}
                    component="div"
                    variant="body4"
                  >
                    {t('report:supplementalWarning')}
                  </BCTypography>
                )}
            </Role>
            {currentStatus !== COMPLIANCE_REPORT_STATUSES.DRAFT && (
              <Box display={'flex'} gap={2}>
                <Role roles={[roles.supplier]}>
                  {isFeatureEnabled(FEATURE_FLAGS.SUPPLEMENTAL_REPORTING) &&
                    currentStatus === COMPLIANCE_REPORT_STATUSES.ASSESSED && (
                      <Box>
                        <BCButton
                          data-test="create-supplemental"
                          size="small"
                          variant="contained"
                          color="primary"
                          onClick={() => {
                            createSupplementalReport()
                          }}
                          startIcon={
                            <Assignment
                              sx={{
                                width: '1rem',
                                height: '1rem'
                              }}
                            />
                          }
                          sx={{ mt: 3 }}
                          disabled={isLoading}
                        >
                          {t('report:createSupplementalRptBtn')}
                        </BCButton>
                      </Box>
                    )}
                </Role>
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
          </Stack>
        </>
      }
    />
  )
}
