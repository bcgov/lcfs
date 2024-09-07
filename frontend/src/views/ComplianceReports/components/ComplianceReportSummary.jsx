import { useEffect, useState, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  CircularProgress
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
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
import SigningAuthorityDeclaration from './SigningAuthorityDeclaration'
import BCTypography from '@/components/BCTypography'
import BCBox from '@/components/BCBox'
import BCAlert from '@/components/BCAlert'

const ComplianceReportSummary = ({ reportID }) => {
  const [summaryData, setSummaryData] = useState(null)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const alertRef = useRef()

  const { t } = useTranslation(['report'])
  const location = useLocation()

  const { data, isLoading, isError, error } =
    useGetComplianceReportSummary(reportID)
  const { mutate: updateComplianceReportSummary } =
    useUpdateComplianceReportSummary(
      data?.complianceReportId,
      data?.summaryId,
      {
        onSuccess: (response) => {
          setSummaryData(response.data)
        },
        onError: (error) => {
          setAlertMessage(error.message)
          setAlertSeverity('error')
          alertRef.current.triggerAlert()
        }
      }
    )
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
      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon sx={{ width: '2rem', height: '2rem' }} />}
          aria-controls="panel1-content"
        >
          <BCBox>
            <BCTypography color="primary" variant="h5">
              {t('report:summaryAndDeclaration')}
            </BCTypography>
          </BCBox>
        </AccordionSummary>
        <AccordionDetails>
          <SummaryTable
            title={t('report:renewableFuelTargetSummary')}
            columns={
              summaryData
                ? renewableFuelColumns(
                    summaryData?.renewableFuelTargetSummary,
                    true
                  )
                : []
            }
            data={summaryData?.renewableFuelTargetSummary}
            onCellEditStopped={handleCellEdit}
          />
          <SummaryTable
            title={t('report:lowCarbonFuelTargetSummary')}
            columns={lowCarbonColumns}
            data={summaryData?.lowCarbonFuelTargetSummary}
            width={'81%'}
          />
          <SummaryTable
            title={t('report:nonCompliancePenaltySummary')}
            columns={nonComplianceColumns}
            data={summaryData?.nonCompliancePenaltySummary}
            width={'81%'}
          />
        </AccordionDetails>
      </Accordion>
    </>
  )
}

export default ComplianceReportSummary
