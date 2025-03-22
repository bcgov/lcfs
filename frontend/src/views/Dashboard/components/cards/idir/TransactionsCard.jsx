import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Stack, List, ListItemButton } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import withRole from '@/utils/withRole'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/routes/routes'
import { useTransactionCounts } from '@/hooks/useDashboard'
import { TRANSACTION_STATUSES, TRANSFER_STATUSES } from '@/constants/statuses'

// Constants for transaction configurations
const TRANSACTION_CONFIGS = {
  transfers: {
    type: 'Transfer',
    statuses: [TRANSFER_STATUSES.SUBMITTED, TRANSFER_STATUSES.RECOMMENDED],
    translationKey: 'dashboard:transactions.transfersInProgress'
  },
  initiativeAgreements: {
    type: 'Initiative Agreement',
    statuses: [TRANSACTION_STATUSES.DRAFT, TRANSACTION_STATUSES.RECOMMENDED],
    translationKey: 'dashboard:transactions.initiativeAgreementsInProgress'
  },
  adminAdjustments: {
    type: 'Admin Adjustment',
    statuses: [TRANSACTION_STATUSES.DRAFT, TRANSACTION_STATUSES.RECOMMENDED],
    translationKey: 'dashboard:transactions.administrativeAdjustmentsInProgress'
  },
  viewAll: {
    type: null,
    statuses: null,
    translationKey: 'dashboard:transactions.viewAllTransactions'
  }
}

const styles = {
  cardContent: {
    '& .MuiCardContent-root': {
      padding: '16px'
    }
  },
  list: {
    maxWidth: '100%',
    padding: 0,
    '& .MuiListItemButton-root': {
      padding: '2px 0'
    }
  },
  link: {
    textDecoration: 'underline',
    '&:hover': {
      color: 'info.main'
    }
  }
}

const TransactionsCard = () => {
  const { t } = useTranslation(['dashboard'])
  const navigate = useNavigate()
  const { data: counts = {}, isLoading } = useTransactionCounts()

  const createFilter = useCallback((transactionType, statuses) => {
    if (!transactionType) return null

    return JSON.stringify({
      transactionType: {
        filterType: 'text',
        type: 'equals',
        filter: transactionType
      },
      status: {
        filterType: 'set',
        type: 'set',
        filter: statuses
      }
    })
  }, [])

  const handleNavigation = useCallback(
    (transactionType, statuses) => {
      const itemKey = 'transactions-grid-filter'
      const filter = createFilter(transactionType, statuses)

      if (filter) {
        sessionStorage.setItem(itemKey, filter)
      } else {
        sessionStorage.removeItem(itemKey)
      }

      navigate(ROUTES.TRANSACTIONS.LIST)
    },
    [navigate, createFilter]
  )

  const renderLinkWithCount = useCallback(
    (text, count, onClick) => (
      <>
        {count != null && (
          <BCTypography
            component="span"
            variant="h3"
            sx={{
              color: 'success.main',
              marginX: 3
            }}
          >
            {count}
          </BCTypography>
        )}
        <BCTypography
          variant="body2"
          color="link"
          sx={styles.link}
          onClick={onClick}
        >
          {text}
        </BCTypography>
      </>
    ),
    []
  )

  const transactionItems = useMemo(
    () => [
      {
        key: 'transfers',
        text: t(TRANSACTION_CONFIGS.transfers.translationKey),
        count: counts.transfers,
        config: TRANSACTION_CONFIGS.transfers
      },
      {
        key: 'initiativeAgreements',
        text: t(TRANSACTION_CONFIGS.initiativeAgreements.translationKey),
        count: counts.initiativeAgreements,
        config: TRANSACTION_CONFIGS.initiativeAgreements
      },
      {
        key: 'adminAdjustments',
        text: t(TRANSACTION_CONFIGS.adminAdjustments.translationKey),
        count: counts.adminAdjustments,
        config: TRANSACTION_CONFIGS.adminAdjustments
      },
      {
        key: 'viewAll',
        text: t(TRANSACTION_CONFIGS.viewAll.translationKey),
        count: null,
        config: TRANSACTION_CONFIGS.viewAll
      }
    ],
    [t, counts]
  )

  if (isLoading) {
    return (
      <BCWidgetCard
        component="div"
        title={t('dashboard:transactions.title')}
        sx={styles.cardContent}
        content={
          <Loading message={t('dashboard:transactions.loadingMessage')} />
        }
      />
    )
  }

  return (
    <BCWidgetCard
      component="div"
      title={t('dashboard:transactions.title')}
      sx={styles.cardContent}
      content={
        <Stack spacing={1}>
          <BCTypography variant="body2" sx={{ marginBottom: 0 }}>
            {t('dashboard:transactions.thereAre')}
          </BCTypography>
          <List component="div" sx={styles.list}>
            {transactionItems.map(({ key, text, count, config }) => (
              <ListItemButton
                key={key}
                component="a"
                onClick={() => handleNavigation(config.type, config.statuses)}
              >
                {renderLinkWithCount(text, count, () =>
                  handleNavigation(config.type, config.statuses)
                )}
              </ListItemButton>
            ))}
          </List>
        </Stack>
      }
    />
  )
}

const AllowedRoles = [roles.analyst, roles.compliance_manager]
const TransactionsWidgetWithRole = withRole(TransactionsCard, AllowedRoles)

export default TransactionsWidgetWithRole
