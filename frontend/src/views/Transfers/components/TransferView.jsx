import PropTypes from 'prop-types'
import { TransferDetailsCard, Comments, CommentList } from '.'
import BCBox from '@/components/BCBox'
import { Typography } from '@mui/material'
import { decimalFormatter } from '@/utils/formatters'
import { useTranslation } from 'react-i18next'
import TransferHistory from './TransferHistory'
import { Role } from '@/components/Role'
import InternalComments from '@/components/InternalComments'
import { roles } from '@/constants/roles'

export const TransferView = ({
  transferId,
  editorMode,
  isGovernmentUser,
  transferData
}) => {
  const { t } = useTranslation(['common', 'transfer'])
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
        <Typography variant="body4">
          <b>{fromOrganization}</b>
          {t('transfer:transfers')}
          <b>{quantity}</b>
          {t('transfer:complianceUnitsTo')} <b>{toOrganization}</b>
          {t('transfer:for')}
          <b>${decimalFormatter({ value: pricePerUnit })}</b>
          {t('transfer:complianceUnitsPerTvo')}
          <b>${decimalFormatter(totalValue)}</b> CAD.
        </Typography>
      </BCBox>
      {/* Comments */}
      <CommentList comments={transferData?.comments} />
      <Comments editorMode={editorMode} isGovernmentUser={isGovernmentUser} />

      {/* Internal Comments */}
      <Role roles={[roles.government]}>
        <InternalComments entityType="Transfer" entityId={transferId} />
      </Role>

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
