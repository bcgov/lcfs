import React from 'react'
import { Box, Tooltip, Fade, Select, MenuItem } from '@mui/material'
import InfoIcon from '@mui/icons-material/Info'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'

// Placeholder data object
const placeholderData = {
  totalUnits: 857361,
  reservedUnits: 113867,
  organizations: ['All organizations', 'Organization 1', 'Organization 2']
}

const OrganizationsSummaryCard = () => {
  return (
    <BCWidgetCard
      component="div"
      disableHover={true}
      title="Summary"
      sx={{
        '& .MuiCardContent-root': { padding: '16px' },
        margin: '0 auto',
        maxWidth: '300px',
        boxShadow: 1
      }}
      content={
        <Box
          p={2}
          paddingTop={1}
          paddingBottom={1}
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          sx={{ width: '100%' }}
        >
          <BCTypography
            style={{ fontSize: '16px', color: '#003366', marginBottom: '2px' }}
          >
            All organizations
          </BCTypography>
          <BCTypography
            style={{ fontSize: '32px', color: '#578260', marginBottom: '-2px' }}
            component="span"
          >
            {placeholderData.totalUnits.toLocaleString()}
          </BCTypography>
          <BCTypography
            style={{ fontSize: '18px', color: '#003366', marginBottom: '-4px' }}
            component="span"
          >
            compliance units
          </BCTypography>
          <Box display="flex" alignItems="center" mt={1}>
            <BCTypography
              style={{ fontSize: '22px', color: '#578260' }}
              component="span"
            >
              ({placeholderData.reservedUnits.toLocaleString()} in reserve)
            </BCTypography>
            <Tooltip
              title="These units are reserved and not currently in circulation."
              TransitionComponent={Fade}
              arrow
            >
              <InfoIcon style={{ marginLeft: '4px', color: '#578260' }} />
            </Tooltip>
          </Box>
          <BCTypography
            style={{ fontSize: '14px', color: '#003366', marginTop: '6px' }}
          >
            Show balance for:
          </BCTypography>
          <Select
            defaultValue={placeholderData.organizations[0]}
            fullWidth
            sx={{
              marginTop: 1,
              padding: '8px',
              width: 'calc(100% - 20px)',
              bgcolor: 'background.paper',
              borderRadius: 1
            }}
          >
            {placeholderData.organizations.map((org, index) => (
              <MenuItem key={index} value={org}>
                {org}
              </MenuItem>
            ))}
          </Select>
        </Box>
      }
    />
  )
}

export default OrganizationsSummaryCard
