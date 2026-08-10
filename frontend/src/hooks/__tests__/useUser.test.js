import { waitFor } from '@testing-library/react'
import { describe, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { test } from '@/tests/utils/fixtures'
import {
  useUser,
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser
} from '../useUser'

vi.mock('@/services/useApiService')

describe('useUser', () => {
  const mockGet = vi.fn()
  const mockPost = vi.fn()
  const mockPut = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({
      get: mockGet,
      post: mockPost,
      put: mockPut
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('useUser', () => {
    test('should fetch user successfully when ID provided', async ({
      renderHook,
      query
    }) => {
      const userId = 123
      const mockData = {
        userId,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useUser(userId), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/users/123')
    })

    test('should not fetch when ID is not provided', ({
      renderHook,
      query
    }) => {
      const { result } = renderHook(() => useUser(), [query])

      // With enabled: !!id, the query should be disabled and not fetch
      expect(result.current.status).toBe('pending')
      expect(result.current.fetchStatus).toBe('idle')
      expect(mockGet).not.toHaveBeenCalled()
    })

    test('should handle API errors', async ({ renderHook, query }) => {
      const userId = 123
      const mockError = new Error('User not found')
      mockGet.mockRejectedValue(mockError)

      const { result } = renderHook(() => useUser(userId), [query])

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useCreateUser', () => {
    test('should create user successfully', async ({ renderHook, query }) => {
      const userData = {
        email: 'newuser@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        organizationId: 1
      }
      const mockResponse = { data: { userId: 456 } }
      mockPost.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useCreateUser(), [query])

      result.current.mutate(userData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPost).toHaveBeenCalledWith('/users', userData)
      expect(result.current.data).toEqual(mockResponse)
    })

    test('should handle API errors during creation', async ({
      renderHook,
      query
    }) => {
      const userData = { email: 'invalid-email' }
      const mockError = new Error('Invalid email format')
      mockPost.mockRejectedValue(mockError)

      const { result } = renderHook(() => useCreateUser(), [query])

      result.current.mutate(userData)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useUpdateUser', () => {
    test('should update user successfully', async ({ renderHook, query }) => {
      const userId = 123
      const updateData = { firstName: 'Updated Name' }
      const mockResponse = { data: { success: true } }
      mockPut.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useUpdateUser(), [query])

      result.current.mutate({ userID: userId, payload: updateData })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPut).toHaveBeenCalledWith('/users/123', updateData)
    })

    test('should handle API errors during update', async ({
      renderHook,
      query
    }) => {
      const userId = 123
      const updateData = { firstName: 'Updated' }
      const mockError = new Error('Update failed')
      mockPut.mockRejectedValue(mockError)

      const { result } = renderHook(() => useUpdateUser(), [query])

      result.current.mutate({ userID: userId, payload: updateData })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useDeleteUser', () => {
    test('should delete user successfully', async ({ renderHook, query }) => {
      const userId = 123
      const mockResponse = { data: { deleted: true } }
      const mockDelete = vi.fn()
      vi.mocked(useApiService).mockReturnValue({
        get: mockGet,
        post: mockPost,
        put: mockPut,
        delete: mockDelete
      })
      mockDelete.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useDeleteUser(), [query])

      result.current.mutate(userId)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockDelete).toHaveBeenCalledWith('/users/123')
    })

    test('should handle API errors during deletion', async ({
      renderHook,
      query
    }) => {
      const userId = 123
      const mockError = new Error('Deletion failed')
      const mockDelete = vi.fn()
      vi.mocked(useApiService).mockReturnValue({
        get: mockGet,
        post: mockPost,
        put: mockPut,
        delete: mockDelete
      })
      mockDelete.mockRejectedValue(mockError)

      const { result } = renderHook(() => useDeleteUser(), [query])

      result.current.mutate(userId)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useUsers', () => {
    test('should fetch users successfully', async ({ renderHook, query }) => {
      const mockData = {
        users: [
          { userId: 1, email: 'user1@example.com' },
          { userId: 2, email: 'user2@example.com' }
        ]
      }
      mockPost.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useUsers(), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockPost).toHaveBeenCalledWith('/users/')
    })

    test('should handle API errors', async ({ renderHook, query }) => {
      const mockError = new Error('Failed to fetch users')
      mockPost.mockRejectedValue(mockError)

      const { result } = renderHook(() => useUsers(), [query])

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    test('should pass through custom options', async ({
      renderHook,
      query
    }) => {
      const mockData = { users: [] }
      mockPost.mockResolvedValue({ data: mockData })
      const customOptions = { staleTime: 5000 }

      const { result } = renderHook(() => useUsers(customOptions), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPost).toHaveBeenCalledWith('/users/')
    })
  })
})
