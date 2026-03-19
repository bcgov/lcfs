import { Box } from '@mui/material'
import BCTypography from '@/components/BCTypography'

interface SqlPreviewProps {
  sql: string
}

export const SqlPreview = ({ sql }: SqlPreviewProps) => {
  return (
    <Box
      component="pre"
      sx={{
        margin: 0,
        overflowX: 'auto',
        padding: 2,
        borderRadius: 1,
        backgroundColor: 'grey.100',
        border: '1px solid',
        borderColor: 'grey.300'
      }}
    >
      <BCTypography
        component="code"
        sx={{ fontFamily: 'monospace', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}
      >
        {sql}
      </BCTypography>
    </Box>
  )
}
