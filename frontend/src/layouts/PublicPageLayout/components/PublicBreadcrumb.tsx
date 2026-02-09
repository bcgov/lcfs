import { Breadcrumbs, Typography, Container } from '@mui/material'
import { Link, useLocation, useMatches } from 'react-router-dom'
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material'
import { emphasize, styled } from '@mui/material/styles'
import Chip from '@mui/material/Chip'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'

type BreadcrumbConfig = {
  label: string
  route?: string
}

type BreadcrumbMap = Record<string, BreadcrumbConfig>

type RouteHandle = {
  title?: string
}

interface PublicBreadcrumbProps {
  customBreadcrumbs?: BreadcrumbMap
  rootLabel?: string
  rootPath?: string
}

const StyledBreadcrumb = styled(Chip)(({ theme }) => {
  const backgroundColor = theme.palette.common.white
  return {
    backgroundColor,
    height: theme.spacing(3),
    color: theme.palette.text.main,
    fontWeight: theme.typography.fontWeightRegular,
    fontSize: theme.typography.pxToRem(16),
    borderRadius: theme.borders.borderRadius.xl,
    '& span': {
      padding: 0
    },
    '&:hover, &:focus': {
      backgroundColor: emphasize(backgroundColor, 0.06)
    },
    '&:active': {
      boxShadow: theme.shadows[1],
      backgroundColor: emphasize(backgroundColor, 0.12)
    }
  }
})

export const PublicBreadcrumb = ({
  customBreadcrumbs = {},
  rootLabel = 'Public',
  rootPath = '/'
}: PublicBreadcrumbProps) => {
  const location = useLocation()
  const matches = useMatches()
  const lastMatchHandle = matches[matches.length - 1]?.handle as
    | RouteHandle
    | undefined
  const title = lastMatchHandle?.title

  // Default breadcrumb mappings for public pages
  const defaultBreadcrumbs: BreadcrumbMap = {
    'credit-calculator': {
      label: 'Compliance unit calculator',
      route: '/credit-calculator'
    },
    'calculation-data': {
      label: 'Calculation data',
      route: '/calculation-data'
    },
    ...customBreadcrumbs
  }

  const pathnames = location.pathname.split('/').filter((x) => x)

  const getBreadcrumbLabel = (name: string, index: number): string => {
    const customCrumb = defaultBreadcrumbs[name]

    if (customCrumb) {
      return customCrumb.label
    }

    // For the last breadcrumb, use the page title if available
    if (index === pathnames.length - 1 && title) {
      return title
    }

    // Default formatting: capitalize and replace hyphens with spaces
    return name.charAt(0).toUpperCase() + name.slice(1).replaceAll('-', ' ')
  }

  const getBreadcrumbRoute = (name: string, index: number): string => {
    const customCrumb = defaultBreadcrumbs[name]
    return customCrumb?.route || `/${pathnames.slice(0, index + 1).join('/')}`
  }

  return (
    <BCBox sx={{ backgroundColor: '#fff', py: 1 }}>
      <Container maxWidth="lg" disableGutters>
        <Breadcrumbs
          aria-label="breadcrumb"
          separator={
            <NavigateNextIcon fontSize="small" aria-label="breadcrumb" />
          }
          sx={{
            '& li': { marginX: 0 },
            '&>ol': { gap: 2 }
          }}
        >
          {/* Root breadcrumb */}
          {pathnames.length > 0 && (
            <StyledBreadcrumb
              to={rootPath}
              component={Link}
              label={rootLabel}
              sx={{
                cursor: 'pointer',
                padding: 0,
                '& .MuiChip-label': {
                  color: 'link.main',
                  overflow: 'initial',
                  padding: 0
                },
                '& span': {
                  padding: 0
                },
                '& span:hover': {
                  textDecoration: 'underline'
                }
              }}
            />
          )}

          {/* Dynamic breadcrumbs based on path */}
          {pathnames.map((name, index) => {
            const isLast = index === pathnames.length - 1
            const routeTo = getBreadcrumbRoute(name, index)
            const displayName = getBreadcrumbLabel(name, index)

            return isLast ? (
              <StyledBreadcrumb
                component={Typography}
                sx={{
                  textTransform: 'none',
                  padding: 0,
                  '&>*': { padding: 0 },
                  backgroundColor: 'transparent'
                }}
                label={
                  <BCTypography variant="body2" color="text.secondary">
                    {displayName}
                  </BCTypography>
                }
                key={name}
              />
            ) : (
              <StyledBreadcrumb
                to={routeTo}
                key={name}
                component={Link}
                label={displayName}
                sx={{
                  padding: 0,
                  cursor: 'pointer',
                  '& .MuiChip-label': {
                    color: 'link.main',
                    overflow: 'initial'
                  },
                  '& span:hover': {
                    textDecoration: 'underline'
                  }
                }}
              />
            )
          })}
        </Breadcrumbs>
      </Container>
    </BCBox>
  )
}
