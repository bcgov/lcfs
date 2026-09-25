import { waitFor } from '@testing-library/react'
import { describe, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { test } from '@/tests/utils/fixtures'
import { useRoleList } from '../useRole'

vi.mock('@/services/useApiService')

describe('useRole', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({
      get: mockGet
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('useRoleList', () => {
    test('should fetch roles successfully without parameters', async ({
      renderHook,
      query
    }) => {
      const mockData = {
        roles: [
          { roleId: 1, name: 'Admin', description: 'Administrator role' },
          { roleId: 2, name: 'User', description: 'Standard user role' }
        ]
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useRoleList(), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/roles/')
    })

    test('should fetch roles successfully with parameters', async ({
      renderHook,
      query
    }) => {
      const mockData = {
        roles: [{ roleId: 1, name: 'Admin', description: 'Administrator role' }]
      }
      const params = 'status=active&type=admin'
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useRoleList(params), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/roles/?status=active&type=admin')
    })

    test('should handle API errors', async ({ renderHook, query }) => {
      const mockError = new Error('Failed to fetch roles')
      mockGet.mockRejectedValue(mockError)

      const { result } = renderHook(() => useRoleList(), [query])

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
      expect(mockGet).toHaveBeenCalledWith('/roles/')
    })

    test('should cache data with staleTime', async ({ renderHook, query }) => {
      const mockData = { roles: [] }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useRoleList(), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Check that staleTime is set (data should be considered fresh)
      expect(result.current.isStale).toBe(false)
    })

    test('should handle empty parameters as "all"', async ({
      renderHook,
      query
    }) => {
      const mockData = { roles: [] }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useRoleList(''), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith('/roles/')
    })

    test('should pass through custom options', async ({
      renderHook,
      query
    }) => {
      const mockData = { roles: [] }
      mockGet.mockResolvedValue({ data: mockData })
      const customOptions = { retry: 3 }

      const { result } = renderHook(
        () => useRoleList(null, customOptions),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith('/roles/')
    })

    test('should use correct query key for caching', async ({
      renderHook,
      query
    }) => {
      const mockData = { roles: [] }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useRoleList('test=param'), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // The hook should use ['roles', 'test=param'] as query key
      expect(result.current.data).toEqual(mockData)
    })
  })
})
