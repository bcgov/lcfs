import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
  useNotificationsCount,
  useGetNotificationMessages,
  useMarkNotificationAsRead,
  useDeleteNotificationMessages,
  useNotificationSubscriptions,
  useCreateSubscription,
  useDeleteSubscription,
  useUpdateNotificationsEmail
} from '../useNotifications'

// Mock the API service
const mockApiService = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}

vi.mock('@/services/useApiService', () => ({
  useApiService: () => mockApiService
}))

vi.mock('@/constants/routes', () => ({
  apiRoutes: {
    getNotificationsCount: '/notifications/count',
    getNotifications: '/notifications/list',
    notifications: '/notifications',
    getNotificationSubscriptions: '/notifications/subscriptions',
    saveNotificationSubscriptions: '/notifications/subscriptions/save',
    updateNotificationsEmail: '/notifications/email/update'
  }
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useNotificationsCount', () => {
    it('should fetch notifications count successfully', async () => {
      const mockCount = { unreadCount: 5, totalCount: 25 }
      mockApiService.get.mockResolvedValue({ data: mockCount })

      const { result } = renderHook(() => useNotificationsCount(), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockCount)
      expect(mockApiService.get).toHaveBeenCalledWith('/notifications/count')
    })

    it('should handle API errors', async () => {
      const mockError = new Error('API Error')
      mockApiService.get.mockRejectedValue(mockError)

      const { result } = renderHook(() => useNotificationsCount(), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useGetNotificationMessages', () => {
    it('should fetch notification messages successfully with default params', async () => {
      const mockMessages = {
        notifications: [
          { id: 1, message: 'Test notification 1', isRead: false },
          { id: 2, message: 'Test notification 2', isRead: true }
        ],
        pagination: { total: 2, page: 1, size: 10 }
      }
      mockApiService.post.mockResolvedValue({ data: mockMessages })

      const { result } = renderHook(() => useGetNotificationMessages(), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockMessages)
      expect(mockApiService.post).toHaveBeenCalledWith('/notifications/list', {
        page: 1,
        size: 10,
        sortOrders: [],
        filters: []
      })
    })

    it('should fetch notification messages with custom params', async () => {
      const mockMessages = {
        notifications: [],
        pagination: { total: 0, page: 2, size: 5 }
      }
      mockApiService.post.mockResolvedValue({ data: mockMessages })

      const params = {
        page: 2,
        size: 5,
        sortOrders: [{ field: 'createdAt', direction: 'desc' }],
        filters: [{ field: 'isRead', value: false }]
      }

      const { result } = renderHook(() => useGetNotificationMessages(params), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/notifications/list',
        params
      )
    })

    it('should handle API errors', async () => {
      const mockError = new Error('API Error')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(() => useGetNotificationMessages(), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useMarkNotificationAsRead', () => {
    it('should mark notifications as read successfully', async () => {
      mockApiService.put.mockResolvedValue({ data: { success: true } })

      const { result } = renderHook(() => useMarkNotificationAsRead(), {
        wrapper: createWrapper()
      })

      const notificationIds = [1, 2, 3]
      result.current.mutate(notificationIds)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.put).toHaveBeenCalledWith(
        '/notifications',
        notificationIds
      )
    })

    it('should handle mark as read errors', async () => {
      const mockError = new Error('Mark as read failed')
      mockApiService.put.mockRejectedValue(mockError)

      const { result } = renderHook(() => useMarkNotificationAsRead(), {
        wrapper: createWrapper()
      })

      result.current.mutate([1, 2])

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useDeleteNotificationMessages', () => {
    it('should delete notification messages successfully', async () => {
      mockApiService.delete.mockResolvedValue({ data: { success: true } })

      const { result } = renderHook(() => useDeleteNotificationMessages(), {
        wrapper: createWrapper()
      })

      const notificationIds = [1, 2, 3]
      result.current.mutate(notificationIds)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.delete).toHaveBeenCalledWith('/notifications', {
        data: notificationIds
      })
    })

    it('should handle delete errors', async () => {
      const mockError = new Error('Delete failed')
      mockApiService.delete.mockRejectedValue(mockError)

      const { result } = renderHook(() => useDeleteNotificationMessages(), {
        wrapper: createWrapper()
      })

      result.current.mutate([1, 2])

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useNotificationSubscriptions', () => {
    it('should fetch notification subscriptions successfully', async () => {
      const mockSubscriptions = [
        { id: 1, channelName: 'Email', isSubscribed: true },
        { id: 2, channelName: 'SMS', isSubscribed: false }
      ]
      mockApiService.get.mockResolvedValue({ data: mockSubscriptions })

      const { result } = renderHook(() => useNotificationSubscriptions(), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockSubscriptions)
      expect(mockApiService.get).toHaveBeenCalledWith(
        '/notifications/subscriptions'
      )
    })

    it('should return empty array on 404 error', async () => {
      const mockError = { response: { status: 404 } }
      mockApiService.get.mockRejectedValue(mockError)

      const { result } = renderHook(() => useNotificationSubscriptions(), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual([])
    })

    it('should handle non-404 API errors', async () => {
      const mockError = { response: { status: 500 } }
      mockApiService.get.mockRejectedValue(mockError)

      const { result } = renderHook(() => useNotificationSubscriptions(), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useCreateSubscription', () => {
    it('should create subscription successfully', async () => {
      const mockResponse = { data: { id: 1, success: true } }
      mockApiService.post.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useCreateSubscription(), {
        wrapper: createWrapper()
      })

      const subscriptionData = { channelName: 'Email', isSubscribed: true }
      result.current.mutate(subscriptionData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/notifications/subscriptions/save',
        subscriptionData
      )
    })

    it('should handle create subscription errors', async () => {
      const mockError = new Error('Create subscription failed')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(() => useCreateSubscription(), {
        wrapper: createWrapper()
      })

      result.current.mutate({ channelName: 'Email' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useDeleteSubscription', () => {
    it('should delete subscription successfully', async () => {
      const mockResponse = { data: { success: true } }
      mockApiService.post.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useDeleteSubscription(), {
        wrapper: createWrapper()
      })

      const subscriptionId = 123
      result.current.mutate(subscriptionId)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/notifications/subscriptions/save',
        {
          notificationChannelSubscriptionId: subscriptionId,
          deleted: true
        }
      )
    })

    it('should handle delete subscription errors', async () => {
      const mockError = new Error('Delete subscription failed')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(() => useDeleteSubscription(), {
        wrapper: createWrapper()
      })

      result.current.mutate(123)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useUpdateNotificationsEmail', () => {
    it('should update notifications email successfully', async () => {
      const mockResponse = { data: { success: true } }
      mockApiService.post.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useUpdateNotificationsEmail(), {
        wrapper: createWrapper()
      })

      const emailData = { email: 'test@example.com' }
      result.current.mutate(emailData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/notifications/email/update',
        emailData
      )
    })

    it('should handle update email errors', async () => {
      const mockError = new Error('Update email failed')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(() => useUpdateNotificationsEmail(), {
        wrapper: createWrapper()
      })

      result.current.mutate({ email: 'test@example.com' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })
})
