import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import Loading from '@/components/Loading'
import { ROUTES } from '@/constants/routes'
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
    localStorage.setItem(
      'fuel-codes-grid-filter',
      '{"status":{"filterType":"text","type":"equals","filter":"Draft"}}'
    )
    navigate(ROUTES.FUELCODES)
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
