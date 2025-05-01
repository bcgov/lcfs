// @mui material components
import { createTheme } from '@mui/material/styles'
// base styles
import breakpoints from './base/breakpoints'
import boxShadows from './base/boxShadows'
import borders from './base/borders'
import colors from './base/colors'
import typography from './base/typography'
import globals from './base/globals'
// helper functions
import { boxShadow, hexToRgb, linearGradient, pxToRem, rgba } from './utils'
// components base styles for @mui material components
import sidenav from './components/sidenav'
import card from './components/card'
import cardMedia from './components/card/cardMedia'
import cardContent from './components/card/cardContent'
import button from './components/button'
import iconButton from './components/iconButton'
import input from './components/form/input'
import inputLabel from './components/form/inputLabel'
import inputOutlined from './components/form/inputOutlined'
import textField from './components/form/textField'
import menu from './components/menu'
import menuItem from './components/menu/menuItem'
import switchButton from './components/form/switchButton'
import tableContainer from './components/table/tableContainer'
import tableHead from './components/table/tableHead'
import tableCell from './components/table/tableCell'
import linearProgress from './components/linearProgress'
import breadcrumbs from './components/breadcrumbs'
import slider from './components/slider'
import avatar from './components/avatar'
import tooltip from './components/tooltip'
import appBar from './components/appBar'
import tabs from './components/tabs'
import tab from './components/tabs/tab'
import select from './components/form/select'
import formControlLabel from './components/form/formControlLabel'
import formLabel from './components/form/formLabel'
import checkbox from './components/form/checkbox'
import radio from './components/form/radio'
import autocomplete from './components/form/autocomplete'
import container from './components/container'
import popover from './components/popover'
import buttonBase from './components/buttonBase'
// import icon from './components/icon";
import svgIcon from './components/svgIcon'
import link from './components/link'
import dialog from './components/dialog'
import dialogTitle from './components/dialog/dialogTitle'
import dialogContent from './components/dialog/dialogContent'
import dialogContentText from './components/dialog/dialogContentText'
import dialogActions from './components/dialog/dialogActions'

export default createTheme({
  breakpoints: { ...breakpoints },
  palette: { ...colors },
  typography: { ...typography },
  boxShadows: { ...boxShadows },
  borders: { ...borders },
  functions: {
    boxShadow,
    hexToRgb,
    linearGradient,
    pxToRem,
    rgba
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ...globals,
        ...container
      }
    },
    MuiButton: { ...button },
    MuiDrawer: { ...sidenav },
    MuiCard: { ...card },
    MuiCardMedia: { ...cardMedia },
    MuiCardContent: { ...cardContent },
    MuiIconButton: { ...iconButton },
    MuiInput: { ...input },
    MuiInputLabel: { ...inputLabel },
    MuiOutlinedInput: { ...inputOutlined },
    MuiTextField: { ...textField },
    MuiMenu: { ...menu },
    MuiMenuItem: { ...menuItem },
    MuiSwitch: { ...switchButton },
    MuiTableContainer: { ...tableContainer },
    MuiTableHead: { ...tableHead },
    MuiTableCell: { ...tableCell },
    MuiLinearProgress: { ...linearProgress },
    MuiBreadcrumbs: { ...breadcrumbs },
    MuiSlider: { ...slider },
    MuiAvatar: { ...avatar },
    MuiTooltip: { ...tooltip },
    MuiAppBar: { ...appBar },
    MuiTabs: { ...tabs },
    MuiTab: { ...tab },
    MuiSelect: { ...select },
    MuiFormControlLabel: { ...formControlLabel },
    MuiFormLabel: { ...formLabel },
    MuiCheckbox: { ...checkbox },
    MuiRadio: { ...radio },
    MuiAutocomplete: { ...autocomplete },
    MuiPopover: { ...popover },
    MuiButtonBase: { ...buttonBase },
    // MuiIcon: { ...icon },
    MuiSvgIcon: { ...svgIcon },
    MuiLink: { ...link },
    MuiDialog: { ...dialog },
    MuiDialogTitle: { ...dialogTitle },
    MuiDialogContent: { ...dialogContent },
    MuiDialogContentText: { ...dialogContentText },
    MuiDialogActions: { ...dialogActions }
  }
})
