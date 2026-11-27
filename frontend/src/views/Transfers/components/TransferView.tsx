import BCBox from '@/components/BCBox'
import { roles } from '@/constants/roles'
import {
  TRANSFER_STATUSES,
  getAllTerminalTransferStatuses
} from '@/constants/statuses'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  formatNumberWithCommas,
  currencyFormatter,
  calculateTotalValue
} from '@/utils/formatters'
import BCTypography from '@/components/BCTypography'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import TransferHistory, { type TransferHistoryEntry } from './TransferHistory'
import { TransferDetailsCard } from '@/views/Transfers/components/TransferDetailsCard'
import { Comments } from '@/views/Transfers/components'
import { CommentList } from '@/views/Transfers/components/CommentList'

interface TransferViewProps {
  editorMode?: boolean
  transferData?: {
    currentStatus?: { status?: string }
    toOrganization?: { name?: string; organizationId?: number }
    fromOrganization?: { name?: string; organizationId?: number }
    quantity?: number
    pricePerUnit?: number
    transferHistory?: TransferHistoryEntry[]
    comments?: TransferComment[]
  } | null
  categoryOverride?: ReactNode
}

interface TransferComment {
  id?: number
  createdBy?: string | null
  createdByOrg?: string | null
  createDate: string
  comment?: string | null
}

export const TransferView = ({
  editorMode,
  transferData,
  categoryOverride
}: TransferViewProps) => {
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

  const totalValue = calculateTotalValue(quantity, pricePerUnit)
  const formattedPricePerUnit = currencyFormatter({ value: pricePerUnit })
  const formattedTotalValue = currencyFormatter({ value: totalValue })

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
          {t('transfer:transfers')}{' '}
          <b>{formatNumberWithCommas({ value: quantity })}</b>{' '}
          {t('transfer:complianceUnitsTo')} <b>{toOrganization}</b>{' '}
          {t('transfer:for')}{' '}
          <b>
            {typeof formattedPricePerUnit === 'string' ||
            typeof formattedPricePerUnit === 'number'
              ? formattedPricePerUnit
              : null}
          </b>{' '}
          {t('transfer:complianceUnitsPerTvo')}{' '}
          <b>
            {typeof formattedTotalValue === 'string' ||
            typeof formattedTotalValue === 'number'
              ? formattedTotalValue
              : null}
          </b>{' '}
          CAD.
        </BCTypography>
        {categoryOverride}
      </BCBox>
      {/* Comments */}
      {(transferData?.comments?.length ?? 0) > 0 && (
        <CommentList
          comments={transferData?.comments}
          viewerIsGovernment={!!isGovernmentUser}
        />
      )}
      {!(
        transferStatus &&
        getAllTerminalTransferStatuses().some(
          (status) => status === transferStatus
        )
      ) && (
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
              'toOrgComment') ||
            undefined
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
