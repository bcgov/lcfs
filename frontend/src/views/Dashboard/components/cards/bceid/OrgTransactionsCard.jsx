import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Stack, List, ListItemButton } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShareFromSquare } from '@fortawesome/free-solid-svg-icons'
import Loading from '@/components/Loading'
import withRole from '@/utils/withRole'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrgTransactionCounts } from '@/hooks/useDashboard'

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

  const { data: orgData, isLoading: orgLoading } = useOrganization()
  const { data: counts, isLoading } = useOrgTransactionCounts()

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

  function openExternalLink(event, url) {
    event.preventDefault()
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const renderLinkWithCount = (
    text,
    count,
    onClick,
    icons = [],
    title = ''
  ) => {
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
          title={title}
        >
          {text}
          {icons.map((icon, index) => (
            <FontAwesomeIcon
              key={index}
              icon={icon}
              style={{ color: '#578260', marginLeft: 6 }}
            />
          ))}
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
                onClick={() =>
                  handleNavigation(ROUTES.TRANSACTIONS, 'Transfer', [
                    'Draft',
                    'Sent',
                    'Submitted'
                  ])
                }
              >
                {renderLinkWithCount(
                  t('dashboard:orgTransactions.transfersInProgress'),
                  counts?.transfers || 0,
                  () =>
                    handleNavigation(ROUTES.TRANSACTIONS, 'Transfer', [
                      'Draft',
                      'Sent',
                      'Submitted'
                    ])
                )}
              </ListItemButton>

              <ListItemButton
                component="a"
                onClick={(e) =>
                  openExternalLink(
                    e,
                    'https://www2.gov.bc.ca/assets/gov/farming-natural-resources-and-industry/electricity-alternative-energy/transportation/renewable-low-carbon-fuels/rlcf-013.pdf'
                  )
                }
              >
                {renderLinkWithCount(
                  t('dashboard:orgTransactions.organizationsRegistered'),
                  null,
                  (e) =>
                    openExternalLink(
                      e,
                      'https://www2.gov.bc.ca/gov/content?id=4B2DC59D77F64C8491C5CDFCF8732F10'
                    ),
                  [faShareFromSquare],
                  t('dashboard:orgTransactions.linkTooltip')
                )}
              </ListItemButton>

              <ListItemButton
                component="a"
                onClick={() => navigate(ROUTES.TRANSFERS_ADD)}
              >
                {renderLinkWithCount(
                  t('dashboard:orgTransactions.startNewTransfer'),
                  null,
                  () => navigate(ROUTES.TRANSFERS_ADD)
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
