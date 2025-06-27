import React from 'react'
import { Chip, Tooltip } from '@mui/material'
import { useTheme } from '@mui/material/styles'

/**
 * A component that displays user initials in a circular chip with an optional tooltip
 * @param {string} fullName - The full name of the user
 * @param {string} tooltipText - Text to display in the tooltip (truncated to maxLength if needed)
 * @param {number} maxLength - Maximum length for tooltip text (default: 500)
 * @param {string} variant - Chip variant ('filled' | 'outlined')
 * @param {string} color - Chip color
 * @param {object} sx - Additional styles
 */
const BCUserInitials = ({
  fullName,
  tooltipText = '',
  maxLength = 500,
  variant = 'filled',
  color = 'primary',
  sx = {},
  ...props
}) => {
  const theme = useTheme()

  // Extract initials from full name
  const getInitials = (name) => {
    if (!name) return ''
    return name
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2) // Limit to 2 characters
  }

  // Function to strip HTML tags from text (for safety and reusability)
  const stripHtmlTags = (html) => {
    if (!html) return ''
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  // Clean and truncate tooltip text
  const cleanTooltipText = stripHtmlTags(tooltipText)
  const truncatedTooltipText =
    cleanTooltipText.length > maxLength
      ? `${cleanTooltipText.substring(0, maxLength)}...`
      : cleanTooltipText

  const initials = getInitials(fullName)

  const pillStyles = {
    height: '24px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    minWidth: '32px',
    '& .MuiChip-label': {
      padding: '0 6px'
    },
    ...sx
  }

  const pill = (
    <Chip
      label={initials}
      variant={variant}
      color={color}
      size="small"
      sx={pillStyles}
      {...props}
    />
  )

  // Only wrap with tooltip if there's tooltip text
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
