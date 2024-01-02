import { ROUTES } from '@/constants/routes'
import colors from '@/themes/base/colors'
import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'

export const IDIRRightColWIdget = () => {
  return (
    <Box p={2.5} bgcolor="background.default">
      <Typography variant="h2" fontSize={24} mb={1}>
        Administration
      </Typography>
      <Box display={'flex'} flexDirection={'column'} gap={1}>
        <Link to={ROUTES.ADMIN_USERS}>
          <Typography fontSize={16} color={colors.link.main}>
            Manage government users
          </Typography>
        </Link>
        <Link to={ROUTES.ORGANIZATIONS}>
          <Typography fontSize={16} color={colors.link.main}>
            Add / edit fuel suppliers
          </Typography>
        </Link>
        <Link to={ROUTES.ADMIN_USERACTIVITY}>
          <Typography fontSize={16} color={colors.link.main}>
            User activity
          </Typography>
        </Link>
      </Box>
    </Box>
  )
}
