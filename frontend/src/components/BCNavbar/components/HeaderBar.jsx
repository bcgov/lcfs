import React from 'react'
import PropTypes from 'prop-types'

import { Icon, Toolbar } from '@mui/material'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
// Images & Icons
import logoDark from '@/assets/images/gov3_bc_logo.png'
import logoLight from '@/assets/images/BCID_H_rgb_pos.png'

const HeaderBar = (props) => {
  const { isScrolled, mobileNavbar, mobileView, openMobileNavbar, data } = props

  return (
    <Toolbar
      sx={({
        palette: { transparent: transparentColor, white, primary },
        functions: { rgba }
      }) => ({
        backgroundColor: isScrolled
          ? transparentColor.main
          : rgba(primary.nav, 1),
        backdropFilter: `saturate(200%) blur(30px)`,
        color: isScrolled ? primary.main : white.main,
        width: '100%'
      })}
    >
      <BCBox sx={{ flexGrow: 1 }} component="div">
        <BCBox sx={{ display: 'flex', alignItems: 'center' }} className="logo">
          <img
            src={isScrolled ? logoLight : logoDark}
            alt="BC Government"
            style={{ width: '160px', marginRight: '10px', height: 'auto' }}
          />
          <BCTypography
            component="span"
            variant={mobileView ? 'h6' : 'h4'}
            className="application_title"
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            {data.title}
            {/* Remove "Beta" tag once the application is deployed to prod */}
            {data.beta && (
              <BCTypography
                component="span"
                color="secondary"
                sx={{
                  marginTop: '-1em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  fontSize: '1.1rem',
                  marginLeft: '0.5em'
                }}
              >
                Beta
              </BCTypography>
            )}
          </BCTypography>
        </BCBox>
      </BCBox>
      <BCBox
        display={{ xs: 'none', lg: 'flex' }}
        m={0}
        py={1}
        flexDirection="column"
      >
        {data.headerRightPart &&
          React.cloneElement(data.headerRightPart, { data })}
      </BCBox>
      <BCBox
        display={{ xs: 'inline-block', lg: 'none' }}
        lineHeight={0}
        py={1.5}
        pl={1.5}
        color="inherit"
        sx={{ cursor: 'pointer' }}
        onClick={openMobileNavbar}
      >
        <Icon fontSize="default">{mobileNavbar ? 'close' : 'menu'}</Icon>
      </BCBox>
    </Toolbar>
  )
}

HeaderBar.propTypes = {
  isScrolled: PropTypes.bool,
  showBalance: PropTypes.bool,
  mobileNavbar: PropTypes.bool,
  mobileView: PropTypes.bool,
  toggleBalanceVisibility: PropTypes.func,
  openMobileNavbar: PropTypes.func,
  data: PropTypes.object
}

export default HeaderBar
