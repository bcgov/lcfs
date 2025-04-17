import PropTypes from 'prop-types'
import { Link } from '@mui/material'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { GitHub } from '@mui/icons-material'
import typography from '@/themes/base/typography'

function Footer({
  repoDetails = {
    href: 'https://github.com/bcgov/lcfs/releases/tag/v1.0.3',
    name: 'v1.0.3',
    id: 'footer-about-version',
    label: 'LCFS repository changelog'
  },
  links = [
    {
      href: '/',
      name: 'Home',
      id: 'footer-home',
      label: 'Home page of LCFS'
    }
  ]
}) {
  const { size } = typography

  const renderLinks = () =>
    links.map((link) => (
      <BCBox
        key={link.name}
        component="li"
        px={2}
        lineHeight={1}
        sx={({ functions: { pxToRem }, palette: { borderDivider } }) => ({
          borderRight: `2px solid ${borderDivider.main}`,
          '&:hover': {
            textDecoration: 'underline'
          },
          '&:focus': {
            outline: `4px solid ${borderDivider.focus}`,
            outlineOffset: pxToRem(2)
          }
        })}
      >
        <Link
          href={link.href}
          target="_blank"
          aria-label={link.label}
          id={link.id}
          data-test={link.id}
        >
          <BCTypography variant="button" fontWeight="regular" color="white">
            {link.name}
          </BCTypography>
        </Link>
      </BCBox>
    ))

  return (
    <BCBox
      className="bcgov-footer"
      component="footer"
      width="100%"
      display="flex"
      flexDirection={{ xs: 'column', lg: 'row' }}
      justifyContent="space-between"
      alignItems="center"
      px={1.5}
      sx={({
        functions: { pxToRem },
        palette: { primary, secondary, white }
      }) => ({
        backgroundColor: primary.nav,
        borderTop: `2px solid ${secondary.main}`,
        color: white.main,
        minHeight: pxToRem(46),
        position: 'relative'
      })}
    >
      <BCBox
        component="ul"
        sx={({ breakpoints }) => ({
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          listStyle: 'none',
          flexDirection: 'row',
          mt: 3,
          mb: 0,
          p: 0,

          [breakpoints.up('lg')]: {
            mt: 0
          }
        })}
      >
        {renderLinks()}
      </BCBox>
      <BCBox
        display="flex"
        justifyContent="center"
        alignItems="center"
        flexWrap="wrap"
        color="white"
        fontSize={size.sm}
        px={1.5}
      >
        <Link
          href={repoDetails.href}
          target="_blank"
          aria-label={repoDetails.label}
          id={repoDetails.id}
          data-test={repoDetails.id}
        >
          <GitHub fontSize="small" />
          <BCTypography
            ml={1}
            variant="button"
            fontWeight="medium"
            sx={{ textDecoration: 'underline' }}
          >
            {repoDetails.name}
          </BCTypography>
        </Link>
      </BCBox>
    </BCBox>
  )
}

// Typechecking props for the Footer
Footer.propTypes = {
  repoDetails: PropTypes.objectOf(PropTypes.string),
  links: PropTypes.arrayOf(PropTypes.object)
}

export default Footer
