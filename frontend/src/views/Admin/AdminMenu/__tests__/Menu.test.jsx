import { render, fireEvent, act } from '@testing-library/react'
import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { AdminMenu } from '../Menu'

const mockNavigate = vi.fn()
const mockT = vi.fn((key) => key)

const mockLocation = { pathname: '/admin/users' }

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT })
}))

vi.mock('@/routes/routes', () => ({
  ROUTES: {
    ADMIN: {
      USERS: { LIST: '/admin/users' },
      USER_ACTIVITY: '/admin/user-activity',
      USER_LOGIN_HISTORY: '/admin/user-login-history',
      AUDIT_LOG: { LIST: '/admin/audit-log' },
      LOGIN_SCREEN_BACKGROUND: '/admin/login-screen-background',
      SEEDED_USER_ASSOCIATION: '/admin/seeded-user-association'
    }
  }
}))

vi.mock('@/themes/base/breakpoints', () => ({
  default: {
    values: {
      lg: 1200
    }
  }
}))

vi.mock('@/components/BCBox', () => ({
  default: vi.fn(({ children, ...props }) => (
    <div data-test="bc-box" {...props}>
      {children}
    </div>
  ))
}))

vi.mock('@mui/material', () => ({
  AppBar: vi.fn(({ children, ...props }) => (
    <div data-test="app-bar" {...props}>
      {children}
    </div>
  )),
  Tabs: vi.fn(({ children, onChange, ...props }) => (
    <div
      data-test="tabs"
      data-orientation={props.orientation}
      data-value={props.value}
      onClick={(e) => onChange && onChange(e, 1)}
      {...props}
    >
      {children}
    </div>
  )),
  Tab: vi.fn(({ label, wrapped, ...props }) => (
    <button data-test="tab" data-wrapped={wrapped} {...props}>
      {label}
    </button>
  ))
}))

vi.mock('@/views/Admin/AdminMenu/components/AdminTabPanel', () => ({
  AdminTabPanel: vi.fn(({ children, value, index, ...props }) => (
    <div
      data-test="admin-tab-panel"
      data-value={value}
      data-index={index}
      style={{ display: value === index ? 'block' : 'none' }}
      {...props}
    >
      {children}
    </div>
  ))
}))

vi.mock('@/views/Admin/AdminMenu', () => ({
  Users: vi.fn(() => <div data-test="users">Users Component</div>),
  UserActivity: vi.fn(() => (
    <div data-test="user-activity">UserActivity Component</div>
  )),
  UserLoginHistory: vi.fn(() => (
    <div data-test="user-login-history">UserLoginHistory Component</div>
  )),
  AuditLog: vi.fn(() => <div data-test="audit-log">AuditLog Component</div>),
  LoginScreenBackground: vi.fn(() => (
    <div data-test="login-screen-background">LoginScreenBackground Component</div>
  )),
  SeededUserAssociation: vi.fn(() => (
    <div data-test="seeded-user-association">SeededUserAssociation Component</div>
  ))
}))

vi.mock('@/constants/roles', () => ({
  roles: {
    administrator: 'Administrator',
    system_admin: 'System Admin'
  }
}))

const mockHasRoles = vi.fn()
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    hasRoles: mockHasRoles,
    hasAnyRole: vi.fn(() => false),
    data: null,
    isLoading: false
  })
}))

vi.mock('@/constants/config', () => ({
  CONFIG: {
    ENVIRONMENT: 'production'
  }
}))

describe('AdminMenu Component', () => {
  const originalInnerWidth = window.innerWidth
  const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
  const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

  beforeEach(() => {
    vi.clearAllMocks()
    mockLocation.pathname = '/admin/users'
    mockHasRoles.mockImplementation(
      (role) => role === 'Administrator' || role === 'System Admin'
    )
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth
    })
  })

  describe('Component Rendering', () => {
    it('renders without crashing', () => {
      const { container } = render(<AdminMenu />)
      expect(container.querySelector('[data-test="bc-box"]')).toBeTruthy()
    })

    it('renders tabs for both administrator and system admin when user has both roles', () => {
      const { container } = render(<AdminMenu />)

      const tabs = container.querySelectorAll('[data-test="tab"]')
      expect(tabs).toHaveLength(5)
    })

    it('renders a tab panel for each visible tab', () => {
      const { container } = render(<AdminMenu />)

      const panels = container.querySelectorAll('[data-test="admin-tab-panel"]')
      expect(panels).toHaveLength(5)
    })

    it('returns nothing when the user has no admin-related roles', () => {
      mockHasRoles.mockReturnValue(false)
      const { container } = render(<AdminMenu />)
      expect(container.firstChild).toBeNull()
    })

    it('assigns sequential a11y ids to the rendered tabs', () => {
      const { container } = render(<AdminMenu />)

      const tabs = container.querySelectorAll('[data-test="tab"]')
      tabs.forEach((tab, index) => {
        expect(tab).toHaveAttribute('id', `full-width-tab-${index}`)
        expect(tab).toHaveAttribute(
          'aria-controls',
          `full-width-admin-tabs-${index}`
        )
      })
    })
  })

  describe('Role-based tab visibility', () => {
    it('shows only admin tabs for administrators without system admin', () => {
      mockHasRoles.mockImplementation((role) => role === 'Administrator')
      const { container } = render(<AdminMenu />)

      const tabs = container.querySelectorAll('[data-test="tab"]')
      expect(tabs).toHaveLength(4)

      expect(
        container.querySelector('[data-test="login-screen-background"]')
      ).toBeNull()
    })

    it('shows only the login screen background tab for system admins', () => {
      mockLocation.pathname = '/admin/login-screen-background'
      mockHasRoles.mockImplementation((role) => role === 'System Admin')
      const { container } = render(<AdminMenu />)

      const tabs = container.querySelectorAll('[data-test="tab"]')
      expect(tabs).toHaveLength(1)

      expect(
        container.querySelector('[data-test="login-screen-background"]')
      ).toBeTruthy()
      expect(container.querySelector('[data-test="users"]')).toBeNull()
    })
  })

  describe('Responsive Behavior', () => {
    it('sets horizontal orientation for large screens', async () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 1300,
        configurable: true
      })

      const { container } = render(<AdminMenu />)

      await act(async () => {
        fireEvent(window, new Event('resize'))
      })

      expect(container.querySelector('[data-test="tabs"]')).toHaveAttribute(
        'data-orientation',
        'horizontal'
      )
    })

    it('sets vertical orientation for small screens', async () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 800,
        configurable: true
      })

      const { container } = render(<AdminMenu />)

      await act(async () => {
        fireEvent(window, new Event('resize'))
      })

      expect(container.querySelector('[data-test="tabs"]')).toHaveAttribute(
        'data-orientation',
        'vertical'
      )
    })
  })

  describe('Event Handling', () => {
    it('adds and removes resize event listener', () => {
      const { unmount } = render(<AdminMenu />)

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'resize',
        expect.any(Function)
      )

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'resize',
        expect.any(Function)
      )
    })

    it('navigates to the second tab when its index is selected', async () => {
      const user = userEvent.setup()
      const { container } = render(<AdminMenu />)

      const tabs = container.querySelector('[data-test="tabs"]')
      await user.click(tabs)

      expect(mockNavigate).toHaveBeenCalledWith('/admin/user-activity')
    })
  })

  describe('Translation Integration', () => {
    it('uses translation function for tab labels', () => {
      render(<AdminMenu />)

      expect(mockT).toHaveBeenCalledWith('Users')
      expect(mockT).toHaveBeenCalledWith('UserActivity')
      expect(mockT).toHaveBeenCalledWith('UserLoginHistory')
      expect(mockT).toHaveBeenCalledWith('AuditLog')
      expect(mockT).toHaveBeenCalledWith('LoginScreenBackground')
    })
  })
})
