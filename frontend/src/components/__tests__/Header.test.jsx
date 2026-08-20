import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import HeaderBar from '@/components/BCNavbar/components/HeaderBar'

// Mock heavy image assets so they don't cause import errors
vi.mock('@/assets/images/logo-banner.svg', () => ({ default: 'logo-banner.svg' }))

// Mock MUI components used inside HeaderBar so the test does not require a
// full theme setup for Toolbar / Icon internals.
vi.mock('@mui/material', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    Toolbar: ({ children, sx, ...props }) => (
      <div data-test="toolbar" {...props}>
        {children}
      </div>
    ),
    Icon: ({ children, fontSize }) => (
      <span data-test="menu-icon" data-fontsize={fontSize}>
        {children}
      </span>
    )
  }
})

vi.mock('@/components/BCBox', () => ({
  __esModule: true,
  default: ({ children, component, className, sx, display, ...props }) => (
    <div className={className} {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/BCTypography', () => ({
  __esModule: true,
  default: ({ children, component, variant, className, color, sx, ...props }) => (
    <span className={className} data-variant={variant} {...props}>
      {children}
    </span>
  )
}))

// Minimal popup-state stub; HeaderBar calls bindTrigger(popupState) to attach
// open/close handlers to the mobile hamburger icon container.
const makePopupState = (isOpen = false) => ({
  isOpen,
  open: vi.fn(),
  close: vi.fn(),
  toggle: vi.fn(),
  setOpen: vi.fn(),
  anchorEl: null,
  popupId: 'test-popup'
})

const baseData = {
  title: 'Low Carbon Fuel Standard',
  beta: false,
  routes: [],
  headerRightPart: null,
  menuRightPart: null
}

const renderHeader = (overrides = {}) => {
  const props = {
    data: baseData,
    popupState: makePopupState(),
    isMobileView: false,
    ...overrides
  }
  return render(
    <ThemeProvider theme={theme}>
      <HeaderBar {...props} />
    </ThemeProvider>
  )
}

describe('HeaderBar', () => {
  it('renders the BC Government logo image', () => {
    renderHeader()
    const logo = screen.getByAltText('BC Government')
    expect(logo).toBeInTheDocument()
    expect(logo).toHaveAttribute('src', 'logo-banner.svg')
  })

  it('renders the application title', () => {
    renderHeader()
    expect(screen.getByText('Low Carbon Fuel Standard')).toBeInTheDocument()
  })

  it('renders a "Beta" label when beta is true', () => {
    renderHeader({ data: { ...baseData, beta: true } })
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('does not render a "Beta" label when beta is false', () => {
    renderHeader({ data: { ...baseData, beta: false } })
    expect(screen.queryByText('Beta')).not.toBeInTheDocument()
  })

  it('renders the headerRightPart content when provided', () => {
    const rightPart = <span data-test="right-part">User Info</span>
    renderHeader({ data: { ...baseData, headerRightPart: rightPart } })
    expect(screen.getByTestId('right-part')).toBeInTheDocument()
  })

  it('renders a menu icon for mobile navigation toggle', () => {
    renderHeader({ isMobileView: true })
    expect(screen.getByTestId('menu-icon')).toBeInTheDocument()
  })

  it('shows a "menu" icon when the popup is closed', () => {
    renderHeader({ popupState: makePopupState(false) })
    expect(screen.getByTestId('menu-icon')).toHaveTextContent('menu')
  })

  it('shows a "close" icon when the popup is open', () => {
    renderHeader({ popupState: makePopupState(true) })
    expect(screen.getByTestId('menu-icon')).toHaveTextContent('close')
  })

  it('renders within a Toolbar container', () => {
    renderHeader()
    expect(screen.getByTestId('toolbar')).toBeInTheDocument()
  })
})
