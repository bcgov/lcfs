import * as materialUi from '@mui/material'
import * as datePickers from '@mui/x-date-pickers'
import * as dateFnsAdapter from '@mui/x-date-pickers/AdapterDateFnsV3'
import * as reactQuery from '@tanstack/react-query'
import * as routerDom from 'react-router-dom'
import * as router from 'react-router'
import * as reactI18next from 'react-i18next'
import testI18n from './capabilities/testI18n'

const readExport = (module, name) => {
  try {
    return module[name]
  } catch {
    return undefined
  }
}

const CssBaseline = readExport(materialUi, 'CssBaseline')
const ThemeProvider = readExport(materialUi, 'ThemeProvider')
const LocalizationProvider = readExport(datePickers, 'LocalizationProvider')
const AdapterDateFns = readExport(dateFnsAdapter, 'AdapterDateFns')
const Router = readExport(routerDom, 'MemoryRouter') || router.MemoryRouter
const QueryClient = readExport(reactQuery, 'QueryClient')
const QueryClientProvider = readExport(reactQuery, 'QueryClientProvider')
const I18nextProvider = readExport(reactI18next, 'I18nextProvider')

const legacyTheme = {
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#9c27b0' },
    light: { main: '#f5f5f5' },
    text: { main: '#212121', primary: '#212121', secondary: '#757575' },
    white: { main: '#ffffff' },
    black: { main: '#000000' },
    transparent: { main: 'transparent' },
    gradients: {}
  },
  functions: {
    boxShadow: () => 'none',
    linearGradient: () => 'none',
    pxToRem: (value) => `${value / 16}rem`,
    rgba: () => 'transparent',
    hexToRgb: () => '0, 0, 0'
  },
  borders: {
    borderRadius: {},
    borderWidth: {},
    borderColor: '#dee2e6'
  },
  boxShadows: { colored: {} },
  typography: {},
  components: {}
}

const theme = await import('@/themes')
  .then(({ default: loadedTheme }) => loadedTheme)
  .catch(() => legacyTheme)
const hasLoadedTheme = theme !== legacyTheme

const queryClientOptions = {
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: false
    },
    mutations: {
      retry: false
    }
  }
}

export const createTestQueryClient = () =>
  QueryClient ? new QueryClient(queryClientOptions) : undefined

export const wrapper = ({ children }) => {
  const queryClient = createTestQueryClient()
  let content =
    QueryClientProvider && queryClient ? (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ) : (
      children
    )

  if (Router) {
    content = <Router>{content}</Router>
  }
  if (LocalizationProvider && AdapterDateFns) {
    content = (
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        {content}
      </LocalizationProvider>
    )
  }
  if (ThemeProvider) {
    content = (
      <ThemeProvider theme={theme}>
        {CssBaseline && hasLoadedTheme ? <CssBaseline /> : null}
        {content}
      </ThemeProvider>
    )
  }

  if (I18nextProvider) {
    content = <I18nextProvider i18n={testI18n}>{content}</I18nextProvider>
  }

  return content
}
