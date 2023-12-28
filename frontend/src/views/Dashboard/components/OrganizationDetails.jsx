import Loading from '@/components/Loading'
import { ROUTES } from '@/constants/routes'
import { useOrganization } from '@/hooks/useOrganization'
import colors from '@/themes/base/colors'
import { faShareFromSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'

export const OrganizationDetails = () => {
  const { data: orgData, isLoading: orgLoading } = useOrganization()

  return (
    <Box p={2.5} bgcolor="background.default">
      <Typography variant="h2" fontSize={24} mb={1} color={colors.primary.main}>
        Organization Details
      </Typography>
      {orgLoading ? (
        <Loading />
      ) : (
        <>
          <Box mb={2}>
            <Typography
              fontWeight="bold"
              fontSize={16}
              color={colors.primary.main}
            >
              {orgData?.name}
            </Typography>
            <Typography fontSize={16} color={colors.primary.main}>
              {orgData?.org_address.street_address}
            </Typography>
            <Typography fontSize={16} color={colors.primary.main}>
              {orgData?.org_address.city} {orgData?.org_address.province_state}
            </Typography>
            <Typography fontSize={16} color={colors.primary.main}>
              {orgData?.org_address.country}
            </Typography>
            <Typography fontSize={16} color={colors.primary.main}>
              {orgData?.org_address.postalCode_zipCode}
            </Typography>
          </Box>
          <Box mb={2}>
            <Typography fontSize={16} color={colors.primary.main}>
              {orgData?.phone}
            </Typography>
            <Typography fontSize={16} color={colors.primary.main}>
              {orgData?.email}
            </Typography>
          </Box>
          <Box>
            <ul style={{ paddingLeft: 20 }}>
              <li>
                <Link to={ROUTES.ORGANIZATION}>
                  <Typography fontSize={16} color={colors.link.main}>
                    Users
                  </Typography>
                </Link>
              </li>
              <li>
                <a href="#">
                  <Typography fontSize={16} color={colors.link.main}>
                    Create new BCeID account{' '}
                    <FontAwesomeIcon icon={faShareFromSquare} />
                  </Typography>
                </a>
              </li>
            </ul>
          </Box>
        </>
      )}
    </Box>
  )
}
