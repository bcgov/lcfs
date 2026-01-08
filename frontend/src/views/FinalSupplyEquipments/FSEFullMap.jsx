/**
 * @file FSEFullMap.jsx
 * @description Interactive map view for Final Supply Equipment (FSE) locations
 *
 * Displays all registered FSE across British Columbia with:
 * - Interactive Leaflet map with clustering
 * - Site-based and equipment-based views
 * - Organization filtering (government users)
 * - Detailed popups for sites and equipment
 *
 * @module views/FinalSupplyEquipments
 * @requires react
 * @requires react-leaflet
 * @requires @mui/material
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { createPortal } from 'react-dom'
import { Control, DomEvent, DomUtil } from 'leaflet'
import {
  Paper,
  Box,
  CircularProgress,
  IconButton,
  Dialog,
  DialogContent,
  Stack,
  Divider,
  Alert,
  AlertTitle,
  Tooltip,
  Button,
  TextField,
  InputAdornment,
  Chip,
  LinearProgress,
  Fade,
  Zoom,
  Autocomplete,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material'
import {
  OpenInNew as OpenInNewIcon,
  LocationOn as LocationIcon,
  LocationOn as EvStationIcon,
  Refresh as RefreshIcon,
  ChevronRight as ChevronRightIcon,
  ContentCopy as CopyIcon,
  Map as MapIcon,
  Search as SearchIcon,
  KeyboardArrowDown,
  KeyboardArrowUp,
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowUp as CollapseIcon,
  Business as SiteIcon,
  Check as CheckIcon,
  Schedule as PendingIcon,
  Edit as DraftIcon,
  Block as BlockIcon,
  FilterList as FilterIcon
} from '@mui/icons-material'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom'
import {
  useGetAllFSEForMap,
  useGetAllChargingSitesForMap
} from '@/hooks/useFinalSupplyEquipment'
import { useOrganizationNames } from '@/hooks/useOrganizations'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { govRoles } from '@/constants/roles'
import { fixLeafletIcons } from './components/utils'
import {
  theme,
  STATUS_CONFIG,
  CHARGING_LEVELS,
  BC_CENTER,
  DEFAULT_ZOOM,
  MAP_STYLES
} from './components/constants'
import {
  transformData,
  transformChargingSites,
  groupBySite,
  buildAddressLine,
  formatCoordinates,
  getLevelInfo,
  getMarkerIconForStatus,
  getSiteUrl,
  getEquipmentUrl
} from './components/helpers'
import {
  PopupCloseButton,
  DetailSectionDivider,
  SiteAddressDisplay,
  CoordinatesDisplay,
  PopupTypeBadge,
  StatusBadge
} from './components/PopupComponents'
import { ROUTES } from '@/routes/routes'
import 'leaflet/dist/leaflet.css'
import React from 'react'
import L from 'leaflet'

fixLeafletIcons()

/**
 * Injects global CSS styles for the map
 */
const StyleInjector = () => {
  useEffect(() => {
    const styleEl = document.createElement('style')
    styleEl.textContent = MAP_STYLES
    document.head.appendChild(styleEl)
    return () => styleEl.remove()
  }, [])
  return null
}

// ============================================================================
// MAP COMPONENTS
// ============================================================================

/**
 * Custom Leaflet control wrapper component
 * Renders React children within a Leaflet map control
 *
 * @param {Object} props
 * @param {string} props.position - Leaflet control position ('topright', 'bottomleft', etc.)
 * @param {React.ReactNode} props.children - React components to render in the control
 */
const MapControl = ({ position, children }) => {
  const [container, setContainer] = useState(null)
  const map = useMap()

  useEffect(() => {
    const ctrl = new Control({ position })
    ctrl.onAdd = () => {
      const div = DomUtil.create('div')
      DomEvent.disableClickPropagation(div)
      DomEvent.disableScrollPropagation(div)
      setContainer(div)
      return div
    }
    ctrl.onRemove = () => setContainer(null)
    map.addControl(ctrl)
    return () => map.removeControl(ctrl)
  }, [map, position])

  return container ? createPortal(children, container) : null
}

/**
 * Map overlay controls (stats panel)
 *
 * @param {Object} props
 * @param {Object} props.stats - Equipment and site statistics
 * @param {Function} props.onRefresh - Data refresh handler
 * @param {boolean} props.isRefreshing - Loading state for refresh
 */
const MapControls = ({ stats, onRefresh, isRefreshing }) => (
  <>
    {/* Stats panel */}
    <MapControl position="topright">
      <Fade in timeout={400}>
        <Paper
          elevation={0}
          sx={{
            minWidth: 160,
            borderRadius: theme.radius.sm,
            overflow: 'hidden',
            boxShadow: theme.shadows.sm,
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            display: { xs: 'none', sm: 'block' }
          }}
        >
          {/* Header */}
          <Box
            sx={{
              px: 2,
              py: 1,
              backgroundColor: theme.colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <BCTypography
              variant="caption"
              sx={{
                color: 'white !important',
                fontWeight: 600,
                letterSpacing: '0.5px'
              }}
            >
              Overview
            </BCTypography>
            {onRefresh && (
              <IconButton
                size="small"
                onClick={onRefresh}
                disabled={isRefreshing}
                sx={{ p: 0.25, color: 'white !important', opacity: 0.9 }}
              >
                <RefreshIcon
                  sx={{
                    fontSize: 16,
                    animation: isRefreshing
                      ? 'spin 1s linear infinite'
                      : 'none',
                    '@keyframes spin': {
                      from: { transform: 'rotate(0deg)' },
                      to: { transform: 'rotate(360deg)' }
                    }
                  }}
                />
              </IconButton>
            )}
          </Box>

          {/* Stats */}
          <Box sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Box>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="baseline"
                >
                  <BCTypography variant="caption" color="text.secondary">
                    FSE
                  </BCTypography>
                  <BCTypography
                    variant="h6"
                    fontWeight="700"
                    sx={{ color: '#043267' }}
                  >
                    {stats.totalEquipment}
                  </BCTypography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={100}
                  sx={{
                    mt: 0.5,
                    height: 3,
                    borderRadius: 1,
                    backgroundColor: theme.colors.borderLight,
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#043267'
                    }
                  }}
                />
              </Box>

              <Box>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="baseline"
                >
                  <BCTypography variant="caption" color="text.secondary">
                    Charging sites
                  </BCTypography>
                  <BCTypography
                    variant="h6"
                    fontWeight="700"
                    sx={{ color: '#043267' }}
                  >
                    {stats.totalSites}
                  </BCTypography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={100}
                  sx={{
                    mt: 0.5,
                    height: 3,
                    borderRadius: 1,
                    backgroundColor: theme.colors.borderLight,
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#043267'
                    }
                  }}
                />
              </Box>
            </Stack>
          </Box>
        </Paper>
      </Fade>
    </MapControl>
  </>
)

/**
 * Component to capture map instance reference
 *
 * @param {Object} props
 * @param {React.MutableRefObject} props.mapInstanceRef - Ref to store map instance
 */
const MapInstanceCapture = ({ mapInstanceRef }) => {
  const map = useMap()
  useEffect(() => {
    mapInstanceRef.current = map
  }, [map, mapInstanceRef])
  return null
}

/**
 * Automatically adjusts map bounds to fit all locations
 *
 * @param {Object} props
 * @param {Array<Object>} props.locations - Array of locations with lat/lng
 */
const AutoBounds = ({ locations }) => {
  const map = useMap()
  const prevLocationsRef = React.useRef(null)

  useEffect(() => {
    if (!locations?.length) return

    const locationsKey = locations
      .map((l) => `${l.lat},${l.lng}`)
      .sort()
      .join('|')

    if (prevLocationsRef.current === locationsKey) return

    prevLocationsRef.current = locationsKey

    const bounds = locations.map((l) => [l.lat, l.lng])
    const animationOptions = {
      animate: true,
      duration: MAP_CONFIG.BOUNDS_ANIMATION_DURATION
    }

    setTimeout(() => {
      try {
        if (bounds.length === 1) {
          map.setView(bounds[0], 12, animationOptions)
        } else {
          map.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 12,
            ...animationOptions
          })
        }

        setTimeout(() => map.invalidateSize(), 100)
      } catch (e) {
        console.debug('Map bounds adjustment:', e)
      }
    }, MAP_CONFIG.MAP_INVALIDATE_DELAY)
  }, [map, locations])

  return null
}

// ============================================================================
// POPUP COMPONENTS
// ============================================================================

/**
 * Equipment list item component for charging site popups
 * Displays compact equipment info with hover effects
 *
 * @param {Object} props
 * @param {Object} props.equipment - Equipment data object
 * @param {number} props.index - Item index in list
 * @param {Function} props.onClick - Click handler for navigation
 * @param {boolean} props.disableClick - Whether to disable click interaction
 */
const EquipmentRow = ({ equipment, index, onClick, disableClick }) => {
  const { t } = useTranslation(['fse'])
  const statusConfig = STATUS_CONFIG[equipment.status] || STATUS_CONFIG.Draft
  const displayTitle =
    [equipment.manufacturer, equipment.model].filter(Boolean).join(' ') ||
    `FSE #${index + 1}`

  return (
    <Box
      onClick={disableClick ? undefined : onClick}
      sx={{
        m: 1,
        p: 1,
        cursor: disableClick ? 'default' : 'pointer',
        backgroundColor: '#ffffff',
        border: '1px solid #e0e4e8',
        borderRadius: '4px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '3px',
          backgroundColor: statusConfig.color,
          opacity: 0,
          transition: 'opacity 0.2s ease'
        },
        '&:hover': disableClick
          ? {}
          : {
              backgroundColor: '#fafbfc',
              borderColor: '#003366',
              boxShadow: '0 2px 6px rgba(0,51,102,0.08)',
              '&::before': {
                opacity: 1
              },
              '& .equipment-action': {
                opacity: 1
              }
            }
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.75}>
        {/* Left: Title and Reg */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <BCTypography
              sx={{
                fontWeight: 600,
                fontSize: '0.78rem',
                color: disableClick ? '#1a202c' : '#003366',
                lineHeight: 1.1,
                whiteSpace: 'normal'
              }}
            >
              {displayTitle}
            </BCTypography>
            {equipment.regNumber && (
              <BCTypography
                sx={{
                  fontSize: '0.68rem',
                  color: '#9ca3af',
                  fontFamily: 'SFMono-Regular, Consolas, monospace',
                  fontWeight: 500,
                  lineHeight: 1
                }}
              >
                #{equipment.regNumber}
              </BCTypography>
            )}
          </Stack>
        </Box>

        {/* Middle: Capacity (if available) */}
        {equipment.capacityKw && (
          <BCTypography
            sx={{
              fontSize: '0.7rem',
              color: '#1a202c',
              fontWeight: 600,
              lineHeight: 1,
              whiteSpace: 'nowrap'
            }}
          >
            {Number(equipment.capacityKw).toLocaleString()}{' '}
            <Box
              component="span"
              sx={{ fontSize: '0.65rem', fontWeight: 500, color: '#718096' }}
            >
              kW
            </Box>
          </BCTypography>
        )}

        {/* Right: Status Badge */}
        <BCTypography
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            px: 0.9,
            py: 0.25,
            borderRadius: '999px',
            fontSize: '0.56rem',
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
        </BCTypography>

        {/* Action Indicator */}
        {!disableClick && (
          <ChevronRightIcon
            className="equipment-action"
            sx={{
              fontSize: 14,
              color: '#cbd5e0',
              opacity: 0,
              transition: 'opacity 0.2s ease',
              flexShrink: 0
            }}
          />
        )}
      </Stack>
    </Box>
  )
}

/**
 * Charging Site Popup Component
 * Displays site information and list of all equipment at the site
 * Includes search, expand/collapse, and navigation features
 *
 * @param {Object} props
 * @param {Object} props.siteData - Grouped site data with equipment array
 * @param {boolean} props.isGovernmentUser - Whether user has government role
 */
const SitePopup = ({ siteData, isGovernmentUser }) => {
  const { t } = useTranslation(['fse'])
  const navigate = useNavigate()
  const { items = [], siteName, siteId, organization, isEmpty } = siteData
  const primary = items[0]

  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(false)

  const siteLat = siteData.lat
  const siteLng = siteData.lng
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${siteLat},${siteLng}`
  const siteUrl = getSiteUrl(siteId)
  const displaySiteName = siteName || 'Unnamed site'
  const displayOrg = organization || null

  const filtered = useMemo(() => {
    if (isEmpty || !items.length) return []
    if (!search) return items
    const term = search.toLowerCase()
    return items.filter(
      (eq) =>
        (eq.regNumber || '').toLowerCase().includes(term) ||
        (eq.serial || '').toLowerCase().includes(term) ||
        (eq.manufacturer || '').toLowerCase().includes(term)
    )
  }, [items, search, isEmpty])

  const statusCounts = useMemo(() => {
    if (isEmpty || !items.length) return {}
    return items.reduce((acc, eq) => {
      acc[eq.status] = (acc[eq.status] || 0) + 1
      return acc
    }, {})
  }, [items, isEmpty])

  const siteStatus = useMemo(() => {
    if (isEmpty || !items.length) return siteData.status || 'Draft'
    const statuses = Object.keys(statusCounts)
    if (statuses.length === 0) return 'Draft'
    if (statuses.length === 1) return statuses[0]
    return Object.entries(statusCounts).sort((a, b) => b[1] - a[1])[0][0]
  }, [statusCounts, isEmpty, siteData.status, items.length])

  const siteStatusConfig = STATUS_CONFIG[siteStatus] || STATUS_CONFIG.Draft
  const LIMIT = 4
  const displayed = expanded ? filtered : filtered.slice(0, LIMIT)
  const hasMore = filtered.length > LIMIT
  const addressLine = useMemo(() => buildAddressLine(siteData), [siteData])

  const totalCapacity = useMemo(() => {
    const total = filtered.reduce((sum, eq) => {
      const value = Number(eq.capacityKw)
      return !Number.isNaN(value) && value > 0 ? sum + value : sum
    }, 0)
    return total > 0 ? total : null
  }, [filtered])

  return (
    <Box
      sx={{
        width: 300,
        backgroundColor: '#fff',
        borderRadius: '6px',
        boxShadow: '0 6px 20px rgba(13,38,76,0.12)',
        border: '1px solid #d9dfe9',
        overflow: 'hidden',
        '& .MuiTypography-root': { lineHeight: 1 }
      }}
    >
      {/* Header */}
      <Box
        sx={{
          backgroundColor: '#043267',
          px: 1.5,
          py: 1,
          position: 'relative'
        }}
      >
        <PopupCloseButton />
        <Box sx={{ pr: 3 }}>
          <PopupTypeBadge icon={SiteIcon} labelKey="map.chargingSite" />
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.8}
            sx={{ mb: 0.5 }}
          >
            <div
              style={{
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.98rem',
                lineHeight: '1.2',
                margin: 0,
                padding: 0
              }}
            >
              {displaySiteName}
            </div>
            <StatusBadge statusConfig={siteStatusConfig} t={t} />
          </Stack>
          {displayOrg && (
            <div
              style={{
                color: 'rgba(255,255,255,0.75)',
                fontSize: '0.7rem',
                lineHeight: '1.2',
                margin: 0,
                padding: 0,
                marginTop: '3px'
              }}
            >
              {displayOrg}
            </div>
          )}
          <div
            style={{
              color: 'rgba(255,255,255,0.65)',
              fontSize: '0.68rem',
              lineHeight: '1.2',
              margin: 0,
              padding: 0,
              marginTop: '6px'
            }}
          >
            {addressLine}
          </div>
        </Box>
      </Box>

      {/* Summary - Single Line */}
      <Box
        sx={{
          px: 1.35,
          py: 0.85,
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #dde3ec'
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          {/* Left: Status badges */}
          <Stack
            direction="row"
            spacing={0.45}
            alignItems="center"
            sx={{ flex: 1 }}
          >
            {isEmpty ? (
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.25,
                  px: 0.7,
                  py: 0.18,
                  borderRadius: '999px',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  letterSpacing: '0.03em',
                  color: siteStatusConfig.color,
                  backgroundColor: siteStatusConfig.bg,
                  border: `1px solid ${siteStatusConfig.color}`,
                  lineHeight: 1
                }}
              >
                {t(siteStatusConfig.labelKey)}
              </Box>
            ) : (
              Object.entries(statusCounts).map(([k, v]) => {
                const cfg = STATUS_CONFIG[k] || STATUS_CONFIG.Draft
                return (
                  <Box
                    key={k}
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.25,
                      px: 0.7,
                      py: 0.18,
                      borderRadius: '999px',
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      letterSpacing: '0.03em',
                      color: cfg.color,
                      backgroundColor: cfg.bg,
                      border: `1px solid ${cfg.color}`,
                      lineHeight: 1
                    }}
                  >
                    {v} {t(cfg.labelKey)}
                  </Box>
                )
              })
            )}
          </Stack>

          {/* Right: Equipment count */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.4,
              px: 0.75,
              py: 0.35,
              borderRadius: '3px',
              backgroundColor: '#043267',
              border: '1px solid #032550'
            }}
          >
            <BCTypography
              component="span"
              sx={{
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.75rem',
                letterSpacing: '0.02em'
              }}
            >
              {items.length}
            </BCTypography>
            <BCTypography
              component="span"
              sx={{
                color: '#b8cfe6',
                fontWeight: 500,
                fontSize: '0.7rem',
                letterSpacing: '0.02em'
              }}
            >
              FSE
            </BCTypography>
          </Box>
        </Stack>
      </Box>

      {/* Empty site message */}
      {isEmpty && (
        <Box
          sx={{
            px: 1.5,
            py: 1.5,
            backgroundColor: '#f7f9fd',
            borderBottom: '1px solid #e4e9f2',
            textAlign: 'center'
          }}
        >
          <BCTypography
            sx={{
              color: '#5c5c5c',
              fontSize: '0.8rem',
              fontStyle: 'italic'
            }}
          >
            {t('map.noEquipmentAtSite', 'No equipment registered at this site')}
          </BCTypography>
        </Box>
      )}

      {/* Search */}
      {!isEmpty && items.length > LIMIT && (
        <Box
          sx={{
            px: 1.25,
            py: 0.75,
            backgroundColor: '#f7f9fd',
            borderBottom: '1px solid #e4e9f2'
          }}
        >
          <TextField
            size="small"
            fullWidth
            placeholder={t('map.searchEquipment')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: '#8a94a6' }} />
                </InputAdornment>
              )
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#fff',
                fontSize: '0.8rem',
                borderRadius: '4px',
                '& fieldset': { borderColor: '#d9dfe9' },
                '&:hover fieldset': { borderColor: '#003366' },
                '&.Mui-focused fieldset': { borderColor: '#003366' },
                '& input': { py: '6px' }
              }
            }}
          />
        </Box>
      )}

      {/* Equipment List */}
      {!isEmpty && (
        <>
          <Box
            sx={{
              maxHeight: 145,
              overflowY: 'auto',
              backgroundColor: '#fff',
              '&::-webkit-scrollbar': {
                width: '8px'
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: '#f1f3f5',
                borderRadius: '4px'
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: '#cbd5e0',
                borderRadius: '4px',
                '&:hover': {
                  backgroundColor: '#a0aec0'
                }
              },
              // Firefox
              scrollbarWidth: 'thin',
              scrollbarColor: '#cbd5e0 #f1f3f5'
            }}
          >
            {displayed.map((eq, idx) => (
              <EquipmentRow
                key={eq.id || idx}
                equipment={eq}
                index={idx}
                disableClick={isGovernmentUser}
                onClick={() => {
                  const url = getEquipmentUrl(eq.id)
                  if (url) navigate(url)
                }}
              />
            ))}
            {filtered.length === 0 && search && (
              <Box sx={{ py: 1, textAlign: 'center' }}>
                <BCTypography sx={{ fontSize: '0.8rem', color: '#8a94a6' }}>
                  {t('map.noEquipmentFound')}
                </BCTypography>
              </Box>
            )}
          </Box>

          {/* Show More */}
          {hasMore && !search && (
            <Box
              onClick={() => setExpanded(!expanded)}
              sx={{
                py: 0.6,
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: '#f7f9fd',
                borderTop: '1px solid #e4e9f2',
                '&:hover': { backgroundColor: '#edf2f8' }
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="center"
                spacing={0.4}
              >
                <BCTypography
                  sx={{
                    color: '#003366',
                    fontWeight: 600,
                    fontSize: '0.72rem'
                  }}
                >
                  {expanded
                    ? t('map.showFewerResults')
                    : t('map.viewAll', { count: filtered.length })}
                </BCTypography>
                {expanded ? (
                  <CollapseIcon sx={{ fontSize: 13, color: '#003366' }} />
                ) : (
                  <ExpandIcon sx={{ fontSize: 13, color: '#003366' }} />
                )}
              </Stack>
            </Box>
          )}
        </>
      )}

      {/* Footer */}
      <Box sx={{ px: 1.25, py: 0.8, backgroundColor: '#fff' }}>
        <DetailSectionDivider />
        <Box sx={{ my: 1 }}>
          <CoordinatesDisplay
            lat={siteLat}
            lng={siteLng}
            googleMapsUrl={googleMapsUrl}
          />
        </Box>
        {siteUrl && (
          <Button
            variant="contained"
            fullWidth
            disableElevation
            onClick={() => navigate(siteUrl)}
            sx={{
              textTransform: 'none',
              fontSize: '0.8rem',
              py: 0.7,
              borderRadius: '4px',
              backgroundColor: '#003366',
              color: '#fff',
              '&:hover': { backgroundColor: '#00264d' }
            }}
          >
            {t('map.viewSite')}
          </Button>
        )}
      </Box>
    </Box>
  )
}

/**
 * Individual Equipment Popup Component
 * Displays detailed information for a single FSE unit
 * Includes specifications, intended use, and navigation options
 *
 * @param {Object} props
 * @param {Object} props.equipment - Equipment data object
 * @param {boolean} props.isGovernmentUser - Whether user has government role
 */
const EquipmentPopup = ({ equipment, isGovernmentUser }) => {
  const { t } = useTranslation(['fse'])
  const navigate = useNavigate()

  const {
    siteName,
    organization,
    siteId,
    regNumber,
    serial,
    manufacturer,
    model,
    ports,
    capacityKw,
    status,
    lat,
    lng,
    level,
    intendedUses,
    intendedUsers
  } = equipment

  const siteUrl = getSiteUrl(siteId)
  const equipmentUrl = getEquipmentUrl(equipment.id)
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.Draft
  const googleMapsUrl =
    lat && lng
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      : null
  const levelInfo = getLevelInfo(level)
  const usesLabel = intendedUses?.length
    ? intendedUses.map((u) => u.type || u).join(', ')
    : null
  const usersLabel = intendedUsers?.length
    ? intendedUsers.map((u) => u.typeName || u).join(', ')
    : null

  const fseDisplayName =
    [manufacturer, model].filter(Boolean).join(' ') || 'Charging Equipment'

  return (
    <Box
      sx={{
        width: 300,
        backgroundColor: '#fff',
        borderRadius: '6px',
        boxShadow: '0 6px 20px rgba(13,38,76,0.12)',
        border: '1px solid #d9dfe9',
        overflow: 'hidden',
        '& .MuiTypography-root': { lineHeight: 1 }
      }}
    >
      {/* Header */}
      <Box
        sx={{
          backgroundColor: '#043267',
          px: 1.5,
          py: 1,
          position: 'relative'
        }}
      >
        <PopupCloseButton />
        <Box sx={{ pr: 3 }}>
          <PopupTypeBadge
            icon={EvStationIcon}
            labelKey="map.finalSupplyEquipment"
          />
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.8}
            sx={{ mb: 0.5 }}
          >
            <div
              style={{
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.98rem',
                lineHeight: '1.2',
                margin: 0,
                padding: 0
              }}
            >
              {fseDisplayName}
            </div>
            <StatusBadge statusConfig={statusConfig} t={t} />
          </Stack>
          {regNumber && (
            <div
              style={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: '0.72rem',
                fontFamily: 'SFMono-Regular, Consolas, monospace',
                lineHeight: '1.2',
                margin: 0,
                padding: 0,
                marginTop: '3px'
              }}
            >
              {regNumber}
            </div>
          )}
          {(siteName || organization) && (
            <div
              style={{
                color: 'rgba(255,255,255,0.75)',
                fontSize: '0.7rem',
                lineHeight: '1.2',
                margin: 0,
                padding: 0,
                marginTop: '3px'
              }}
            >
              {[organization, siteName].filter(Boolean).join(' • ')}
            </div>
          )}
        </Box>
      </Box>

      {/* Specifications & Details */}
      <Box
        sx={{
          px: 1.25,
          py: 0.85,
          backgroundColor: '#fff',
          borderBottom: '1px solid #e4e9f2'
        }}
      >
        <Box
          component="table"
          sx={{
            width: '100%',
            borderCollapse: 'collapse',
            '& td, & th': {
              padding: '2.5px 6px',
              border: 'none',
              fontSize: '0.92rem'
            }
          }}
        >
          <tbody>
            {[
              { label: 'Serial', value: serial },
              { label: 'Ports', value: ports },
              { label: 'Level', value: levelInfo.short || levelInfo.full },
              capacityKw && {
                label: 'Cap.',
                value: `${Number(capacityKw).toLocaleString()} kW`
              },
              usesLabel && { label: 'Intended use', value: usesLabel },
              usersLabel && { label: 'Intended users', value: usersLabel }
            ]
              .filter(Boolean)
              .map(({ label, value }) => (
                <tr key={label}>
                  <td
                    style={{
                      color: '#8a94a6',
                      fontWeight: 500,
                      fontSize: '0.7rem',
                      textTransform: 'none',
                      width: '38%',
                      paddingRight: 8,
                      verticalAlign: 'top'
                    }}
                  >
                    {label}
                  </td>
                  <td
                    style={{
                      color: '#1a1a1a',
                      fontSize: '0.7rem',
                      wordBreak: 'break-all'
                    }}
                  >
                    {value || '—'}
                  </td>
                </tr>
              ))}
          </tbody>
        </Box>
      </Box>

      {/* Footer */}
      <Box sx={{ px: 1.25, py: 0.8, backgroundColor: '#fff' }}>
        <Box sx={{ mb: 1 }}>
          <CoordinatesDisplay
            lat={lat}
            lng={lng}
            googleMapsUrl={googleMapsUrl}
          />
        </Box>
        <Stack direction="row" spacing={0.5}>
          {siteUrl && (
            <Button
              variant="contained"
              fullWidth
              disableElevation
              onClick={() => navigate(siteUrl)}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                py: 0.6,
                borderRadius: '5px',
                backgroundColor: '#5c6f82',
                color: '#fff !important',
                '&:hover': {
                  backgroundColor: '#4a5a69'
                }
              }}
            >
              {t('map.viewSite')}
            </Button>
          )}
          {equipmentUrl && !isGovernmentUser && (
            <Button
              variant="contained"
              fullWidth
              disableElevation
              onClick={() => navigate(equipmentUrl)}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                py: 0.6,
                borderRadius: '5px',
                backgroundColor: '#003366',
                color: '#fff',
                '&:hover': { backgroundColor: '#00264d' }
              }}
            >
              View FSE
            </Button>
          )}
        </Stack>
      </Box>
    </Box>
  )
}

// ============================================================================
// STATE COMPONENTS
// ============================================================================

const LoadingState = () => (
  <Paper
    elevation={0}
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: 450,
      borderRadius: theme.radius.md,
      border: `1px solid ${theme.colors.border}`,
      backgroundColor: theme.colors.surfaceAlt
    }}
  >
    <CircularProgress
      size={40}
      thickness={4}
      sx={{ color: theme.colors.primary }}
    />
    <BCTypography
      variant="body1"
      sx={{ mt: 2, color: theme.colors.textSecondary }}
    >
      Loading FSE data...
    </BCTypography>
  </Paper>
)

const ErrorState = ({ error, onRetry }) => (
  <Alert
    severity="error"
    sx={{ borderRadius: theme.radius.md }}
    action={
      onRetry && (
        <Button color="inherit" size="small" onClick={onRetry}>
          Retry
        </Button>
      )
    }
  >
    <AlertTitle sx={{ fontWeight: 600 }}>Unable to load map data</AlertTitle>
    {error?.message || 'Please try again later.'}
  </Alert>
)

/**
 * Empty state component shown when no FSE data exists
 * Displays message and action button to add equipment
 */
const EmptyState = () => (
  <Paper
    elevation={0}
    sx={{
      borderRadius: theme.radius.md,
      backgroundColor: '#fff',
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
      overflow: 'hidden',
      width: '100%',
      maxWidth: 600,
      mx: 'auto'
    }}
  >
    <Box
      sx={{
        pt: 5,
        pb: 4,
        px: 4,
        textAlign: 'center'
      }}
    >
      <Box
        sx={{
          width: 80,
          height: 80,
          mx: 'auto',
          mb: 3,
          borderRadius: '50%',
          backgroundColor: theme.colors.surfaceAlt,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `2px solid ${theme.colors.borderLight}`
        }}
      >
        <LocationIcon
          sx={{
            fontSize: 40,
            color: theme.colors.textMuted
          }}
        />
      </Box>

      <BCTypography
        variant="h5"
        sx={{
          fontWeight: 700,
          mb: 1.5,
          color: theme.colors.text
        }}
      >
        No FSE locations
      </BCTypography>

      <BCTypography
        variant="body1"
        sx={{
          color: theme.colors.textSecondary,
          mb: 3,
          maxWidth: 420,
          mx: 'auto',
          lineHeight: 1.6
        }}
      >
        FSE with valid coordinates will be displayed here once added.
      </BCTypography>

      <Button
        component={RouterLink}
        to={ROUTES.REPORTS.MANAGE_FSE}
        variant="contained"
        disableElevation
        sx={{
          textTransform: 'none',
          fontWeight: 600,
          px: 4,
          py: 1.25,
          fontSize: '0.9375rem',
          borderRadius: theme.radius.sm,
          color: '#fff !important',
          backgroundColor: theme.colors.primary,
          boxShadow: '0 2px 6px rgba(0,51,102,0.2)',
          '&:hover': {
            backgroundColor: theme.colors.primaryDark,
            boxShadow: '0 5px 12px rgba(0,51,102,0.25)',
            transform: 'translateY(-1px)'
          },
          transition: 'all 0.2s ease'
        }}
      >
        Manage FSE
      </Button>
    </Box>
  </Paper>
)

// ============================================================================
// PAGE COMPONENTS
// ============================================================================

/**
 * Page header component with title, description, and statistics
 *
 * @param {Object} props
 * @param {Object} props.stats - Statistics object with totalEquipment and totalSites
 * @param {React.ReactNode} props.action - Optional action buttons/content
 */
const PageHeader = ({ stats, action = null }) => (
  <Box sx={{ mb: 4 }}>
    <Box sx={{ mb: 2 }}>
      <BCTypography
        variant="h5"
        component="h1"
        sx={{
          fontWeight: 700,
          mb: 0.5,
          color: theme.colors.primary,
          letterSpacing: '-0.01em'
        }}
      >
        FSE map
      </BCTypography>
      <BCTypography
        variant="body2"
        sx={{
          color: theme.colors.textSecondary,
          maxWidth: 720,
          lineHeight: 1.5
        }}
      >
        Interactive map displaying all registered Final Supply Equipment across
        British Columbia. Click markers to view details and specifications.
      </BCTypography>
    </Box>
    {action}
  </Box>
)

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Map container styling constants
 */
const MAP_STYLES_CONSTANTS = {
  colors: {
    headerBg: '#4a6fa5',
    headerBgHover: '#38598a',
    filterBg: '#f8f9fa',
    border: '#d0d5dd',
    white: '#ffffff'
  },
  borderRadius: {
    collapsed: '8px',
    expanded: 0
  },
  spacing: {
    headerPillWidth: 'calc(100% - 32px)',
    headerMarginCollapsed: '-28px auto 8px',
    headerMarginExpanded: '0 auto',
    containerMx: '0px',
    containerMb: '10px'
  },
  shadows: {
    collapsed: '2px 2px 3px rgba(0,0,0,0.2)',
    expanded:
      '0 25px 100px rgba(4,50,103,0.4), 0 10px 40px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.1)'
  },
  transitions: {
    expand:
      'position 0s, top 0.8s cubic-bezier(0.16, 1, 0.3, 1), left 0.8s cubic-bezier(0.16, 1, 0.3, 1), right 0.8s cubic-bezier(0.16, 1, 0.3, 1), bottom 0.8s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s, border-radius 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), filter 0.6s ease',
    collapse:
      'position 0s 0.8s, top 0.6s cubic-bezier(0.76, 0, 0.24, 1), left 0.6s cubic-bezier(0.76, 0, 0.24, 1), right 0.6s cubic-bezier(0.76, 0, 0.24, 1), bottom 0.6s cubic-bezier(0.76, 0, 0.24, 1), box-shadow 0.5s cubic-bezier(0.76, 0, 0.24, 1), border-radius 0.5s cubic-bezier(0.76, 0, 0.24, 1), transform 0.6s cubic-bezier(0.76, 0, 0.24, 1), filter 0.4s ease'
  }
}

/**
 * Special option for government users to view all organizations
 */
const ALL_ORGS_OPTION = {
  organizationId: 'all',
  name: 'All organizations'
}

/**
 * Map container configuration
 */
const MAP_CONFIG = {
  MIN_LOADING_DISPLAY_TIME: 500, // Minimum time to show loading (ms)
  MAP_INVALIDATE_DELAY: 50, // Delay before invalidating map size
  MAP_INVALIDATE_AFTER_TRANSITION: 350, // Delay after transition completes
  BOUNDS_ANIMATION_DURATION: 0.5, // Map bounds animation duration (seconds)
  MAP_SPACING_BELOW_CONTENT: -20 // Spacing between content and map (px)
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * FSEFullMap - Main interactive map component
 *
 * Features:
 * - Interactive Leaflet map with marker clustering
 * - Two view modes: equipment-based and site-based markers
 * - Organization filtering (government users only)
 * - Detailed popups for sites and individual equipment
 * - Real-time data with refresh capability
 * - Responsive design with mobile support
 *
 * @param {Object} props
 * @param {number|string} props.organizationId - Organization ID for filtering (optional)
 * @returns {React.ReactElement} The map component
 */
const FSEFullMap = ({ organizationId: propOrgId }) => {
  const { t } = useTranslation(['fse'])

  // Route params and user context
  const { complianceReportId } = useParams()
  const { data: currentUser, hasAnyRole } = useCurrentUser()
  const isGovernmentUser = hasAnyRole(...govRoles)

  // Component state
  const [selectedOrgId, setSelectedOrgId] = useState('all')
  const [viewMode, setViewMode] = useState('sites') // 'equipment' or 'sites' - default to 'sites'
  const [isMapExpanded, setIsMapExpanded] = useState(false)
  const mapContainerRef = React.useRef(null)
  const mapInstanceRef = React.useRef(null)
  const [showLoading, setShowLoading] = useState(false)
  const loadingTimeoutRef = React.useRef(null)
  const contentRef = React.useRef(null)
  const scrollPositionRef = React.useRef(0)
  const [mapTopOffset, setMapTopOffset] = useState('400px')

  // Restore organization filter from session storage (government users only)
  useEffect(() => {
    if (!isGovernmentUser) return
    const saved = sessionStorage.getItem('fse-map-selected-org')
    if (saved) {
      if (saved === 'all') {
        setSelectedOrgId('all')
        return
      }
      const parsed = Number(saved)
      if (!Number.isNaN(parsed)) {
        setSelectedOrgId(parsed)
        return
      }
    }
    setSelectedOrgId('all')
  }, [isGovernmentUser])

  // Fetch organization list (government users only)
  const { data: organizationOptions = [], isLoading: isLoadingOrganizations } =
    useOrganizationNames(
      null,
      { orgFilter: 'all' },
      { enabled: isGovernmentUser }
    )

  // Build organization dropdown options with "All organizations" first
  const organizationOptionsWithAll = useMemo(() => {
    if (!isGovernmentUser) return []

    // Sort organizations alphabetically
    const sorted = [...organizationOptions].sort((a, b) => {
      const nameA = a?.name || ''
      const nameB = b?.name || ''
      return nameA.localeCompare(nameB, undefined, {
        numeric: true,
        sensitivity: 'base'
      })
    })

    return [ALL_ORGS_OPTION, ...sorted]
  }, [isGovernmentUser, organizationOptions])

  // Get currently selected organization option for dropdown
  const selectedOrgOption = useMemo(() => {
    if (selectedOrgId === 'all') return ALL_ORGS_OPTION
    return (
      organizationOptionsWithAll.find(
        (org) => Number(org?.organizationId) === Number(selectedOrgId)
      ) || ALL_ORGS_OPTION
    )
  }, [organizationOptionsWithAll, selectedOrgId])

  // Memoized option label getter for Autocomplete
  const getOptionLabel = useCallback((option) => option?.name || '', [])

  // Memoized option equality checker for Autocomplete
  const isOptionEqualToValue = useCallback(
    (option, value) => option?.organizationId === value?.organizationId,
    []
  )

  // Handle organization filter selection
  const handleOrganizationChange = useCallback((_, option) => {
    const optionId = option?.organizationId
    const orgId =
      optionId === 'all' ? 'all' : optionId ? Number(optionId) : 'all'
    setSelectedOrgId(orgId)

    // Persist selection to session storage
    if (orgId === 'all') {
      sessionStorage.setItem('fse-map-selected-org', 'all')
    } else {
      sessionStorage.setItem('fse-map-selected-org', String(orgId))
    }
  }, [])

  // Determine effective organization ID for API query
  // Government users: use selected org (null = all orgs)
  // Regular users: use prop or current user's org
  const effectiveOrganizationId = isGovernmentUser
    ? selectedOrgId === 'all'
      ? null
      : selectedOrgId
    : propOrgId || currentUser?.organization?.organizationId

  // Fetch FSE data from API
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useGetAllFSEForMap(complianceReportId, effectiveOrganizationId, {
      enabled: isGovernmentUser ? true : !!effectiveOrganizationId
    })

  // Fetch all charging sites (including empty ones)
  const { data: chargingSitesData } = useGetAllChargingSitesForMap(
    effectiveOrganizationId,
    {
      enabled: isGovernmentUser ? true : !!effectiveOrganizationId
    }
  )

  // Handle loading state with minimum display time
  useEffect(() => {
    if (isLoading || isRefetching) {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
      setShowLoading(true)
    } else {
      loadingTimeoutRef.current = setTimeout(() => {
        setShowLoading(false)
      }, MAP_CONFIG.MIN_LOADING_DISPLAY_TIME)
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
    }
  }, [isLoading, isRefetching])

  // Transform and group equipment data
  const { locations, grouped, stats, allSites } = useMemo(() => {
    const locs = transformData(data)
    const sites = transformChargingSites(chargingSitesData?.chargingSites || [])
    const grp = groupBySite(locs, sites)

    return {
      locations: locs,
      allSites: sites,
      grouped: grp,
      stats: {
        totalEquipment: locs.length,
        totalSites: Object.keys(grp).length
      }
    }
  }, [data, chargingSitesData])

  // Prepare marker arrays for map rendering
  const equipmentMarkers = locations // Individual equipment markers
  const siteMarkers = useMemo(() => Object.values(grouped), [grouped]) // Site markers with grouped equipment

  // Generate cluster icons with size based on marker count
  const clusterIcon = useCallback((cluster) => {
    const count = cluster.getChildCount()
    let cls = 'cluster-sm',
      size = 32

    // Scale cluster size based on count
    if (count >= 50) {
      cls = 'cluster-xl'
      size = 56
    } else if (count >= 20) {
      cls = 'cluster-lg'
      size = 48
    } else if (count >= 5) {
      cls = 'cluster-md'
      size = 40
    }

    return L.divIcon({
      html: `<div class="fse-marker-cluster ${cls}">${count}</div>`,
      className: '',
      iconSize: L.point(size, size, true)
    })
  }, [])

  // Calculate dynamic map top offset based on content height
  useEffect(() => {
    const calculateOffset = () => {
      if (contentRef.current) {
        const rect = contentRef.current.getBoundingClientRect()
        const offsetFromTop = Math.max(
          rect.bottom + MAP_CONFIG.MAP_SPACING_BELOW_CONTENT,
          200 // Minimum offset to prevent overlap with header
        )
        setMapTopOffset(`${offsetFromTop}px`)
      }
    }

    // Calculate on mount and when window resizes
    calculateOffset()

    // Use ResizeObserver for better performance if available
    let resizeObserver
    if (window.ResizeObserver && contentRef.current) {
      resizeObserver = new ResizeObserver(calculateOffset)
      resizeObserver.observe(contentRef.current)
    }

    window.addEventListener('resize', calculateOffset)

    // Recalculate after a short delay to ensure content is rendered
    const timeoutId = setTimeout(calculateOffset, 100)

    return () => {
      window.removeEventListener('resize', calculateOffset)
      if (resizeObserver) resizeObserver.disconnect()
      clearTimeout(timeoutId)
    }
  }, [stats, isGovernmentUser, viewMode]) // Recalculate when these change

  // Handle map expansion with proper size invalidation
  useEffect(() => {
    if (!mapInstanceRef.current) return

    const invalidateMapSize = (delay) => {
      setTimeout(() => {
        try {
          mapInstanceRef.current?.invalidateSize()
        } catch (e) {
          console.debug('Map invalidate size:', e)
        }
      }, delay)
    }

    invalidateMapSize(MAP_CONFIG.MAP_INVALIDATE_DELAY)
    invalidateMapSize(MAP_CONFIG.MAP_INVALIDATE_AFTER_TRANSITION)
  }, [isMapExpanded])

  // Memoized map content renderer to prevent unnecessary re-renders
  const mapContent = useCallback(
    () => (
      <>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapInstanceCapture mapInstanceRef={mapInstanceRef} />
        <AutoBounds
          locations={viewMode === 'equipment' ? equipmentMarkers : siteMarkers}
        />
        <MapControls
          stats={stats}
          onRefresh={refetch}
          isRefreshing={isRefetching}
        />
        {/* Equipment markers cluster */}
        {viewMode === 'equipment' && (
          <MarkerClusterGroup
            key="equipment"
            chunkedLoading
            iconCreateFunction={clusterIcon}
            maxClusterRadius={50}
            spiderfyOnMaxZoom
            showCoverageOnHover={false}
            zoomToBoundsOnClick
            animate
          >
            {equipmentMarkers.map((equipment, idx) => (
              <Marker
                key={`eq-${equipment.id || idx}`}
                position={[equipment.lat, equipment.lng]}
                icon={getMarkerIconForStatus(equipment.status)}
              >
                <Popup maxWidth={360} minWidth={300}>
                  <EquipmentPopup
                    equipment={equipment}
                    isGovernmentUser={isGovernmentUser}
                  />
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        )}
        {/* Charging sites cluster */}
        {viewMode === 'sites' && (
          <MarkerClusterGroup
            key="sites"
            chunkedLoading
            iconCreateFunction={clusterIcon}
            maxClusterRadius={50}
            spiderfyOnMaxZoom
            showCoverageOnHover={false}
            zoomToBoundsOnClick
            animate
          >
            {siteMarkers.map((site) => (
              <Marker
                key={`site-${site.key}`}
                position={[site.lat, site.lng]}
                icon={getMarkerIconForStatus(site.status)}
              >
                <Popup maxWidth={400} minWidth={320}>
                  <SitePopup
                    siteData={site}
                    isGovernmentUser={isGovernmentUser}
                  />
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        )}
      </>
    ),
    [
      viewMode,
      equipmentMarkers,
      siteMarkers,
      stats,
      refetch,
      isRefetching,
      clusterIcon,
      isGovernmentUser
    ]
  )

  const headerActions = (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      alignItems={{ xs: 'stretch', md: 'center' }}
    >
      {/* Organization Filter - only for government users */}
      {isGovernmentUser && (
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ minWidth: { xs: '100%', md: 340 } }}
        >
          <BCTypography
            sx={{
              fontSize: '0.875rem',
              color: theme.colors.textSecondary,
              fontWeight: 600,
              flexShrink: 0
            }}
          >
            Filter by:
          </BCTypography>
          <Autocomplete
            options={organizationOptionsWithAll}
            loading={isLoadingOrganizations}
            value={selectedOrgOption}
            onChange={handleOrganizationChange}
            getOptionLabel={getOptionLabel}
            isOptionEqualToValue={isOptionEqualToValue}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Filter by organization"
                size="small"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {isLoadingOrganizations ? (
                        <CircularProgress color="inherit" size={16} />
                      ) : null}
                      {params.InputProps.endAdornment}
                    </>
                  )
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: '0.875rem',
                    backgroundColor: '#fff',
                    borderRadius: theme.radius.sm,
                    '& fieldset': {
                      borderColor: theme.colors.borderLight
                    },
                    '&:hover fieldset': {
                      borderColor: theme.colors.primary
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: theme.colors.primary,
                      borderWidth: '2px'
                    }
                  }
                }}
              />
            )}
            sx={{ flex: 1 }}
          />
        </Stack>
      )}

      {/* Divider between filters */}
      {isGovernmentUser && (
        <Divider
          orientation="vertical"
          flexItem
          sx={{ display: { xs: 'none', md: 'block' } }}
        />
      )}

      {/* Display Mode Toggle */}
      <Stack direction="row" spacing={1.5} alignItems="center">
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          size="small"
          onChange={(_, value) => value && setViewMode(value)}
          sx={{
            backgroundColor: '#fff',
            borderRadius: theme.radius.sm,
            border: `1px solid ${theme.colors.borderLight}`,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8125rem',
              px: 2.5,
              py: 0.75,
              border: 'none',
              color: theme.colors.textSecondary,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                backgroundColor: 'rgba(0,51,102,0.04)',
                color: theme.colors.primary
              },
              '&.Mui-selected': {
                backgroundColor: theme.colors.primary,
                color: '#fff !important',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.15)',
                '&:hover': {
                  backgroundColor: theme.colors.primaryDark
                }
              }
            }
          }}
        >
          <ToggleButton value="sites">
            <Stack direction="row" spacing={0.75} alignItems="center">
              <SiteIcon sx={{ fontSize: 18 }} />
              <span>Charging sites</span>
            </Stack>
          </ToggleButton>
          <ToggleButton value="equipment">
            <Stack direction="row" spacing={0.75} alignItems="center">
              <EvStationIcon sx={{ fontSize: 18 }} />
              <span>FSE Coordinates</span>
            </Stack>
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>
    </Stack>
  )

  // Show error state for initial load errors
  if (isError && !data)
    return (
      <Box>
        <PageHeader stats={null} action={headerActions} />
        <ErrorState error={error} onRetry={refetch} />
      </Box>
    )

  return (
    <>
      <style>{MAP_STYLES}</style>
      <Box
        ref={contentRef}
        sx={{
          // On large desktop (xl), constrain height to prevent scrolling with fixed map
          maxHeight: { xs: 'none', xl: 'calc(100vh - 200px)' },
          overflow: { xs: 'visible', xl: 'auto' }
        }}
      >
        <PageHeader stats={stats} action={null} />
      </Box>

      {/* Map Container - All screen sizes - Scrolls with page when collapsed, fixed when expanded */}
      <Box
        sx={{
          display: 'flex',
          position: isMapExpanded ? 'fixed' : 'relative',
          ...(isMapExpanded
            ? {
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1200
              }
            : {
                mx: MAP_STYLES_CONSTANTS.spacing.containerMx,
                mb: MAP_STYLES_CONSTANTS.spacing.containerMb,
                mt: 2,
                height: '600px'
              }),
          flexDirection: 'column',
          boxShadow: isMapExpanded
            ? MAP_STYLES_CONSTANTS.shadows.expanded
            : MAP_STYLES_CONSTANTS.shadows.collapsed,
          border: isMapExpanded
            ? 'none'
            : `1px solid ${MAP_STYLES_CONSTANTS.colors.border}`,
          backgroundColor: MAP_STYLES_CONSTANTS.colors.white,
          transition: isMapExpanded
            ? MAP_STYLES_CONSTANTS.transitions.expand
            : MAP_STYLES_CONSTANTS.transitions.collapse,
          borderRadius: isMapExpanded
            ? MAP_STYLES_CONSTANTS.borderRadius.expanded
            : MAP_STYLES_CONSTANTS.borderRadius.collapsed,
          overflow: isMapExpanded ? 'hidden' : 'visible',
          pt: isMapExpanded ? 0 : 2
        }}
      >
        {/* Map Header Bar */}
        <Box
          sx={{
            flexShrink: 0,
            backgroundColor: MAP_STYLES_CONSTANTS.colors.filterBg,
            pb: isMapExpanded ? 0 : 1
          }}
        >
          {/* Top Row - Title and Toggle */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: isMapExpanded ? 2 : 3,
              py: isMapExpanded ? 1.25 : 1,
              backgroundColor: MAP_STYLES_CONSTANTS.colors.headerBg,
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: MAP_STYLES_CONSTANTS.colors.headerBgHover
              },
              transition: 'background-color 0.2s ease',
              borderRadius: isMapExpanded
                ? MAP_STYLES_CONSTANTS.borderRadius.expanded
                : MAP_STYLES_CONSTANTS.borderRadius.collapsed,
              width: isMapExpanded
                ? '100%'
                : MAP_STYLES_CONSTANTS.spacing.headerPillWidth,
              margin: isMapExpanded
                ? MAP_STYLES_CONSTANTS.spacing.headerMarginExpanded
                : MAP_STYLES_CONSTANTS.spacing.headerMarginCollapsed,
              position: 'relative',
              zIndex: 2
            }}
            onClick={() => {
              if (isMapExpanded) {
                // Save scroll position before collapsing
                scrollPositionRef.current = window.scrollY
              }
              setIsMapExpanded(!isMapExpanded)

              if (isMapExpanded) {
                // Restore scroll position after collapsing
                setTimeout(() => {
                  window.scrollTo(0, scrollPositionRef.current)
                }, 50)
              }
            }}
            role="button"
            aria-label={isMapExpanded ? 'Collapse map' : 'Expand map'}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                if (isMapExpanded) {
                  scrollPositionRef.current = window.scrollY
                }
                setIsMapExpanded(!isMapExpanded)

                if (isMapExpanded) {
                  setTimeout(() => {
                    window.scrollTo(0, scrollPositionRef.current)
                  }, 50)
                }
              }
            }}
          >
            <Stack direction="row" spacing={1.25} alignItems="center">
              <MapIcon sx={{ color: 'white !important', fontSize: 18 }} />
              <BCTypography
                variant="body2"
                sx={{
                  color: 'white !important',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  letterSpacing: '0.005em'
                }}
              >
                {viewMode === 'sites' ? 'Charging sites' : 'FSE Ccordinates'}
              </BCTypography>
              <Box
                sx={{
                  height: 20,
                  width: '1px',
                  backgroundColor: 'rgba(255,255,255,0.3)',
                  mx: 0.5
                }}
              />
              <BCTypography
                variant="body2"
                sx={{
                  color: 'rgba(255,255,255,0.9) !important',
                  fontWeight: 500,
                  fontSize: '0.8125rem'
                }}
              >
                {stats.totalSites} {stats.totalSites === 1 ? 'site' : 'sites'} •{' '}
                {stats.totalEquipment} equipment
              </BCTypography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title={isMapExpanded ? 'Collapse map' : 'Expand map'}>
                <IconButton
                  size="small"
                  sx={{
                    color: 'white !important',
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    p: 0.6,
                    '&:hover': {
                      backgroundColor: 'rgba(255,255,255,0.25)'
                    }
                  }}
                >
                  {isMapExpanded ? (
                    <KeyboardArrowDown
                      sx={{ color: 'white !important', fontSize: 22 }}
                    />
                  ) : (
                    <KeyboardArrowUp
                      sx={{ color: 'white !important', fontSize: 22 }}
                    />
                  )}
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          {/* Bottom Row - Filters */}
          <Box
            sx={{
              px: 3,
              py: isMapExpanded ? 2 : 1,
              backgroundColor: MAP_STYLES_CONSTANTS.colors.filterBg
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={{ xs: 2, md: 3 }}
              alignItems={{ xs: 'stretch', md: 'center' }}
              sx={{
                gap: { xs: 1.5, md: 2 }
              }}
            >
              {/* Organization Filter - only for government users */}
              {isGovernmentUser && (
                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  sx={{
                    flex: { xs: 'unset', md: 1 },
                    width: { xs: '100%', md: 'auto' },
                    minWidth: { xs: 'unset', md: 300 }
                  }}
                >
                  <BCTypography
                    sx={{
                      fontSize: '0.875rem',
                      color: theme.colors.text,
                      fontWeight: 600,
                      flexShrink: 0
                    }}
                  >
                    Filter by:
                  </BCTypography>
                  <Autocomplete
                    options={organizationOptionsWithAll}
                    loading={isLoadingOrganizations}
                    value={selectedOrgOption}
                    onChange={handleOrganizationChange}
                    getOptionLabel={getOptionLabel}
                    isOptionEqualToValue={isOptionEqualToValue}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Select organization"
                        size="small"
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {isLoadingOrganizations ? (
                                <CircularProgress color="inherit" size={16} />
                              ) : null}
                              {params.InputProps.endAdornment}
                            </>
                          )
                        }}
                        sx={{
                          minWidth: 320,
                          '& .MuiOutlinedInput-root': {
                            fontSize: '0.875rem',
                            backgroundColor: '#fff',
                            borderRadius: '6px',
                            '& fieldset': {
                              borderColor: theme.colors.border
                            },
                            '&:hover fieldset': {
                              borderColor: theme.colors.primary
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: theme.colors.primary,
                              borderWidth: '2px'
                            }
                          }
                        }}
                      />
                    )}
                    sx={{ flex: 1 }}
                  />
                </Stack>
              )}

              {/* Divider between filters */}
              {isGovernmentUser && (
                <Divider
                  orientation="vertical"
                  flexItem
                  sx={{
                    height: 50,
                    alignSelf: 'center',
                    borderColor: theme.colors.border,
                    display: { xs: 'none', md: 'block' },
                    '@media (max-width: 840px)': {
                      display: 'none'
                    }
                  }}
                />
              )}

              {/* Display Mode Toggle */}
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{
                  width: { xs: '100%', md: 'auto' },
                  justifyContent: { xs: 'center', md: 'flex-start' }
                }}
              >
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  size="small"
                  onChange={(_, value) => value && setViewMode(value)}
                  sx={{
                    backgroundColor: '#fff',
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.border}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    '& .MuiToggleButton-root': {
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      px: 2.5,
                      py: 0.85,
                      border: 'none',
                      color: theme.colors.textSecondary,
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        backgroundColor: 'rgba(0,51,102,0.04)',
                        color: theme.colors.primary
                      },
                      '&.Mui-selected': {
                        backgroundColor: theme.colors.primary,
                        color: '#fff !important',
                        boxShadow:
                          '0 2px 4px rgba(0,51,102,0.2), inset 0 1px 2px rgba(0,0,0,0.1)',
                        '&:hover': {
                          backgroundColor: theme.colors.primaryDark
                        }
                      }
                    }
                  }}
                >
                  <ToggleButton value="sites">
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <SiteIcon sx={{ fontSize: 18 }} />
                      <span>Charging sites</span>
                    </Stack>
                  </ToggleButton>
                  <ToggleButton value="equipment">
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <EvStationIcon sx={{ fontSize: 18 }} />
                      <span>FSE coordinates</span>
                    </Stack>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </Stack>
          </Box>
        </Box>

        {/* Map Content */}
        <Box
          sx={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: stats.totalSites === 0 ? '#f8f9fa' : 'transparent'
          }}
        >
          {showLoading ? (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.surfaceAlt,
                minHeight: 350
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <CircularProgress size={48} thickness={4} />
                <BCTypography
                  sx={{
                    mt: 2,
                    color: theme.colors.textSecondary,
                    fontWeight: 500
                  }}
                >
                  {isLoading ? 'Loading map data...' : 'Updating map...'}
                </BCTypography>
              </Box>
            </Box>
          ) : stats.totalSites === 0 ? (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f8f9fa',
                minHeight: 350
              }}
            >
              <EmptyState />
            </Box>
          ) : (
            <MapContainer
              key="fse-map-desktop"
              center={BC_CENTER}
              zoom={DEFAULT_ZOOM}
              style={{ height: '100%', width: '100%' }}
              whenReady={(mapInstance) => {
                // Ensure map is properly sized when ready
                setTimeout(() => {
                  mapInstance.target?.invalidateSize()
                }, 100)
              }}
            >
              {mapContent(false)}
            </MapContainer>
          )}
        </Box>
      </Box>
    </>
  )
}

export default FSEFullMap
