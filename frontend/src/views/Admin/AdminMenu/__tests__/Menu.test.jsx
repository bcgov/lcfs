import { render, fireEvent, act } from '@testing-library/react'
import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { AdminMenu } from '../Menu'

const mockNavigate = vi.fn()
const mockT = vi.fn((key) => key)

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
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
      AUDIT_LOG: { LIST: '/admin/audit-log' }
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

vi.mock('@/components/Role', () => ({
  Role: vi.fn(({ children, roles }) => (
    <div data-test="role" data-roles={roles?.join(',')}>
      {children}
    </div>
  ))
}))

vi.mock('@/views/Admin/AdminMenu', () => ({
  Users: vi.fn(() => <div data-test="users">Users Component</div>),
  UserActivity: vi.fn(() => <div data-test="user-activity">UserActivity Component</div>),
  UserLoginHistory: vi.fn(() => <div data-test="user-login-history">UserLoginHistory Component</div>),
  AuditLog: vi.fn(() => <div data-test="audit-log">AuditLog Component</div>)
}))

vi.mock('@/constants/roles', () => ({
  roles: {
    administrator: 'administrator'
  }
}))

describe('AdminMenu Component', () => {
  const originalInnerWidth = window.innerWidth
  const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
  const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

  beforeEach(() => {
    vi.clearAllMocks()
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

  describe('Accessibility', () => {
    it('renders tabs with correct accessibility attributes', () => {
      const { container } = render(<AdminMenu tabIndex={0} />)
      
      const tabs = container.querySelectorAll('[data-test="tab"]')
      expect(tabs).toHaveLength(4)
      
      tabs.forEach((tab, index) => {
        expect(tab).toHaveAttribute('id', `full-width-tab-${index}`)
        expect(tab).toHaveAttribute('aria-controls', `full-width-admin-tabs-${index}`)
      })
    })
  })

  describe('Component Rendering', () => {
    it('renders without crashing', () => {
      const { container } = render(<AdminMenu tabIndex={0} />)
      expect(container.querySelector('[data-test="bc-box"]')).toBeTruthy()
    })

    it('renders with different tabIndex values', () => {
      const { rerender, container } = render(<AdminMenu tabIndex={0} />)
      expect(container.querySelector('[data-test="tabs"]')).toHaveAttribute('data-value', '0')

      rerender(<AdminMenu tabIndex={1} />)
      expect(container.querySelector('[data-test="tabs"]')).toHaveAttribute('data-value', '1')

      rerender(<AdminMenu tabIndex={2} />)
      expect(container.querySelector('[data-test="tabs"]')).toHaveAttribute('data-value', '2')

      rerender(<AdminMenu tabIndex={3} />)
      expect(container.querySelector('[data-test="tabs"]')).toHaveAttribute('data-value', '3')
    })

    it('renders all tab components', () => {
      const { container } = render(<AdminMenu tabIndex={0} />)
      
      const tabs = container.querySelectorAll('[data-test="tab"]')
      expect(tabs).toHaveLength(4)
    })

    it('renders all admin tab panels', () => {
      const { container } = render(<AdminMenu tabIndex={0} />)
      
      const panels = container.querySelectorAll('[data-test="admin-tab-panel"]')
      expect(panels).toHaveLength(4)
    })
  })

  describe('Responsive Behavior', () => {
    it('sets horizontal orientation for large screens', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 1300, configurable: true })
      
      const { container } = render(<AdminMenu tabIndex={0} />)
      
      await act(async () => {
        fireEvent(window, new Event('resize'))
      })
      
      expect(container.querySelector('[data-test="tabs"]')).toHaveAttribute('data-orientation', 'horizontal')
    })

    it('sets vertical orientation for small screens', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true })
      
      const { container } = render(<AdminMenu tabIndex={0} />)
      
      await act(async () => {
        fireEvent(window, new Event('resize'))
      })
      
      expect(container.querySelector('[data-test="tabs"]')).toHaveAttribute('data-orientation', 'vertical')
    })
  })

  describe('Event Handling', () => {
    it('adds and removes resize event listener', () => {
      const { unmount } = render(<AdminMenu tabIndex={0} />)
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
      
      unmount()
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    })

    it('calls navigate when tab value changes', async () => {
      const user = userEvent.setup()
      const { container } = render(<AdminMenu tabIndex={0} />)
      
      const tabs = container.querySelector('[data-test="tabs"]')
      await user.click(tabs)
      
      expect(mockNavigate).toHaveBeenCalledWith('/admin/user-activity')
    })
  })

  describe('Translation Integration', () => {
    it('uses translation function for tab labels', () => {
      render(<AdminMenu tabIndex={0} />)
      
      expect(mockT).toHaveBeenCalledWith('Users')
      expect(mockT).toHaveBeenCalledWith('UserActivity')
      expect(mockT).toHaveBeenCalledWith('UserLoginHistory')
      expect(mockT).toHaveBeenCalledWith('AuditLog')
    })
  })

  describe('Role-based Rendering', () => {
    it('renders role component with administrator role', () => {
      const { container } = render(<AdminMenu tabIndex={0} />)
      
      const roleComponent = container.querySelector('[data-test="role"]')
      expect(roleComponent).toBeTruthy()
      expect(roleComponent).toHaveAttribute('data-roles', 'administrator')
    })

    it('renders all child components within role-protected panels', () => {
      const { container } = render(<AdminMenu tabIndex={0} />)
      
      expect(container.querySelector('[data-test="users"]')).toBeTruthy()
      expect(container.querySelector('[data-test="user-activity"]')).toBeTruthy()
      expect(container.querySelector('[data-test="user-login-history"]')).toBeTruthy()
      expect(container.querySelector('[data-test="audit-log"]')).toBeTruthy()
    })
  })
})