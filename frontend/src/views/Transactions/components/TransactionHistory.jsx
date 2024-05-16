import BCBox from '@/components/BCBox';
import { Typography } from '@mui/material';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { useTranslation } from 'react-i18next';

dayjs.extend(localizedFormat);

export const TransactionHistory = ({ transactionHistory }) => {
  const { t } = useTranslation(['common', 'transaction']);

  const getTransactionStatusLabel = (status) => {
    const basePath = 'txn:txnHistory';
    const statusNotFound = 'Status not found';
    return t(`${basePath}.${status}`, statusNotFound);
  };

  // Helper function to determine the correct status object
  const getStatusObject = (historyItem) => {
    if (historyItem.adminAdjustmentStatus) {
      return historyItem.adminAdjustmentStatus.status;
    } else if (historyItem.initiativeAgreementStatus) {
      return historyItem.initiativeAgreementStatus.status;
    }
    return 'Unknown Status'; // Fallback in case no known status object keys are found
  };

  return (
    <BCBox mt={2}>
      <Typography variant="h6" color="primary">
        {t('txn:txnHistoryLabel')}
      </Typography>
      <BCBox m={2}>
        <ul>
          {transactionHistory?.map((item, index) => (
            <li key={index} style={{marginLeft: 10}}>
              <Typography variant="body2" component="div">
                <strong>{getTransactionStatusLabel(getStatusObject(item))}</strong>
                <span> on </span>
                {dayjs(item.createDate).format('LL')}
                <span> by </span>
                <strong>
                  {item.userProfile.firstName} {item.userProfile.lastName}
                </strong>
                <span> of </span>
                <strong>{t('govOrg')}</strong>
              </Typography>
            </li>
          ))}
        </ul>
      </BCBox>
    </BCBox>
  );
};
