import { useEffect, useState, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { 
  Accordion, 
  AccordionSummary, 
  AccordionDetails, 
  Typography, 
  CircularProgress,
  List, 
  ListItem 
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SummaryTable from './SummaryTable'
import { renewableFuelColumns, lowCarbonColumns, nonComplianceColumns } from './_schema'
import { useGetComplianceReportSummary, useUpdateComplianceReportSummary } from '@/hooks/useComplianceReports'
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

  const { data, isLoading, isError, error } = useGetComplianceReportSummary(reportID)

  useEffect(() => {
    if (data) {
      setSummaryData(data)
    }
  }, [data])

  const { mutate: updateComplianceReportSummary } =
    useUpdateComplianceReportSummary(reportID, {
      onSuccess: (response) => {
        setSummaryData(response.data)
      },
      onError: (error) => {
        setAlertMessage(error.message)
        setAlertSeverity('error')
        alertRef.current.triggerAlert()
      }
    })
  
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
      <BCAlert
        ref={alertRef}
        data-test="alert-box"
        severity={alertSeverity}
        delay={65000}
      >
        {alertMessage}
      </BCAlert>
      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon sx={{ width: '2rem', height: '2rem' }} />}
          aria-controls="panel1-content"
        >
          <BCBox>
            <BCTypography color="primary" variant="h5">
              {t('report:summaryAndDeclaration')}
            </BCTypography>
            <List sx={{ padding: 0, marginTop: 1, marginLeft: 3 }}>
              <ListItem
                sx={{
                  display: 'list-item',
                  paddingLeft: 0,
                  paddingRight: 0,
                  listStyleType: 'disc'
                }}
              >
                <BCTypography
                  variant="h6"
                  color="link"
                  sx={{
                    textDecoration: 'underline',
                    '&:hover': { color: 'info.main' }
                  }}
                >
                  {t('report:addRenewableFuelRetention')}
                </BCTypography>
              </ListItem>
            </List>
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
          />
          <SummaryTable
            title={t('report:nonCompliancePenaltySummary')}
            columns={nonComplianceColumns}
            data={summaryData?.nonCompliancePenaltySummary}
          />
          <SigningAuthorityDeclaration />
        </AccordionDetails>
      </Accordion>
    </>
  )
}

export default ComplianceReportSummary