import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import Loading from '@/components/Loading'
import { FILTER_KEYS } from '@/constants/common'
import { ROUTES } from '@/routes/routes'
import { FUEL_CODE_STATUSES } from '@/constants/statuses'
import { useFuelCodeCounts } from '@/hooks/useDashboard'
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

export const FuelCodeCard = () => {
  const { t } = useTranslation(['dashboard'])
  const navigate = useNavigate()
  const { data: counts, isLoading } = useFuelCodeCounts()

  const handleNavigation = () => {
    sessionStorage.setItem(
      FILTER_KEYS.FUEL_CODES_GRID,
      JSON.stringify({
        status: {
          filterType: 'text',
          type: 'equals',
          filter: FUEL_CODE_STATUSES.DRAFT
        }
      })
    )
    navigate(ROUTES.FUEL_CODES.LIST)
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
      title={t('dashboard:fuelCodes.title')}
      sx={{ '& .MuiCardContent-root': { padding: '16px' } }}
      content={
        isLoading ? (
          <Loading message={t('dashboard:fuelCodes.loadingMessage')} />
        ) : (
          <Stack spacing={1}>
            <BCTypography variant="body2" sx={{ marginBottom: 0 }}>
              {t('dashboard:fuelCodes.thereAre')}
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
                  t('dashboard:fuelCodes.fcInProgress'),
                  counts?.draftFuelCodes || 0,
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
