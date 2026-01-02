import colors from './colors'
import { rgba, pxToRem } from '../utils'
import BCSansRegularTTF from '@bcgov/bc-sans/fonts/BCSans-Regular.woff2'
import BCSansBoldTTF from '@bcgov/bc-sans/fonts/BCSans-Bold.woff2'
import BCSansBoldItalicTTF from '@bcgov/bc-sans/fonts/BCSans-BoldItalic.woff2'
import BCSansItalicTTF from '@bcgov/bc-sans/fonts/BCSans-Italic.woff2'
import BCSansLightTTF from '@bcgov/bc-sans/fonts/BCSans-Light.woff2'
import BCSansLightItalicTTF from '@bcgov/bc-sans/fonts/BCSans-LightItalic.woff2'
import bceidImg from '@/assets/images/bceid.png'
import loadingImg from '@/assets/images/logo_loading.svg'

const { info, link, background, primary, light, dark, white, grey } = colors

const bcSansRegular = {
  fontFamily: 'BCSans',
  fontStyle: 'normal',
  src: `url(${BCSansRegularTTF}) format('woff2')`
}

const bcSansBold = {
  fontFamily: 'BCSans',
  fontWeight: 700,
  src: `url(${BCSansBoldTTF}) format('woff2')`
}

const bcSansBoldItalic = {
  fontFamily: 'BCSans',
  fontWeight: 700,
  fontStyle: 'italic',
  src: `url(${BCSansBoldItalicTTF}) format('woff2')`
}

const bcSansItalic = {
  fontFamily: 'BCSans',
  fontStyle: 'italic',
  src: `url(${BCSansItalicTTF}) format('woff2')`
}

const bcSansLight = {
  fontFamily: 'BCSans',
  fontStyle: 'italic',
  src: `url(${BCSansLightTTF}) format('woff2')`
}

const bcSansLightItalic = {
  fontFamily: 'BCSans',
  fontStyle: 'italic',
  src: `url(${BCSansLightItalicTTF}) format('woff2')`
}

const globals = {
  html: [
    { scrollBehavior: 'smooth' },
    { '@font-face': bcSansRegular },
    { '@font-face': bcSansBold },
    { '@font-face': bcSansBoldItalic },
    { '@font-face': bcSansItalic },
    { '@font-face': bcSansLight },
    { '@font-face': bcSansLightItalic }
  ],
  '*, *::before, *::after': {
    margin: 0,
    padding: 0
  },
  '#root': {
    backgroundColor: background.paper
  },
  'a, a:link, a:visited': {
    textDecoration: 'none !important'
  },
  'a.link, .link, a.link:link, .link:link, a.link:visited, .link:visited': {
    color: `${link.main} !important`,
    transition: 'color 150ms ease-in !important'
  },
  'a.link:hover, .link:hover, a.link:focus, .link:focus': {
    color: `${info.main} !important`
  },
  '.ag-theme-alpine': {
    '--ag-odd-row-background-color': rgba(light.main, 0.6),
    '--ag-font-size': pxToRem(16),
    '--ag-color': rgba(dark.main, 0.9),
    '--ag-font-family':
      "'BCSans', 'Noto Sans', 'Verdana', 'Arial', 'sans-serif'",
    '--ag-row-hover-color': rgba(background.secondary, 1)
  },
  '.ag-theme-material': {
    '--ag-header-column-resize-handle-display': 'block',
    '--ag-header-column-resize-handle-height': '30%',
    '--ag-header-column-resize-handle-width': '2px',
    '--ag-header-column-resize-handle-color': '#dde2eb',
    '--ag-material-accent-color': grey[700],
    '--ag-borders': `1px solid ${grey[700]}`,
    '--ag-border-color': grey[700],
    '--ag-odd-row-background-color': rgba(light.main, 0.6),
    '--ag-header-background-color': background.grey,
    '--ag-font-size': pxToRem(16),
    '--ag-color': rgba(dark.main, 0.9),
    '--ag-font-family':
      "'BCSans', 'Noto Sans', 'Verdana', 'Arial', 'sans-serif'",
    '--ag-row-hover-color': rgba(background.secondary, 1)
  },
  '.bc-grid-container': {
    width: '100%'
  },
  '.bc-grid-container .ag-grid-pagination-container': {
    border: 'none',
    borderBottom: `1px solid ${grey[700]}`,
    maxHeight: 'unset'
  },
  '.bc-grid-container .ag-grid-pagination-container .MuiTablePagination-toolbar':
    {
      overflow: 'hidden'
    },
  '.ag-theme-material .ag-floating-filter-input': {
    backgroundColor: white.main
  },
  '.ag-theme-material .bc-column-set-filter .MuiOutlinedInput-notchedOutline': {
    border: 'none',
    borderBottom: '2px solid #495057'
  },
  '.unread-row': {
    fontWeight: 700,
    color: grey[700]
  },
  '.select-container': {
    fontFamily: "'BCSans', 'Noto Sans', 'Verdana', 'Arial', 'sans-serif'",
    fontSize: '1.6rem',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    border: 'none',
    borderBottom: '2px solid #495057',
    borderRadius: '0px',
    padding: '0px',
    background: '#fff',
    transition: 'border-color 0.3s ease-in-out, box-shadow 0.3s ease-in-out'
  },
  '.select-container:focus-within': {
    border: '2px solid #495057',
    borderWidth: '0px 0.01rem'
  },
  '.select-container #select-filter': {
    width: '100%',
    padding: '11px',
    border: 'none',
    outline: 'none',
    appearance: 'none',
    background: 'transparent'
  },
  '.select-container option': {
    fontSize: '1rem',
    fontFamily: 'inherit'
  },
  // editor theme for ag-grid quertz theme
  '.ag-theme-quartz': {
    '--ag-borders': `0.5px solid ${grey[400]} !important`,
    '--ag-input-focus-border-color': primary.main,
    '--ag-header-background-color': background.grey,
    '--ag-font-size': pxToRem(16),
    '--ag-color': rgba(dark.main, 0.9),
    '--ag-font-family':
      "'BCSans', 'Noto Sans', 'Verdana', 'Arial', 'sans-serif'",
    '--ag-row-hover-color': rgba(background.secondary, 1),
    '--ag-background-color': white.main
  },
  '.ag-theme-quartz .ag-header-cell-label': {
    justifyContent: 'center'
  },
  '.ag-theme-quartz .ag-cell:focus, .ag-input-field-input:focus, .ag-picker-field-wrapper:focus':
    {
      border: `2px solid ${primary.main} !important`
    },
  '.ag-theme-quartz .ag-row-editing': {
    '--ag-row-hover-color': white.main
  },
  '.ag-theme-quartz .ag-header-cell': {
    fontWeight: 600,
    color: grey[700]
  },
  '.ag-theme-quartz .ag-header-cell, .ag-theme-quartz .ag-cell, .ag-theme-quartz .MuiOutlinedInput-notchedOutline':
    {
      border: `0.5px solid ${grey[500]}`,
      borderRadius: '4px'
    },
  '.ag-theme-quartz .ag-grid-date-editor input': {
    paddingBottom: '8px'
  },
  '.ag-theme-quartz .ag-grid-date-editor': {
    width: '200px',
    height: '100%'
  },
  '.ag-theme-quartz .ag-center-cols-viewport': {
    minHeight: 'unset !important'
  },
  '.ag-theme-quartz .ag-cell-focus:not(.ag-cell-range-selected, .ag-cell-inline-editing):focus-within':
    {
      border: `2px solid ${link.focus}`
    },
  '.ag-theme-material .ag-header-row,': {
    borderTop: `1px solid ${grey[700]}`
  },
  '.ag-theme-material .ag-row-hover': {
    cursor: 'pointer'
  },
  // Expand checkbox click target area - make entire cell clickable
  '.ag-theme-material .ag-cell[col-id="__select__"], .ag-theme-material .ag-cell[col-id="ag-Grid-SelectionColumn"]':
    {
      cursor: 'pointer'
    },
  '.ag-theme-quartz .ag-cell[col-id="__select__"], .ag-theme-quartz .ag-cell[col-id="ag-Grid-SelectionColumn"]':
    {
      cursor: 'pointer'
    },
  '.ag-overlay-loading-center-box': {
    height: 100,
    width: 150,
    background: `url(${loadingImg}) center / contain no-repeat`,
    margin: '0 auto'
  },
  '.ag-header-cell-filtered, .ag-header-cell-sorted-asc, .ag-header-cell-sorted-desc':
    {
      backgroundColor: rgba(dark.main, 0.1)
    },
  '.ag-header-cell-sorted-asc': {
    borderTop: `2px solid ${primary.main}`
  },
  '.ag-header-cell-sorted-desc': {
    borderBottom: `2px solid ${primary.main}`
  },
  '.ag-paging-panel': {
    justifyContent: 'flex-start'
  },
  '.ag-popup-child:not(.ag-tooltip-custom)': {
    boxShadow: 'none'
  },
  '#bc-column-set-filter-listbox, #organizations-listbox, .MuiMenu-list': {
    '& > li:hover, & > li:focus, & > li:blur': {
      backgroundColor: primary.light,
      color: white.main
    }
  },
  '.MuiTablePagination-toolbar': {
    display: 'flex',
    padding: '18px 2px 18px 24px'
  },
  '.ag-grid-pagination': {
    fontSize: '0.875rem'
  },
  '.ag-grid-pagination .MuiInputBase-root': {
    border: `1.2px solid ${grey[500]}`,
    borderRadius: '0.3rem',
    padding: '0.1rem',
    width: '60px'
  },
  '.MuiButton-root': {
    height: pxToRem(39),
    padding: '6px 12px'
  },
  '.svg-icon-button .MuiSvgIcon-root': {
    height: pxToRem(22),
    width: pxToRem(22)
  },

  '.MuiPaper-elevation': {
    border: `1.2px solid ${grey[500]}`
  },
  '.bceid-name': {
    textIndent: '-9999px',
    backgroundImage: `url(${bceidImg})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'contain',
    height: '1.15rem',
    width: '6rem'
  },
  'a .leaflet-attribution-flag': {
    visibility: 'hidden'
  },
  '#link-idir': {
    textAlign: 'right',
    color: `${primary.main}`,
    '&:hover': {
      color: `${light.main}`
    }
  },
  '.small-icon': {
    width: '1rem',
    height: '1rem'
  },
  '#bc-column-set-filter-listbox, #organizations-listbox': {
    '& > li:hover, & > li:focus, & > li:blur': {
      backgroundColor: primary.light,
      color: white.main
    }
  },
  '.visually-hidden': {
    position: 'absolute',
    width: '1px',
    height: '1px',
    margin: '-1px',
    padding: 0,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    border: 0,
    whiteSpace: 'nowrap'
  }
}

export default globals
