import React from 'react'
import { ROUTES } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useOrganization } from '@/hooks/useOrganization'
import { useTransactionsOrgTransfersInProgress } from '@/hooks/useTransactions'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { faFilePdf, faShareFromSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Grid, List, ListItemButton } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'

const TransactionListItem = ({ text, route, number, icons = [], external = false }) => {
  const navigate = useNavigate()

  const handleClick = (e) => {
    if (external) {
      e.preventDefault()
      window.open(route, '_blank', 'noopener,noreferrer')
    } else {
      navigate(route)
    }
  }

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
          component="a"
          alignItems="flex-start"
          onClick={(e) => handleClick(e)}
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
            {icons.map((icon, index) => (
              <FontAwesomeIcon key={index} icon={icon} style={{ color: '#578260', marginLeft: 6 }} />
            ))}
          </BCTypography>
        </ListItemButton>
      </Grid>
    </Grid>
  )
}

export function OrgTransactionsCard() {
  const { t } = useTranslation(['common', 'org'])

  const { data: currentUserData } = useCurrentUser()
  const { data: orgData, isLoading: orgLoading } = useOrganization()
  const { data: transfersInProgressData, isLoading: transfersLoading } = useTransactionsOrgTransfersInProgress(currentUserData?.organization.organizationId)

  if (orgLoading || transfersLoading) {
    return <Loading message={t('org:cards.orgTransactions.loading')} />
  }

  const transfersInProgress = transfersInProgressData?.transfersInProgress ?? 0

  return (
    <BCWidgetCard
      component="div"
      disableHover={true}
      title={t('org:cards.orgTransactions.title')}
      content={
        <Grid container spacing={2}>
          <Grid item xs={12} mb={-2}>
            <BCTypography variant="body2" color="primary" gutterBottom>
              {t('org:cards.orgTransactions.orgHas', { name: orgData?.name })}
            </BCTypography>
          </Grid>
          <Grid item xs sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
            <List component="div" sx={{ maxWidth: '100%' }}>
              <TransactionListItem
                text={t('org:cards.orgTransactions.transfersInProgress')}
                route={ROUTES.TRANSACTIONS_FILTER_IN_PROGRESS_ORG_TRANSFERS}
                number={transfersInProgress} />
              <TransactionListItem
                text={t('org:cards.orgTransactions.organizationsRegistered')}
                route="https://www2.gov.bc.ca/assets/gov/farming-natural-resources-and-industry/electricity-alternative-energy/transportation/renewable-low-carbon-fuels/rlcf-013.pdf"
                icons={[faFilePdf, faShareFromSquare]}
                external={true} />
              <TransactionListItem
                text={t('org:cards.orgTransactions.startNewTransfer')}
                route={ROUTES.TRANSFERS_ADD} />
            </List>
          </Grid>
        </Grid>
      } />
  )
}
