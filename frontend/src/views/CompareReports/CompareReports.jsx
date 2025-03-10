import BCAlert from '@/components/BCAlert'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  lowCarbonColumns,
  nonCompliancePenaltyColumns,
  renewableFuelColumns
} from '@/views/CompareReports/_schema'
import {
  useGetComplianceReportSummary,
  useListComplianceReports
} from '@/hooks/useComplianceReports'
import { Icon, MenuItem, Select } from '@mui/material'
import Box from '@mui/material/Box'
import Loading from '@/components/Loading'
import CompareTable from '@/views/CompareReports/components/CompareTable'
import { styled } from '@mui/material/styles'

const Controls = styled(Box)({
  width: '66%'
})

export const CompareReports = () => {
  const { t } = useTranslation(['common', 'report'])
  const [alertMessage, setAlertMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [alertSeverity, setAlertSeverity] = useState('info')

  const alertRef = useRef()
  const { hasRoles, data: currentUser } = useCurrentUser()
  const [reports, setReports] = useState([])

  const { data: response } = useListComplianceReports(
    currentUser?.organization?.organizationId
  )

  const [report1, setReport1] = useState(null)
  const [report2, setReport2] = useState(null)
  const [fuelType, setFuelType] = useState('gasoline')
  useEffect(() => {
    if (response) {
      const { reports } = response.data
      if (reports?.length > 0) {
        setReport1(reports[0])
      }
      if (reports?.length > 1) {
        setReport2(reports[1])
      }
      setReports(reports)
      setIsLoading(false)
    }
  }, [response])

  const { data: report1Summary } = useGetComplianceReportSummary(
    report1?.complianceReportId
  )
  const { data: report2Summary } = useGetComplianceReportSummary(
    report2?.complianceReportId
  )

  const [renewableSummary, SetRenewableSummary] = useState([])
  const [lowCarbonSummary, SetLowCarbonSummary] = useState([])
  const [nonCompliancePenaltySummary, SetNonCompliancePenaltySummary] =
    useState([])
  useEffect(() => {
    const renewableSummary = []
    const lowCarbonSummary = []
    const nonCompliancePenaltySummary = []
    if (report1Summary) {
      for (const row of report1Summary.renewableFuelTargetSummary) {
        renewableSummary.push({
          line: row.line,
          description: row.description,
          format: row.format,
          report1: row[fuelType]
        })
      }
      for (const row of report1Summary.lowCarbonFuelTargetSummary) {
        lowCarbonSummary.push({
          line: row.line,
          description: row.description,
          format: row.format,
          report1: row.value
        })
      }
      for (const row of report1Summary.nonCompliancePenaltySummary) {
        nonCompliancePenaltySummary.push({
          line: row.line,
          description: row.description,
          format: row.format,
          report1: row.value
        })
      }
    }
    if (report2Summary) {
      for (const row of renewableSummary) {
        const matchingRow = report2Summary.renewableFuelTargetSummary.find(
          (row2) => row2.line === row.line
        )
        row.report2 = matchingRow[fuelType]
        row.delta = (row.report2 ?? 0) - row.report1
      }
      for (const row of lowCarbonSummary) {
        const matchingRow = report2Summary.lowCarbonFuelTargetSummary.find(
          (row2) => row2.line === row.line
        )
        row.report2 = matchingRow.value
        row.delta = row.report2 !== null ? row.report2 - row.report1 : null
      }
      for (const row of nonCompliancePenaltySummary) {
        const matchingRow = report2Summary.nonCompliancePenaltySummary.find(
          (row2) => row2.line === row.line
        )
        row.report2 = matchingRow.value
        row.delta = row.report2 !== null ? row.report2 - row.report1 : null
      }
    }
    SetRenewableSummary(renewableSummary)
    SetLowCarbonSummary(lowCarbonSummary)
    SetNonCompliancePenaltySummary(nonCompliancePenaltySummary)
  }, [report1Summary, report2Summary, fuelType])

  function onSelectReport1(event) {
    const compliancePeriod = event.target.value
    const report = reports.find(
      (report) => report.compliancePeriod === compliancePeriod
    )
    setReport1(report)
  }

  function onSelectReport2(event) {
    const compliancePeriod = event.target.value
    const report = reports.find(
      (report) => report.compliancePeriod === compliancePeriod
    )
    setReport2(report)
  }

  if (isLoading) {
    return <Loading />
  }

  return (
    <>
      <Box>
        {alertMessage && (
          <BCAlert
            ref={alertRef}
            data-test="alert-box"
            severity={alertSeverity}
            delay={6500}
          >
            {alertMessage}
          </BCAlert>
        )}
      </Box>
      <Controls>
        <Box>
          <h5>{t('report:compareReports')}:</h5>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 48px 1fr',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Select
              name="Report 1 Select"
              sx={{
                marginTop: 1,
                padding: '8px',
                borderRadius: 1
              }}
              value={report1?.compliancePeriod}
              variant="outlined"
              onChange={onSelectReport1}
            >
              {reports.map((report, index) => (
                <MenuItem key={index} value={report.compliancePeriod}>
                  {`${t('report:complianceReport')} ${report.compliancePeriod}`}
                </MenuItem>
              ))}
            </Select>
            <Icon sx={{ transform: 'scale(1.5)', marginTop: '4px', width: 1 }}>
              compare_arrows
            </Icon>
            <Select
              name="Report 2 Select"
              sx={{
                marginTop: 1,
                padding: '8px',
                borderRadius: 1
              }}
              value={report2?.compliancePeriod}
              variant="outlined"
              onChange={onSelectReport2}
            >
              {reports.map((report, index) => (
                <MenuItem key={index} value={report.compliancePeriod}>
                  {`${t('report:complianceReport')} ${report.compliancePeriod}`}
                </MenuItem>
              ))}
            </Select>
          </Box>
        </Box>
      </Controls>
      <CompareTable
        title={t('report:renewableFuelTargetSummary')}
        columns={renewableFuelColumns(
          t,
          report1 ? `CR${report1.compliancePeriod}` : '',
          report2 ? `CR${report2.compliancePeriod}` : ''
        )}
        data={renewableSummary}
        useParenthesis={true}
        enableFuelControls={true}
        setFuelType={setFuelType}
        fuelType={fuelType}
      />
      <CompareTable
        title={t('report:lowCarbonFuelTargetSummary')}
        columns={lowCarbonColumns(
          t,
          report1 ? `CR${report1.compliancePeriod}` : '',
          report2 ? `CR${report2.compliancePeriod}` : ''
        )}
        data={lowCarbonSummary}
      />
      <CompareTable
        title={t('report:nonCompliancePenaltySummary')}
        columns={nonCompliancePenaltyColumns(
          t,
          report1 ? `CR${report1.compliancePeriod}` : '',
          report2 ? `CR${report2.compliancePeriod}` : ''
        )}
        data={nonCompliancePenaltySummary}
      />
    </>
  )
}
