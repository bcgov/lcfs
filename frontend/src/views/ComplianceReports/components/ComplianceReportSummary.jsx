import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Stack
} from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import SigningAuthorityDeclaration from './SigningAuthorityDeclaration'
import SummaryTable from './SummaryTable'
import {
  lowCarbonColumns,
  nonComplianceColumns,
  renewableFuelColumns
} from './_schema'
import {
  useGetComplianceReportSummary,
  useUpdateComplianceReportSummary
} from '@/hooks/useComplianceReports'
import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import Loading from '@/components/Loading'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { roles } from '@/constants/roles'
import { useOrganizationSnapshot } from '@/hooks/useOrganizationSnapshot.js'
import { CompareReports } from '@/views/CompareReports/CompareReports.jsx'
import { TogglePanel } from '@/components/TogglePanel.jsx'
import { ExpandMore } from '@mui/icons-material'

const ComplianceReportSummary = ({
  reportID,
  currentStatus,
  canEdit,
  compliancePeriodYear,
  setIsSigningAuthorityDeclared,
  buttonClusterConfig,
  methods,
  enableCompareMode,
  alertRef
}) => {
  const [summaryData, setSummaryData] = useState(null)
  const [hasRecords, setHasRecords] = useState(false)
  const [hasValidAddress, setHasValidAddress] = useState(false)
  const { t } = useTranslation(['report'])

  const { data: snapshotData } = useOrganizationSnapshot(reportID)

  const { hasRoles, data: currentUser } = useCurrentUser()
  const isGovernmentUser = currentUser?.isGovernmentUser

  const { data, isLoading, isError, error, isFetching } =
    useGetComplianceReportSummary(reportID)
  const { mutate: updateComplianceReportSummary } =
    useUpdateComplianceReportSummary(data?.complianceReportId, {
      onSuccess: (response) => {
        setSummaryData(response.data)
      },
      onError: (error) => {
        alertRef.current?.triggerAlert({
          message: error.message,
          severity: 'error'
        })
      }
    })
  useEffect(() => {
    if (data) {
      setSummaryData(data)
      setHasRecords(data && data.canSign)
    }
    if (isError) {
      alertRef.current?.triggerAlert({
        message: error?.response?.data?.detail || error.message,
        severity: 'error'
      })
    }
  }, [alertRef, data, error, isError])

  useEffect(() => {
    if (snapshotData) {
      // Exclude headOfficeAddress and recordsAddress from the validity check
      const { headOfficeAddress, recordsAddress, ...rest } = snapshotData
      const dataToCheck = {
        ...rest,
        isEdited: true // Hardcode since we don't want it in the validity check
      }
      const hasValidAddress = Object.values(dataToCheck).reduce(
        (previousValue, currentValue) => currentValue && !!previousValue,
        true
      )
      setHasValidAddress(hasValidAddress)
    }
  }, [snapshotData])

  const handleCellEdit = useCallback(
    (data) => {
      // perform auto save of summary after each cell change
      const updatedData = { ...summaryData, renewableFuelTargetSummary: data }
      setSummaryData(updatedData)
      updateComplianceReportSummary(updatedData)
    },
    [summaryData, updateComplianceReportSummary]
  )

  if (isLoading || isFetching) {
    return <Loading message={t('report:summaryLoadingMsg')} />
  }

  if (isError) {
    return (
      <BCTypography color="error">{t('report:errorRetrieving')}</BCTypography>
    )
  }

  return (
    <>
      <BCTypography color="primary" variant="h5" mb={1} mt={2} component="div">
        {t('report:summaryAndDeclaration')}
      </BCTypography>
      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMore sx={{ width: '2rem', height: '2rem' }} />}
          aria-controls="panel1-content"
        >
          <BCTypography color="primary" variant="h6" component="div">
            {t('report:summary')}
          </BCTypography>
        </AccordionSummary>
        <AccordionDetails>
          <TogglePanel
            label="Compare mode"
            disabled={!enableCompareMode}
            onComponent={<CompareReports />}
            offComponent={
              <>
                <SummaryTable
                  data-test="renewable-summary"
                  title={t('report:renewableFuelTargetSummary')}
                  columns={
                    summaryData
                      ? renewableFuelColumns(
                          t,
                          summaryData?.renewableFuelTargetSummary,
                          canEdit,
                          compliancePeriodYear
                        )
                      : []
                  }
                  data={summaryData?.renewableFuelTargetSummary}
                  onCellEditStopped={handleCellEdit}
                  useParenthesis={true}
                />
                <SummaryTable
                  data-test="low-carbon-summary"
                  title={t('report:lowCarbonFuelTargetSummary')}
                  columns={lowCarbonColumns(t)}
                  data={summaryData?.lowCarbonFuelTargetSummary}
                  width={'80.65%'}
                />
                <SummaryTable
                  data-test="non-compliance-summary"
                  title={t('report:nonCompliancePenaltySummary')}
                  columns={nonComplianceColumns(t)}
                  data={summaryData?.nonCompliancePenaltySummary}
                  width={'80.65%'}
                />
              </>
            }
          />
          {currentStatus === COMPLIANCE_REPORT_STATUSES.DRAFT && (
            <>
              {!isGovernmentUser && (
                <SigningAuthorityDeclaration
                  onChange={setIsSigningAuthorityDeclared}
                  hasAuthority={hasRoles(roles.signing_authority)}
                  hasRecords={hasRecords}
                  hasValidAddress={hasValidAddress}
                />
              )}

              <Stack direction="row" justifyContent="flex-start" mt={2} gap={2}>
                {buttonClusterConfig[currentStatus]?.map(
                  (config) =>
                    config && (
                      <BCButton
                        key={config.id}
                        data-test={config.id}
                        id={config.id}
                        size="small"
                        variant={config.variant}
                        color={config.color}
                        onClick={methods.handleSubmit(config.handler)}
                        startIcon={
                          config.startIcon && (
                            <FontAwesomeIcon
                              icon={config.startIcon}
                              className="small-icon"
                            />
                          )
                        }
                        disabled={config.disabled}
                      >
                        {config.label}
                      </BCButton>
                    )
                )}
              </Stack>
            </>
          )}
        </AccordionDetails>
      </Accordion>
    </>
  )
}

export default ComplianceReportSummary
