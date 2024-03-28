import BCBox from '@/components/BCBox'
import { List, ListItem, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

function TransferHistory({ transferHistory }) {
  const { t } = useTranslation(['common', 'transfer']);

  const getTransferStatusLabel = (status) => {
    return t(`transfer:transferHistory.${status}`, 'Status not found')
  }

  // Format the date as Month Day, Year (e.g., March 22, 2024)
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <BCBox mt={2} ml={2}>
      <Typography variant="h6" color="primary">
        {t('transfer:txnHistory')}
      </Typography>
      <ul>
        {transferHistory?.map((item, index) => (
          <li key={item.transferStatus.transferStatusId + index}>
            <Typography variant="body2" component="div">
              <b>{getTransferStatusLabel(item.transferStatus.status)}</b>{' '}
              <span> on </span>
              {formatDate(item.createDate)}
              <span> by </span>
              <strong> {item.userProfile.firstName} {item.userProfile.lastName}</strong> <span> of </span>
              <strong> {item.userProfile.organization ? item.userProfile.organization.name : t('govOrg')} </strong>
            </Typography>
          </li>
        ))}
      </ul>
    </BCBox>
  )
}

export default TransferHistory
