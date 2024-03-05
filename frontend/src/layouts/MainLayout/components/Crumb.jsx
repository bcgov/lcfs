import { Breadcrumbs, Typography } from '@mui/material'
import { useLocation, Link } from 'react-router-dom'
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material'
import { viewRoutesTitle } from '@/constants/routes/apiRoutes'
import { emphasize, styled } from '@mui/material/styles'
import Chip from '@mui/material/Chip'

const StyledBreadcrumb = styled(Chip)(({ theme }) => {
  const backgroundColor =
    theme.palette.mode === 'light'
      ? theme.palette.grey[200]
      : theme.palette.grey[800]
  return {
    backgroundColor,
    height: theme.spacing(3),
    color: theme.palette.text.main,
    fontWeight: theme.typography.fontWeightRegular,
    fontSize: theme.typography.pxToRem(16),
    borderRadius: theme.borders.borderRadius.xl,
    padding: theme.spacing(2),
    textTransform: 'capitalize',
    '&:hover, &:focus': {
      backgroundColor: emphasize(backgroundColor, 0.06)
    },
    '&:active': {
      boxShadow: theme.shadows[1],
      backgroundColor: emphasize(backgroundColor, 0.12)
    }
  }
})

const Crumb = () => {
  const location = useLocation()
  const pathnames = location.pathname.split('/').filter((x) => x)

  return (
    <>
      {pathnames.length > 1 && (
        <Breadcrumbs
          aria-label="breadcrumb"
          separator={
            <NavigateNextIcon fontSize="small" aria-label="breadcrumb" />
          }
        >
          {pathnames.map((name, index) => {
            const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`
            const isLast = index === pathnames.length - 1
            return isLast ? (
              <StyledBreadcrumb
                component={Typography}
                label={
                  viewRoutesTitle[name] ||
                  name.charAt(0).toUpperCase() + name.slice(1).replace('-', ' ')
                }
                key={name}
              />
            ) : (
              <StyledBreadcrumb
                to={routeTo}
                key={name}
                component={Link}
                label={
                  viewRoutesTitle[name] ||
                  name.charAt(0).toUpperCase() + name.slice(1).replace('-', ' ')
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
          })}
        </Breadcrumbs>
      )}
    </>
  )
}

export default Crumb
