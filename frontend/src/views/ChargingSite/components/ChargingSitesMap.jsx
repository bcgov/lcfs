import React, { useEffect, useState } from 'react'
import { MapContainer, useMap, Marker, Popup, TileLayer } from 'react-leaflet'
import { createPortal } from 'react-dom'
import { Control, DomEvent, DomUtil } from 'leaflet'
import {
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogContent,
  DialogTitle,
  Box,
  Slide,
  useTheme,
  useMediaQuery
} from '@mui/material'
import {
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Close as CloseIcon
} from '@mui/icons-material'
import BCTypography from '@/components/BCTypography'
import { fixLeafletIcons, markerIcons } from './utils'
import 'leaflet/dist/leaflet.css'
import { useTranslation } from 'react-i18next'
import colors from '@/themes/base/colors'

// Fix Leaflet icon issue
fixLeafletIcons()

// Slide transition for the dialog
const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />
})

// Custom Control component using React portals
const MapControl = ({
  position = 'topright',
  disableClickPropagation = false,
  children
}) => {
  const [container, setContainer] = useState(null)
  const map = useMap()

  useEffect(() => {
    // Create a new map control
    const mapControl = new Control({ position })

    mapControl.onAdd = () => {
      const section = DomUtil.create('section')

      if (disableClickPropagation) {
        DomEvent.disableClickPropagation(section)
        DomEvent.disableScrollPropagation(section)
      }

      setContainer(section)
      return section
    }

    mapControl.onRemove = () => {
      setContainer(null)
    }

    // Add the control to the map
    map.addControl(mapControl)

    // Cleanup function
    return () => {
      map.removeControl(mapControl)
    }
  }, [map, position, disableClickPropagation])

  // Use createPortal to render React components inside the Leaflet control
  return container ? createPortal(children, container) : null
}

// Fullscreen toggle control
const FullscreenControl = ({ onToggleFullscreen, isFullscreen }) => {
  return (
    <MapControl position="topleft" disableClickPropagation={true}>
      <Paper elevation={2} sx={{ display: 'flex' }}>
        <IconButton
          onClick={onToggleFullscreen}
          size="small"
          sx={{
            p: 1,
            backgroundColor: 'white',
            '&:hover': {
              backgroundColor: '#f5f5f5'
            }
          }}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
        </IconButton>
      </Paper>
    </MapControl>
  )
}

// Component to fit the map bounds when locations change
const MapBoundsHandler = ({ sites }) => {
  const map = useMap()

  useEffect(() => {
    if (sites && sites.length > 0) {
      const validSites = sites.filter(
        (site) =>
          site.latitude != null &&
          site.longitude != null &&
          !isNaN(site.latitude) &&
          !isNaN(site.longitude) &&
          Math.abs(site.latitude) <= 90 &&
          Math.abs(site.longitude) <= 180
      )

      if (validSites.length === 1) {
        // Single site - center on it with reasonable zoom
        map.setView([validSites[0].latitude, validSites[0].longitude], 12)
      } else if (validSites.length > 1) {
        // Multiple sites - fit bounds to show all
        const bounds = validSites.map((site) => [site.latitude, site.longitude])
        map.fitBounds(bounds, { padding: [20, 20] })
      }
    }
  }, [map, sites])

  // Trigger map resize when container changes
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 100)

    return () => clearTimeout(timer)
  }, [map])

  return null
}

// Legend component
const ChargingSitesLegend = ({ sites, isFullscreen }) => {
  const { t } = useTranslation(['chargingSite'])
  const validSites = sites.filter(
    (site) =>
      site.latitude != null &&
      site.longitude != null &&
      !isNaN(site.latitude) &&
      !isNaN(site.longitude) &&
      Math.abs(site.latitude) <= 90 &&
      Math.abs(site.longitude) <= 180
  )

  const invalidSites = sites.filter(
    (site) =>
      site.latitude == null ||
      site.longitude == null ||
      isNaN(site.latitude) ||
      isNaN(site.longitude) ||
      Math.abs(site.latitude) > 90 ||
      Math.abs(site.longitude) > 180
  )

  // Get unique statuses for legend
  const statusCounts = validSites.reduce((acc, site) => {
    const status = site.status?.status || 'Unknown'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'validated':
        return colors.badgeColors.success.background // Green
      case 'draft':
        return colors.badgeColors.info.background // Blue
      case 'submitted':
        return colors.badgeColors.warning.background // Orange
      case 'decommissioned':
        return '#f44336' // Red
      default:
        return '#9e9e9e' // Grey
    }
  }

  return (
    <MapControl position="topright" disableClickPropagation={true}>
      <Paper
        elevation={3}
        sx={{
          p: 2,
          minWidth: isFullscreen ? 300 : 250,
          maxWidth: isFullscreen ? 400 : 350,
          maxHeight: isFullscreen ? '80vh' : '60vh',
          overflow: 'auto'
        }}
      >
        <BCTypography variant="h6" fontWeight="bold" gutterBottom>
          Charging Sites
        </BCTypography>

        <BCTypography variant="caption" component="div" sx={{ mb: 2 }}>
          Total Sites: {sites.length}
          {validSites.length < sites.length && (
            <span style={{ color: '#f44336' }}>
              {' '}
              ({invalidSites.length} invalid coordinates)
            </span>
          )}
        </BCTypography>

        {Object.keys(statusCounts).length > 0 && (
          <>
            <BCTypography variant="caption" fontWeight="bold" gutterBottom>
              Status Distribution:
            </BCTypography>
            {Object.entries(statusCounts).map(([status, count]) => (
              <div
                key={status}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '4px'
                }}
              >
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: getStatusColor(status),
                    borderRadius: '50%',
                    marginRight: '8px'
                  }}
                />
                <BCTypography variant="caption" component="span">
                  {status}: {count}
                </BCTypography>
              </div>
            ))}
          </>
        )}

        {invalidSites.length > 0 && (
          <>
            <BCTypography
              variant="caption"
              fontWeight="bold"
              sx={{ mt: 2, color: '#f44336' }}
            >
              Sites with Invalid Coordinates:
            </BCTypography>
            {invalidSites.map((site, index) => (
              <BCTypography
                key={site.chargingSiteId || index}
                variant="caption"
                component="div"
                sx={{ color: '#f44336' }}
              >
                • {site.siteName}
              </BCTypography>
            ))}
          </>
        )}
      </Paper>
    </MapControl>
  )
}

// Individual marker component
const ChargingSiteMarker = ({ site, isFullscreen }) => {
  const { t } = useTranslation('chargingSite')
  // Skip invalid coordinates
  if (
    site.latitude == null ||
    site.longitude == null ||
    isNaN(site.latitude) ||
    isNaN(site.longitude) ||
    Math.abs(site.latitude) > 90 ||
    Math.abs(site.longitude) > 180
  ) {
    return null
  }

  const position = [site.latitude, site.longitude]

  // Determine marker color based on status
  const getMarkerIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'validated':
        return markerIcons.green
      case 'draft':
      case 'updated':
        return markerIcons.default
      case 'submitted':
        return markerIcons.orange
      case 'decommissioned':
        return markerIcons.red
      default:
        return markerIcons.grey
    }
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'validated':
        return colors.badgeColors.success.background
      case 'updated':
      case 'draft':
        return colors.badgeColors.info.background
      case 'submitted':
        return colors.badgeColors.warning.background
      case 'decommissioned':
        return '#f44336'
      default:
        return '#9e9e9e'
    }
  }

  const markerIcon = getMarkerIcon(site.status?.status)

  return (
    <Marker key={site.chargingSiteId} position={position} icon={markerIcon}>
      <Popup maxWidth={isFullscreen ? 350 : 250}>
        <div style={{ maxWidth: isFullscreen ? 300 : 200 }}>
          {/* Site Header with Status Chip */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '8px',
              marginBottom: '12px'
            }}
          >
            <BCTypography
              variant="caption"
              fontWeight="bold"
              component="div"
              sx={{ flex: 1, minWidth: 0 }}
            >
              {site.siteName}
            </BCTypography>

            <Chip
              label={site.status?.status || 'Unknown'}
              size="small"
              sx={{
                backgroundColor: getStatusColor(site.status?.status),
                color: 'white',
                flexShrink: 0,
                fontSize: '0.65rem',
                height: '20px'
              }}
            />
          </div>

          {/* Organization */}
          <BCTypography variant="caption" component="div" sx={{ mb: 1 }}>
            <strong>{t('cardLabels.organization')}:</strong>{' '}
            {site.organization?.name || 'Unknown'}
          </BCTypography>

          {/* Site Code */}
          {site.siteCode && (
            <BCTypography variant="caption" component="div" sx={{ mb: 1 }}>
              <strong>{t('cardLabels.siteNum')}:</strong> {site.siteCode}
            </BCTypography>
          )}

          {/* Address */}
          <BCTypography variant="caption" component="div" sx={{ mb: 1 }}>
            <strong>{t('cardLabels.siteAddr')}:</strong> {site.streetAddress}
            {site.city && `, ${site.city}`}
            {site.postalCode && ` ${site.postalCode}`}
          </BCTypography>

          {/* Coordinates */}
          <BCTypography variant="caption" component="div" sx={{ mb: 2 }}>
            <strong>{t('cardLabels.coordinates')}:</strong>{' '}
            {site.latitude?.toFixed(6)}, {site.longitude?.toFixed(6)}
          </BCTypography>

          {/* Intended Users */}
          {site.intendedUsers && site.intendedUsers.length > 0 && (
            <>
              <BCTypography
                variant="caption"
                fontWeight="bold"
                component="div"
                sx={{ mb: 1 }}
              >
                {t('cardLabels.intendedUserTypes')}:
              </BCTypography>
              {site.intendedUsers.map((user, index) => (
                <BCTypography
                  key={user.endUserTypeId || index}
                  variant="caption"
                  component="div"
                  sx={{ ml: 1 }}
                >
                  • {user.typeName}
                </BCTypography>
              ))}
            </>
          )}

          {/* Notes */}
          {site.notes && (
            <BCTypography
              variant="caption"
              component="div"
              sx={{ mt: 2, fontStyle: 'italic' }}
            >
              <strong>{t('cardLabels.notes')}:</strong> {site.notes}
            </BCTypography>
          )}

          {/* Dates */}
          <BCTypography
            variant="caption"
            component="div"
            sx={{ mt: 2, color: '#666' }}
          >
            {t('cardLabels.created')}:{' '}
            {new Date(site.createDate).toLocaleDateString()} by{' '}
            {site.createUser}
            <br />
            {t('cardLabels.updated')}:{' '}
            {new Date(site.updateDate).toLocaleDateString()} by{' '}
            {site.updateUser}
          </BCTypography>
        </div>
      </Popup>
    </Marker>
  )
}

// Map content component (extracted for reuse)
const MapContent = ({ sites, showLegend, isFullscreen }) => {
  const sitesArray = Array.isArray(sites) ? sites : [sites]

  return (
    <>
      <TileLayer
        attribution='Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapBoundsHandler sites={sitesArray} />

      {showLegend && (
        <ChargingSitesLegend sites={sitesArray} isFullscreen={isFullscreen} />
      )}

      {/* Render markers for all valid sites */}
      {sitesArray.map((site, index) => (
        <ChargingSiteMarker
          key={site.chargingSiteId || `site-${index}`}
          site={site}
          isFullscreen={isFullscreen}
        />
      ))}
    </>
  )
}

// Main charging sites map component
const ChargingSitesMap = ({
  sites = [],
  height = 600,
  width = '100%',
  showLegend = true,
  showFullscreenButton = true
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  // Ensure sites is always an array
  const sitesArray = Array.isArray(sites) ? sites : [sites]

  // Default center (BC center)
  const defaultCenter = [53.7267, -127.6476]
  const defaultZoom = 5

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const handleCloseFullscreen = () => {
    setIsFullscreen(false)
  }

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen])

  if (sites && sites.length < 1) {
    return <></>
  }
  return (
    <>
      {/* Normal view */}
      <Paper
        elevation={3}
        sx={{ height, width, overflow: 'hidden', position: 'relative' }}
      >
        <MapContainer
          center={defaultCenter}
          zoom={defaultZoom}
          style={{ height: '100%', width: '100%' }}
        >
          <MapContent
            sites={sitesArray}
            showLegend={showLegend}
            isFullscreen={false}
          />

          {showFullscreenButton && (
            <FullscreenControl
              onToggleFullscreen={handleToggleFullscreen}
              isFullscreen={false}
            />
          )}
        </MapContainer>
      </Paper>

      {/* Floating dialog */}
      <Dialog
        open={isFullscreen}
        onClose={handleCloseFullscreen}
        maxWidth="lg"
        fullWidth
        TransitionComponent={Transition}
        BackdropProps={{
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.3)' // Semi-transparent backdrop
          }
        }}
        PaperProps={{
          sx: {
            width: '90vw',
            height: '85vh',
            maxWidth: '1400px',
            maxHeight: '900px',
            margin: 'auto',
            backgroundColor: '#f5f5f5',
            backgroundImage: 'none',
            borderRadius: 2,
            boxShadow: 24
          }
        }}
      >
        <DialogTitle
          sx={{
            p: 2,
            backgroundColor: 'white',
            borderBottom: '1px solid #e0e0e0',
            borderRadius: '8px 8px 0 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <BCTypography variant="h6" component="div">
            Charging Sites Map - Expanded View
          </BCTypography>
          <IconButton
            onClick={handleCloseFullscreen}
            size="small"
            sx={{ color: 'grey.500' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0, height: 'calc(100% - 64px)' }}>
          <Box sx={{ height: '100%', width: '100%' }}>
            <MapContainer
              center={defaultCenter}
              zoom={defaultZoom}
              style={{ height: '100%', width: '100%' }}
            >
              <MapContent
                sites={sitesArray}
                showLegend={showLegend}
                isFullscreen={true}
              />

              <FullscreenControl
                onToggleFullscreen={handleCloseFullscreen}
                isFullscreen={true}
              />
            </MapContainer>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ChargingSitesMap
