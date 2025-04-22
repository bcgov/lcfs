import { useTranslation } from 'react-i18next'
import { Accordion, AccordionDetails, AccordionSummary } from '@mui/material'
import SummaryTable from './SummaryTable'
import { earlyIssuanceColumns } from './_schema'
import { useGetComplianceReportSummary } from '@/hooks/useComplianceReports'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { ExpandMore } from '@mui/icons-material'

const ComplianceReportEarlyIssuanceSummary = ({ reportData }) => {
  const { t } = useTranslation(['report'])

  const { data, isLoading } = useGetComplianceReportSummary(
    reportData?.report.complianceReportId
  )

  if (isLoading) {
    return <Loading message={t('report:summaryLoadingMsg')} />
  }

  return (
    <Accordion defaultExpanded>
      <AccordionSummary
        expandIcon={<ExpandMore sx={{ width: '2rem', height: '2rem' }} />}
        aria-controls="panel1-content"
      >
        <BCTypography color="primary" variant="h6" component="div">
          {t('report:summaryAndDeclaration')}
        </BCTypography>
      </AccordionSummary>
      <AccordionDetails>
        <SummaryTable
          data-test="early-issuance-summary"
          title={t('report:nonCompliancePenaltySummary')}
          columns={earlyIssuanceColumns(t)}
          data={data?.earlyIssuanceSummary}
        />
      </AccordionDetails>
    </Accordion>
  )
}

export default ComplianceReportEarlyIssuanceSummary
