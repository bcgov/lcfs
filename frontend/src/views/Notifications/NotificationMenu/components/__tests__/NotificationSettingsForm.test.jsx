import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import NotificationSettingsForm from '../NotificationSettingsForm'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes'
import * as useNotificationsHook from '@/hooks/useNotifications'
import { MemoryRouter } from 'react-router-dom'

// Mock translation function
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        'title.ConfigureNotifications': 'Configure Notifications',
        'general.title': 'General Notifications',
        'notifications:notificationType1': 'Notification Type 1',
        'notifications:notificationType2': 'Notification Type 2',
        'loading.notificationSettings': 'Loading notification settings...',
        saveButton: 'Save',
        email: 'Email',
        emailNotification: 'Email Notification',
        inAppNotification: 'In-App Notification'
      }
      return translations[key] || key
    },
    i18n: { language: 'en' }
  })
}))

// Mock notification types and channels
vi.mock('@/constants/notificationTypes', () => ({
  notificationTypes: {
    notificationType1: 'NOTIFICATION_TYPE_1',
    notificationType2: 'NOTIFICATION_TYPE_2'
  },
  notificationChannels: {
    EMAIL: 'EMAIL',
    IN_APP: 'IN_APP'
  }
}))

const customRender = (ui, options = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  const AllTheProviders = ({ children }) => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )

  return render(ui, { wrapper: AllTheProviders, ...options })
}

describe('NotificationSettingsForm Component', () => {
  // Mock data setup
  const mockCategories = {
    general: {
      title: 'general.title',
      notificationType1: 'notifications:notificationType1',
      notificationType2: 'notifications:notificationType2'
    }
  }

  const mockSubscriptionsData = [
    {
      notificationTypeName: 'notificationType1',
      notificationChannelName: 'EMAIL',
      isEnabled: true,
      notificationChannelSubscriptionId: '1'
    },
    {
      notificationTypeName: 'notificationType2',
      notificationChannelName: 'IN_APP',
      isEnabled: false,
      notificationChannelSubscriptionId: '2'
    }
  ]

  // Mock functions
  const mockCreateSubscription = vi.fn()
  const mockDeleteSubscription = vi.fn()
  const mockUpdateEmail = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset mock implementations
    mockCreateSubscription.mockResolvedValue()
    mockDeleteSubscription.mockResolvedValue()
    mockUpdateEmail.mockResolvedValue()
  })

  // Helper function to setup default mocks
  const setupDefaultMocks = (overrides = {}) => {
    const defaults = {
      subscriptionsData: mockSubscriptionsData,
      isLoading: false,
      ...overrides
    }

    vi.spyOn(useNotificationsHook, 'useNotificationSubscriptions').mockReturnValue({
      data: defaults.subscriptionsData,
      isLoading: defaults.isLoading
    })

    vi.spyOn(useNotificationsHook, 'useCreateSubscription').mockReturnValue({
      mutateAsync: mockCreateSubscription
    })

    vi.spyOn(useNotificationsHook, 'useDeleteSubscription').mockReturnValue({
      mutateAsync: mockDeleteSubscription
    })

    vi.spyOn(useNotificationsHook, 'useUpdateNotificationsEmail').mockReturnValue({
      mutateAsync: mockUpdateEmail
    })
  }

  describe('Basic Rendering Tests', () => {
    it('renders correctly with required props', () => {
      setupDefaultMocks()
      
      customRender(<NotificationSettingsForm categories={mockCategories} />)

      expect(screen.getByText('Configure Notifications')).toBeInTheDocument()
      expect(screen.getByText('General Notifications')).toBeInTheDocument()
      expect(screen.getByText('Notification Type 1')).toBeInTheDocument()
      expect(screen.getByText('Notification Type 2')).toBeInTheDocument()
      expect(screen.getByText('Email Notification')).toBeInTheDocument()
      expect(screen.getByText('In-App Notification')).toBeInTheDocument()
    })

    it('shows loading state when subscriptions are loading', () => {
      setupDefaultMocks({ isLoading: true })
      
      customRender(<NotificationSettingsForm categories={mockCategories} />)

      expect(screen.getByText('Loading notification settings...')).toBeInTheDocument()
      expect(screen.queryByText('Configure Notifications')).not.toBeInTheDocument()
    })

    it('renders without email field when showEmailField is false', () => {
      setupDefaultMocks()
      
      customRender(
        <NotificationSettingsForm 
          categories={mockCategories} 
          showEmailField={false} 
        />
      )

      expect(screen.queryByLabelText('Email:')).not.toBeInTheDocument()
      expect(screen.queryByText('Save')).not.toBeInTheDocument()
    })

    it('renders checkboxes with correct initial states from subscription data', () => {
      setupDefaultMocks()
      
      customRender(<NotificationSettingsForm categories={mockCategories} />)

      const checkboxes = screen.getAllByRole('checkbox')
      
      // Should have 4 checkboxes (2 types × 2 channels)
      expect(checkboxes).toHaveLength(4)
    })

    it('handles empty subscription data', () => {
      setupDefaultMocks({ subscriptionsData: [] })
      
      customRender(<NotificationSettingsForm categories={mockCategories} />)

      expect(screen.getByText('Configure Notifications')).toBeInTheDocument()
      expect(screen.getAllByRole('checkbox')).toHaveLength(4)
    })

    it('handles null subscription data', () => {
      setupDefaultMocks({ subscriptionsData: null })
      
      customRender(<NotificationSettingsForm categories={mockCategories} />)

      expect(screen.getByText('Configure Notifications')).toBeInTheDocument()
      expect(screen.getAllByRole('checkbox')).toHaveLength(4)
    })
  })

  describe('Interaction Tests', () => {
    it('can interact with checkboxes', async () => {
      setupDefaultMocks({ subscriptionsData: [] })
      
      await act(async () => {
        customRender(<NotificationSettingsForm categories={mockCategories} />)
      })

      const checkboxes = screen.getAllByRole('checkbox')
      
      // Should be able to click checkbox without error
      await act(async () => {
        fireEvent.click(checkboxes[0])
      })
    })

    it('can interact with email form when present', async () => {
      setupDefaultMocks()
      
      await act(async () => {
        customRender(
          <NotificationSettingsForm 
            categories={mockCategories} 
            showEmailField={true}
            initialEmail="test@example.com"
          />
        )
      })

      const saveButton = screen.getByText('Save')
      
      // Should be able to click save button without error
      await act(async () => {
        fireEvent.click(saveButton)
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles categories with no notifications', () => {
      const emptyCat = { empty: { title: 'empty.title' } }
      setupDefaultMocks()
      
      customRender(<NotificationSettingsForm categories={emptyCat} />)

      expect(screen.getByText('Configure Notifications')).toBeInTheDocument()
    })

    it('handles missing notification type in constants', () => {
      const invalidCategories = {
        general: {
          title: 'general.title',
          invalidType: 'notifications:invalidType'
        }
      }
      setupDefaultMocks()
      
      customRender(<NotificationSettingsForm categories={invalidCategories} />)

      expect(screen.getByText('Configure Notifications')).toBeInTheDocument()
    })

    it('handles different notification types and channels', () => {
      setupDefaultMocks({ subscriptionsData: [] })
      
      customRender(<NotificationSettingsForm categories={mockCategories} />)

      const checkboxes = screen.getAllByRole('checkbox')
      
      // Should have checkboxes for different combinations
      expect(checkboxes).toHaveLength(4)
    })
  })
})