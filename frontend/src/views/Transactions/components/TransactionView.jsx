import React from 'react'
import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { Grid } from '@mui/material'
import { LabelBox } from './LabelBox'
import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { TRANSACTION_STATUSES } from '@/constants/statuses'
import { numberFormatter } from '@/utils/formatters'

// Define common inline styles
const inlineLabelStyle = { display: 'inline', marginRight: 6 }

export const TransactionView = ({ transaction }) => {
  const { t } = useTranslation(['txn'])
  const { hasAnyRole } = useCurrentUser()

  const transactionType = transaction?.adminAdjustmentId
    ? t('txn:administrativeAdjustment')
    : t('txn:initiativeAgreement')
  const organizationName =
    transaction?.toOrganization?.name || t('common:unknown')

  const isRecommended =
    transaction?.currentStatus?.status === TRANSACTION_STATUSES.RECOMMENDED

  return (
    <BCBox mb={4}>
      <LabelBox>
        <BCBox m={1}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <BCTypography variant="h6">
                <b>
                  {transactionType} for {organizationName}
                </b>
              </BCTypography>
            </Grid>
            <Grid item xs={12}>
              <BCTypography variant="label" style={inlineLabelStyle}>
                {t('txn:complianceUnitsLabel')}
              </BCTypography>
              <BCTypography variant="body2" style={{ display: 'inline' }}>
                {numberFormatter(transaction?.complianceUnits)}
              </BCTypography>
            </Grid>
            <Grid item xs={12}>
              <BCTypography variant="label" style={inlineLabelStyle}>
                {t('txn:effectiveDateLabel')}
              </BCTypography>
              <BCTypography variant="body2" style={{ display: 'inline' }}>
                {transaction?.transactionEffectiveDate || ''}
              </BCTypography>
            </Grid>
            <Grid item xs={12}>
              <BCTypography
                variant="body3"
                dangerouslySetInnerHTML={{
                  __html:
                    isRecommended && hasAnyRole(roles.director)
                      ? t('txn:editableComments')
                      : t('txn:comments')
                }}
                style={inlineLabelStyle}
              />
              <BCTypography variant="body2" style={{ display: 'inline' }}>
                {transaction?.govComment}
              </BCTypography>
            </Grid>
          </Grid>
        </BCBox>
        <BCBox sx={{ bgcolor: '#f2f2f2' }} p={3} m={1} mt={2}>
          <Grid item lg={12}>
            <BCTypography
              variant="body3"
              dangerouslySetInnerHTML={{ __html: t('txn:description') }}
            />
          </Grid>
        </BCBox>
      </LabelBox>
    </BCBox>
  )
}
