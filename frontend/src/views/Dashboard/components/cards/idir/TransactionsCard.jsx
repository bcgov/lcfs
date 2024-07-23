import React from 'react'
import { ROUTES } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useTransactionsTransfersInProgress,
  useTransactionsInitiativeAgreementsInProgress,
  useTransactionsAdminAdjustmentsInProgress
} from '@/hooks/useTransactions'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Grid, List, ListItemButton } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'

const TransactionListItem = ({ text, route, number }) => {
  const navigate = useNavigate()

  return (
    <Grid container alignItems="center" spacing={2}>
      <Grid item xs={2}>
        <BCTypography
          variant="h3"
          style={{ color: '#578260', textAlign: 'right' }}
        >
          {number}
        </BCTypography>
      </Grid>
      <Grid item xs={10}>
        <ListItemButton
          component="div"
          alignItems="flex-start"
          onClick={() => navigate(route)}
          sx={{ display: 'flex', alignItems: 'center', padding: '8px 16px' }}
        >
          <BCTypography
            variant="subtitle2"
            color="link"
            sx={{
              textDecoration: 'underline',
              '&:hover': { color: 'info.main' },
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {text}
          </BCTypography>
        </ListItemButton>
      </Grid>
    </Grid>
  )
}

export function TransactionsCard() {
  const { t } = useTranslation(['common', 'org'])
  const { data: currentUserData } = useCurrentUser()

  const { data: transfersInProgressData, isLoading: transfersLoading } = useTransactionsTransfersInProgress()
  const { data: initiativeAgreementsInProgressData, isLoading: initiativeAgreementsLoading } = useTransactionsInitiativeAgreementsInProgress()
  const { data: adminAdjustmentsInProgressData, isLoading: adminAdjustmentsLoading } = useTransactionsAdminAdjustmentsInProgress()

  if (transfersLoading || initiativeAgreementsLoading || adminAdjustmentsLoading) {
    return <Loading message={t('org:cards.transactions.loading')} />
  }

  const transfersInProgress = transfersInProgressData?.transfersInProgress ?? 0
  const initiativeAgreementsInProgress = initiativeAgreementsInProgressData?.initiativeAgreementsInProgress ?? 0
  const adminAdjustmentsInProgress = adminAdjustmentsInProgressData?.adminAdjustmentsInProgress ?? 0

  return (
    <BCWidgetCard
      component="div"
      disableHover={true}
      title={t('org:cards.transactions.title')}
      content={
        <Grid container spacing={2}>
          <Grid item xs={12} mb={-2}>
            <BCTypography variant="body2" color="primary" gutterBottom>
              {t('org:cards.transactions.thereAre')}
            </BCTypography>
          </Grid>
          <Grid item xs sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
            <List component="div" sx={{ maxWidth: '100%' }}>
              <TransactionListItem
                text={t('org:cards.transactions.transfersInProgress')}
                route={ROUTES.TRANSACTIONS_FILTER_IN_PROGRESS_TRANSFERS}
                number={transfersInProgress} />
              <TransactionListItem
                text={t('org:cards.transactions.initiativeAgreementsInProgress')}
                route={ROUTES.TRANSACTIONS_FILTER_IN_PROGRESS_INITIATIVE_AGREEMENT}
                number={initiativeAgreementsInProgress} />
              <TransactionListItem
                text={t('org:cards.transactions.administrativeAdjustmentsInProgress')}
                route={ROUTES.TRANSACTIONS_FILTER_IN_PROGRESS_ADMIN_ADJUSTMENT}
                number={adminAdjustmentsInProgress} />
              <TransactionListItem
                text={t('org:cards.transactions.viewAllTransactions')}
                route={ROUTES.TRANSACTIONS} />
            </List>
          </Grid>
        </Grid>
      }
    />
  )
}
