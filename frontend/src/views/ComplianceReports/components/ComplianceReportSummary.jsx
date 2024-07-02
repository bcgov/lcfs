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

const ComplianceReportSummary = ({ reportID }) => {
  const { data, isLoading, isError, error } = useGetComplianceReportSummary(reportID)

  if (isLoading) {
    return <CircularProgress />
  }

  if (isError) {
    return <Typography color="error">{error.message}</Typography>
  }

  return (
    <>
      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1-content"
        >
          <BCBox>
            <BCTypography color="primary" variant="h5">
              Summary & Declaration
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
                  Add a renewable fuel retention or obligation deferral
                </BCTypography>
              </ListItem>
            </List>
          </BCBox>
        </AccordionSummary>
        <AccordionDetails>
          <SummaryTable title="Renewable Fuel Target Summary" columns={renewableFuelColumns} data={data.renewableFuelTargetSummary} />
          <SummaryTable title="Low Carbon Fuel Target Summary" columns={lowCarbonColumns} data={data.lowCarbonFuelTargetSummary} />
          <SummaryTable title="Non-compliance Penalty Payable Summary" columns={nonComplianceColumns} data={data.nonCompliancePenaltySummary} />
          <SigningAuthorityDeclaration />
        </AccordionDetails>
      </Accordion>
    </>
  )
}

export default ComplianceReportSummary
