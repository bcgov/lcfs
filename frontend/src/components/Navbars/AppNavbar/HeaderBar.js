import React from 'react'
import PropTypes from 'prop-types'

import { Icon, Toolbar } from '@mui/material';
import BCBox from 'components/BCBox';
import BCTypography from 'components/BCTypography';
// Images & Icons
import logoDark from 'assets/images/gov3_bc_logo.png'
import logoLight from 'assets/images/BCID_H_rgb_pos.png'

const HeaderBar = props => {
  const { isScrolled, org, showBalance, mobileNavbar, mobileView, toggleBalanceVisibility, openMobileNavbar } = props;

  return (
    <Toolbar
      sx={({
        palette: { transparent: transparentColor, white, primary },
        functions: { rgba },
      }) => ({
        backgroundColor: (isScrolled
          ? transparentColor.main
          : rgba(primary.nav, 1)),
        backdropFilter: `saturate(200%) blur(30px)`,
        color: (isScrolled ? primary.main : white.main),
        width: '100%',
      })}>
      <BCBox sx={{ flexGrow: 1 }} component='div'>
        <BCBox sx={{ display: 'flex', alignItems: 'center' }} className='logo'>
          <img src={isScrolled ? logoLight : logoDark} alt='BC Government' style={{ width: '160px', marginRight: '10px', height: 'auto' }} />
          <BCTypography variant={mobileView ? 'h6' : 'h3'} component='div' className='application_title'>{org.title}</BCTypography>
        </BCBox>
      </BCBox>
      <BCBox display={{ xs: 'none', lg: 'flex' }} m={0} py={1} flexDirection='column'>
        <BCTypography className='organization_name' variant='body1' align='right'>
          {org.organizationName}
        </BCTypography>
        <BCBox component='div' className='organization_balance'>
          Balance:{' '}
          <BCBox component='div' sx={{ display: 'inline-flex', alignItems: 'center' }}>
            {showBalance && <div className='balance'>{org.balance}</div>}
            <Icon style={{ fontSize: 20, cursor: 'pointer', margin: '5px' }} onClick={toggleBalanceVisibility}>
              {showBalance ? 'visibility' : 'visibility_off'}
            </Icon>
          </BCBox>
        </BCBox>
      </BCBox>
      <BCBox
        display={{ xs: 'inline-block', lg: 'none' }}
        lineHeight={0}
        py={1.5}
        pl={1.5}
        color='inherit'
        sx={{ cursor: 'pointer' }}
        onClick={openMobileNavbar}
      >
        <Icon fontSize='default'>{mobileNavbar ? 'close' : 'menu'}</Icon>
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
  title: PropTypes.string,
  organizationName: PropTypes.string,
  balance: PropTypes.string,
}

export default HeaderBar