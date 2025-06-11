import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  lowCarbonColumns,
  nonCompliancePenaltyColumns,
  renewableFuelColumns
} from '@/views/CompareReports/_schema'
import { useGetComplianceReportSummary } from '@/hooks/useComplianceReports'
import { Icon, MenuItem, Select } from '@mui/material'
import Box from '@mui/material/Box'
import Loading from '@/components/Loading'
import CompareTable from '@/views/CompareReports/components/CompareTable'
import { styled } from '@mui/material/styles'
import useComplianceReportStore from '@/stores/useComplianceReportStore'

const Controls = styled(Box)({
  width: '66%'
})

export const CompareReports = () => {
  const { t } = useTranslation(['common', 'report'])
  const [isLoading, setIsLoading] = useState(true)
  const [reportChain, setReportChain] = useState([])

  const { currentReport } = useComplianceReportStore()

  const [report1ID, setReport1ID] = useState(null)
  const [report2ID, setReport2ID] = useState(null)
  const [fuelType, setFuelType] = useState('gasoline')

  useEffect(() => {
    if (currentReport) {
      const { chain } = currentReport
      setReportChain(chain)

      // Set default selections to the two most recent reports
      // with the oldest on the left (report1) and newest on the right (report2)
      if (chain.length >= 2) {
        const sortedChain = [...chain].sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        )
        setReport1ID(sortedChain[1].complianceReportId)
        setReport2ID(sortedChain[0].complianceReportId)
      }

      setIsLoading(false)
    }
  }, [currentReport])

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
          report1:
            row.value || row.totalValue || row.amount || row[fuelType] || 0
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
        if (matchingRow) {
          row.report2 = matchingRow.value
          row.delta = row.report2 !== null ? row.report2 - row.report1 : null
        } else {
          row.report2 = null
          row.delta = null
        }
      }
      for (const row of nonCompliancePenaltySummary) {
        const matchingRow = report2Summary.nonCompliancePenaltySummary.find(
          (row2) => row2.line === row.line
        )
        if (matchingRow) {
          row.report2 =
            matchingRow.value ||
            matchingRow.totalValue ||
            matchingRow.amount ||
            matchingRow[fuelType] ||
            0
          row.delta = row.report2 !== null ? row.report2 - row.report1 : null
        } else {
          row.report2 = null
          row.delta = null
        }
      }
    }
    setRenewableSummary(renewableSummary)
    setLowCarbonSummary(lowCarbonSummary)
    setNonCompliancePenaltySummary(nonCompliancePenaltySummary)
  }, [report1Summary, report2Summary, fuelType])

  function onSelectReport1(event) {
    const newReport1ID = event.target.value
    setReport1ID(newReport1ID)

    if (newReport1ID === report2ID && reportChain.length > 1) {
      const availableReports = reportChain.filter(
        (report) => report.complianceReportId !== newReport1ID
      )

      if (availableReports.length > 0) {
        setReport2ID(availableReports[0].complianceReportId)
      } else {
        setReport2ID(null)
      }
    }
  }

  function onSelectReport2(event) {
    const newReport2ID = event.target.value
    setReport2ID(newReport2ID)

    if (newReport2ID === report1ID && reportChain.length > 1) {
      const availableReports = reportChain.filter(
        (report) => report.complianceReportId !== newReport2ID
      )

      if (availableReports.length > 0) {
        setReport1ID(availableReports[0].complianceReportId)
      } else {
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
          selectedReportName1 || '',
          selectedReportName2 || ''
        )}
        data={nonCompliancePenaltySummary}
      />
    </>
  )
}
