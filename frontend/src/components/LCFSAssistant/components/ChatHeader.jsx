import PropTypes from 'prop-types'
import { Box, Typography, IconButton, Tooltip, Button } from '@mui/material'
import {
  OpenInFull as MaximizeIcon,
  CloseFullscreen as MinimizeIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material'

// Reusable icon button with consistent styling
const HeaderIconButton = ({
  icon: Icon,
  onClick,
  tooltip,
  ariaLabel,
  isDark = false
}) => {
  const baseColor = isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.7)'
  const hoverBg = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
  const hoverColor = isDark ? '#fff' : '#000'

  return (
    <Tooltip
      title={tooltip}
      placement="bottom"
      arrow
      disableInteractive
      leaveDelay={0}
    >
      <IconButton
        size="small"
        onClick={onClick}
        sx={{
          color: baseColor,
          borderRadius: '6px',
          p: 0.75,
          transition: 'all 0.2s ease',
          '&:hover': {
            bgcolor: hoverBg,
            color: hoverColor
          }
        }}
        aria-label={ariaLabel}
      >
        <Icon style={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
  )
}

// Reusable back button with text
const HeaderBackButton = ({ onClick, label = 'Back', isDark = false }) => {
  const baseColor = isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.7)'
  const hoverBg = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
  const hoverColor = isDark ? '#fff' : '#000'

  return (
    <Button
      size="small"
      startIcon={<ArrowBackIcon style={{ fontSize: 16 }} />}
      onClick={onClick}
      sx={{
        color: baseColor,
        textTransform: 'none',
        fontSize: '0.8rem',
        minWidth: 'auto',
        px: 1.5,
        borderRadius: '6px',
        transition: 'all 0.2s ease',
        '&:hover': {
          bgcolor: hoverBg,
          color: hoverColor
        }
      }}
    >
      {label}
    </Button>
  )
}

HeaderBackButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  label: PropTypes.string,
  isDark: PropTypes.bool
}

HeaderIconButton.propTypes = {
  icon: PropTypes.elementType.isRequired,
  onClick: PropTypes.func.isRequired,
  tooltip: PropTypes.string.isRequired,
  ariaLabel: PropTypes.string.isRequired,
  isDark: PropTypes.bool
}

// Vertical divider for header
const HeaderDivider = ({ isDark = false }) => (
  <Box
    sx={{
      width: '1px',
      height: '18px',
      bgcolor: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.15)',
      mx: 0.5
    }}
  />
)

HeaderDivider.propTypes = {
  isDark: PropTypes.bool
}

// Main ChatHeader component
const ChatHeader = ({
  title,
  icon: Icon,
  bgcolor = '#fcba19',
  isDark = false,
  isMaximized = false,
  isMobile = false,
  onToggleMaximize,
  onClose,
  leftActions,
  rightActions
}) => {
  const textColor = isDark ? '#fff' : '#000'
  const iconBgColor = isDark
    ? 'rgba(255, 255, 255, 0.15)'
    : 'rgba(0, 0, 0, 0.1)'

  return (
    <Box
      sx={{
        px: 2,
        height: 52,
        bgcolor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
    >
      {/* Left side - Icon and Title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {leftActions}
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: '6px',
            bgcolor: iconBgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Icon sx={{ fontSize: 18, color: textColor }} />
        </Box>
        <Typography
          variant="h6"
          component="h1"
          sx={{
            fontWeight: 500,
            fontSize: '1rem',
            letterSpacing: '0.01em',
            color: textColor
          }}
        >
          {title}
        </Typography>
      </Box>

      {/* Right side - Actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        {rightActions}

        {/* Maximize/Minimize - hide on mobile */}
        {!isMobile && onToggleMaximize && (
          <HeaderIconButton
            icon={isMaximized ? MinimizeIcon : MaximizeIcon}
            onClick={(e) => {
              e.currentTarget.blur()
              onToggleMaximize()
            }}
            tooltip={isMaximized ? 'Minimize' : 'Maximize'}
            ariaLabel={isMaximized ? 'Minimize' : 'Maximize'}
            isDark={isDark}
          />
        )}

        {/* Close button */}
        {onClose && (
          <HeaderIconButton
            icon={CloseIcon}
            onClick={onClose}
            tooltip="Close assistant"
            ariaLabel="Close assistant"
            isDark={isDark}
          />
        )}
      </Box>
    </Box>
  )
}

ChatHeader.propTypes = {
  title: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  bgcolor: PropTypes.string,
  isDark: PropTypes.bool,
  isMaximized: PropTypes.bool,
  isMobile: PropTypes.bool,
  onToggleMaximize: PropTypes.func,
  onClose: PropTypes.func,
  leftActions: PropTypes.node,
  rightActions: PropTypes.node
}

export { ChatHeader, HeaderIconButton, HeaderDivider, HeaderBackButton }
export default ChatHeader
