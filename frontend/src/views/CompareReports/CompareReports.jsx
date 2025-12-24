import React, { useEffect, useMemo, useState } from 'react'
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
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

const Controls = styled(Box)({
  width: '66%'
})

const FUEL_TYPES = ['gasoline', 'diesel', 'jetFuel']

export const CompareReports = () => {
  const { t } = useTranslation(['common', 'report'])
  const [isLoading, setIsLoading] = useState(true)
  const [reportChain, setReportChain] = useState([])

  const { currentReport } = useComplianceReportStore()

  const [report1ID, setReport1ID] = useState(null)
  const [report2ID, setReport2ID] = useState(null)
  const [fuelType, setFuelType] = useState('gasoline')
  const [hasUserSelectedFuel, setHasUserSelectedFuel] = useState(false)

  const originalReport = useMemo(() => {
    if (!Array.isArray(reportChain)) return null
    return reportChain.find((report) => report.version === 0) || null
  }, [reportChain])

  const hasSupplementalReports = useMemo(() => {
    if (!Array.isArray(reportChain)) return false
    return reportChain.some((report) => (report.version ?? 0) > 0)
  }, [reportChain])

  const shouldShowOriginalNotAssessedLabel = useMemo(() => {
    if (!originalReport) return false
    if (!hasSupplementalReports) return false
    const originalStatus = originalReport.currentStatus?.status
    return originalStatus !== COMPLIANCE_REPORT_STATUSES.ASSESSED
  }, [originalReport, hasSupplementalReports])

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

  const fuelAvailability = useMemo(() => {
    const summaries = [report1Summary, report2Summary].filter(Boolean)
    if (!summaries.length) return null

    const getFuelValue = (summary, lineNumber, fuelKey) => {
      const line = summary?.renewableFuelTargetSummary?.find(
        (row) => Number(row.line) === lineNumber
      )
      return line?.[fuelKey]
    }

    const hasFuelContent = (summary, fuelKey) => {
      const line3Value = getFuelValue(summary, 3, fuelKey)
      const line9Value = getFuelValue(summary, 9, fuelKey)
      const line3Number = Number(line3Value)
      const line9Number = Number(line9Value)
      const line3HasContent =
        Number.isFinite(line3Number) && line3Number !== 0
      const line9HasContent =
        Number.isFinite(line9Number) && line9Number !== 0
      return line3HasContent || line9HasContent
    }

    return FUEL_TYPES.reduce((acc, fuelKey) => {
      acc[fuelKey] = summaries.some((summary) =>
        hasFuelContent(summary, fuelKey)
      )
      return acc
    }, {})
  }, [report1Summary, report2Summary])

  useEffect(() => {
    if (!fuelAvailability) return
    const availableFuelTypes = FUEL_TYPES.filter(
      (fuelKey) => fuelAvailability[fuelKey]
    )
    if (!availableFuelTypes.length) return
    const preferredFuelType = availableFuelTypes[0]

    if (!hasUserSelectedFuel) {
      if (fuelType !== preferredFuelType) {
        setFuelType(preferredFuelType)
      }
      return
    }

    if (!fuelAvailability[fuelType]) {
      setFuelType(preferredFuelType)
    }
  }, [fuelAvailability, fuelType, hasUserSelectedFuel])

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
    setHasUserSelectedFuel(false)

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
    setHasUserSelectedFuel(false)

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

  const originalReportId = originalReport?.complianceReportId

  const isOriginalReport = (reportId) =>
    !!originalReportId && reportId === originalReportId

  const shouldLabelOriginal = (reportId) =>
    shouldShowOriginalNotAssessedLabel && isOriginalReport(reportId)

  const report1Label = shouldLabelOriginal(report1ID)
    ? t('report:originalReportNotAssessed')
    : selectedReportName1

  const report2Label = shouldLabelOriginal(report2ID)
    ? t('report:originalReportNotAssessed')
    : selectedReportName2

  const highlightedColumns = []
  if (shouldLabelOriginal(report1ID)) {
    highlightedColumns.push('report1')
  }
  if (shouldLabelOriginal(report2ID)) {
    highlightedColumns.push('report2')
  }

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
          report1Label,
          report2Label
        )}
        data={renewableSummary}
        useParenthesis
        enableFuelControls
        setFuelType={(nextFuelType) => {
          setFuelType(nextFuelType)
          setHasUserSelectedFuel(true)
        }}
        fuelType={fuelType}
        highlightedColumns={highlightedColumns}
        fuelAvailability={fuelAvailability}
      />
      <CompareTable
        title={t('report:lowCarbonFuelTargetSummary')}
        columns={lowCarbonColumns(t, report1Label, report2Label)}
        data={lowCarbonSummary}
        highlightedColumns={highlightedColumns}
      />
      <CompareTable
        title={t('report:nonCompliancePenaltySummary')}
        columns={nonCompliancePenaltyColumns(
          t,
          report1Label || '',
          report2Label || ''
        )}
        data={nonCompliancePenaltySummary}
        highlightedColumns={highlightedColumns}
      />
    </>
  )
}
