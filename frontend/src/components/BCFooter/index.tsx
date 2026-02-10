import { Link } from '@mui/material'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { GitHub } from '@mui/icons-material'
import typography from '@/themes/base/typography'

type FooterLink = {
  href: string
  name: string
  id: string
  label: string
}

type RepoDetails = {
  href: string
  name: string
  id: string
  label: string
}

export interface BCFooterProps {
  repoDetails?: RepoDetails
  links?: FooterLink[]
}

const defaultRepoDetails: RepoDetails = {
  href: 'https://github.com/bcgov/lcfs/releases/tag/v1.2.1',
  name: 'v1.2.1',
  id: 'footer-about-version',
  label: 'LCFS repository changelog'
}

const defaultLinks: FooterLink[] = [
  {
    href: '/',
    name: 'Home',
    id: 'footer-home',
    label: 'Home page of LCFS'
  }
]

function Footer({
  repoDetails = defaultRepoDetails,
  links = defaultLinks
}: BCFooterProps) {
  const { size } = typography

  const renderLinks = () =>
    links.map((link) => (
      <BCBox
        key={link.name}
        component="li"
        px={2}
        sx={(theme: any) => {
          const typedTheme = theme as any
          const { pxToRem } = typedTheme.functions
          const { borderDivider } = typedTheme.palette
          return {
            lineHeight: 1,
            borderRight: `2px solid ${borderDivider.main}`,
            '&:hover': {
              textDecoration: 'underline'
            },
            '&:focus': {
              outline: `4px solid ${borderDivider.focus}`,
              outlineOffset: pxToRem(2)
            }
          }
        }}
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
      px={1.5}
      sx={(theme: any) => {
        const typedTheme = theme as any
        const { pxToRem } = typedTheme.functions
        const { primary, secondary, white } = typedTheme.palette
        return {
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: primary.nav,
          borderTop: `2px solid ${secondary.main}`,
          color: white.main,
          minHeight: pxToRem(46),
          position: 'relative'
        }
      }}
    >
      <BCBox
        component="ul"
        sx={(theme: any) => ({
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          listStyle: 'none',
          flexDirection: 'row',
          mt: 3,
          mb: 0,
          p: 0,
          [theme.breakpoints.up('lg')]: {
            mt: 0
          }
        })}
      >
        {renderLinks()}
      </BCBox>
      <BCBox
        color="white"
        fontSize={size.sm}
        px={1.5}
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}
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
export default Footer
