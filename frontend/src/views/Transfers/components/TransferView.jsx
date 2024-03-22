import PropTypes from 'prop-types'
import {
  TransferDetailsCard,
  CommentList,
  AttachmentList,
  AddPlainComment
} from '.'
import BCBox from '@/components/BCBox'
import { Typography, List, ListItem } from '@mui/material'
import { faCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { decimalFormatter } from '@/utils/formatters'
import { useTranslation } from 'react-i18next'

export const TransferView = ({
  fromOrgId,
  fromOrganization,
  toOrgId,
  toOrganization,
  quantity,
  pricePerUnit,
  transferStatus,
  isGovernmentUser,
  totalValue,
  handleCommentChange,
  comment
}) => {
  const { t } = useTranslation(['common', 'transfer'])
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
      {/* <CommentList comments={demoData.comments} /> */}
      <AddPlainComment
        toOrgId={toOrgId}
        isGovernmentUser={isGovernmentUser}
        handleCommentChange={handleCommentChange}
        comment={comment}
        transferStatus={transferStatus}
      />
      {/* List of attachments */}
      {/* <AttachmentList attachments={demoData.attachments} /> */}
      {/* Transaction History notes */}
      {/* <BCBox mt={2}>
        <Typography variant="h6" color="primary">
          {t('transfer:txnHistory')}
        </Typography>
        <List>
          {demoData.transactionHistory.map((transaction) => (
            <ListItem key={transaction.transactionID} disablePadding>
              <BCBox mr={1} mb={1}>
                <FontAwesomeIcon icon={faCircle} fontSize={6} />
              </BCBox>
              <Typography variant="body4">{transaction.notes}</Typography>
            </ListItem>
          ))}
        </List>
      </BCBox> */}
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
