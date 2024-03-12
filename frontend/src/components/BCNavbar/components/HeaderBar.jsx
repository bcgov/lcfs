import React from 'react'
import PropTypes from 'prop-types'

import { Icon, Toolbar } from '@mui/material'
import { bindTrigger } from 'material-ui-popup-state'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
// Images & Icons
import logoDark from '@/assets/images/logo-banner.svg'
import logoLight from '@/assets/images/BCID_H_rgb_pos.png'

const HeaderBar = (props) => {
  const { isScrolled, isMobileView, popupState, data } = props

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
            variant={isMobileView ? 'h6' : 'h4'}
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
        display={{ xs: 'inline-block', xl: 'none' }}
        lineHeight={0}
        py={1.5}
        pl={1.5}
        color="inherit"
        sx={{ cursor: 'pointer' }}
        {...bindTrigger(popupState)}
      >
        <Icon fontSize="default">{popupState.isOpen ? 'close' : 'menu'}</Icon>
      </BCBox>
    </Toolbar>
  )
}

HeaderBar.defaultProps = {
  isScrolled: false,
  isMobileView: false,
  popupState: {},
  data: {}
}

HeaderBar.propTypes = {
  isScrolled: PropTypes.bool,
  isMobileView: PropTypes.bool,
  popupState: PropTypes.object,
  data: PropTypes.object
}

export default HeaderBar
