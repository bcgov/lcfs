import React from 'react'
import { Grid, Box } from '@mui/material'
import { Role } from '@/components/Role'
import { roles, govRoles, nonGovRoles } from '@/constants/roles'
import {
  AdminLinksCard,
  OrgDetailsCard,
  OrgBalanceCard,
  FeedbackCard,
  WebsiteCard,
  DirectorReviewCard,
  TransactionsCard,
  OrgTransactionsCard
} from './components/cards'
import OrganizationsSummaryCard from './components/cards/idir/OrganizationsSummaryCard'

export const Dashboard = () => {
  return (
    <Box mt={-4}>
      <Grid 
        container 
        spacing={{ xs: 3, lg: 0 }} 
        justifyContent={{ md: 'center' }}
        data-test="dashboard-container"
      >
        {/* Left Section */}
        <Grid
          item 
          xs={12} sm={6} md={5} lg={3}
          order={{ xs: 3, sm: 2, md: 2, lg: 1 }}
        >
          <Box display="flex" flexDirection="column" gap={3} sx={{ ml: { lg: 3 }, mt: 5 }}>
            <Role roles={nonGovRoles}>
              <OrgBalanceCard />
              <FeedbackCard />
              <WebsiteCard />
            </Role>
            <Role roles={govRoles}>
              <OrganizationsSummaryCard />
            </Role>
          </Box>
        </Grid>

      {/* Central Section */}
        <Grid
          item
          xs={12} sm={12} md={12} lg={6}
          order={{ xs: 1, sm: 1, md: 1, lg: 2 }}
        >
          <Box sx={{ mx: {lg: 2 }, mt: {lg: 5}, mb: {lg: 3}, px: { lg: 1 } }}>
            <Role roles={[roles.analyst, roles.compliance_manager]}>
              <TransactionsCard />
            </Role>
            <Role roles={[roles.transfers]}>
              <OrgTransactionsCard />
            </Role>
            <Role roles={[roles.director]}>
              <DirectorReviewCard />
            </Role>
          </Box>
        </Grid>

        {/* Right Section */}
        <Grid
          item
          xs={12} sm={6} md={5} lg={3}
          order={{ xs: 2, sm: 3, md: 3, lg: 3 }}
        >
          <Box sx={{ mr: {lg: 3 }, my: {lg: 5 } }}>
            <Role roles={nonGovRoles}>
              <OrgDetailsCard />
            </Role>
            <Role roles={govRoles}>
              <AdminLinksCard />
            </Role>
          </Box>
        </Grid>

      </Grid>
    </Box>
  )
}
