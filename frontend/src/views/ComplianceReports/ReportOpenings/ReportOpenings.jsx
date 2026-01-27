import { useEffect, useMemo, useState } from 'react'
import { Box, Checkbox, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import Loading from '@/components/Loading'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { useReportOpenings, useUpdateReportOpenings } from '@/hooks/useReportOpenings'

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

export const ReportOpenings = () => {
  const { t } = useTranslation(['reports'])
  const { enqueueSnackbar } = useSnackbar()
  const { data, isLoading } = useReportOpenings()
  const updateMutation = useUpdateReportOpenings()
  const [rowState, setRowState] = useState({ rows: [], lookup: {} })

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
      return (
        original &&
        original.complianceReportingEnabled !== row.complianceReportingEnabled
      )
    })
  }, [rows, originalLookup])

  const hasChanges = dirtyRows.length > 0
  const saving = updateMutation.isPending

  const handleToggle = (year) => {
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

  const handleSave = () => {
    if (!hasChanges) {
      return
    }

    updateMutation.mutate(
      {
        reportOpenings: dirtyRows.map((row) => ({
          complianceYear: row.complianceYear,
          complianceReportingEnabled: row.complianceReportingEnabled
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
      <BCTypography variant="h4" gutterBottom>
        {t('reportOpenings.title')}
      </BCTypography>
      <BCTypography variant="body1" color="text.secondary" gutterBottom>
        {t('reportOpenings.description')}
      </BCTypography>
      <TableContainer component={Paper} sx={{ mt: 3 }}>
        <Table aria-label={t('reportOpenings.title')}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>{t('reportOpenings.year')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>
                {t('reportOpenings.complianceReporting')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.complianceYear}>
                <TableCell>{row.complianceYear}</TableCell>
                <TableCell>
                  <Checkbox
                    color="primary"
                    checked={row.complianceReportingEnabled}
                    onChange={() => handleToggle(row.complianceYear)}
                    inputProps={{
                      'aria-label': t('reportOpenings.complianceReportingToggle', {
                        year: row.complianceYear
                      })
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box mt={3} display="flex" justifyContent="flex-end">
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
  )
}
