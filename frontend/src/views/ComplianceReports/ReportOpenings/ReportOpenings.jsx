import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Checkbox,
  Paper,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControlLabel
} from '@mui/material'
import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import Loading from '@/components/Loading'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import {
  useReportOpenings,
  useUpdateReportOpenings
} from '@/hooks/useReportOpenings'

const buildRowState = (records = []) => ({
  rows: records
    .slice()
    .sort((a, b) => a.complianceYear - b.complianceYear)
    .map((record) => ({
      complianceYear: record.complianceYear,
      complianceReportingEnabled: record.complianceReportingEnabled,
      earlyIssuanceEnabled: record.earlyIssuanceEnabled,
      supplementalReportRole: record.supplementalReportRole
    })),
  lookup: records.reduce((acc, record) => {
    acc[record.complianceYear] = record
    return acc
  }, {})
})

const CustomTableCell = ({ children, ...props }) => {
  return (
    <TableCell
      align="center"
      sx={{
        bgcolor: '#f2f2f2',
        borderBottom: 'none',
        padding: '4px',
        paddingTop: 0
      }}
      {...props}
    >
      {children}
    </TableCell>
  )
}

export const ReportOpenings = () => {
  const { t } = useTranslation(['reports'])
  const { enqueueSnackbar } = useSnackbar()
  const { data, isLoading } = useReportOpenings()
  const updateMutation = useUpdateReportOpenings()
  const [rowState, setRowState] = useState({ rows: [], lookup: {} })
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    if (Array.isArray(data)) {
      setRowState(buildRowState(data))
    }
  }, [data])

  const rows = rowState.rows
  const originalLookup = rowState.lookup

  const dirtyRows = useMemo(() => {
    return rows.filter((row) => {
      const original = originalLookup[row.complianceYear]
      if (!original) {
        return false
      }

      return (
        original.complianceReportingEnabled !==
          row.complianceReportingEnabled ||
        original.earlyIssuanceEnabled !== row.earlyIssuanceEnabled ||
        original.supplementalReportRole !== row.supplementalReportRole
      )
    })
  }, [rows, originalLookup])

  const hasChanges = dirtyRows.length > 0
  const saving = updateMutation.isPending

  const handleComplianceToggle = (year) => {
    setRowState((prev) => ({
      ...prev,
      rows: prev.rows.map((row) =>
        row.complianceYear === year
          ? {
              ...row,
              complianceReportingEnabled: !row.complianceReportingEnabled
            }
          : row
      )
    }))
  }

  const handleEarlyIssuanceToggle = (year) => {
    if (year !== currentYear) {
      return
    }

    setRowState((prev) => ({
      ...prev,
      rows: prev.rows.map((row) =>
        row.complianceYear === year
          ? {
              ...row,
              earlyIssuanceEnabled: !row.earlyIssuanceEnabled
            }
          : row
      )
    }))
  }

  const handleSupplementalChange = (year, role) => {
    setRowState((prev) => ({
      ...prev,
      rows: prev.rows.map((row) =>
        row.complianceYear === year
          ? {
              ...row,
              supplementalReportRole: role
            }
          : row
      )
    }))
  }

  const handleSave = () => {
    if (!hasChanges) {
      return
    }

    updateMutation.mutate(
      {
        reportOpenings: dirtyRows.map((row) => ({
          complianceYear: row.complianceYear,
          complianceReportingEnabled: row.complianceReportingEnabled,
          earlyIssuanceEnabled: row.earlyIssuanceEnabled,
          supplementalReportRole: row.supplementalReportRole
        }))
      },
      {
        onSuccess: (response) => {
          setRowState(buildRowState(response))
          enqueueSnackbar(t('reportOpenings.saveSuccess'), {
            variant: 'success'
          })
        },
        onError: () => {
          enqueueSnackbar(t('reportOpenings.saveError'), {
            variant: 'error'
          })
        }
      }
    )
  }

  if (isLoading && rows.length === 0) {
    return <Loading message={t('reportOpenings.loading')} />
  }

  return (
    <Box>
      <BCTypography variant="h5" color="primary" gutterBottom>
        {t('reportOpenings.title')}
      </BCTypography>
      <Box
        mt={3}
        display="flex"
        justifyContent="flex-start"
        flexDirection="column"
        width="fit-content"
        sx={{ border: '1px solid black', p: 2 }}
      >
        <Table
          size="small"
          aria-label={t('reportOpenings.title')}
          sx={{
            borderCollapse: 'separate',
            borderSpacing: '32px 0',
            '& td, & th': { border: 0, py: 0.25 }
          }}
        >
          <TableHead>
            <TableRow>
              <CustomTableCell sx={{ background: 'none', width: 100 }} />
              <CustomTableCell sx={{ background: 'none' }} />
              <CustomTableCell sx={{ background: 'none' }} />
              <CustomTableCell
                sx={{ fontWeight: 600, color: 'primary.main' }}
                colSpan={2}
              >
                {t('reportOpenings.createSupplemental')}
              </CustomTableCell>
            </TableRow>
            <TableRow>
              <CustomTableCell sx={{ background: 'none' }} />
              <CustomTableCell sx={{ fontWeight: 600, color: 'primary.main' }}>
                {t('reportOpenings.complianceReporting')}
              </CustomTableCell>
              <CustomTableCell sx={{ fontWeight: 600, color: 'primary.main' }}>
                {t('reportOpenings.earlyIssuance')}
              </CustomTableCell>
              <CustomTableCell sx={{ fontWeight: 600, color: 'primary.main' }}>
                {t('reportOpenings.bceid')}
              </CustomTableCell>
              <CustomTableCell sx={{ fontWeight: 600, color: 'primary.main' }}>
                {t('reportOpenings.idir')}
              </CustomTableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.complianceYear}>
                <CustomTableCell sx={{ fontWeight: 600 }}>
                  {row.complianceYear}
                </CustomTableCell>
                <CustomTableCell>
                  <Checkbox
                    color="primary"
                    checked={row.complianceReportingEnabled}
                    onChange={() => handleComplianceToggle(row.complianceYear)}
                    inputProps={{
                      'aria-label': t(
                        'reportOpenings.complianceReportingToggle',
                        {
                          year: row.complianceYear
                        }
                      )
                    }}
                  />
                </CustomTableCell>
                <CustomTableCell>
                  <Checkbox
                    color="primary"
                    checked={row.earlyIssuanceEnabled}
                    disabled={row.complianceYear !== currentYear}
                    onChange={() =>
                      handleEarlyIssuanceToggle(row.complianceYear)
                    }
                    inputProps={{
                      'aria-label': t('reportOpenings.earlyIssuanceToggle', {
                        year: row.complianceYear
                      })
                    }}
                  />
                </CustomTableCell>
                <CustomTableCell colSpan={2}>
                  <RadioGroup
                    row
                    name={`supplemental-${row.complianceYear}`}
                    value={row.supplementalReportRole}
                    onChange={(event) =>
                      handleSupplementalChange(
                        row.complianceYear,
                        event.target.value
                      )
                    }
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 10
                    }}
                  >
                    <FormControlLabel
                      value="BCeID"
                      control={<Radio color="primary" />}
                    />
                    <FormControlLabel
                      value="IDIR"
                      control={<Radio color="primary" />}
                    />
                  </RadioGroup>
                </CustomTableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box mt={3} display="flex" justifyContent="flex-start" pl={2}>
          <BCButton
            variant="contained"
            color="primary"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            isLoading={saving}
          >
            {t('reportOpenings.save')}
          </BCButton>
        </Box>
      </Box>
    </Box>
  )
}
