import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Stack, List, ListItemButton } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import withRole from '@/utils/withRole'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { useTransactionCounts } from '@/hooks/useDashboard'

const CountDisplay = ({ count }) => (
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
)

const TransactionsCard = () => {
  const { t } = useTranslation(['dashboard'])
  const navigate = useNavigate()
  const { data: counts, isLoading } = useTransactionCounts()

  const handleNavigation = (route, transactionType, statuses) => {
    const filters = [
      {
        field: 'transactionType',
        filterType: 'text',
        type: 'equals',
        filter: transactionType
      },
      { field: 'status', filterType: 'set', type: 'set', filter: statuses }
    ]
    navigate(route, { state: { filters } })
  }

  const renderLinkWithCount = (text, count, onClick) => {
    return (
      <>
        {count != null && <CountDisplay count={count} />}
        <BCTypography
          variant="body2"
          color="link"
          sx={{
            textDecoration: 'underline',
            '&:hover': { color: 'info.main' }
          }}
          onClick={onClick}
        >
          {text}
        </BCTypography>
      </>
    )
  }

  return (
    <BCWidgetCard
      component="div"
      title={t('dashboard:transactions.title')}
      sx={{ '& .MuiCardContent-root': { padding: '16px' } }}
      content={
        isLoading ? (
          <Loading message={t('dashboard:transactions.loadingMessage')} />
        ) : (
          <Stack spacing={1}>
            <BCTypography variant="body2" sx={{ marginBottom: 0 }}>
              {t('dashboard:transactions.thereAre')}
            </BCTypography>
            <List
              component="div"
              sx={{
                maxWidth: '100%',
                padding: 0,
                '& .MuiListItemButton-root': {
                  padding: '2px 0'
                }
              }}
            >
              <ListItemButton
                component="a"
                onClick={() =>
                  handleNavigation(ROUTES.TRANSACTIONS, 'Transfer', [
                    'Submitted',
                    'Recommended'
                  ])
                }
              >
                {renderLinkWithCount(
                  t('dashboard:transactions.transfersInProgress'),
                  counts?.transfers || 0,
                  () =>
                    handleNavigation(ROUTES.TRANSACTIONS, 'Transfer', [
                      'Submitted',
                      'Recommended'
                    ])
                )}
              </ListItemButton>
              <ListItemButton
                component="a"
                onClick={() =>
                  handleNavigation(ROUTES.TRANSACTIONS, 'InitiativeAgreement', [
                    'Draft',
                    'Recommended'
                  ])
                }
              >
                {renderLinkWithCount(
                  t('dashboard:transactions.initiativeAgreementsInProgress'),
                  counts?.initiativeAgreements || 0,
                  () =>
                    handleNavigation(
                      ROUTES.TRANSACTIONS,
                      'InitiativeAgreement',
                      ['Draft', 'Recommended']
                    )
                )}
              </ListItemButton>
              <ListItemButton
                component="a"
                onClick={() =>
                  handleNavigation(ROUTES.TRANSACTIONS, 'AdminAdjustment', [
                    'Draft',
                    'Recommended'
                  ])
                }
              >
                {renderLinkWithCount(
                  t(
                    'dashboard:transactions.administrativeAdjustmentsInProgress'
                  ),
                  counts?.adminAdjustments || 0,
                  () =>
                    handleNavigation(ROUTES.TRANSACTIONS, 'AdminAdjustment', [
                      'Draft',
                      'Recommended'
                    ])
                )}
              </ListItemButton>
              <ListItemButton
                component="a"
                onClick={() => navigate(ROUTES.TRANSACTIONS)}
              >
                {renderLinkWithCount(
                  t('dashboard:transactions.viewAllTransactions'),
                  null,
                  () => navigate(ROUTES.TRANSACTIONS)
                )}
              </ListItemButton>
            </List>
          </Stack>
        )
      }
    />
  )
}

const AllowedRoles = [roles.analyst, roles.compliance_manager]
const TransactionsWidgetWithRole = withRole(TransactionsCard, AllowedRoles)

export default TransactionsWidgetWithRole
