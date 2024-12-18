import BCBox from '@/components/BCBox'

import { roles } from '@/constants/roles'
import {
  TRANSFER_STATUSES,
  getAllTerminalTransferStatuses
} from '@/constants/statuses'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { decimalFormatter } from '@/utils/formatters'
import BCTypography from '@/components/BCTypography'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import TransferHistory from './TransferHistory'
import { TransferDetailsCard } from '@/views/Transfers/components/TransferDetailsCard'
import { Comments } from '@/views/Transfers/components'
import { CommentList } from '@/views/Transfers/components/CommentList'

export const TransferView = ({ transferId, editorMode, transferData }) => {
  const { t } = useTranslation(['common', 'transfer'])
  const { data: currentUser, sameOrganization, hasAnyRole } = useCurrentUser()
  const isGovernmentUser = currentUser?.isGovernmentUser
  const isAnalyst = hasAnyRole(roles.analyst)
  const {
    currentStatus: { status: transferStatus } = {},
    toOrganization: { name: toOrganization, organizationId: toOrgId } = {},
    fromOrganization: {
      name: fromOrganization,
      organizationId: fromOrgId
    } = {},
    quantity,
    pricePerUnit,
    transferHistory
  } = transferData || {}

  const totalValue = quantity * pricePerUnit

  return (
    <>
      <TransferDetailsCard
        fromOrgId={fromOrgId}
        fromOrganization={fromOrganization}
        toOrgId={toOrgId}
        toOrganization={toOrganization}
        quantity={quantity}
        pricePerUnit={pricePerUnit}
        transferStatus={transferStatus}
        isGovernmentUser={isGovernmentUser}
      />
      {/* Transfer Details View only */}
      <BCBox
        variant="outlined"
        p={2}
        mt={2}
        sx={{
          backgroundColor: 'transparent.main'
        }}
      >
        <BCTypography variant="body4">
          <b>{fromOrganization}</b>
          {t('transfer:transfers')}
          <b>{quantity}</b>
          {t('transfer:complianceUnitsTo')} <b>{toOrganization}</b>
          {t('transfer:for')}
          <b>${decimalFormatter({ value: pricePerUnit })}</b>
          {t('transfer:complianceUnitsPerTvo')}
          <b>${decimalFormatter(totalValue)}</b> CAD.
        </BCTypography>
      </BCBox>
      {/* Comments */}
      {transferData?.comments.length > 0 && (
        <CommentList comments={transferData?.comments} />
      )}
      {!getAllTerminalTransferStatuses().includes(transferStatus) && (
        <Comments
          editorMode={editorMode}
          isGovernmentUser={isGovernmentUser}
          commentField={
            (transferStatus === TRANSFER_STATUSES.DRAFT &&
              sameOrganization(fromOrgId) &&
              'fromOrgComment') ||
            (isGovernmentUser && 'govComment') ||
            (!isGovernmentUser &&
              transferStatus === TRANSFER_STATUSES.SENT &&
              sameOrganization(toOrgId) &&
              'toOrgComment')
          }
          isDefaultExpanded={isAnalyst}
        />
      )}

      {/* List of attachments */}
      {/* <AttachmentList attachments={demoData.attachments} /> */}

      {/* Transaction History notes */}
      <TransferHistory transferHistory={transferHistory} />
    </>
  )
}

TransferView.propTypes = {
  fromOrgId: PropTypes.number,
  fromOrganization: PropTypes.string,
  toOrgId: PropTypes.number,
  toOrganization: PropTypes.string,
  quantity: PropTypes.number,
  pricePerUnit: PropTypes.number,
  transferStatus: PropTypes.string,
  isGovernmentUser: PropTypes.bool,
  totalValue: PropTypes.number,
  handleCommentChange: PropTypes.func,
  comment: PropTypes.string
}
