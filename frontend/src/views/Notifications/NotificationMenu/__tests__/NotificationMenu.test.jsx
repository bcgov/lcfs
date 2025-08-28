import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi } from 'vitest'
import { NotificationMenu } from '../NotificationMenu'

// Mock external dependencies
const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/components/BCBox', () => ({
  __esModule: true,
  default: ({ children, ...props }) => <div data-test="bc-box" {...props}>{children}</div>
}))

vi.mock('@/routes/routes', () => ({
  ROUTES: {
    NOTIFICATIONS: {
      LIST: '/notifications',
      SETTINGS: '/notifications/settings'
    }
  }
}))

vi.mock('@/themes/base/breakpoints', () => ({
  __esModule: true,
  default: {
    values: {
      lg: 1200
    }
  }
}))

vi.mock('@mui/material', () => ({
  AppBar: ({ children, ...props }) => <div data-test="app-bar" {...props}>{children}</div>,
  Tabs: ({ children, onChange, ...props }) => (
    <div 
      data-test="tabs" 
      {...props}
      onClick={(e) => onChange && onChange(e, 1)}
    >
      {children}
    </div>
  ),
  Tab: ({ label, ...props }) => <button data-test="tab" {...props}>{label}</button>
}))

vi.mock('../components/NotificationTabPanel', () => ({
  NotificationTabPanel: ({ children, value, index, ...props }) => (
    <div 
      data-test="tab-panel" 
      data-value={value} 
      data-index={index}
      {...props}
    >
      {value === index && children}
    </div>
  )
}))

vi.mock('../index', () => ({
  Notifications: () => <div data-test="notifications">Notifications Component</div>,
  NotificationSettings: () => <div data-test="notification-settings">Settings Component</div>
}))

describe('NotificationMenu', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024
    })
    
    window.addEventListener = vi.fn()
    window.removeEventListener = vi.fn()
    mockNavigate.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic rendering', () => {
    it('renders without crashing', () => {
      render(<NotificationMenu tabIndex={0} />)
      expect(screen.getByTestId('bc-box')).toBeInTheDocument()
    })

    it('renders main container components', () => {
      render(<NotificationMenu tabIndex={0} />)
      
      expect(screen.getByTestId('bc-box')).toBeInTheDocument()
      expect(screen.getByTestId('app-bar')).toBeInTheDocument()
      expect(screen.getByTestId('tabs')).toBeInTheDocument()
    })

    it('renders both tab buttons', () => {
      render(<NotificationMenu tabIndex={0} />)
      
      const tabs = screen.getAllByTestId('tab')
      expect(tabs).toHaveLength(2)
      expect(tabs[0]).toHaveTextContent('title.Notifications')
      expect(tabs[1]).toHaveTextContent('title.ConfigureNotifications')
    })

    it('renders tab panels', () => {
      render(<NotificationMenu tabIndex={0} />)
      
      expect(screen.getAllByTestId('tab-panel')).toHaveLength(2)
    })
  })

  describe('Tab content rendering', () => {
    it('shows notifications component when tabIndex is 0', () => {
      render(<NotificationMenu tabIndex={0} />)
      
      expect(screen.getByTestId('notifications')).toBeInTheDocument()
      expect(screen.queryByTestId('notification-settings')).not.toBeInTheDocument()
    })

    it('shows settings component when tabIndex is 1', () => {
      render(<NotificationMenu tabIndex={1} />)
      
      expect(screen.queryByTestId('notifications')).not.toBeInTheDocument()
      expect(screen.getByTestId('notification-settings')).toBeInTheDocument()
    })

    it('handles invalid tabIndex gracefully', () => {
      render(<NotificationMenu tabIndex={2} />)
      
      expect(screen.queryByTestId('notifications')).not.toBeInTheDocument()
      expect(screen.queryByTestId('notification-settings')).not.toBeInTheDocument()
    })
  })

  describe('Tab orientation responsive behavior', () => {
    it('sets horizontal orientation when window width >= lg breakpoint', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200
      })

      await act(async () => {
        render(<NotificationMenu tabIndex={0} />)
      })

      expect(screen.getByTestId('tabs')).toHaveAttribute('orientation', 'horizontal')
    })

    it('sets vertical orientation when window width < lg breakpoint', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 800
      })

      await act(async () => {
        render(<NotificationMenu tabIndex={0} />)
      })

      expect(screen.getByTestId('tabs')).toHaveAttribute('orientation', 'vertical')
    })
  })

  describe('Event listener lifecycle', () => {
    it('adds resize event listener on mount', async () => {
      await act(async () => {
        render(<NotificationMenu tabIndex={0} />)
      })

      expect(window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
    })

    it('removes resize event listener on unmount', async () => {
      const { unmount } = render(<NotificationMenu tabIndex={0} />)
      
      await act(async () => {
        unmount()
      })

      expect(window.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
    })

    it('calls orientation handler on initial mount', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1300
      })
      
      await act(async () => {
        render(<NotificationMenu tabIndex={0} />)
      })

      expect(screen.getByTestId('tabs')).toHaveAttribute('orientation', 'horizontal')
    })
  })

  describe('Tab navigation functionality', () => {
    it('calls navigate with correct path when tab is clicked', async () => {
      render(<NotificationMenu tabIndex={0} />)
      
      const tabsElement = screen.getByTestId('tabs')
      
      await act(async () => {
        fireEvent.click(tabsElement)
      })

      expect(mockNavigate).toHaveBeenCalledWith('/notifications/settings')
    })

    it('updates tab value correctly', () => {
      render(<NotificationMenu tabIndex={0} />)
      
      expect(screen.getByTestId('tabs')).toHaveAttribute('value', '0')
    })

    it('handles tab value change', () => {
      const { rerender } = render(<NotificationMenu tabIndex={0} />)
      
      expect(screen.getByTestId('tabs')).toHaveAttribute('value', '0')
      
      rerender(<NotificationMenu tabIndex={1} />)
      
      expect(screen.getByTestId('tabs')).toHaveAttribute('value', '1')
    })
  })

  describe('Accessibility features', () => {
    it('has proper ARIA attributes on tabs container', () => {
      render(<NotificationMenu tabIndex={0} />)
      
      expect(screen.getByTestId('tabs')).toHaveAttribute('aria-label', 'Tabs for selection of notifications options')
    })

    it('applies accessibility props to tab elements', () => {
      render(<NotificationMenu tabIndex={0} />)
      
      const tabs = screen.getAllByTestId('tab')
      expect(tabs[0]).toHaveAttribute('id', 'full-width-tab-0')
      expect(tabs[0]).toHaveAttribute('aria-controls', 'full-width-notifications-tabs-0')
      expect(tabs[1]).toHaveAttribute('id', 'full-width-tab-1')
      expect(tabs[1]).toHaveAttribute('aria-controls', 'full-width-notifications-tabs-1')
    })
  })

  describe('Component state management', () => {
    it('manages tab orientation state through window resize', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1300
      })

      render(<NotificationMenu tabIndex={0} />)
      
      // Get the resize handler
      const resizeHandler = window.addEventListener.mock.calls.find(
        call => call[0] === 'resize'
      )[1]

      // Simulate window resize to smaller width
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 800
      })

      await act(async () => {
        resizeHandler()
      })

      expect(screen.getByTestId('tabs')).toHaveAttribute('orientation', 'vertical')
    })

    it('maintains state correctly on rerender', () => {
      const { rerender } = render(<NotificationMenu tabIndex={0} />)
      
      expect(screen.getByTestId('notifications')).toBeInTheDocument()
      
      rerender(<NotificationMenu tabIndex={1} />)
      
      expect(screen.getByTestId('notification-settings')).toBeInTheDocument()
    })
  })

  describe('PropTypes validation', () => {
    it('has propTypes defined', () => {
      expect(NotificationMenu.propTypes).toBeDefined()
      expect(NotificationMenu.propTypes.tabIndex).toBeDefined()
    })

    it('accepts valid tabIndex prop', () => {
      expect(() => render(<NotificationMenu tabIndex={0} />)).not.toThrow()
      expect(() => render(<NotificationMenu tabIndex={1} />)).not.toThrow()
    })
  })

  describe('Utility functions', () => {
    // Test a11yProps function indirectly through component behavior
    it('applies correct accessibility properties through a11yProps', () => {
      render(<NotificationMenu tabIndex={0} />)
      
      const tabs = screen.getAllByTestId('tab')
      
      // Test that a11yProps(0) results are applied
      expect(tabs[0]).toHaveAttribute('id', 'full-width-tab-0')
      expect(tabs[0]).toHaveAttribute('aria-controls', 'full-width-notifications-tabs-0')
      
      // Test that a11yProps(1) results are applied
      expect(tabs[1]).toHaveAttribute('id', 'full-width-tab-1')
      expect(tabs[1]).toHaveAttribute('aria-controls', 'full-width-notifications-tabs-1')
    })
  })

  describe('Integration with translation system', () => {
    it('uses translation keys for tab labels', () => {
      render(<NotificationMenu tabIndex={0} />)
      
      expect(screen.getByText('title.Notifications')).toBeInTheDocument()
      expect(screen.getByText('title.ConfigureNotifications')).toBeInTheDocument()
    })
  })
})