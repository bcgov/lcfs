import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Stack, List, ListItemButton } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFilePdf, faShareFromSquare } from '@fortawesome/free-solid-svg-icons'
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
      marginX: 3
    }}
  >
    {count}
  </BCTypography>
)

const OrgTransactionsCard = () => {
  const { t } = useTranslation(['dashboard'])
  const navigate = useNavigate()
  const { data: orgData, isLoading: orgLoading } = useOrganization()
  const { data: counts, isLoading } = useOrgTransactionCounts()

  const handleNavigation = (route, transactionType, statuses) => {
    const filters = [
      { field: "transactionType", filterType: "text", type: "equals", filter: transactionType },
      { field: 'status', filterType: 'set', type: 'set', filter: statuses },
    ]
    navigate(route, { state: { filters } })
  }

  function handleExternalNavigate(event, route) {
    event.preventDefault();
    window.open(route, '_blank', 'noopener,noreferrer');
  }

  const renderLinkWithCount = (text, count, onClick, icons = []) => {
    return (
      <>
        {count != null && <CountDisplay count={count} />}
        <BCTypography
          variant="body2"
          color="link"
          sx={{
            textDecoration: 'underline',
            '&:hover': { color: 'info.main' },
          }}
          onClick={onClick}
        >
          {text}
          {icons.map((icon, index) => (
            <FontAwesomeIcon key={index} icon={icon} style={{ color: '#578260', marginLeft: 6 }} />
          ))}
        </BCTypography>
      </>
    )
  }

  return (
    <BCWidgetCard
      component="div"
      disableHover={true}
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
                  padding: '2px 0'
                },
              }}
            >
              <ListItemButton
                component="a"
                onClick={() => handleNavigation(ROUTES.TRANSACTIONS, 'Transfer', ['Draft', 'Sent', 'Submitted'])}
              >
                {renderLinkWithCount(
                  t('dashboard:orgTransactions.transfersInProgress'),
                  counts?.transfers || 0,
                  () => handleNavigation(ROUTES.TRANSACTIONS, 'Transfer', ['Draft', 'Sent', 'Submitted'])
                )}
              </ListItemButton>
              <ListItemButton
                component="a"
                onClick={(e) => handleExternalNavigate(e, 'https://www2.gov.bc.ca/assets/gov/farming-natural-resources-and-industry/electricity-alternative-energy/transportation/renewable-low-carbon-fuels/rlcf-013.pdf')}
              >
                {renderLinkWithCount(
                  t('dashboard:orgTransactions.organizationsRegistered'),
                  null,
                  (e) => handleExternalNavigate(e, 'https://www2.gov.bc.ca/assets/gov/farming-natural-resources-and-industry/electricity-alternative-energy/transportation/renewable-low-carbon-fuels/rlcf-013.pdf'),
                  [faFilePdf, faShareFromSquare]
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
const orgTransactionsWidgetWithRole = withRole(OrgTransactionsCard, AllowedRoles)

export default orgTransactionsWidgetWithRole
