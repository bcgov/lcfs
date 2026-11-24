import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'

import BCAlert from '@/components/BCAlert'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { useRecordVersions } from '@/hooks/useInitiativeAgreements'
import { dateFormatter } from '@/utils/formatters'
import { evidencePlainText } from './evidenceRichText'

// Rich-text fields are shown as their text.
const RICH_TEXT_FIELDS = new Set([
  'noteText',
  'description',
  'projectDescription'
])

const display = (field, value) => {
  if (value === null || value === undefined || value === '') return '—'
  if (RICH_TEXT_FIELDS.has(field))
    return evidencePlainText(String(value)) || '—'
  if (typeof value === 'number') return value.toLocaleString()
  return String(value)
}

const versionCaption = (version, t) => {
  if (version.changeOrderNumber == null) {
    return t('initiativeAgreement:changeOrder.original')
  }
  const parts = [
    t('initiativeAgreement:changeOrder.fromChangeOrder', {
      number: version.changeOrderNumber
    })
  ]
  if (version.acceptedDate) {
    parts.push(
      t('initiativeAgreement:changeOrder.acceptedOn', {
        date: dateFormatter({ value: version.acceptedDate })
      })
    )
  }
  if (version.actionType === 'CREATE') {
    parts.push(t('initiativeAgreement:changeOrder.versionAdded'))
  }
  if (version.actionType === 'DELETE') {
    parts.push(t('initiativeAgreement:changeOrder.versionRemoved'))
  }
  return parts.join(' · ')
}

/** Every version of one record side by side, fields down the left (#5555). */
export const RecordVersionsTable = ({ versions }) => {
  const { t } = useTranslation(['initiativeAgreement'])
  const fields = Object.keys(versions[0]?.values ?? {})
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small" data-test="record-versions-table">
        <TableHead sx={{ display: 'table-header-group' }}>
          <TableRow>
            <TableCell />
            {versions.map((version) => (
              <TableCell
                key={version.version}
                data-test={`record-version-${version.version}`}
                sx={{ verticalAlign: 'top', minWidth: 180 }}
              >
                <BCTypography variant="body4" component="div">
                  <strong>
                    {t('initiativeAgreement:changeOrder.versionLabel', {
                      version: version.version
                    })}
                  </strong>
                  {version.isCurrent &&
                    ` (${t('initiativeAgreement:changeOrder.current')})`}
                  {version.isPending &&
                    ` (${t('initiativeAgreement:changeOrder.pending')})`}
                </BCTypography>
                <BCTypography
                  variant="body4"
                  component="div"
                  color="text.secondary"
                >
                  {versionCaption(version, t)}
                </BCTypography>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {fields.map((field) => (
            <TableRow key={field}>
              <TableCell component="th" scope="row">
                <BCTypography variant="body4" component="span">
                  {t(`initiativeAgreement:changeOrder.fields.${field}`, {
                    defaultValue: field
                  })}
                </BCTypography>
              </TableCell>
              {versions.map((version, index) => {
                const value = version.values[field]
                const changed =
                  index > 0 && versions[index - 1].values[field] !== value
                return (
                  <TableCell
                    key={version.version}
                    sx={{
                      verticalAlign: 'top',
                      fontWeight: changed ? 700 : 'normal'
                    }}
                  >
                    <BCTypography
                      variant="body4"
                      component="span"
                      sx={{ fontWeight: 'inherit', whiteSpace: 'pre-line' }}
                    >
                      {display(field, value)}
                    </BCTypography>
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  )
}

const RecordVersionsContent = ({ recordType, recordId }) => {
  const { t } = useTranslation(['initiativeAgreement'])
  const {
    data: versions = [],
    isLoading,
    isError
  } = useRecordVersions(recordType, recordId)
  if (isLoading) return <Loading />
  if (isError) {
    return (
      <BCAlert severity="error" dismissible={false}>
        {t('initiativeAgreement:changeOrder.loadFailed')}
      </BCAlert>
    )
  }
  if (!versions.length) {
    return (
      <BCTypography
        variant="body4"
        color="text.secondary"
        data-test="record-versions-empty"
      >
        {t('initiativeAgreement:changeOrder.versionsEmpty')}
      </BCTypography>
    )
  }
  return <RecordVersionsTable versions={versions} />
}

/**
 * A "Version history" link that opens a record's versions. IDIR only: the
 * API refuses everyone else.
 */
export const VersionHistoryButton = ({ recordType, recordId, sx }) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const [open, setOpen] = useState(false)
  return (
    <>
      <BCTypography
        component="button"
        type="button"
        variant="body4"
        color="link"
        data-test={`version-history-${recordType}-${recordId}`}
        onClick={(event) => {
          event.stopPropagation()
          setOpen(true)
        }}
        sx={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textDecoration: 'underline',
          p: 0,
          ...sx
        }}
      >
        {t('initiativeAgreement:changeOrder.versions')}
      </BCTypography>
      <BCModal
        open={open}
        onClose={() => setOpen(false)}
        data={{
          title: t('initiativeAgreement:changeOrder.versionsTitle'),
          secondaryButtonText: t('initiativeAgreement:changeOrder.close'),
          content: open && (
            <RecordVersionsContent
              recordType={recordType}
              recordId={recordId}
            />
          )
        }}
      />
    </>
  )
}

export default VersionHistoryButton
