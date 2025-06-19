import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { wrapper } from '@/tests/utils/wrapper'
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
    it('should fetch user successfully when ID provided', async () => {
      const userId = 123
      const mockData = {
        userId,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useUser(userId), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/users/123')
    })

    it('should not fetch when ID is not provided', () => {
      const { result } = renderHook(() => useUser(), { wrapper })

      // With enabled: !!id, the query should be disabled and not fetch
      expect(result.current.status).toBe('pending')
      expect(result.current.fetchStatus).toBe('idle')
      expect(mockGet).not.toHaveBeenCalled()
    })

    it('should handle API errors', async () => {
      const userId = 123
      const mockError = new Error('User not found')
      mockGet.mockRejectedValue(mockError)

      const { result } = renderHook(() => useUser(userId), { wrapper })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useCreateUser', () => {
    it('should create user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        organizationId: 1
      }
      const mockResponse = { data: { userId: 456 } }
      mockPost.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useCreateUser(), { wrapper })

      result.current.mutate(userData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPost).toHaveBeenCalledWith('/users', userData)
      expect(result.current.data).toEqual(mockResponse)
    })

    it('should handle API errors during creation', async () => {
      const userData = { email: 'invalid-email' }
      const mockError = new Error('Invalid email format')
      mockPost.mockRejectedValue(mockError)

      const { result } = renderHook(() => useCreateUser(), { wrapper })

      result.current.mutate(userData)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useUpdateUser', () => {
    it('should update user successfully', async () => {
      const userId = 123
      const updateData = { firstName: 'Updated Name' }
      const mockResponse = { data: { success: true } }
      mockPut.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useUpdateUser(), { wrapper })

      result.current.mutate({ userID: userId, payload: updateData })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPut).toHaveBeenCalledWith('/users/123', updateData)
    })

    it('should handle API errors during update', async () => {
      const userId = 123
      const updateData = { firstName: 'Updated' }
      const mockError = new Error('Update failed')
      mockPut.mockRejectedValue(mockError)

      const { result } = renderHook(() => useUpdateUser(), { wrapper })

      result.current.mutate({ userID: userId, payload: updateData })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useDeleteUser', () => {
    it('should delete user successfully', async () => {
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

      const { result } = renderHook(() => useDeleteUser(), { wrapper })

      result.current.mutate(userId)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockDelete).toHaveBeenCalledWith('/users/123')
    })

    it('should handle API errors during deletion', async () => {
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

      const { result } = renderHook(() => useDeleteUser(), { wrapper })

      result.current.mutate(userId)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useUsers', () => {
    it('should fetch users successfully', async () => {
      const mockData = {
        users: [
          { userId: 1, email: 'user1@example.com' },
          { userId: 2, email: 'user2@example.com' }
        ]
      }
      mockPost.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useUsers(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockPost).toHaveBeenCalledWith('/users/')
    })

    it('should handle API errors', async () => {
      const mockError = new Error('Failed to fetch users')
      mockPost.mockRejectedValue(mockError)

      const { result } = renderHook(() => useUsers(), { wrapper })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    it('should pass through custom options', async () => {
      const mockData = { users: [] }
      mockPost.mockResolvedValue({ data: mockData })
      const customOptions = { staleTime: 5000 }

      const { result } = renderHook(() => useUsers(customOptions), {
        wrapper
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPost).toHaveBeenCalledWith('/users/')
    })
  })
})
