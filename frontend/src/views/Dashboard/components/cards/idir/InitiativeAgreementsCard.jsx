import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import Loading from '@/components/Loading'
import { FILTER_KEYS } from '@/constants/common'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config'
import { ROUTES } from '@/routes/routes'
import { useInitiativeAgreementCounts } from '@/hooks/useDashboard'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import Stack from '@mui/material/Stack'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { CountDisplay } from '../../CountDisplay'
import { countDigits } from '../../countDigits'

// IDIR dashboard links card for the Initiative Agreements module (#4895).
// The wireframe's "Change order(s)" and "Expression of interest" counters
// are undefined concepts (open PO question); until they are, the card
// counts by lifecycle status. There is no draft counter: drafts are
// proponents' unsubmitted applications, which IDIR users do not see (#5186).
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

  // One counter width for the whole list, so its links line up (#4911); a
  // row without a count keeps an empty counter, so its link lines up too.
  const digits = countDigits(counts?.underway || 0, counts?.draft || 0)

  const renderLinkWithCount = (text, count, onClick) => {
    return (
      <>
        <CountDisplay count={count} digits={digits} hidden={count == null} />
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
