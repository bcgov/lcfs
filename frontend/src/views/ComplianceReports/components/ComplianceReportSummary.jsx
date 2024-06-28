import { Accordion, AccordionSummary, AccordionDetails, Typography, CircularProgress } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SummaryTable from './SummaryTable'
import { renewableFuelColumns, lowCarbonColumns, nonComplianceColumns } from './_schema'
import { useGetComplianceReportSummary } from '@/hooks/useComplianceReports'

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
          <Typography color="primary" variant="h4">
            Summary & Declaration
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <SummaryTable title="Renewable Fuel Target Summary" columns={renewableFuelColumns} data={data.renewableFuelTargetSummary} />
          <SummaryTable title="Low Carbon Fuel Target Summary" columns={lowCarbonColumns} data={data.lowCarbonFuelTargetSummary} />
          <SummaryTable title="Non-compliance Penalty Payable Summary" columns={nonComplianceColumns} data={data.nonCompliancePenaltySummary} />
        </AccordionDetails>
      </Accordion>
    </>
  )
}

export default ComplianceReportSummary
