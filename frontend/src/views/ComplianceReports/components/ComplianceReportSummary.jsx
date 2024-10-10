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
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import Loading from '@/components/Loading'

const ComplianceReportSummary = ({ reportID, currentStatus, compliancePeriodYear, setIsSigningAuthorityDeclared, buttonClusterConfig, methods, setHasMet, alertRef }) => {
  const [summaryData, setSummaryData] = useState(null)
  const { t } = useTranslation(['report'])

  const { data, isLoading, isError } =
    useGetComplianceReportSummary(reportID)
  const { mutate: updateComplianceReportSummary } =
    useUpdateComplianceReportSummary(data?.complianceReportId, {
      onSuccess: (response) => {
        setSummaryData(response.data)
        setHasMet(response.data?.nonCompliancePenaltySummary[0]?.totalValue <= 0 || response.data?.nonCompliancePenaltySummary[1].totalValue <= 0)
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
      setHasMet(data?.nonCompliancePenaltySummary[0]?.totalValue <= 0 || data?.nonCompliancePenaltySummary[1].totalValue <= 0)
    }
  }, [data, setHasMet])

  const handleCellEdit = useCallback(
    (data) => {
      // perform auto save of summary after each cell change
      const updatedData = { ...summaryData, renewableFuelTargetSummary: data }
      setSummaryData(updatedData)
      updateComplianceReportSummary(updatedData)
    },
    [summaryData, updateComplianceReportSummary]
  )

  if (isLoading) {
    return <Loading message='Loading compliance report summary...' />
  }

  if (isError) {
    return <Typography color="error">{t('report:errorRetrieving')}</Typography>
  }

  return (
    <>
      <Typography color="primary" variant="h5" mb={2} component="div">
        {t('report:summaryAndDeclaration')}
      </Typography>
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
            useParenthesis={true}
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
          {currentStatus === COMPLIANCE_REPORT_STATUSES.DRAFT && (
            <>
              <SigningAuthorityDeclaration
                onChange={setIsSigningAuthorityDeclared}
              />
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
            </>
          )}
        </AccordionDetails>
      </Accordion>
    </>
  )
}

export default ComplianceReportSummary
