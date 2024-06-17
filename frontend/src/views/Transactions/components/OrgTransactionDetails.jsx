import React from 'react'
import { Grid, Box, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import {
  numberFormatter,
  dateFormatter,
} from '@/utils/formatters'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'

// Constants for transaction types
export const ADMIN_ADJUSTMENT = 'administrativeAdjustment'
export const INITIATIVE_AGREEMENT = 'initiativeAgreement'

export const OrgTransactionDetails = ({ transactionType, transactionData }) => {
  const { t } = useTranslation(['common', 'adminadjustment', 'initiativeagreement', 'transaction'])
  
  // Determine the appropriate status field based on the transaction type
  const statusField = transactionType === ADMIN_ADJUSTMENT ? 'adminAdjustmentStatus' : 'initiativeAgreementStatus';
  
  // Find the approval date from the history if available
  const approvedDateFromHistory = transactionData.history?.find(
    (entry) => entry[statusField]?.status === 'Approved'
  )?.createDate

  // Use createDate as the approved date if there is no history
  const approvedDate = approvedDateFromHistory || transactionData.createDate

  // Use the transaction effective date or the approved date if no effective date is provided
  const effectiveDate = transactionData.transactionEffectiveDate || approvedDate;

  // Construct the content based on the transaction type
  const content = (
    <Box component="div" display="flex" flexDirection="column" gap={1}>
      <Typography variant="body2">
        <strong>{transactionType === ADMIN_ADJUSTMENT ? t('txn:administrativeAdjustment') : t('txn:initiativeAgreement')} {t('txn:for')} {transactionData.toOrganization.name}</strong>
      </Typography>
      <Typography variant="body2">
        <strong>{t('txn:complianceUnitsLabel')}</strong> {numberFormatter({ value: transactionData.complianceUnits })}
      </Typography>
      <Typography variant="body2">
        <strong>{t('txn:effectiveDateLabel')}</strong> {dateFormatter({ value: effectiveDate })}
      </Typography>
      {transactionData.govComment && (
        <Typography variant="body2">
          <strong>{t('txn:commentsTextLabel')}</strong> {transactionData.govComment}
        </Typography>
      )}
      <Typography variant="body2">
        <strong>{t('txn:approvedLabel')}</strong> {dateFormatter({ value: approvedDate })} {t('txn:approvedByDirector')}
      </Typography>
    </Box>
  )

  // Determine the title based on the transaction type
  const title = transactionType === ADMIN_ADJUSTMENT
    ? `${t('txn:adminAdjustmentId')} ${transactionData.adminAdjustmentId}`
    : `${t('txn:initiativeAgreementId')} ${transactionData.initiativeAgreementId}`

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={11} md={8} lg={6}>
        <BCWidgetCard
          component="div"
          disableHover={true}
          title={title}
          content={content}
        />
      </Grid>
    </Grid>
  )
}

export default OrgTransactionDetails
