import { Box, Alert } from '@mui/material'
import { PrivacyTip as PrivacyIcon } from '@mui/icons-material'

const PrivacyNotice = () => {
  return (
    <Box sx={{ p: 2, pb: 1, bgcolor: 'info.lighter' }}>
      <Alert
        severity="info"
        icon={<PrivacyIcon fontSize="small" />}
        sx={{
          py: 0.5,
          '& .MuiAlert-message': {
            py: 0.5
          }
        }}
      >
        <Box component="ul" sx={{ m: 0, pl: 2, fontSize: '0.75rem' }}>
          <li>Your conversation is not stored on our servers</li>
          <li>When you close this chat, your history is deleted</li>
          <li>Anonymous usage metrics are collected for service improvement</li>
          <li>For support, email us at lcfs@gov.bc.ca</li>
        </Box>
      </Alert>
    </Box>
  )
}

export default PrivacyNotice
