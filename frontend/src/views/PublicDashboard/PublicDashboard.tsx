import { Box, List, ListItemButton } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import { ROUTES } from '@/routes/routes'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const publicLinks = [
  {
    labelKey: 'publicDashboard.links.calculator',
    path: ROUTES.CREDIT_CALCULATOR
  },
  {
    labelKey: 'publicDashboard.links.calculationData',
    path: ROUTES.CALCULATION_DATA
  },
  {
    labelKey: 'publicDashboard.links.approvedCarbonIntensities',
    path: ROUTES.APPROVED_CARBON_INTENSITIES
  }
]

export const PublicDashboard = () => {
  const { t } = useTranslation()

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="60vh"
    >
      <BCWidgetCard
        color="nav"
        title={t('publicDashboard.cardTitle')}
        data-test="public-dashboard-card"
        sx={{ width: 550, mb: 0, pb: 12 }}
        content={
          <List component="div" sx={{ maxWidth: '100%', py: 1, pr: 0 }}>
            {publicLinks.map(({ labelKey, path }) => (
              <ListItemButton
                component={Link}
                to={path}
                key={labelKey}
                alignItems="flex-start"
                data-test={`public-link-${path.replace(/^\//, '')}`}
              >
                <BCTypography
                  variant="subtitle2"
                  component="p"
                  color="link"
                  sx={{
                    textDecoration: 'underline',
                    '&:hover': { color: 'info.main' }
                  }}
                >
                  {t(labelKey)}
                </BCTypography>
              </ListItemButton>
            ))}
          </List>
        }
      />
    </Box>
  )
}

export default PublicDashboard
