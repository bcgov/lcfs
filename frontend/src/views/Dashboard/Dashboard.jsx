import { Box } from '@mui/material'
import { OrganizationDetails } from './components/OrganizationDetails'
// import { Role } from '@/components/Role'

export const Dashboard = () => {
  return (
    <Box display="grid" gridTemplateColumns="1fr 3fr" gap={3}>
      <Box p={2.5} bgcolor="background.grey">
        placeholder
      </Box>
      <Box
        display="grid"
        gridTemplateColumns="2fr 1fr"
        bgcolor="background.grey"
        p={3}
        gap={3}
      >
        <Box p={2.5} bgcolor="background.default">
          placeholder
        </Box>
        {/* <Role roles={['Government']}> */}
        <OrganizationDetails />
        {/* </Role> */}
      </Box>
    </Box>
  )
}
