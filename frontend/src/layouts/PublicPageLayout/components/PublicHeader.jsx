import React from 'react'
import { AppBar, Box, useTheme, useMediaQuery, Divider } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import logoDark from '@/assets/images/logo-banner.svg'

export const PublicHeader = () => {
  const theme = useTheme()
  const isMobileView = useMediaQuery(theme.breakpoints.down('xl'))

  return (
    <AppBar
      position="static"
      color="inherit"
      elevation={0}
      sx={({ palette: { primary, secondary } }) => ({
        backgroundColor: primary.nav,
        borderBottom: `5px solid #dadada`
      })}
    >
      <Box
        sx={{ display: 'flex', alignItems: 'center', height: '85px', px: 3 }}
      >
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
      <Divider
        sx={({ palette: { secondary } }) => ({
          backgroundColor: 'secondary.main',
          height: '2px'
        })}
      />
      <Box
        sx={{
          backgroundColor: 'rgba(56, 89, 138, 1)',
          minHeight: '45px',
          display: 'flex',
          alignItems: 'center',
          px: 3
        }}
      ></Box>
    </AppBar>
  )
}
