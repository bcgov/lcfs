import BCBox from '@/components/BCBox'
import {
  TRANSFER_STATUSES,
  TRANSFER_RECOMMENDATION
} from '@/constants/statuses'
import { useTransfer } from '@/hooks/useTransfer'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import BCTypography from '@/components/BCTypography'
import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import duration from 'dayjs/plugin/duration'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { formatDateWithTimezoneAbbr } from '@/utils/formatters.js'

dayjs.extend(localizedFormat)
dayjs.extend(duration)

function TransferHistory({ transferHistory }) {
  const { transferId } = useParams()
  const { data: transferData } = useTransfer(transferId)
  const { data: currentUser } = useCurrentUser()

  const { t } = useTranslation(['common', 'transfer'])

  if (!transferData) {
    return null
  }

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
  const agreementDate = transferData?.agreementDate
    ? dayjs(transferData.agreementDate)
    : null
  const today = dayjs().subtract(1, 'day')
  const diff = agreementDate ? dayjs.duration(today.diff(agreementDate)) : null
  const diffYears = diff?.years() || 0
  const diffMonths = diff?.months() || 0
  const diffDays = diff?.days() || 0

  let category = 'A'
  if (
    (diffYears === 0 && diffMonths >= 6 && diffDays > 0) ||
    (diffYears === 1 && diffMonths === 0 && diffDays === 0)
  ) {
    category = 'B'
  } else if (diffYears >= 1) {
    category = 'C'
  }

  // Filter out any DRAFT records, so “Created draft” never shows up
  const filteredHistory = transferHistory?.filter(
    (item) => item.transferStatus?.status !== TRANSFER_STATUSES.DRAFT
  )

  return (
    <BCBox mt={2} data-test="transfer-history">
      <BCTypography variant="h6" color="primary">
        {t('transfer:txnHistory')}
      </BCTypography>
      <BCBox m={2}>
        <ul>
          {[
            TRANSFER_STATUSES.SENT,
            TRANSFER_STATUSES.SUBMITTED,
            TRANSFER_STATUSES.RECOMMENDED,
            TRANSFER_STATUSES.RECORDED
          ].includes(currentStatus) &&
            agreementDate && (
              <li>
                <BCTypography variant="body2" component="div">
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
                </BCTypography>
              </li>
            )}
          {filteredHistory?.map((item, index) => {
            const isRecordedStatus =
              item.transferStatus?.status === TRANSFER_STATUSES.RECORDED
            const isBCeIDUser = !currentUser?.isGovernmentUser
            return (
              <li
                key={(item.transferStatus?.transferStatusId || index) + index}
              >
                <BCTypography variant="body2" component="div">
                  <b>{getTransferStatusLabel(item.transferStatus?.status)}</b>
                  <span> on </span>
                  {formatDateWithTimezoneAbbr(item.createDate)}
                  <span> by </span>
                  {isRecordedStatus && isBCeIDUser ? (
                    <>
                      the <strong>{t('transfer:director')}</strong> under the{' '}
                      <i>{t('underAct')}</i>
                    </>
                  ) : (
                    <>
                      <strong>
                        {item.displayName ||
                          `${item.userProfile?.firstName} ${item.userProfile?.lastName}`}
                      </strong>
                      <span> of </span>
                      <strong>
                        {item.userProfile?.organization
                          ? item.userProfile.organization.name
                          : t('govOrg')}
                      </strong>
                    </>
                  )}
                </BCTypography>
              </li>
            )
          })}
        </ul>
      </BCBox>
    </BCBox>
  )
}

export default TransferHistory
