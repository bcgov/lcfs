import { AppBar, Box, useTheme, useMediaQuery, Divider } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import logoDark from '@/assets/images/logo-banner.svg'
import { useTranslation } from 'react-i18next'

export const PublicHeader = () => {
  const theme = useTheme()
  const isMobileView = useMediaQuery(theme.breakpoints.down('xl'))
  const { t } = useTranslation()

  return (
    <AppBar
      position="static"
      color="inherit"
      elevation={0}
      sx={({ palette }) => ({
        backgroundColor: palette.primary.main,
        border: 'none'
      })}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '85px',
          px: 3
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <img
            src={logoDark}
            alt="BC Government Logo"
            style={{
              width: '160px',
              height: 'auto',
              marginRight: '16px'
            }}
          />
          <BCTypography variant={isMobileView ? 'h6' : 'h4'} color="white">
            Low Carbon Fuel Standard
          </BCTypography>
        </Box>
        <BCTypography
          variant="body1"
          color="white"
          sx={{ display: { xs: 'none', md: 'block' } }}
        >
          {t('govOrg')}
        </BCTypography>
      </Box>
      <Divider
        sx={{
          backgroundColor: 'secondary.main',
          height: '3px',
          border: 'none'
        }}
      />
    </AppBar>
  )
}
