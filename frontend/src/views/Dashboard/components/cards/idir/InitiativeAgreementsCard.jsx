import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import Loading from '@/components/Loading'
import { FILTER_KEYS } from '@/constants/common'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config'
import { ROUTES } from '@/routes/routes'
import { useInitiativeAgreementCounts } from '@/hooks/useDashboard'
import { List, ListItemButton, Stack } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

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

// IDIR dashboard links card for the Initiative Agreements module (#4895).
// The wireframe's "Change order(s)" and "Expression of interest" counters
// are undefined concepts (open PO question); until they are, the card
// counts by lifecycle status.
export const InitiativeAgreementsCard = () => {
  const { t } = useTranslation(['dashboard'])
  const navigate = useNavigate()
  const moduleEnabled = isFeatureEnabled(FEATURE_FLAGS.INITIATIVE_AGREEMENTS)
  const { data: counts, isLoading } = useInitiativeAgreementCounts({
    enabled: moduleEnabled
  })

  if (!moduleEnabled) {
    return null
  }

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
      disableHover={true}
      title={t('dashboard:initiativeAgreements.title')}
      sx={{ '& .MuiCardContent-root': { padding: '16px' } }}
      content={
        isLoading ? (
          <Loading
            message={t('dashboard:initiativeAgreements.loadingMessage')}
          />
        ) : (
          <Stack spacing={1}>
            <BCTypography variant="body2" sx={{ marginBottom: 0 }}>
              {t('dashboard:initiativeAgreements.thereAre')}
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
                onClick={() => navigateWithStatus('Underway')}
              >
                {renderLinkWithCount(
                  t('dashboard:initiativeAgreements.underway'),
                  counts?.underway || 0,
                  () => navigateWithStatus('Underway')
                )}
              </ListItemButton>
              <ListItemButton
                component="a"
                onClick={() => navigateWithStatus('Draft')}
              >
                {renderLinkWithCount(
                  t('dashboard:initiativeAgreements.draft'),
                  counts?.draft || 0,
                  () => navigateWithStatus('Draft')
                )}
              </ListItemButton>
              <ListItemButton
                component="a"
                onClick={() => navigateWithStatus(null)}
              >
                {renderLinkWithCount(
                  t('dashboard:initiativeAgreements.viewAll'),
                  null,
                  () => navigateWithStatus(null)
                )}
              </ListItemButton>
            </List>
          </Stack>
        )
      }
    />
  )
}
