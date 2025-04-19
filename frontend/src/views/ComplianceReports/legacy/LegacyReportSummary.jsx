// import { useEffect, useState } from 'react'
// import { useTranslation } from 'react-i18next'
// import { Accordion, AccordionSummary, AccordionDetails } from '@mui/material'
// import {
//   renewableFuelColumns,
//   lowCarbonColumns,
//   nonComplianceColumns
// } from './_schema'
// import { useGetComplianceReportSummary } from '@/hooks/useComplianceReports'
// import BCTypography from '@/components/BCTypography'
// import Loading from '@/components/Loading'
// import SummaryTable from '../components/SummaryTable'
// import { ExpandMore } from '@mui/icons-material'

// const LegacyReportSummary = ({ reportID, alertRef }) => {
//   const [summaryData, setSummaryData] = useState(null)
//   const { t } = useTranslation(['report'])

//   const { data, isLoading, isError, error } =
//     useGetComplianceReportSummary(reportID)

//   useEffect(() => {
//     if (data) {
//       setSummaryData(data)
//     }
//     if (isError) {
//       alertRef.current?.triggerAlert({
//         message: error?.response?.data?.detail || error.message,
//         severity: 'error'
//       })
//     }
//   }, [alertRef, data, error, isError])

//   if (isLoading) {
//     return <Loading message={t('report:summaryLoadingMsg')} />
//   }

//   if (isError) {
//     return (
//       <BCTypography color="error">{t('report:errorRetrieving')}</BCTypography>
//     )
//   }

//   return (
//     <>
//       <BCTypography color="primary" variant="h5" mb={1} mt={2} component="div">
//         {t('report:summaryAndDeclaration')}
//       </BCTypography>
//       <Accordion defaultExpanded>
//         <AccordionSummary
//           expandIcon={<ExpandMore sx={{ width: '2rem', height: '2rem' }} />}
//           aria-controls="panel1-content"
//         >
//           <BCTypography color="primary" variant="h6" component="div">
//             {t('report:summary')}
//           </BCTypography>
//         </AccordionSummary>
//         <AccordionDetails>
//           <SummaryTable
//             data-test="renewable-summary"
//             title={t('report:part2RenewableFuelTargetSummary')}
//             columns={
//               summaryData
//                 ? renewableFuelColumns(
//                     t,
//                     summaryData?.renewableFuelTargetSummary
//                   )
//                 : []
//             }
//             data={summaryData?.renewableFuelTargetSummary}
//             useParenthesis={true}
//           />
//           <SummaryTable
//             data-test="low-carbon-summary"
//             title={t('report:part3LowCarbonFuelTargetSummary')}
//             columns={lowCarbonColumns(t)}
//             data={summaryData?.lowCarbonFuelTargetSummary}
//             width={'80.65%'}
//           />
//           <SummaryTable
//             data-test="non-compliance-summary"
//             title={t('report:nonCompliancePenaltySummary')}
//             columns={nonComplianceColumns(t)}
//             data={summaryData?.nonCompliancePenaltySummary}
//             width={'80.65%'}
//           />
//         </AccordionDetails>
//       </Accordion>
//     </>
//   )
// }

// export default LegacyReportSummary
