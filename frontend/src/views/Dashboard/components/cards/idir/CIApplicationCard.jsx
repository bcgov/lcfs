import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import Loading from '@/components/Loading'
import { FILTER_KEYS } from '@/constants/common'
import { ROUTES } from '@/routes/routes'
import { CI_APPLICATION_STATUSES } from '@/constants/statuses'
import { useCIApplicationCounts } from '@/hooks/useDashboard'
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

export const CIApplicationCard = () => {
  const { t } = useTranslation(['dashboard'])
  const navigate = useNavigate()
  const { data: counts, isLoading } = useCIApplicationCounts()

  const handleNavigation = () => {
    sessionStorage.setItem(
      FILTER_KEYS.CI_APPLICATIONS_GRID,
      JSON.stringify({
        status: {
          filterType: 'set',
          type: 'set',
          filter: [
            CI_APPLICATION_STATUSES.SUBMITTED,
            CI_APPLICATION_STATUSES.RECOMMENDED
          ]
        }
      })
    )
    navigate(ROUTES.CI_APPLICATIONS.LIST)
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
      title={t('dashboard:ciApplications.title')}
      sx={{ '& .MuiCardContent-root': { padding: '16px' } }}
      content={
        isLoading ? (
          <Loading message={t('dashboard:ciApplications.loadingMessage')} />
        ) : (
          <Stack spacing={1}>
            <BCTypography variant="body2" sx={{ marginBottom: 0 }}>
              {t('dashboard:ciApplications.thereAre')}
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
              <ListItemButton component="a" onClick={handleNavigation}>
                {renderLinkWithCount(
                  t('dashboard:ciApplications.inProgress'),
                  counts?.inProgress || 0,
                  handleNavigation
                )}
              </ListItemButton>
            </List>
          </Stack>
        )
      }
    />
  )
}
