import BCBox from '@/components/BCBox'
import { Box } from '@mui/material'
import analystReviewRobot from '@/assets/images/analyst-review-methy.gif'
import type { RobotVariant } from './types'

interface RobotAvatarProps {
  robot: RobotVariant
  size?: number
  pulse?: boolean
}

export const RobotAvatar = ({ size = 80, pulse = false }: RobotAvatarProps) => (
  <BCBox
    sx={{
      width: size,
      height: size,
      borderRadius: '6px',
      backgroundColor: 'rgba(255, 255, 255, 0.72)',
      display: 'grid',
      placeItems: 'center',
      flex: '0 0 auto',
      overflow: 'hidden',
      animation: pulse ? 'aiPulse 1.3s ease-in-out infinite' : 'none',
      '@keyframes aiPulse': {
        '0%, 100%': { transform: 'scale(1)', opacity: 0.82 },
        '50%': { transform: 'scale(1.06)', opacity: 1 }
      }
    }}
  >
    <Box
      component="img"
      src={analystReviewRobot}
      alt=""
      aria-hidden="true"
      sx={{
        width: Math.round(size * 0.86),
        height: Math.round(size * 0.86),
        objectFit: 'contain'
      }}
    />
  </BCBox>
)
