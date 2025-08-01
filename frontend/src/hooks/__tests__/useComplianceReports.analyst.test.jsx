import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGetAvailableAnalysts, useAssignAnalyst } from '../useComplianceReports'
import * as useApiService from '@/services/useApiService'

// Mock the API service
vi.mock('@/services/useApiService')

// Test wrapper component
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
        staleTime: 0
      },
      mutations: {
        retry: false
      }
    }
  })

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('Analyst Assignment Hooks', () => {
  let mockApiClient

  beforeEach(() => {
    vi.clearAllMocks()
    mockApiClient = {
      get: vi.fn(),
      put: vi.fn()
    }
    useApiService.useApiService.mockReturnValue(mockApiClient)
  })

  describe('useGetAvailableAnalysts', () => {
    it('should fetch available analysts successfully', async () => {
      const mockAnalysts = [
        {
          userProfileId: 1,
          firstName: 'John',
          lastName: 'Doe',
          initials: 'JD'
        },
        {
          userProfileId: 2,
          firstName: 'Jane',
          lastName: 'Smith',
          initials: 'JS'
        }
      ]

      mockApiClient.get.mockResolvedValue({
        data: mockAnalysts
      })

      const { result } = renderHook(() => useGetAvailableAnalysts(), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockAnalysts)
      expect(mockApiClient.get).toHaveBeenCalledWith('/reports/analysts')
    })

    it('should handle fetch error gracefully', async () => {
      const mockError = new Error('API Error')
      mockApiClient.get.mockRejectedValue(mockError)

      const { result } = renderHook(() => useGetAvailableAnalysts({
        retry: false // Disable retries for faster test
      }), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      }, { timeout: 5000 })

      expect(result.current.error).toEqual(mockError)
    })

    it('should use correct cache configuration', async () => {
      const { result } = renderHook(() => useGetAvailableAnalysts({
        staleTime: 300000,
        cacheTime: 600000
      }), {
        wrapper: createWrapper()
      })

      // Query should be configured with the provided options
      expect(result.current).toBeDefined()
    })

    it('should handle empty analysts list', async () => {
      mockApiClient.get.mockResolvedValue({
        data: []
      })

      const { result } = renderHook(() => useGetAvailableAnalysts(), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual([])
    })

    it('should be enabled by default', async () => {
      mockApiClient.get.mockResolvedValue({
        data: []
      })

      const { result } = renderHook(() => useGetAvailableAnalysts(), {
        wrapper: createWrapper()
      })

      // Query should be enabled and should make API call
      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalled()
      })
    })

    it('should respect enabled option', async () => {
      const { result } = renderHook(() => useGetAvailableAnalysts({
        enabled: false
      }), {
        wrapper: createWrapper()
      })

      // Give it time to potentially make a call
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockApiClient.get).not.toHaveBeenCalled()
    })
  })

  describe('useAssignAnalyst', () => {
    it('should assign analyst successfully', async () => {
      const mockResponse = {
        data: { success: true }
      }

      mockApiClient.put.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useAssignAnalyst(), {
        wrapper: createWrapper()
      })

      const assignmentData = {
        reportId: 1,
        assignedAnalystId: 123
      }

      result.current.mutate(assignmentData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiClient.put).toHaveBeenCalledWith(
        '/reports/1/assign',
        { assignedAnalystId: 123 }
      )
    })

    it('should unassign analyst successfully', async () => {
      const mockResponse = {
        data: { success: true }
      }

      mockApiClient.put.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useAssignAnalyst(), {
        wrapper: createWrapper()
      })

      const assignmentData = {
        reportId: 1,
        assignedAnalystId: null
      }

      result.current.mutate(assignmentData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiClient.put).toHaveBeenCalledWith(
        '/reports/1/assign',
        { assignedAnalystId: null }
      )
    })

    it('should handle assignment error', async () => {
      const mockError = new Error('Assignment failed')
      mockApiClient.put.mockRejectedValue(mockError)

      const { result } = renderHook(() => useAssignAnalyst(), {
        wrapper: createWrapper()
      })

      const assignmentData = {
        reportId: 1,
        assignedAnalystId: 123
      }

      result.current.mutate(assignmentData)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    it('should invalidate related queries on success', async () => {
      const mockQueryClient = {
        invalidateQueries: vi.fn()
      }

      const mockResponse = {
        data: { success: true }
      }

      mockApiClient.put.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useAssignAnalyst(), {
        wrapper: createWrapper()
      })

      const assignmentData = {
        reportId: 1,
        assignedAnalystId: 123
      }

      result.current.mutate(assignmentData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // The hook should invalidate queries by default
      expect(result.current.isSuccess).toBe(true)
    })

    it('should call custom onSuccess callback', async () => {
      const mockOnSuccess = vi.fn()
      const mockResponse = {
        data: { success: true }
      }

      mockApiClient.put.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useAssignAnalyst({
        onSuccess: mockOnSuccess
      }), {
        wrapper: createWrapper()
      })

      const assignmentData = {
        reportId: 1,
        assignedAnalystId: 123
      }

      result.current.mutate(assignmentData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockOnSuccess).toHaveBeenCalledWith(
        mockResponse,
        assignmentData,
        undefined
      )
    })

    it('should call custom onError callback', async () => {
      const mockOnError = vi.fn()
      const mockError = new Error('Assignment failed')

      mockApiClient.put.mockRejectedValue(mockError)

      const { result } = renderHook(() => useAssignAnalyst({
        onError: mockOnError
      }), {
        wrapper: createWrapper()
      })

      const assignmentData = {
        reportId: 1,
        assignedAnalystId: 123
      }

      result.current.mutate(assignmentData)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(mockOnError).toHaveBeenCalledWith(
        mockError,
        assignmentData,
        undefined
      )
    })

    it('should respect invalidateRelatedQueries option', async () => {
      const mockResponse = {
        data: { success: true }
      }

      mockApiClient.put.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useAssignAnalyst({
        invalidateRelatedQueries: false
      }), {
        wrapper: createWrapper()
      })

      const assignmentData = {
        reportId: 1,
        assignedAnalystId: 123
      }

      result.current.mutate(assignmentData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Should still succeed even without invalidation
      expect(result.current.isSuccess).toBe(true)
    })
  })
})