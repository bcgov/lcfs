import { useParams } from 'react-router-dom'
import { useAuditLog } from '@/hooks/useAuditLog'
import Loading from '@/components/Loading'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Typography
} from '@mui/material'
import { useTranslation } from 'react-i18next'

export const ViewAuditLog = () => {
  const { auditLogId } = useParams()
  const { data, isLoading, isError, error } = useAuditLog(auditLogId)
  const { t } = useTranslation(['admin'])

  if (isLoading) return <Loading />
  if (isError) return <div>Error: {error.message}</div>

  // Extract necessary data
  const {
    auditLogId: id,
    tableName,
    operation,
    rowId,
    createDate,
    createUser,
    oldValues,
    newValues,
    delta
  } = data

  // Get all unique field names from oldValues and newValues
  const fieldNames = Array.from(
    new Set([...Object.keys(oldValues || {}), ...Object.keys(newValues || {})])
  )

  // Function to format complex values
  const formatValue = (value) => {
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2)
    }
    return value !== null && value !== undefined ? value.toString() : ''
  }

  // Determine styles based on operation
  let rowStyle = {}
  if (operation === 'INSERT') {
    rowStyle = { backgroundColor: '#e8f5e9' } // Light green
  } else if (operation === 'DELETE') {
    rowStyle = { backgroundColor: '#ffebee' } // Light red
  }

  return (
    <Box>
      <Typography variant="h5" color="primary" mb={2}>
        {t('AuditLogDetails', { id })}
      </Typography>

      {/* Display the additional information */}
      <Box mb={2}>
        <Typography variant="body1">
          <strong>{t('auditLogColLabels.tableName')}:</strong> {tableName}
        </Typography>
        <Typography variant="body1">
          <strong>{t('auditLogColLabels.operation')}:</strong> {operation}
        </Typography>
        <Typography variant="body1">
          <strong>{t('auditLogColLabels.rowId')}:</strong> {rowId}
        </Typography>
        <Typography variant="body1">
          <strong>{t('auditLogColLabels.createDate')}:</strong>{' '}
          {new Date(createDate).toLocaleString()}
        </Typography>
        <Typography variant="body1">
          <strong>{t('auditLogColLabels.userId')}:</strong>{' '}
          {createUser || t('System')}
        </Typography>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <strong>{t('Field')}</strong>
              </TableCell>
              <TableCell>
                <strong>{t('OldValue')}</strong>
              </TableCell>
              <TableCell>
                <strong>{t('NewValue')}</strong>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fieldNames.map((field) => {
              let isChanged = false
              if (operation === 'UPDATE') {
                isChanged =
                  delta && Object.prototype.hasOwnProperty.call(delta, field)
              }

              const fieldRowStyle = isChanged
                ? { backgroundColor: '#e3f2fd' } // Light blue for updates
                : {}

              const oldValue = oldValues ? oldValues[field] : ''
              const newValue = newValues ? newValues[field] : ''

              return (
                <TableRow
                  key={field}
                  style={operation === 'UPDATE' ? fieldRowStyle : rowStyle}
                >
                  <TableCell>{field}</TableCell>
                  <TableCell>{formatValue(oldValue)}</TableCell>
                  <TableCell>{formatValue(newValue)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
