import { Breadcrumbs, Typography } from '@mui/material'
import { useLocation, Link, useMatches, useParams } from 'react-router-dom'
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material'
import { emphasize, styled } from '@mui/material/styles'
import Chip from '@mui/material/Chip'
import { isNumeric } from '@/utils/formatters'

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
    padding: theme.spacing(1.8, 1),
    '&:hover, &:focus': {
      // backgroundColor: emphasize(backgroundColor, 0.06)
    },
    '&:active': {
      boxShadow: theme.shadows[1],
      backgroundColor: emphasize(backgroundColor, 0.12)
    }
  }
})

const Crumb = () => {
  const location = useLocation()
  const matches = useMatches()
  const reportPathRegex = /^\d{4}-Compliance-report$/
  const { userID, orgID, complianceReportId, compliancePeriod } = useParams()
  const path = location.pathname.replace(
    `/compliance-reporting/${compliancePeriod}/${complianceReportId}`,
    `/compliance-reporting/${compliancePeriod}-Compliance-report`
  )
  const pathnames = path.split('/').filter((x) => x)
  const title = matches[matches.length - 1]?.handle?.title

  // Mapping for custom breadcrumb labels and routes
  const customBreadcrumbs = {
    admin: { label: 'Administration', route: '/admin' },
    transfers: { label: 'Transactions', route: '/transactions' },
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
          '& li': { marginX: '-2px' },
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
