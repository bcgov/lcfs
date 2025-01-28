import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import { useTranslation } from 'react-i18next'
import { formatDateWithTimezoneAbbr } from '@/utils/formatters.js'

dayjs.extend(localizedFormat)

export const TransactionHistory = ({ transactionHistory }) => {
  const { t } = useTranslation(['common', 'transaction'])

  const getTransactionStatusLabel = (status) => {
    const basePath = 'txn:txnHistory'
    const statusNotFound = 'Status not found'
    return t(`${basePath}.${status}`, statusNotFound)
  }

  // Helper function to determine the correct status object
  const getStatusObject = (historyItem) => {
    if (historyItem.adminAdjustmentStatus) {
      return historyItem.adminAdjustmentStatus.status
    } else if (historyItem.initiativeAgreementStatus) {
      return historyItem.initiativeAgreementStatus.status
    }
    return 'Unknown Status' // Fallback in case no known status object keys are found
  }

  if (transactionHistory?.length <= 0) {
    return <></>
  }

  return (
    <BCBox mt={2}>
      <BCTypography variant="h6" color="primary">
        {t('txn:txnHistoryLabel')}
      </BCTypography>
      <BCBox m={2}>
        <ul>
          {transactionHistory?.map((item, index) => (
            <li key={index} style={{ marginLeft: 10 }}>
              <BCTypography variant="body2" component="div">
                <strong>
                  {getTransactionStatusLabel(getStatusObject(item))}
                </strong>
                <span> on </span>
                {formatDateWithTimezoneAbbr(item.createDate)}
                <span> by </span>
                <strong>
                  {item.displayName ||
                    `${item.userProfile.firstName} ${item.userProfile.lastName}`}
                </strong>
                <span> of </span>
                <strong>{t('govOrg')}</strong>
              </BCTypography>
            </li>
          ))}
        </ul>
      </BCBox>
    </BCBox>
  )
}
