import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Stack, List, ListItemButton } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import withRole from '@/utils/withRole'
import { withFeatureFlag } from '@/utils/withFeatureFlag'
import { roles } from '@/constants/roles'
import { FEATURE_FLAGS } from '@/constants/config'
import { FILTER_KEYS } from '@/constants/common'
import { ROUTES } from '@/routes/routes'
import { useOrgInitiativeAgreementCounts } from '@/hooks/useDashboard'

// BCeID dashboard card for a proponent's initiative agreements (#4893):
// the organization's agreements by lifecycle status, each a link into
// the index already narrowed to that status. Mirrors OrgFuelCodeCard.

// When `hidden`, the number is rendered invisibly but still occupies
// layout, so plain links share the indent and row height of counted ones.
const CountDisplay = ({ count, hidden = false }) => (
  <BCTypography
    component="span"
    variant="h3"
    aria-hidden={hidden || undefined}
    sx={{
      color: 'success.main',
      marginX: 3,
      ...(hidden && { visibility: 'hidden' })
    }}
  >
    {count}
  </BCTypography>
)

const linkSx = {
  textDecoration: 'underline',
  '&:hover': { color: 'info.main' }
}

const OrgInitiativeAgreementsCard = () => {
  const { t } = useTranslation(['dashboard'])
  const navigate = useNavigate()
  const { data: counts, isLoading } = useOrgInitiativeAgreementCounts()

  const underway = counts?.underway || 0
  const completed = counts?.completed || 0
  const hasAgreements = underway > 0 || completed > 0

  // The index grid restores `${gridKey}-filter` from sessionStorage, so a
  // counter link lands on the grid already narrowed to its status.
  const navigateWithStatus = (status) => {
    if (status) {
      sessionStorage.setItem(
        FILTER_KEYS.INITIATIVE_AGREEMENTS_GRID,
        JSON.stringify({
          'lifecycleStatus.status': {
            filterType: 'text',
            type: 'equals',
            filter: status
          }
        })
      )
    } else {
      sessionStorage.removeItem(FILTER_KEYS.INITIATIVE_AGREEMENTS_GRID)
    }
    navigate(ROUTES.INITIATIVE_AGREEMENTS.LIST)
  }

  const renderLinkWithCount = (text, count, onClick, testId) =>
    count > 0 ? (
      <ListItemButton component="a" onClick={onClick} data-test={testId}>
        <CountDisplay count={count} />
        <BCTypography variant="body2" color="link" sx={linkSx}>
          {text}
        </BCTypography>
      </ListItemButton>
    ) : null

  return (
    <BCWidgetCard
      component="div"
      title={t('dashboard:orgInitiativeAgreements.title')}
      sx={{ '& .MuiCardContent-root': { padding: '16px' } }}
      content={
        isLoading ? (
          <Loading
            message={t('dashboard:orgInitiativeAgreements.loadingMessage')}
          />
        ) : (
          <Stack spacing={1}>
            {hasAgreements ? (
              <BCTypography variant="body2" sx={{ marginBottom: 0 }}>
                {t('dashboard:orgInitiativeAgreements.thereAre')}
              </BCTypography>
            ) : (
              <BCTypography
                variant="body2"
                style={{ marginTop: '10px' }}
                data-test="org-ia-none"
              >
                {t('dashboard:orgInitiativeAgreements.noAgreements')}
              </BCTypography>
            )}
            <List
              component="div"
              sx={{
                maxWidth: '100%',
                padding: 0,
                '& .MuiListItemButton-root': { padding: '2px 0' }
              }}
            >
              {renderLinkWithCount(
                t('dashboard:orgInitiativeAgreements.underway'),
                underway,
                () => navigateWithStatus('Underway'),
                'org-ia-underway'
              )}
              {renderLinkWithCount(
                t('dashboard:orgInitiativeAgreements.completed'),
                completed,
                () => navigateWithStatus('Completed'),
                'org-ia-completed'
              )}
              <ListItemButton
                component="a"
                onClick={() => navigateWithStatus(null)}
                data-test="org-ia-view-all"
              >
                <CountDisplay count={0} hidden />
                <BCTypography variant="body2" color="link" sx={linkSx}>
                  {t('dashboard:orgInitiativeAgreements.viewAll')}
                </BCTypography>
              </ListItemButton>
            </List>
          </Stack>
        )
      }
    />
  )
}

const OrgInitiativeAgreementsCardWithRole = withRole(
  OrgInitiativeAgreementsCard,
  [roles.ia_proponent]
)

// A dashboard card, not a route: it renders nothing when the module flag
// is off rather than redirecting.
const OrgInitiativeAgreementsCardGated = withFeatureFlag(
  OrgInitiativeAgreementsCardWithRole,
  FEATURE_FLAGS.INITIATIVE_AGREEMENTS
)

export default OrgInitiativeAgreementsCardGated
