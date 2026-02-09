/**
 * @file constants.js
 * @description Constants and configuration for FSE Map components
 */
import {
  Check as CheckIcon,
  Schedule as PendingIcon,
  Edit as DraftIcon,
  Block as BlockIcon
} from '@mui/icons-material'

/**
 * Theme configuration following BC Government design standards
 */
export const theme = {
  colors: {
    // Primary palette
    primary: '#003366',
    primaryLight: '#1a5a96',
    primaryDark: '#002147',

    // Accent
    accent: '#fcba19',
    accentDark: '#e6a800',

    // Neutrals
    text: '#313132',
    textSecondary: '#5c5c5c',
    textMuted: '#868e96',

    // Backgrounds
    surface: '#ffffff',
    surfaceAlt: '#f8f9fa',
    surfaceHover: '#f1f3f5',

    // Borders
    border: '#dee2e6',
    borderLight: '#e9ecef',

    // Status
    success: '#2e7d32',
    successBg: '#e8f5e9',
    warning: '#ed6c02',
    warningBg: '#fff4e5',
    error: '#d32f2f',
    errorBg: '#ffebee',
    info: '#0288d1',
    infoBg: '#e1f5fe'
  },
  shadows: {
    sm: '0 1px 3px rgba(0,0,0,0.08)',
    md: '0 4px 12px rgba(0,0,0,0.1)',
    lg: '0 8px 24px rgba(0,0,0,0.12)',
    popup: '0 12px 40px rgba(0,0,0,0.15)'
  },
  radius: {
    sm: 2,
    md: 4,
    lg: 4
  }
}

/**
 * Status configuration for FSE equipment states
 * Maps status to display properties and marker colors
 */
export const STATUS_CONFIG = {
  Validated: {
    color: theme.colors.success,
    bg: theme.colors.successBg,
    icon: CheckIcon,
    labelKey: 'map.validated',
    markerColor: 'green'
  },
  Submitted: {
    color: theme.colors.info,
    bg: theme.colors.infoBg,
    icon: PendingIcon,
    labelKey: 'map.submitted',
    markerColor: 'blue'
  },
  Draft: {
    color: theme.colors.textSecondary,
    bg: theme.colors.surfaceAlt,
    icon: DraftIcon,
    labelKey: 'map.draft',
    markerColor: 'grey'
  },
  Updated: {
    color: theme.colors.warning,
    bg: theme.colors.warningBg,
    icon: DraftIcon,
    labelKey: 'map.updated',
    markerColor: 'orange'
  },
  Decommissioned: {
    color: theme.colors.error,
    bg: theme.colors.errorBg,
    icon: BlockIcon,
    labelKey: 'map.decommissioned',
    markerColor: 'red'
  }
}

/**
 * Charging level display mappings
 */
export const CHARGING_LEVELS = {
  1: { fullKey: 'map.level1', short: 'L1' },
  2: { fullKey: 'map.level2', short: 'L2' },
  3: { fullKey: 'map.level3', short: 'L3' },
  DCFC: { fullKey: 'map.dcFastCharging', short: 'DCFC' },
  'Level 1': { fullKey: 'map.level1', short: 'L1' },
  'Level 2': { fullKey: 'map.level2', short: 'L2' },
  'Level 3': { fullKey: 'map.level3', short: 'L3' },
  L1: { fullKey: 'map.level1', short: 'L1' },
  L2: { fullKey: 'map.level2', short: 'L2' },
  L3: { fullKey: 'map.level3', short: 'L3' }
}

/**
 * Map configuration
 */
export const BC_CENTER = [53.7267, -127.6476]
export const DEFAULT_ZOOM = 5

/**
 * Map styles CSS
 */
export const MAP_STYLES = `
  .fse-marker-cluster {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    font-weight: 600;
    font-family: 'BCSans', -apple-system, BlinkMacSystemFont, sans-serif;
    color: white;
    background: ${theme.colors.primary};
    border: 2px solid white;
    box-shadow: ${theme.shadows.sm};
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .fse-marker-cluster:hover {
    transform: scale(1.05);
    background: ${theme.colors.primaryDark};
  }
  .cluster-sm { width: 32px; height: 32px; font-size: 12px; }
  .cluster-md { width: 40px; height: 40px; font-size: 13px; }
  .cluster-lg { width: 48px; height: 48px; font-size: 14px; }
  .cluster-xl { width: 56px; height: 56px; font-size: 15px; }
  
  .leaflet-popup-content-wrapper {
    border-radius: ${theme.radius.sm}px !important;
    box-shadow: ${theme.shadows.popup} !important;
    padding: 0 !important;
    overflow: hidden;
    border: none !important;
  }
  .leaflet-popup-content { 
    margin: 0 !important; 
    width: auto !important;
  }
  .leaflet-popup-tip { display: none; }
  .leaflet-popup-close-button { display: none !important; }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
`
