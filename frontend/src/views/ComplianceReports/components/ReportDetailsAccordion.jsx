import React, { useState } from 'react'
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { NotionalTransferSummary } from '../../NotionalTransfers/NotionalTransferSummary'

const ReportDetailsAccordion = ({ compliancePeriod }) => {
  const [expanded, setExpanded] = useState(true)

  const handleChange = () => (event, isExpanded) => {
    setExpanded(isExpanded)
  }

  return (
    <>
      <Typography color="primary" variant="h4">
        Report Details
      </Typography>
      <Accordion expanded={expanded} onChange={handleChange()}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1-content"
        />
        <AccordionDetails>
          <NotionalTransferSummary compliancePeriod={compliancePeriod}/>
        </AccordionDetails>
      </Accordion>
    </>
  )
}

export default ReportDetailsAccordion
