import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  lowCarbonColumns,
  nonCompliancePenaltyColumns,
  renewableFuelColumns
} from '@/views/CompareReports/_schema'
import {
  useGetComplianceReport,
  useGetComplianceReportSummary
} from '@/hooks/useComplianceReports'
import { Icon, MenuItem, Select } from '@mui/material'
import Box from '@mui/material/Box'
import Loading from '@/components/Loading'
import CompareTable from '@/views/CompareReports/components/CompareTable'
import { styled } from '@mui/material/styles'
import { useParams } from 'react-router-dom'

const Controls = styled(Box)({
  width: '66%'
})

export const CompareReports = () => {
  const { t } = useTranslation(['common', 'report'])
  const [isLoading, setIsLoading] = useState(true)
  const { data: currentUser, isLoading: isCurrentUserLoading } =
    useCurrentUser()
  const [reportChain, setReportChain] = useState([])

  const { complianceReportId } = useParams()
  const { data: complianceReport } = useGetComplianceReport(
    currentUser?.organization?.organizationId,
    complianceReportId,
    {
      enabled: !!complianceReportId && !isCurrentUserLoading
    }
  )

  const [report1ID, setReport1ID] = useState(null)
  const [report2ID, setReport2ID] = useState(null)
  const [fuelType, setFuelType] = useState('gasoline')

  useEffect(() => {
    if (complianceReport) {
      const { chain } = complianceReport
      // Don't set any default selected reports
      // Let both lists start with empty selections
      setReportChain(chain)
      setIsLoading(false)
    }
  }, [complianceReport])

  const { data: report1Summary } = useGetComplianceReportSummary(report1ID, {
    enabled: !!report1ID
  })
  const { data: report2Summary } = useGetComplianceReportSummary(report2ID, {
    enabled: !!report2ID
  })

  const [renewableSummary, setRenewableSummary] = useState([])
  const [lowCarbonSummary, setLowCarbonSummary] = useState([])
  const [nonCompliancePenaltySummary, setNonCompliancePenaltySummary] =
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
    setRenewableSummary(renewableSummary)
    setLowCarbonSummary(lowCarbonSummary)
    setNonCompliancePenaltySummary(nonCompliancePenaltySummary)
  }, [report1Summary, report2Summary, fuelType])

  function onSelectReport1(event) {
    const newReport1ID = event.target.value
    setReport1ID(newReport1ID)

    // If the newly selected report1 is the same as current report2, we need to change report2
    if (newReport1ID === report2ID && reportChain.length > 1) {
      // Find a new valid report to assign to report2
      const availableReports = reportChain.filter(
        (report) => report.complianceReportId !== newReport1ID
      )

      if (availableReports.length > 0) {
        setReport2ID(availableReports[0].complianceReportId)
      } else {
        // If no other reports are available, reset report2
        setReport2ID(null)
      }
    }
  }

  function onSelectReport2(event) {
    const newReport2ID = event.target.value
    setReport2ID(newReport2ID)

    // If the newly selected report2 is the same as current report1, we need to change report1
    if (newReport2ID === report1ID && reportChain.length > 1) {
      // Find a new valid report to assign to report1
      const availableReports = reportChain.filter(
        (report) => report.complianceReportId !== newReport2ID
      )

      if (availableReports.length > 0) {
        setReport1ID(availableReports[0].complianceReportId)
      } else {
        // If no other reports are available, reset report1
        setReport1ID(null)
      }
    }
  }

  if (isLoading) {
    return <Loading />
  }

  const selectedReportName1 = report1ID
    ? reportChain.find((report) => report.complianceReportId === report1ID)
        ?.nickname || ''
    : ''

  const selectedReportName2 = report2ID
    ? reportChain.find((report) => report.complianceReportId === report2ID)
        ?.nickname || ''
    : ''

  return (
    <>
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
              value={report1ID || ''}
              variant="outlined"
              onChange={onSelectReport1}
              displayEmpty
            >
              {reportChain
                .filter((report) => report.complianceReportId !== report2ID)
                .map((report) => (
                  <MenuItem
                    key={report.complianceReportId}
                    value={report.complianceReportId}
                  >
                    {report.nickname}
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
              value={report2ID || ''}
              variant="outlined"
              onChange={onSelectReport2}
              displayEmpty
            >
              {reportChain
                .filter((report) => report.complianceReportId !== report1ID)
                .map((report) => (
                  <MenuItem
                    key={report.complianceReportId}
                    value={report.complianceReportId}
                  >
                    {report.nickname}
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
          selectedReportName1,
          selectedReportName2
        )}
        data={renewableSummary}
        useParenthesis
        enableFuelControls
        setFuelType={setFuelType}
        fuelType={fuelType}
      />
      <CompareTable
        title={t('report:lowCarbonFuelTargetSummary')}
        columns={lowCarbonColumns(t, selectedReportName1, selectedReportName2)}
        data={lowCarbonSummary}
      />
      <CompareTable
        title={t('report:nonCompliancePenaltySummary')}
        columns={nonCompliancePenaltyColumns(
          t,
          selectedReportName1 ? `CR ${selectedReportName1}` : '',
          selectedReportName2 ? `CR ${selectedReportName2}` : ''
        )}
        data={nonCompliancePenaltySummary}
      />
    </>
  )
}
