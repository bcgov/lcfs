import { Role } from '@/components/Role'
import { govRoles, nonGovRoles } from '@/constants/roles'
import { Box } from '@mui/material'
import { OrgDetailsWidget } from './components/bceidWidgets/OrgDetailsWidget'
import { BCeIDBalance } from './components/bceidWidgets/BCeIDBalance'
import { AdminLinksCard } from './components/idirWidgets/AdminLinksCard'

export const Dashboard = () => {
  return (
    <Box display="grid" gridTemplateColumns="1fr 3fr" gap={3} data-test="dashboard-container">
      <Box display="flex" flexDirection="column" gap={3}>
        <Role roles={nonGovRoles}>
          <BCeIDBalance />
        </Role>
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
          <OrgDetailsWidget />
        </Role>
        <Role roles={govRoles}>
          <AdminLinksCard />
        </Role>
      </Box>
    </Box>
  )
}
