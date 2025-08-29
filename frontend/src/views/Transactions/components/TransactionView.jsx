import React from 'react'
import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { Grid, List, ListItemButton } from '@mui/material'
import { LabelBox } from './LabelBox'
import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { TRANSACTION_STATUSES } from '@/constants/statuses'
import { numberFormatter } from '@/utils/formatters'
import { useDocuments, useDownloadDocument } from '@/hooks/useDocuments.js'
import {
  ADMIN_ADJUSTMENT,
  INITIATIVE_AGREEMENT
} from '@/views/Transactions/constants.js'

// Define common inline styles
const inlineLabelStyle = { display: 'inline', marginRight: 6 }

export const TransactionView = ({ transaction }) => {
  const { t } = useTranslation(['txn'])
  const { hasAnyRole } = useCurrentUser()

  const transactionType = transaction.adminAdjustmentId
    ? ADMIN_ADJUSTMENT
    : INITIATIVE_AGREEMENT

  const transactionLabel =
    transactionType === ADMIN_ADJUSTMENT
      ? t('txn:administrativeAdjustment')
      : t('txn:initiativeAgreement')
  const organizationName =
    transaction.toOrganization?.name || t('common:unknown')

  const isRecommended =
    transaction.currentStatus?.status === TRANSACTION_STATUSES.RECOMMENDED

  const { data: loadedFiles } = useDocuments(
    transactionType,
    transaction.adminAdjustmentId ?? transaction.initiativeAgreementId
  )
  const viewDocument = useDownloadDocument(
    transactionType,
    transaction.adminAdjustmentId ?? transaction.initiativeAgreementId
  )

  return (
    <BCBox mb={4}>
      <LabelBox>
        <BCBox m={1}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <BCTypography variant="h6">
                <b>
                  {transactionLabel} for {organizationName}
                </b>
              </BCTypography>
            </Grid>
            <Grid item xs={12}>
              <BCTypography variant="label" style={inlineLabelStyle}>
                {t('txn:complianceUnitsLabel')}
              </BCTypography>
              <BCTypography variant="body2" style={{ display: 'inline' }}>
                {numberFormatter(transaction.complianceUnits)}
              </BCTypography>
            </Grid>
            <Grid item xs={12}>
              <BCTypography variant="label" style={inlineLabelStyle}>
                {t('txn:effectiveDateLabel')}
              </BCTypography>
              <BCTypography variant="body2" style={{ display: 'inline' }}>
                {transaction.transactionEffectiveDate || ''}
              </BCTypography>
            </Grid>
            <Grid item xs={12}>
              <BCTypography
                variant="label"
                dangerouslySetInnerHTML={{
                  __html:
                    isRecommended && hasAnyRole(roles.director)
                      ? t('txn:editableComments')
                      : t('txn:comments')
                }}
                style={inlineLabelStyle}
              />
              <BCTypography variant="body2" style={{ display: 'inline' }}>
                {transaction.govComment}
              </BCTypography>
            </Grid>
            <Grid item xs={12}>
              <BCTypography variant="label" style={inlineLabelStyle}>
                {t('txn:attachments')}
              </BCTypography>
              {loadedFiles && loadedFiles.length > 0 && (
                <BCBox component="div" style={{ display: 'inline-block' }}>
                  <List
                    component="div"
                    sx={{ maxWidth: '100%', listStyleType: 'disc' }}
                  >
                    {loadedFiles.map((file) => (
                      <ListItemButton
                        sx={{
                          display: 'list-item',
                          padding: '0',
                          marginLeft: '1.2rem'
                        }}
                        component="a"
                        key={file.documentId}
                        alignItems="flex-start"
                        onClick={() => {
                          viewDocument(file.documentId)
                        }}
                      >
                        <BCTypography
                          sx={{
                            textDecoration: 'underline'
                          }}
                          variant="subtitle2"
                          color="link"
                        >
                          {file.fileName}
                        </BCTypography>
                      </ListItemButton>
                    ))}
                  </List>
                </BCBox>
              )}
            </Grid>
          </Grid>
        </BCBox>
      </LabelBox>
    </BCBox>
  )
}
