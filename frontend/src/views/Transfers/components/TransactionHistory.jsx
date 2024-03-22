import BCBox from '@/components/BCBox';
import { List, ListItem, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

function TransactionHistory({ transactionHistory }) {
  const { t } = useTranslation(['transfer']);

  const getTransferStatusLabel = (status) => {
    return t(`transfer:transferHistory.${status}`, "Status not found");
  };

  // Format the date as Month Day, Year (e.g., March 22, 2024)
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <BCBox mt={2}>
      <Typography variant="h6" color="primary">
        {t('transfer:txnHistory')}
      </Typography>
      <List>
        {transactionHistory?.map((txn, index) => (
          <ListItem key={txn.transferId + index} disablePadding>
            <Typography variant="body2" component="div">
              <b>{getTransferStatusLabel(txn.transferStatus.status)}</b> <span> on </span>
              {formatDate(txn.createDate)}
              <span> by </span>
              <strong> {txn.userProfile.firstName} {txn.userProfile.lastName}</strong> <span> of </span>
              <strong> {txn.userProfile.organization.name} </strong>
            </Typography>
          </ListItem>
        ))}
      </List>
    </BCBox>
  );
}

export default TransactionHistory;
