import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SnackbarProvider } from 'notistack'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import theme from '@/themes'
import GovernmentNotificationsCard from '../GovernmentNotificationsCard'

// Mock dependencies
const mockEnqueueSnackbar = vi.fn()
vi.mock('notistack', async () => {
  const actual = await vi.importActual('notistack')
  return {
    ...actual,
    useSnackbar: () => ({
      enqueueSnackbar: mockEnqueueSnackbar
    })
  }
})

const mockHasAnyRole = vi.fn()
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    hasRoles: vi.fn(),
    hasAnyRole: mockHasAnyRole
  })
}))

const mockUseCurrentGovernmentNotification = vi.fn()
const mockMutate = vi.fn()
const mockUseUpdateGovernmentNotification = vi.fn()

vi.mock('@/hooks/useGovernmentNotification', () => ({
  useCurrentGovernmentNotification: () => mockUseCurrentGovernmentNotification(),
  useUpdateGovernmentNotification: (callbacks) => mockUseUpdateGovernmentNotification(callbacks)
}))

// Mock ReactQuill
vi.mock('react-quill', () => ({
  default: ({ value, onChange, placeholder }) => (
    <textarea
      data-test="react-quill"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}))

// Create test wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return ({ children }) => (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <SnackbarProvider>{children}</SnackbarProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

describe('GovernmentNotificationsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasAnyRole.mockReturnValue(false)
    mockUseCurrentGovernmentNotification.mockReturnValue({
      data: null,
      isLoading: false
    })
    mockUseUpdateGovernmentNotification.mockReturnValue({
      mutate: mockMutate,
      isPending: false
    })
  })

  describe('Loading State', () => {
    it('should display loading state when fetching notification', () => {
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      expect(screen.getByText('Loading notification...')).toBeInTheDocument()
    })
  })

  describe('Access Control', () => {
    it('should not render card when no notification exists and user cannot edit', () => {
      mockHasAnyRole.mockReturnValue(false)
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: null,
        isLoading: false
      })

      const { container } = render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      expect(container.firstChild).toBeNull()
    })

    it('should render empty state when no notification exists but user can edit', () => {
      mockHasAnyRole.mockReturnValue(true)
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      expect(screen.getByText('No government notification has been created yet.')).toBeInTheDocument()
    })

    it('should show edit button for compliance managers and directors', () => {
      mockHasAnyRole.mockReturnValue(true)
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: {
          notificationTitle: 'Test Notification',
          notificationText: '<p>Test content</p>',
          notificationType: 'General'
        },
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    })

    it('should not show edit button for regular users', () => {
      mockHasAnyRole.mockReturnValue(false)
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: {
          notificationTitle: 'Test Notification',
          notificationText: '<p>Test content</p>',
          notificationType: 'General'
        },
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
    })
  })

  describe('Notification Display', () => {
    it('should display notification with title and text', () => {
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: {
          notificationTitle: 'Important Update',
          notificationText: '<p>Please review the new guidelines.</p>',
          notificationType: 'General'
        },
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      expect(screen.getByText('Important Update')).toBeInTheDocument()
      expect(screen.getByText('Please review the new guidelines.')).toBeInTheDocument()
    })

    it('should display notification with link when linkUrl is provided', () => {
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: {
          notificationTitle: 'Read More',
          notificationText: '<p>Click the title to learn more.</p>',
          linkUrl: 'https://example.com',
          notificationType: 'Alert'
        },
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      const link = screen.getByRole('link', { name: 'Read More' })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', 'https://example.com')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('should display notification without link when linkUrl is not provided', () => {
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: {
          notificationTitle: 'System Maintenance',
          notificationText: '<p>Scheduled maintenance tonight.</p>',
          notificationType: 'Outage'
        },
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      expect(screen.getByText('System Maintenance')).toBeInTheDocument()
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })

    it('should display correct card title based on notification type', () => {
      const types = [
        { type: 'Alert', title: 'Alert notification' },
        { type: 'Outage', title: 'Outage notification' },
        { type: 'Deadline', title: 'Deadline notification' },
        { type: 'General', title: 'General notification' }
      ]

      types.forEach(({ type, title }) => {
        mockUseCurrentGovernmentNotification.mockReturnValue({
          data: {
            notificationTitle: 'Test',
            notificationText: '<p>Test</p>',
            notificationType: type
          },
          isLoading: false
        })

        const { unmount } = render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })
        expect(screen.getByText(title)).toBeInTheDocument()
        unmount()
      })
    })
  })

  describe('Text Truncation', () => {
    it('should show More button when text exceeds 1000 characters', () => {
      const longText = '<p>' + 'a'.repeat(1100) + '</p>'

      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: {
          notificationTitle: 'Long Notification',
          notificationText: longText,
          notificationType: 'General'
        },
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument()
    })

    it('should not show More button when text is under 1000 characters', () => {
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: {
          notificationTitle: 'Short Notification',
          notificationText: '<p>Short text</p>',
          notificationType: 'General'
        },
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument()
    })

    it('should expand and collapse text when More/Less button is clicked', async () => {
      const user = userEvent.setup()
      const longText = '<p>' + 'a'.repeat(1100) + '</p>'

      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: {
          notificationTitle: 'Long Notification',
          notificationText: longText,
          notificationType: 'General'
        },
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      const moreButton = screen.getByRole('button', { name: 'More' })
      await user.click(moreButton)

      expect(screen.getByRole('button', { name: 'Less' })).toBeInTheDocument()

      const lessButton = screen.getByRole('button', { name: 'Less' })
      await user.click(lessButton)

      expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument()
    })
  })

  describe('Edit Mode', () => {
    beforeEach(() => {
      mockHasAnyRole.mockReturnValue(true)
    })

    it('should enter edit mode when edit button is clicked', async () => {
      const user = userEvent.setup()
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: {
          notificationTitle: 'Existing Notification',
          notificationText: '<p>Existing content</p>',
          linkUrl: 'https://example.com',
          notificationType: 'Alert'
        },
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      // Should show form fields
      expect(screen.getByPlaceholderText('Enter notification title')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Optional link URL')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter notification message')).toBeInTheDocument()

      // Should populate with existing data
      expect(screen.getByDisplayValue('Existing Notification')).toBeInTheDocument()
      expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument()
    })

    it('should show all notification type pills in edit mode', async () => {
      const user = userEvent.setup()
      mockHasAnyRole.mockReturnValue(true)
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      expect(screen.getByRole('button', { name: 'Alert' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Outage' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Deadline' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'General' })).toBeInTheDocument()
    })

    it('should select notification type when pill is clicked', async () => {
      const user = userEvent.setup()
      mockHasAnyRole.mockReturnValue(true)
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: {
          notificationTitle: 'Test',
          notificationText: '<p>Test</p>',
          notificationType: 'General'
        },
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      const alertPill = screen.getByRole('button', { name: 'Alert' })
      await user.click(alertPill)

      // Card title should update to reflect selected type
      expect(screen.getByText('Alert notification')).toBeInTheDocument()
    })

    it('should update form fields when user types', async () => {
      const user = userEvent.setup()
      mockHasAnyRole.mockReturnValue(true)
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      const titleInput = screen.getByPlaceholderText('Enter notification title')
      const urlInput = screen.getByPlaceholderText('Optional link URL')
      const messageInput = screen.getByPlaceholderText('Enter notification message')

      await user.type(titleInput, 'New Title')
      await user.type(urlInput, 'https://test.com')
      await user.type(messageInput, 'New message content')

      expect(titleInput).toHaveValue('New Title')
      expect(urlInput).toHaveValue('https://test.com')
      expect(messageInput).toHaveValue('New message content')
    })

    it('should disable save button when title is empty', async () => {
      const user = userEvent.setup()
      mockHasAnyRole.mockReturnValue(true)
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      const saveButton = screen.getByRole('button', { name: 'Save' })
      expect(saveButton).toBeDisabled()
    })

    it('should disable save button when message is empty', async () => {
      const user = userEvent.setup()
      mockHasAnyRole.mockReturnValue(true)
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      const titleInput = screen.getByPlaceholderText('Enter notification title')
      await user.type(titleInput, 'Test Title')

      const saveButton = screen.getByRole('button', { name: 'Save' })
      expect(saveButton).toBeDisabled()
    })

    it('should enable save button when both title and message are filled', async () => {
      const user = userEvent.setup()
      mockHasAnyRole.mockReturnValue(true)
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      const titleInput = screen.getByPlaceholderText('Enter notification title')
      const messageInput = screen.getByPlaceholderText('Enter notification message')

      await user.type(titleInput, 'Test Title')
      await user.type(messageInput, 'Test message')

      const saveButton = screen.getByRole('button', { name: 'Save' })
      expect(saveButton).not.toBeDisabled()
    })

    it('should exit edit mode when cancel button is clicked', async () => {
      const user = userEvent.setup()
      mockHasAnyRole.mockReturnValue(true)
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: {
          notificationTitle: 'Test',
          notificationText: '<p>Test</p>',
          notificationType: 'General'
        },
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      expect(screen.getByPlaceholderText('Enter notification title')).toBeInTheDocument()

      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      await user.click(cancelButton)

      // Should be back in view mode
      expect(screen.queryByPlaceholderText('Enter notification title')).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 6, name: 'Test' })).toBeInTheDocument()
    })
  })

  describe('Save Confirmation Dialog', () => {
    beforeEach(() => {
      mockHasAnyRole.mockReturnValue(true)
    })

    it('should show confirmation dialog when save button is clicked', async () => {
      const user = userEvent.setup()
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      const titleInput = screen.getByPlaceholderText('Enter notification title')
      const messageInput = screen.getByPlaceholderText('Enter notification message')

      await user.type(titleInput, 'Test Title')
      await user.type(messageInput, 'Test message')

      const saveButton = screen.getByRole('button', { name: 'Save' })
      await user.click(saveButton)

      // Confirmation dialog should be visible
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Government notification')).toBeInTheDocument()
      expect(screen.getByText(/Notification emails go out to all BCeID and IDIR users!/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save and send email' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save without email sent' })).toBeInTheDocument()
    })

    it('should call mutate with form data when "Save and send email" is clicked', async () => {
      const user = userEvent.setup()
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      await user.type(screen.getByPlaceholderText('Enter notification title'), 'Test Title')
      await user.type(screen.getByPlaceholderText('Enter notification message'), 'Test message')

      const saveButton = screen.getByRole('button', { name: 'Save' })
      await user.click(saveButton)

      const saveWithEmailButton = screen.getByRole('button', { name: 'Save and send email' })
      await user.click(saveWithEmailButton)

      expect(mockMutate).toHaveBeenCalledWith({
        notification_title: 'Test Title',
        notification_text: 'Test message',
        link_url: '',
        notification_type: 'General'
      })
    })

    it('should call mutate with form data when "Save without email sent" is clicked', async () => {
      const user = userEvent.setup()
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      await user.type(screen.getByPlaceholderText('Enter notification title'), 'Test Title')
      await user.type(screen.getByPlaceholderText('Enter notification message'), 'Test message')

      const saveButton = screen.getByRole('button', { name: 'Save' })
      await user.click(saveButton)

      const saveWithoutEmailButton = screen.getByRole('button', { name: 'Save without email sent' })
      await user.click(saveWithoutEmailButton)

      expect(mockMutate).toHaveBeenCalledWith({
        notification_title: 'Test Title',
        notification_text: 'Test message',
        link_url: '',
        notification_type: 'General'
      })
    })

    it('should close confirmation dialog when cancel button is clicked', async () => {
      const user = userEvent.setup()
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      await user.type(screen.getByPlaceholderText('Enter notification title'), 'Test Title')
      await user.type(screen.getByPlaceholderText('Enter notification message'), 'Test message')

      const saveButton = screen.getByRole('button', { name: 'Save' })
      await user.click(saveButton)

      expect(screen.getByRole('dialog')).toBeInTheDocument()

      // There are multiple Cancel buttons - one in the dialog
      const dialogCancelButtons = screen.getAllByRole('button', { name: 'Cancel' })
      const dialogCancelButton = dialogCancelButtons.find(btn => {
        const dialog = btn.closest('[role="dialog"]')
        return dialog !== null
      })

      await user.click(dialogCancelButton)

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })
  })

  describe('Success and Error Handling', () => {
    beforeEach(() => {
      mockHasAnyRole.mockReturnValue(true)
    })

    it('should show success snackbar on successful save', async () => {
      const user = userEvent.setup()
      let onSuccessCallback

      mockUseUpdateGovernmentNotification.mockImplementation((callbacks) => {
        onSuccessCallback = callbacks?.onSuccess
        return {
          mutate: mockMutate,
          isPending: false
        }
      })

      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      await user.type(screen.getByPlaceholderText('Enter notification title'), 'Test')
      await user.type(screen.getByPlaceholderText('Enter notification message'), 'Test')

      const saveButton = screen.getByRole('button', { name: 'Save' })
      await user.click(saveButton)

      const saveWithoutEmailButton = screen.getByRole('button', { name: 'Save without email sent' })
      await user.click(saveWithoutEmailButton)

      // Simulate successful save
      if (onSuccessCallback) {
        onSuccessCallback({ notificationTitle: 'Test' })
      }

      await waitFor(() => {
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
          'Government notification updated successfully',
          { variant: 'success' }
        )
      })
    })

    it('should show error snackbar on failed save', async () => {
      const user = userEvent.setup()
      let onErrorCallback

      mockUseUpdateGovernmentNotification.mockImplementation((callbacks) => {
        onErrorCallback = callbacks?.onError
        return {
          mutate: mockMutate,
          isPending: false
        }
      })

      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      await user.type(screen.getByPlaceholderText('Enter notification title'), 'Test')
      await user.type(screen.getByPlaceholderText('Enter notification message'), 'Test')

      const saveButton = screen.getByRole('button', { name: 'Save' })
      await user.click(saveButton)

      const saveWithoutEmailButton = screen.getByRole('button', { name: 'Save without email sent' })
      await user.click(saveWithoutEmailButton)

      // Simulate failed save
      if (onErrorCallback) {
        onErrorCallback({
          response: {
            data: {
              message: 'Database error'
            }
          }
        })
      }

      await waitFor(() => {
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
          'Database error',
          { variant: 'error' }
        )
      })
    })

    it('should show default error message when error has no message', async () => {
      const user = userEvent.setup()
      let onErrorCallback

      mockUseUpdateGovernmentNotification.mockImplementation((callbacks) => {
        onErrorCallback = callbacks?.onError
        return {
          mutate: mockMutate,
          isPending: false
        }
      })

      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      await user.type(screen.getByPlaceholderText('Enter notification title'), 'Test')
      await user.type(screen.getByPlaceholderText('Enter notification message'), 'Test')

      const saveButton = screen.getByRole('button', { name: 'Save' })
      await user.click(saveButton)

      const saveWithoutEmailButton = screen.getByRole('button', { name: 'Save without email sent' })
      await user.click(saveWithoutEmailButton)

      // Simulate failed save with no error message
      if (onErrorCallback) {
        onErrorCallback({})
      }

      await waitFor(() => {
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
          'Failed to update government notification',
          { variant: 'error' }
        )
      })
    })

    it('should exit edit mode after successful save', async () => {
      const user = userEvent.setup()
      let onSuccessCallback

      mockUseUpdateGovernmentNotification.mockImplementation((callbacks) => {
        onSuccessCallback = callbacks?.onSuccess
        return {
          mutate: mockMutate,
          isPending: false
        }
      })

      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: null,
        isLoading: false
      })

      const { rerender } = render(<GovernmentNotificationsCard />, { wrapper: createWrapper() })

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      await user.type(screen.getByPlaceholderText('Enter notification title'), 'Test')
      await user.type(screen.getByPlaceholderText('Enter notification message'), 'Test')

      const saveButton = screen.getByRole('button', { name: 'Save' })
      await user.click(saveButton)

      const saveWithoutEmailButton = screen.getByRole('button', { name: 'Save without email sent' })
      await user.click(saveWithoutEmailButton)

      // Simulate successful save
      if (onSuccessCallback) {
        onSuccessCallback({
          notificationTitle: 'Test',
          notificationText: '<p>Test</p>',
          notificationType: 'General'
        })
      }

      // Update mock to return the saved notification
      mockUseCurrentGovernmentNotification.mockReturnValue({
        data: {
          notificationTitle: 'Test',
          notificationText: '<p>Test</p>',
          notificationType: 'General'
        },
        isLoading: false
      })

      rerender(<GovernmentNotificationsCard />)

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Enter notification title')).not.toBeInTheDocument()
      })
    })
  })
})
