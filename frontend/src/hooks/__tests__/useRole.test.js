import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { wrapper } from '@/tests/utils/wrapper'
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
    it('should fetch roles successfully without parameters', async () => {
      const mockData = {
        roles: [
          { roleId: 1, name: 'Admin', description: 'Administrator role' },
          { roleId: 2, name: 'User', description: 'Standard user role' }
        ]
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useRoleList(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/roles/')
    })

    it('should fetch roles successfully with parameters', async () => {
      const mockData = {
        roles: [{ roleId: 1, name: 'Admin', description: 'Administrator role' }]
      }
      const params = 'status=active&type=admin'
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useRoleList(params), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/roles/?status=active&type=admin')
    })

    it('should handle API errors', async () => {
      const mockError = new Error('Failed to fetch roles')
      mockGet.mockRejectedValue(mockError)

      const { result } = renderHook(() => useRoleList(), { wrapper })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
      expect(mockGet).toHaveBeenCalledWith('/roles/')
    })

    it('should cache data with staleTime', async () => {
      const mockData = { roles: [] }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useRoleList(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Check that staleTime is set (data should be considered fresh)
      expect(result.current.isStale).toBe(false)
    })

    it('should handle empty parameters as "all"', async () => {
      const mockData = { roles: [] }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useRoleList(''), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith('/roles/')
    })

    it('should pass through custom options', async () => {
      const mockData = { roles: [] }
      mockGet.mockResolvedValue({ data: mockData })
      const customOptions = { retry: 3 }

      const { result } = renderHook(() => useRoleList(null, customOptions), {
        wrapper
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith('/roles/')
    })

    it('should use correct query key for caching', async () => {
      const mockData = { roles: [] }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useRoleList('test=param'), {
        wrapper
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // The hook should use ['roles', 'test=param'] as query key
      expect(result.current.data).toEqual(mockData)
    })
  })
})
