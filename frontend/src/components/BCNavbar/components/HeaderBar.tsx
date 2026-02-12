import React from 'react'
import { Icon, Toolbar } from '@mui/material'
import { bindTrigger } from 'material-ui-popup-state'
import type { PopupState } from 'material-ui-popup-state/hooks'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import logoDark from '@/assets/images/logo-banner.svg'
import type { NavbarContextData } from '@/components/BCNavbar/types'

interface HeaderBarProps {
  isMobileView?: boolean
  popupState: PopupState
  data: NavbarContextData
}

const HeaderBar = ({
  isMobileView = false,
  popupState,
  data
}: HeaderBarProps) => {
  return (
    <Toolbar
      sx={(theme: any) => {
        const { white, primary } = theme.palette
        const { rgba } = theme.functions
        return {
          backgroundColor: rgba(primary.nav, 1),
          backdropFilter: `saturate(200%) blur(30px)`,
          color: white.main,
          width: '100%'
        }
      }}
    >
      <BCBox sx={{ flexGrow: 1 }} component="div">
        <BCBox sx={{ display: 'flex', alignItems: 'center' }} className="logo">
          <img
            src={logoDark}
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
        <Icon fontSize="inherit">
          {popupState.isOpen ? 'close' : 'menu'}
        </Icon>
      </BCBox>
    </Toolbar>
  )
}

export default HeaderBar
