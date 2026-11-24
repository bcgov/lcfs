import { useTranslation } from 'react-i18next'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'

import BCTypography from '@/components/BCTypography'
import { useChangeOrders } from '@/hooks/useInitiativeAgreements'
import { dateFormatter, timezoneFormatter } from '@/utils/formatters'

/**
 * The agreement's change orders (#5555): when each started, and for an
 * accepted one, its Accepted date beside when and by whom it was recorded.
 * Renders nothing until there is one.
 */
export const ChangeOrderHistory = ({ initiativeAgreementId }) => {
  const { t } = useTranslation(['initiativeAgreement'])
  const { data: changeOrders = [] } = useChangeOrders(initiativeAgreementId)
  if (!changeOrders.length) return null

  const column = (key) => t(`initiativeAgreement:changeOrder.columns.${key}`)
  return (
    <Paper
      variant="outlined"
      sx={{ p: 3, mt: 3 }}
      data-test="change-order-history"
    >
      <BCTypography variant="h6" color="primary" mb={1}>
        {t('initiativeAgreement:changeOrder.historyTitle')}
      </BCTypography>
      <Table size="small">
        <TableHead sx={{ display: 'table-header-group' }}>
          <TableRow>
            <TableCell>{column('number')}</TableCell>
            <TableCell>{column('status')}</TableCell>
            <TableCell>{column('started')}</TableCell>
            <TableCell>{column('acceptedDate')}</TableCell>
            <TableCell>{column('recorded')}</TableCell>
            <TableCell>{column('by')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {changeOrders.map((changeOrder) => {
            const closedAt = changeOrder.acceptedAt || changeOrder.discardedAt
            const closedBy =
              changeOrder.acceptedByDisplayName ||
              changeOrder.discardedByDisplayName
            return (
              <TableRow
                key={changeOrder.initiativeAgreementChangeOrderId}
                data-test={`change-order-row-${changeOrder.changeOrderNumber}`}
              >
                <TableCell>{changeOrder.changeOrderNumber}</TableCell>
                <TableCell>{changeOrder.status}</TableCell>
                <TableCell>
                  {[
                    changeOrder.createDate
                      ? timezoneFormatter({ value: changeOrder.createDate })
                      : null,
                    changeOrder.startedByDisplayName
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </TableCell>
                <TableCell>
                  {changeOrder.acceptedDate
                    ? dateFormatter({ value: changeOrder.acceptedDate })
                    : '—'}
                </TableCell>
                <TableCell>
                  {closedAt ? timezoneFormatter({ value: closedAt }) : '—'}
                </TableCell>
                <TableCell>{closedBy || '—'}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Paper>
  )
}

export default ChangeOrderHistory
