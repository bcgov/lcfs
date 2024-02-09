import { Role } from '@/components/Role'
import { govRoles, nonGovRoles } from '@/constants/roles'
import { Box } from '@mui/material'
import { BCeIDRightColWidget } from './components/BCeIDRightColWidget'
import { AdminLinksCard } from './components/AdminLinksCard'

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
        alignItems={'flex-start'}
      >
        <Box p={2.5} bgcolor="background.default">
          placeholder
        </Box>
        <Role roles={nonGovRoles}>
          <BCeIDRightColWidget />
        </Role>
        <Role roles={govRoles}>
          <AdminLinksCard />
        </Role>
      </Box>
    </Box>
  )
}
