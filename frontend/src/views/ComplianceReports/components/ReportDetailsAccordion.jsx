import React, { useState } from 'react'
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { NotionalTransferSummary } from '../../NotionalTransfers/NotionalTransferSummary'
import { OtherUsesSummary } from '../../OtherUses/OtherUsesSummary'

const ReportDetailsAccordion = ({ compliancePeriod }) => {
  const [expanded, setExpanded] = useState({
    notionalTransfers: true,
    otherUses: false,
  })

  const handleChange = (panel) => (event, isExpanded) => {
    setExpanded({ ...expanded, [panel]: isExpanded })
  }

  return (
    <>
      <Typography color="primary" variant="h4">
        Report Details
      </Typography>
      <Accordion
        expanded={expanded.notionalTransfers}
        onChange={handleChange('notionalTransfers')}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1-content"
        >
          <Typography>Notional Transfers</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <NotionalTransferSummary compliancePeriod={compliancePeriod} />
        </AccordionDetails>
      </Accordion>
      <Accordion
        expanded={expanded.otherUses}
        onChange={handleChange('otherUses')}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel2-content"
        >
          <Typography>Other Uses</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <OtherUsesSummary compliancePeriod={compliancePeriod} />
        </AccordionDetails>
      </Accordion>
    </>
  )
}

export default ReportDetailsAccordion
