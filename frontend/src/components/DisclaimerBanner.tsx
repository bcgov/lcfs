import Box from '@mui/material/Box'
import BCTypography from '@/components/BCTypography'
import colors from '@/themes/base/colors'

export interface DisclaimerBannerProps {
  messages: Array<string | undefined>
}

const DisclaimerBanner = ({ messages }: DisclaimerBannerProps) => {
  return (
    <Box
      sx={{
        backgroundColor: colors.background.grey,
        color: colors.grey[700],
        marginTop: 2,
        marginBottom: 4,
        padding: '10px 15px',
        border: `1px solid ${colors.borderDivider.nav}`,
        borderRadius: '5px'
      }}
    >
      {messages.map((message, index) => (
        <BCTypography key={index} sx={{ fontSize: '14px' }}>
          {message}
        </BCTypography>
      ))}
    </Box>
  )
}

export default DisclaimerBanner
