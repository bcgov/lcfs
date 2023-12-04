import React from 'react'
import { Link } from 'react-router-dom';
import { useKeycloak } from '@react-keycloak/web';

// Constants
import { IDENTITY_PROVIDERS } from 'constants/auth';
// BC @mui components
import LoginLayout from 'layouts/authentication/LoginLayout'
import BCBox from 'components/BCBox';
import BCButton from 'components/BCButton';
import BCTypography from 'components/BCTypography';

// @mui material components
import { Card } from '@mui/material';

// Images
import logoDark from 'assets/images/gov3_bc_logo.png';

function getSeason(date) {
  const month = date.getMonth() + 1; // Months are zero-indexed
  const day = date.getDate();

  if ((month === 3 && day >= 20) || (month > 3 && month < 6) || (month === 6 && day <= 20)) {
    return 'spring';
  } else if (
    (month === 6 && day >= 21) ||
    (month > 6 && month < 9) ||
    (month === 9 && day <= 21)
  ) {
    return 'summer';
  } else if (
    (month === 9 && day >= 22) ||
    (month > 9 && month < 12) ||
    (month === 12 && day <= 20)
  ) {
    return 'autumn';
  } else {
    return 'winter';
  }
}

const LCFSLogin = () => {
  const { keycloak } = useKeycloak()
  const redirectUri = window.location.origin
  const currentDate = new Date()

  return (
    <LoginLayout season={getSeason(currentDate)}>
      <Card
        sx={{
          background: 'rgba(255, 255, 255, 0.8)',
        }}
      >
        <BCBox
          variant="gradient"
          bgColor="primary"
          borderRadius="lg"
          coloredShadow="primary"
          mx={2}
          mt={-3}
          p={2}
          mb={1}
          textAlign="center"
        >
          <img src={logoDark} alt='BC Government Logo' style={{ width: '160px', marginRight: '10px', height: 'auto' }} />
          <BCTypography variant="h4" fontWeight="medium" color="white" mt={1}>
            Low Carbon Fuel Standard
          </BCTypography>
        </BCBox>
        <BCBox pt={1} pb={3} px={3}>
          <BCBox component="form" role="form">
            <BCBox mt={4} mb={1}>
              <BCButton variant="contained"
                color="primary"
                onClick={() => {
                  keycloak.login({
                    idpHint: IDENTITY_PROVIDERS.BCEID_BUSINESS,
                    redirectUri
                  })
                }}
                id="link-bceid"
                className="button"
                data-test="link-bceid"
                size='large'
                fullWidth>
                <BCTypography variant="h5" component='span' color="text" sx={{ fontWeight: '400' }}>Login with&nbsp;</BCTypography>
                <BCTypography variant='h5' component='span' className="bceid-name">BCeID</BCTypography>
              </BCButton>
            </BCBox>
            <BCBox mt={4} mb={1}>
              <BCButton variant="outlined"
                color="primary"
                onClick={() => {
                  keycloak.login({
                    idpHint: IDENTITY_PROVIDERS.IDIR,
                    redirectUri
                  })
                }}
                id="link-idir"
                className="button"
                data-test="link-idir"
                size='large'
                sx={{ textAlign: 'right' }}
                fullWidth>
                <BCTypography variant="h5" color="text" sx={{ fontWeight: '400' }}>
                  Login with&nbsp;
                </BCTypography>
                <BCTypography variant='h5' mr={3} className="idir-name">IDIR</BCTypography>
              </BCButton>
            </BCBox>
            <BCBox mt={3} mb={1} textAlign="center">
              <BCTypography variant="button" color="text">
                {" "}
                <Link
                  component="button"
                  variant="button"
                  to="/contact-us"
                  fontWeight="medium"
                >
                  <BCTypography variant="button" color="info" fontSize='1.15rem'>
                    Trouble logging in?
                  </BCTypography>
                </Link>
              </BCTypography>
            </BCBox>
          </BCBox>
        </BCBox>
      </Card>
    </LoginLayout>
  )
}

export default LCFSLogin
