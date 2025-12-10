import { Breadcrumbs, Typography } from '@mui/material'
import { useLocation, Link, useMatches, useParams } from 'react-router-dom'
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material'
import { emphasize, styled } from '@mui/material/styles'
import Chip from '@mui/material/Chip'
import { isNumeric } from '@/utils/formatters'
import { useOrganizationPageStore } from '@/stores/useOrganizationPageStore'

type RouteTitleResolver = (args: {
  params: Record<string, string | undefined>
  location: ReturnType<typeof useLocation>
}) => string | undefined

type RouteHandle = {
  title?: string | RouteTitleResolver | null
}

type MatchWithHandle = ReturnType<typeof useMatches>[number] & {
  handle?: RouteHandle
  params?: Record<string, string | undefined>
}

type BreadcrumbDefinition = Record<
  string,
  {
    label: string
    route: string
  }
>

const StyledBreadcrumb = styled(Chip)(({ theme }) => {
  const backgroundColor =
    theme.palette.mode === 'light'
      ? theme.palette.common.white
      : theme.palette.grey[800]
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
      // backgroundColor: emphasize(backgroundColor, 0.06)
    },
    '&:active': {
      boxShadow: theme.shadows[1],
      backgroundColor: emphasize(backgroundColor, 0.12)
    }
  }
})

const ORG_TAB_SEGMENTS = new Set([
  'users',
  'credit-ledger',
  'company-overview',
  'penalty-log',
  'supply-history',
  'compliance-tracking'
])

const Crumb = () => {
  const location = useLocation()
  const matches = useMatches()
  const reportPathRegex = /^\d{4}-Compliance-report$/
  const { userID, orgID, complianceReportId, compliancePeriod } = useParams<{
    userID?: string
    orgID?: string
    complianceReportId?: string
    compliancePeriod?: string
  }>()
  const organizationName = useOrganizationPageStore(
    (state) => state.organizationName
  )
  const activeTabLabel = useOrganizationPageStore(
    (state) => state.activeTabLabel
  )
  const path = location.pathname.replace(
    `/compliance-reporting/${compliancePeriod}/${complianceReportId}`,
    `/compliance-reporting/${compliancePeriod}-Compliance-report`
  )
  const pathnames = path.split('/').filter((x) => x)
  const currentMatch = matches[matches.length - 1] as
    | MatchWithHandle
    | undefined
  const handleTitle = currentMatch?.handle?.title
  const title =
    typeof handleTitle === 'function'
      ? handleTitle({ params: currentMatch?.params || {}, location })
      : handleTitle

  const isOrganizationRoute =
    !!organizationName && location.pathname.startsWith('/organizations/')
  const organizationContextLabel = isOrganizationRoute
    ? activeTabLabel
      ? `${organizationName} - ${activeTabLabel}`
      : organizationName
    : null

  // Mapping for custom breadcrumb labels and routes
  const customBreadcrumbs: BreadcrumbDefinition = {
    admin: { label: 'Administration', route: '/admin' },
    transfers: { label: 'Transactions', route: '/transactions' },
    'compliance-reporting': {
      label: 'Compliance reporting',
      route: '/compliance-reporting'
    },
    fse: { label: 'Manage FSE', route: '/compliance-reporting/fse' },
    'charging-sites': {
      label: 'Manage charging sites',
      route: '/compliance-reporting/charging-sites'
    },
    'add-org': { label: 'Add organization', route: '/add-org' },
    'edit-org': { label: 'Edit organization', route: '/edit-org' },
    'initiative-agreement': { label: 'Transactions', route: '/transactions' },
    'org-initiative-agreement': {
      label: 'Transactions',
      route: '/transactions'
    },
    'admin-adjustment': { label: 'Transactions', route: '/transactions' },
    'org-admin-adjustment': { label: 'Transactions', route: '/transactions' }
  }

  return (
    <>
      <Breadcrumbs
        aria-label="breadcrumb"
        separator={
          <NavigateNextIcon fontSize="small" aria-label="breadcrumb" />
        }
        sx={{
          mt: 1,
          mb: 1,
          '& li': { marginX: 0 },
          '&>ol': { gap: 2 }
        }}
      >
        {pathnames.length > 0 && (
          <StyledBreadcrumb
            to={'/'}
            component={Link}
            label={'Home'}
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

        {pathnames.map((name, index) => {
          const isLast = index === pathnames.length - 1
          const customCrumb = customBreadcrumbs[name] || {}
          let routeTo =
            customCrumb.route || `/${pathnames.slice(0, index + 1).join('/')}`
          if (reportPathRegex.test(name)) {
            routeTo = `compliance-reporting/${compliancePeriod}/${complianceReportId}`
          }
          const displayName =
            customCrumb.label ||
            name.charAt(0).toUpperCase() + name.slice(1).replaceAll('-', ' ')

          // Skip numeric ID crumb for FSE routes (e.g., /fse/:id/edit)
          if (isNumeric(name) && pathnames[index - 1] === 'fse') {
            return null
          }

          const isOrgIdSegment =
            isOrganizationRoute && orgID && name === orgID && !isLast
          if (isOrgIdSegment) {
            return null
          }

          const shouldUseOrgLabelForLast =
            organizationContextLabel &&
            isOrganizationRoute &&
            (ORG_TAB_SEGMENTS.has(name) ||
              (orgID && name === orgID && isLast))

          if (isLast && shouldUseOrgLabelForLast) {
            return (
              <StyledBreadcrumb
                component={Typography}
                sx={{
                  textTransform: 'none',
                  padding: 0,
                  '&>*': { padding: 0 }
                }}
                label={organizationContextLabel}
                key={name}
              />
            )
          }

          const shouldUseOrgLabelForLink =
            organizationContextLabel &&
            isOrganizationRoute &&
            ORG_TAB_SEGMENTS.has(name) &&
            !isLast

          if (shouldUseOrgLabelForLink) {
            return (
              <StyledBreadcrumb
                to={routeTo}
                key={name}
                component={Link}
                label={organizationContextLabel}
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
          }

          return isLast ? (
            <StyledBreadcrumb
              component={Typography}
              sx={{ textTransform: 'none', padding: 0, '&>*': { padding: 0 } }}
              label={
                title && title !== ''
                  ? title
                  : isNumeric(name)
                    ? 'ID: ' + name
                    : displayName
              }
              key={name}
            />
          ) : (
            name !== 'edit' && (
              <StyledBreadcrumb
                to={routeTo}
                key={name}
                component={Link}
                label={
                  (isNumeric(name) &&
                    name === userID &&
                    pathnames[index + 1] === 'edit-user' &&
                    'User profile') ||
                  (isNumeric(name) &&
                    name === orgID &&
                    'Organization profile') ||
                  displayName
                }
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
          )
        })}
      </Breadcrumbs>
    </>
  )
}

export default Crumb
