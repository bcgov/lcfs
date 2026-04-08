import { Chip, Tooltip, type ChipProps } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'

export interface BCUserInitialsProps
  extends Omit<ChipProps, 'label' | 'size'> {
  fullName: string
  tooltipText?: string
  maxLength?: number
  sx?: SxProps<Theme>
}

const BCUserInitials = ({
  fullName,
  tooltipText = '',
  maxLength = 500,
  variant = 'filled',
  color = 'primary',
  sx,
  ...chipProps
}: BCUserInitialsProps) => {
  const getInitials = (name: string) => {
    if (!name) return ''
    return name
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2)
  }

  const stripHtmlTags = (html: string) => {
    if (!html) return ''
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  const cleanTooltipText = stripHtmlTags(tooltipText)
  const truncatedTooltipText =
    cleanTooltipText.length > maxLength
      ? `${cleanTooltipText.substring(0, maxLength)}...`
      : cleanTooltipText

  const initials = getInitials(fullName)

  const baseStyles = {
    height: '24px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    minWidth: '32px',
    '& .MuiChip-label': {
      padding: '0 6px'
    }
  }

  const combinedSx: SxProps<Theme> = Array.isArray(sx)
    ? [baseStyles, ...sx]
    : sx
    ? [baseStyles, sx]
    : baseStyles

  const pill = (
    <Chip
      label={initials}
      variant={variant}
      color={color}
      size="small"
      sx={combinedSx}
      {...chipProps}
    />
  )

  if (truncatedTooltipText) {
    return (
      <Tooltip
        title={truncatedTooltipText}
        placement="top"
        arrow
        enterDelay={500}
        leaveDelay={200}
      >
        <span>{pill}</span>
      </Tooltip>
    )
  }

  return pill
}

export default BCUserInitials
