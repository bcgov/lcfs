import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NotificationSettingsForm from '../NotificationSettingsForm'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes'
import * as useNotificationsHook from '@/hooks/useNotifications'
import { MemoryRouter } from 'react-router-dom'

// Updated mock translation function with meaningful translations
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        notificationsEmail: 'Notifications Email',
        'title.ConfigureNotifications': 'Configure Notifications',
        'general.title': 'General Notifications',
        'notifications:notificationType1': 'Notification Type 1',
        'notifications:notificationType2': 'Notification Type 2',
        saveButton: 'Save',
        emailNotification: 'Email Notification',
        inAppNotification: 'In-App Notification'
        // Add other translations as needed
      }
      return translations[key] || key
    },
    i18n: { language: 'en' }
  })
}))

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
  const queryClient = new QueryClient()
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
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders correctly', () => {
    // Mock data
    const categories = {
      general: {
        title: 'general.title',
        notificationType1: 'notifications:notificationType1',
        notificationType2: 'notifications:notificationType2'
      }
    }

    const subscriptionsData = [
      {
        notificationTypeName: 'notificationType1',
        notificationChannelName: 'EMAIL',
        isEnabled: true,
        notificationChannelSubscriptionId: '1'
      },
      {
        notificationTypeName: 'notificationType2',
        notificationChannelName: 'IN_APP',
        isEnabled: true,
        notificationChannelSubscriptionId: '2'
      }
    ]

    vi.spyOn(
      useNotificationsHook,
      'useNotificationSubscriptions'
    ).mockReturnValue({
      data: subscriptionsData,
      isLoading: false
    })

    vi.spyOn(useNotificationsHook, 'useCreateSubscription').mockReturnValue({
      mutateAsync: vi.fn()
    })

    vi.spyOn(useNotificationsHook, 'useDeleteSubscription').mockReturnValue({
      mutateAsync: vi.fn()
    })

    vi.spyOn(
      useNotificationsHook,
      'useUpdateNotificationsEmail'
    ).mockReturnValue({
      mutateAsync: vi.fn()
    })

    customRender(<NotificationSettingsForm categories={categories} />)

    expect(screen.getByText('Configure Notifications')).toBeInTheDocument()
    expect(screen.getByText('General Notifications')).toBeInTheDocument()
    expect(screen.getByText('Notification Type 1')).toBeInTheDocument()
    expect(screen.getByText('Notification Type 2')).toBeInTheDocument()
  })

  it('handles checkbox changes correctly', async () => {
    const categories = {
      general: {
        title: 'general.title',
        notificationType1: 'notifications:notificationType1'
      }
    }

    const subscriptionsData = []

    const mockMutateAsync = vi.fn()

    vi.spyOn(
      useNotificationsHook,
      'useNotificationSubscriptions'
    ).mockReturnValue({
      data: subscriptionsData,
      isLoading: false
    })

    vi.spyOn(useNotificationsHook, 'useCreateSubscription').mockReturnValue({
      mutateAsync: mockMutateAsync
    })

    vi.spyOn(useNotificationsHook, 'useDeleteSubscription').mockReturnValue({
      mutateAsync: mockMutateAsync
    })

    customRender(<NotificationSettingsForm categories={categories} />)

    const checkbox = screen.getAllByRole('checkbox')[0]
    fireEvent.click(checkbox)

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled()
    })
  })
})
