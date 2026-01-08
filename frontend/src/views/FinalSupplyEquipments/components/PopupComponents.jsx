/**
 * @file PopupComponents.jsx
 * @description Reusable UI components for map popups
 */
import { Box, IconButton, Stack, Tooltip } from '@mui/material'
import {
  Close as CloseIcon,
  LocationOn as LocationIcon,
  Map as MapIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon
} from '@mui/icons-material'
import BCTypography from '@/components/BCTypography'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Type badge for popup headers (e.g., "Charging site", "Final supply equipment")
 */
export const PopupTypeBadge = ({ icon: Icon, labelKey }) => {
  const { t } = useTranslation(['fse'])

  return (
    <div style={{ marginBottom: '10px' }}>
      <Stack direction="row" alignItems="center" spacing={0.8}>
        <Icon sx={{ color: '#fcba19', fontSize: 11 }} />
        <span
          style={{
            color: '#fcba19',
            fontWeight: 600,
            fontSize: '0.66rem',
            letterSpacing: '0.04em',
            lineHeight: '1',
            margin: 0,
            marginLeft: 3
          }}
        >
          {t(labelKey)}
        </span>
      </Stack>
    </div>
  )
}

/**
 * Status badge component for inline display
 */
export const StatusBadge = ({ statusConfig, t }) => (
  <Box
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      px: 0.9,
      py: 0.25,
      borderRadius: '999px',
      fontSize: '0.6rem',
      fontWeight: 700,
      letterSpacing: '0.03em',
      color: statusConfig.color,
      backgroundColor: statusConfig.bg,
      border: `1px solid ${statusConfig.color}`,
      lineHeight: 1,
      flexShrink: 0
    }}
  >
    {t(statusConfig.labelKey)}
  </Box>
)

/**
 * Custom close button for popups
 */
export const PopupCloseButton = () => (
  <IconButton
    size="small"
    onClick={() => {
      const popup = document.querySelector('.leaflet-popup-close-button')
      if (popup) popup.click()
    }}
    sx={{
      position: 'absolute',
      top: 4,
      right: 4,
      color: 'rgba(255,255,255,0.6)',
      padding: '3px',
      minWidth: 0,
      '&:hover': {
        backgroundColor: 'rgba(255,255,255,0.15)',
        color: '#fff'
      }
    }}
  >
    <CloseIcon sx={{ fontSize: 12 }} />
  </IconButton>
)

/**
 * Horizontal divider for popup sections
 */
export const DetailSectionDivider = () => (
  <Box
    sx={{
      borderTop: '1px solid #e4e6ef',
      width: '100%',
      mb: 0.1
    }}
  />
)

/**
 * Address display component
 */
export const SiteAddressDisplay = ({ addressLine }) => {
  if (!addressLine) return null

  return (
    <Box sx={{ mb: 0.75 }}>
      <BCTypography
        sx={{
          fontSize: '0.72rem',
          color: '#4a5568',
          lineHeight: 1.4
        }}
      >
        {addressLine}
      </BCTypography>
    </Box>
  )
}

/**
 * Coordinates display with Google Maps link and copy functionality
 */
export const CoordinatesDisplay = ({ lat, lng, googleMapsUrl }) => {
  const { t } = useTranslation(['fse'])
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(
        `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed')
    }
  }

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ mb: 0.5 }}
    >
      <Stack direction="row" alignItems="center" spacing={0.25}>
        <LocationIcon sx={{ fontSize: 13, color: '#8a94a6' }} />
        <BCTypography
          sx={{
            fontFamily: 'SFMono-Regular, Consolas, monospace',
            fontSize: '0.7rem',
            color: '#616e7c'
          }}
        >
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </BCTypography>
      </Stack>
      <Stack direction="row" spacing={0.2}>
        <Tooltip title={t('map.openInGoogleMaps')} arrow>
          <IconButton
            size="small"
            component="a"
            href={googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            sx={{
              p: 0.4,
              borderRadius: '4px',
              '&:hover': { backgroundColor: '#f0f3f7' }
            }}
          >
            <MapIcon sx={{ fontSize: 14, color: '#616e7c' }} />
          </IconButton>
        </Tooltip>
        <Tooltip
          title={copied ? t('map.copied') : t('map.copyCoordinates')}
          arrow
        >
          <IconButton
            size="small"
            onClick={handleCopy}
            sx={{
              p: 0.4,
              borderRadius: '4px',
              '&:hover': { backgroundColor: '#f0f3f7' }
            }}
          >
            {copied ? (
              <CheckIcon sx={{ fontSize: 13, color: '#2e8540' }} />
            ) : (
              <CopyIcon sx={{ fontSize: 13, color: '#616e7c' }} />
            )}
          </IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  )
}
