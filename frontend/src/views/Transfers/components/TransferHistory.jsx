import BCBox from '@/components/BCBox'
import {
  TRANSFER_STATUSES,
  TRANSFER_RECOMMENDATION
} from '@/constants/statuses'
import { useTransfer } from '@/hooks/useTransfer'
import { Typography } from '@mui/material'
import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import duration from 'dayjs/plugin/duration'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

dayjs.extend(localizedFormat)
dayjs.extend(duration)

function TransferHistory({ transferHistory }) {
  const { transferId } = useParams()
  const { data: transferData } = useTransfer(transferId)

  const { t } = useTranslation(['common', 'transfer'])

  const getTransferStatusLabel = (status) => {
    const basePath = 'transfer:transferHistory'
    const statusNotFound = 'Status not found'

    if (status === TRANSFER_STATUSES.RECOMMENDED) {
      const recommendation =
        transferData.recommendation === TRANSFER_RECOMMENDATION.RECORD
          ? 'RecommendedRecord'
          : 'RecommendedRefuse'
      return t(`${basePath}.${recommendation}`)
    }

    return t(`${basePath}.${status}`, statusNotFound)
  }

  const dateCutoffMonths = {
    A: 6,
    B: 12
  }
  const currentStatus = transferData?.currentStatus.status
  const agreementDate = dayjs(transferData.agreementDate)
  const today = dayjs().subtract(1, 'day')
  const diff = dayjs.duration(today.diff(agreementDate))
  const diffYears = diff.years()
  const diffMonths = diff.months()
  const diffDays = diff.days()

  let category = 'A'
  if (
    (diffYears === 0 && diffMonths >= 6 && diffDays > 0) ||
    (diffYears === 1 && diffMonths === 0 && diffDays === 0)
  ) {
    category = 'B'
  } else if (diffYears >= 1) {
    category = 'C'
  }

  return (
    <BCBox mt={2} data-test="transfer-history">
      <Typography variant="h6" color="primary">
        {t('transfer:txnHistory')}
      </Typography>
      <BCBox m={2}>
        <ul>
          {[
            TRANSFER_STATUSES.SENT,
            TRANSFER_STATUSES.SUBMITTED,
            TRANSFER_STATUSES.RECOMMENDED,
            TRANSFER_STATUSES.RECORDED
          ].includes(currentStatus) && (
            <li>
              <Typography variant="body2" component="div">
                <span>
                  Date of written agreement reached between the two
                  organizations: {agreementDate.format('LL')} (proposal falls
                  under{' '}
                  <strong>
                    Category{' '}
                    {transferData.transferCategory?.category ?? category}
                  </strong>
                  {!transferData.transferCategory?.category &&
                    (category === 'A' || category === 'B') && (
                      <>
                        {' '}
                        if approved by:{' '}
                        <strong>
                          {agreementDate
                            .add(dateCutoffMonths[category], 'M')
                            .format('LL')}
                        </strong>
                      </>
                    )}
                  )
                </span>
              </Typography>
            </li>
          )}
          {transferHistory?.map((item, index) => (
            <li key={item.transferStatus.transferStatusId + index}>
              <Typography variant="body2" component="div">
                <b>{getTransferStatusLabel(item.transferStatus.status)}</b>{' '}
                <span> on </span>
                {dayjs(item.createDate).format('LL')}
                <span> by </span>
                <strong>
                  {' '}
                  {item.userProfile.firstName} {item.userProfile.lastName}
                </strong>{' '}
                <span> of </span>
                <strong>
                  {' '}
                  {item.userProfile.organization
                    ? item.userProfile.organization.name
                    : t('govOrg')}{' '}
                </strong>
              </Typography>
            </li>
          ))}
        </ul>
      </BCBox>
    </BCBox>
  )
}

export default TransferHistory
