import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Stack, List, ListItemButton } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import withRole from '@/utils/withRole'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/routes/routes'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgTransactionCounts } from '@/hooks/useDashboard'
import { FILTER_KEYS } from '@/constants/common'
import { TRANSACTION_TYPES, TRANSFER_STATUSES } from '@/constants/statuses'

const CountDisplay = ({ count }) => (
  <BCTypography
    component="span"
    variant="h3"
    sx={{
      color: 'success.main',
      marginX: 3,
      visibility: count != null ? 'visible' : 'hidden'
    }}
  >
    {count ?? 0}
  </BCTypography>
)

const OrgTransactionsCard = () => {
  const { t } = useTranslation(['dashboard'])
  const navigate = useNavigate()

  const { data: orgData } = useOrganization()
  const { data: counts, isLoading } = useOrgTransactionCounts()

  const handleNavigation = (route) => {
    sessionStorage.setItem(
      FILTER_KEYS.TRANSACTIONS_GRID,
      JSON.stringify({
        status: {
          filterType: 'set',
          type: 'set',
          filter: [
            TRANSFER_STATUSES.SENT,
            TRANSFER_STATUSES.SUBMITTED,
            TRANSFER_STATUSES.RECOMMENDED
          ]
        },
        transactionType: {
          filterType: 'text',
          type: 'equals',
          filter: TRANSACTION_TYPES.TRANSFER
        }
      })
    )
    navigate(route)
  }

  const renderLinkWithCount = (text, count, onClick) => {
    return (
      <>
        <CountDisplay count={count} />
        <BCTypography
          variant="body2"
          color="link"
          sx={{
            textDecoration: 'underline',
            '&:hover': { color: 'info.main' },
            cursor: 'pointer'
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
      title={t('dashboard:orgTransactions.title')}
      sx={{ '& .MuiCardContent-root': { padding: '16px' } }}
      content={
        isLoading ? (
          <Loading message={t('dashboard:orgTransactions.loadingMessage')} />
        ) : (
          <Stack spacing={1}>
            <BCTypography variant="body2" sx={{ marginBottom: 0 }}>
              {t('dashboard:orgTransactions.orgHas', { name: orgData?.name })}
            </BCTypography>
            <List
              component="div"
              sx={{
                maxWidth: '100%',
                padding: 0,
                '& .MuiListItemButton-root': {
                  padding: '1px 0'
                }
              }}
            >
              <ListItemButton
                component="a"
                onClick={() => handleNavigation(ROUTES.TRANSACTIONS.LIST)}
              >
                {renderLinkWithCount(
                  t('dashboard:orgTransactions.transfersInProgress'),
                  counts?.transfers || 0,
                  () => handleNavigation(ROUTES.TRANSACTIONS.LIST)
                )}
              </ListItemButton>

              <ListItemButton
                component="a"
                onClick={() => navigate(ROUTES.TRANSACTIONS.CREDIT_TRADING_MARKET)}
              >
                {renderLinkWithCount(
                  t('dashboard:orgTransactions.organizationsRegistered'),
                  null,
                  () => navigate(ROUTES.TRANSACTIONS.CREDIT_TRADING_MARKET)
                )}
              </ListItemButton>

              <ListItemButton
                component="a"
                onClick={() => navigate(ROUTES.TRANSFERS.ADD)}
              >
                {renderLinkWithCount(
                  t('dashboard:orgTransactions.startNewTransfer'),
                  null,
                  () => navigate(ROUTES.TRANSFERS.ADD)
                )}
              </ListItemButton>
            </List>
          </Stack>
        )
      }
    />
  )
}

const AllowedRoles = [roles.transfers]
const orgTransactionsWidgetWithRole = withRole(
  OrgTransactionsCard,
  AllowedRoles
)

export default orgTransactionsWidgetWithRole
