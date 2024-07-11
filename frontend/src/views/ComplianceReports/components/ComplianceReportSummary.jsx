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
import { useGetComplianceReportSummary } from '@/hooks/useComplianceReports'
import SigningAuthorityDeclaration from './SigningAuthorityDeclaration'
import BCTypography from '@/components/BCTypography'
import BCBox from '@/components/BCBox'

const ComplianceReportSummary = ({ reportID, collapseAll }) => {
  const { t } = useTranslation(['report'])

  const { data, isLoading, isError, error } = useGetComplianceReportSummary(reportID)

  if (isLoading) {
    return <CircularProgress />
  }

  if (isError) {
    return <Typography color="error">{t('report:errorRetrieving')}</Typography>
  }

  return (
    <>
      <Accordion expanded={!collapseAll}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon sx={{ width: '2rem', height: '2rem' }} />}
          aria-controls="panel1-content"
        >
          <BCBox>
            <BCTypography color="primary" variant="h5">
              {t('report:summaryAndDeclaration')}
            </BCTypography>
            <List sx={{ padding: 0, marginTop: 1, marginLeft: 3 }}>
              <ListItem sx={{ display: 'list-item', paddingLeft: 0, paddingRight: 0, listStyleType: 'disc' }}>
                <BCTypography
                  variant="h6"
                  color="link"
                  sx={{
                    textDecoration: 'underline',
                    '&:hover': { color: 'info.main' },
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
            columns={renewableFuelColumns} 
            data={data.renewableFuelTargetSummary} 
          />
          <SummaryTable 
            title={t('report:lowCarbonFuelTargetSummary')} 
            columns={lowCarbonColumns} 
            data={data.lowCarbonFuelTargetSummary} 
          />
          <SummaryTable 
            title={t('report:nonCompliancePenaltySummary')} 
            columns={nonComplianceColumns} 
            data={data.nonCompliancePenaltySummary} 
          />
          <SigningAuthorityDeclaration />
        </AccordionDetails>
      </Accordion>
    </>
  )
}

export default ComplianceReportSummary