import { useEffect, useState, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  CircularProgress,
  Stack
} from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SigningAuthorityDeclaration from './SigningAuthorityDeclaration'
import SummaryTable from './SummaryTable'
import {
  renewableFuelColumns,
  lowCarbonColumns,
  nonComplianceColumns
} from './_schema'
import {
  useGetComplianceReportSummary,
  useUpdateComplianceReportSummary
} from '@/hooks/useComplianceReports'
import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import BCAlert from '@/components/BCAlert'

const ComplianceReportSummary = ({ reportID, currentStatus, compliancePeriodYear, setIsSigningAuthorityDeclared, buttonClusterConfig, methods }) => {
  const [summaryData, setSummaryData] = useState(null)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const alertRef = useRef()

  const { t } = useTranslation(['report'])
  const location = useLocation()

  const { data, isLoading, isError, error } =
    useGetComplianceReportSummary(reportID)
  const { mutate: updateComplianceReportSummary } =
    useUpdateComplianceReportSummary(data?.complianceReportId, {
      onSuccess: (response) => {
        setSummaryData(response.data)
      },
      onError: (error) => {
        setAlertMessage(error.message)
        setAlertSeverity('error')
        alertRef.current.triggerAlert()
      }
    })
  useEffect(() => {
    if (data) {
      setSummaryData(data)
    }
  }, [data])

  const handleCellEdit = useCallback(
    (data) => {
      // perform auto save of summary after each cell change
      const updatedData = { ...summaryData, renewableFuelTargetSummary: data }
      setSummaryData(updatedData)
      updateComplianceReportSummary(updatedData)
    },
    [summaryData, updateComplianceReportSummary]
  )

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
    if (isError) {
      setAlertMessage(error.message)
      setAlertSeverity('error')
    }
  }, [isError, error, location.state])

  if (isLoading) {
    return <CircularProgress />
  }

  if (isError) {
    return <Typography color="error">{t('report:errorRetrieving')}</Typography>
  }

  return (
    <>
      {alertMessage && (
        <BCAlert ref={alertRef} severity={alertSeverity}>
          {alertMessage}
        </BCAlert>
      )}
      <Typography color="primary" variant="h5" mb={2} component="div">
        {t('report:summaryAndDeclaration')}
      </Typography>
      {(summaryData?.renewableFuelTargetSummary[2]?.gasoline > 0 ||
        summaryData?.renewableFuelTargetSummary[2]?.diesel > 0 ||
        summaryData?.renewableFuelTargetSummary[2]?.jetFuel > 0) &&
        <Accordion defaultExpanded>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ width: '2rem', height: '2rem' }} />}
            aria-controls="panel1-content"
          >
            <BCTypography color="primary" variant="h6" component="div">
              {t('report:summary')}
            </BCTypography>
          </AccordionSummary>
          <AccordionDetails>
            <SummaryTable
              title={t('report:renewableFuelTargetSummary')}
              columns={
                summaryData
                  ? renewableFuelColumns(
                    t,
                    summaryData?.renewableFuelTargetSummary,
                    currentStatus === 'Draft',
                    compliancePeriodYear
                  )
                  : []
              }
              data={summaryData?.renewableFuelTargetSummary}
              onCellEditStopped={handleCellEdit}
            />
            <SummaryTable
              title={t('report:lowCarbonFuelTargetSummary')}
              columns={lowCarbonColumns(t)}
              data={summaryData?.lowCarbonFuelTargetSummary}
              width={'81%'}
            />
            <SummaryTable
              title={t('report:nonCompliancePenaltySummary')}
              columns={nonComplianceColumns(t)}
              data={summaryData?.nonCompliancePenaltySummary}
              width={'81%'}
            />
            {currentStatus === 'Draft' && (
              <SigningAuthorityDeclaration
                onChange={setIsSigningAuthorityDeclared}
              />
            )}
            <Stack direction="row" justifyContent="flex-end" mt={2} gap={2}>
              {buttonClusterConfig[currentStatus]?.map(
                (config) =>
                  config && (
                    <BCButton
                      key={config.id}
                      data-test={config.id}
                      id={config.id}
                      size="large"
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
          </AccordionDetails>
        </Accordion>
      }
    </>
  )
}

export default ComplianceReportSummary
