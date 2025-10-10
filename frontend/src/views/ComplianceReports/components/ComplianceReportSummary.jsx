import { useCallback, useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Stack,
  FormControlLabel,
  Checkbox,
  Box
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
  alertRef,
  hasEligibleRenewableFuel,
  setHasEligibleRenewableFuel
}) => {
  const [summaryData, setSummaryData] = useState(null)
  const [hasRecords, setHasRecords] = useState(false)
  const [hasValidAddress, setHasValidAddress] = useState(false)
  const [penaltyOverrideEnabled, setPenaltyOverrideEnabled] = useState(false)
  const [savingCellKey, setSavingCellKey] = useState(null)
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
        setSavingCellKey(null)
      },
      onError: (error) => {
        setSavingCellKey(null)
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
      setPenaltyOverrideEnabled(data.penaltyOverrideEnabled || false)
      setHasEligibleRenewableFuel(
        data.renewableFuelTargetSummary[2].diesel > 0 ||
          data.renewableFuelTargetSummary[2].gasoline > 0 ||
          false
      )
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
    (data, cellInfo = null) => {
      // perform auto save of summary after each cell change
      const updatedData = { ...summaryData, renewableFuelTargetSummary: data }
      setSummaryData(updatedData)
      if (cellInfo) {
        setSavingCellKey(`renewable_${cellInfo.rowIndex}_${cellInfo.columnId}`)
      }
      updateComplianceReportSummary(updatedData)
    },
    [summaryData, updateComplianceReportSummary]
  )

  const handlePenaltyOverrideCellEdit = useCallback(
    (data, cellInfo = null) => {
      // Extract penalty override values from edited non-compliance penalty summary data
      // Row 0 (index 0) = Line 11 renewable fuel penalty -> renewablePenaltyOverride
      // Row 1 (index 1) = Line 21 low carbon fuel penalty -> lowCarbonPenaltyOverride
      const renewablePenaltyValue = data[0]?.totalValue || null
      const lowCarbonPenaltyValue = data[1]?.totalValue || null

      const updatedData = {
        ...summaryData,
        nonCompliancePenaltySummary: data,
        renewablePenaltyOverride: renewablePenaltyValue,
        lowCarbonPenaltyOverride: lowCarbonPenaltyValue,
        penaltyOverrideDate: new Date().toISOString(),
        penaltyOverrideUser: currentUser?.userProfileId
      }

      if (cellInfo) {
        setSavingCellKey(`penalty_${cellInfo.rowIndex}_${cellInfo.columnId}`)
      }
      setSummaryData(updatedData)
      updateComplianceReportSummary(updatedData)
    },
    [summaryData, updateComplianceReportSummary, currentUser]
  )

  // Computed data for non-compliance penalty summary based on override state
  const nonCompliancePenaltyDisplayData = useMemo(() => {
    if (!summaryData?.nonCompliancePenaltySummary) return null

    const originalData = summaryData.nonCompliancePenaltySummary

    if (!penaltyOverrideEnabled) {
      // When override is disabled, show original calculated values
      return originalData
    }

    // When override is enabled, show override values
    return originalData.map((row, index) => {
      if (index === 0) {
        // Line 11: Renewable fuel penalty - show override value
        return {
          ...row,
          totalValue: summaryData.renewablePenaltyOverride || 0
        }
      } else if (index === 1) {
        // Line 21: Low carbon fuel penalty - show override value
        return {
          ...row,
          totalValue: summaryData.lowCarbonPenaltyOverride || 0
        }
      } else if (index === 2) {
        // Total row: Sum of override values (calculated from backend)
        return {
          ...row,
          totalValue:
            (summaryData.renewablePenaltyOverride || 0) +
            (summaryData.lowCarbonPenaltyOverride || 0)
        }
      }
      return row
    })
  }, [summaryData, penaltyOverrideEnabled])

  const handleCheckboxToggle = useCallback(
    (enabled) => {
      setPenaltyOverrideEnabled(enabled)
      const updatedData = {
        ...summaryData,
        penaltyOverrideEnabled: enabled,
        // If enabling, set audit fields immediately
        ...(enabled
          ? {
              penaltyOverrideDate: new Date().toISOString(),
              penaltyOverrideUser: currentUser?.userProfileId
            }
          : {
              renewablePenaltyOverride: null,
              lowCarbonPenaltyOverride: null,
              penaltyOverrideDate: null,
              penaltyOverrideUser: null
            })
      }
      console.log('Checkbox toggle - sending to backend:', updatedData)
      updateComplianceReportSummary(updatedData)
    },
    [summaryData, updateComplianceReportSummary, currentUser]
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
                          compliancePeriodYear,
                          summaryData?.lines7And9Locked
                        )
                      : []
                  }
                  data={summaryData?.renewableFuelTargetSummary}
                  onCellEditStopped={handleCellEdit}
                  useParenthesis={true}
                  lines7And9Locked={summaryData?.lines7And9Locked}
                  savingCellKey={savingCellKey}
                  tableType="renewable"
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
                  columns={nonComplianceColumns(t, penaltyOverrideEnabled)}
                  data={nonCompliancePenaltyDisplayData}
                  width={'80.65%'}
                  onCellEditStopped={
                    penaltyOverrideEnabled
                      ? handlePenaltyOverrideCellEdit
                      : undefined
                  }
                  savingCellKey={savingCellKey}
                  tableType="penalty"
                />
                {hasRoles(roles.director) &&
                  parseInt(compliancePeriodYear) >= 2024 &&
                  (currentStatus ===
                    COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST ||
                    currentStatus ===
                      COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER) && (
                    <Box sx={{ mb: 2 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={penaltyOverrideEnabled}
                            onChange={(e) =>
                              handleCheckboxToggle(e.target.checked)
                            }
                            data-test="penalty-override-checkbox"
                          />
                        }
                        label="Override penalty calculations"
                      />
                    </Box>
                  )}
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
                  hasEligibleRenewableFuel={hasEligibleRenewableFuel}
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
