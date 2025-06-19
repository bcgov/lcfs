import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
  useOrganizationSnapshot,
  useUpdateOrganizationSnapshot
} from '../useOrganizationSnapshot'

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
    getOrganizationSnapshot: '/organization-snapshot/:reportID'
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

describe('useOrganizationSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useOrganizationSnapshot', () => {
    it('should fetch organization snapshot successfully', async () => {
      const mockSnapshot = {
        id: 1,
        organizationName: 'Test Organization',
        address: '123 Test St',
        reportId: 123
      }
      mockApiService.get.mockResolvedValue({ data: mockSnapshot })

      const { result } = renderHook(() => useOrganizationSnapshot(123), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockSnapshot)
      expect(mockApiService.get).toHaveBeenCalledWith(
        '/organization-snapshot/123'
      )
    })

    it('should not fetch when complianceReportId is missing', () => {
      const { result } = renderHook(() => useOrganizationSnapshot(null), {
        wrapper: createWrapper()
      })

      expect(result.current.status).toBe('pending')
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should handle enabled option', () => {
      const { result } = renderHook(
        () => useOrganizationSnapshot(123, { enabled: false }),
        { wrapper: createWrapper() }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should handle API errors', async () => {
      const mockError = new Error('API Error')
      mockApiService.get.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useOrganizationSnapshot(123, { retry: 0 }),
        {
          wrapper: createWrapper()
        }
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    it('should use custom cache and stale time options', async () => {
      const mockSnapshot = { id: 1, organizationName: 'Test Organization' }
      mockApiService.get.mockResolvedValue({ data: mockSnapshot })

      const customOptions = {
        staleTime: 60000,
        cacheTime: 120000
      }

      const { result } = renderHook(
        () => useOrganizationSnapshot(123, customOptions),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockSnapshot)
    })
  })

  describe('useUpdateOrganizationSnapshot', () => {
    it('should update organization snapshot successfully', async () => {
      const mockResponse = {
        data: {
          id: 1,
          organizationName: 'Updated Organization',
          address: '456 Updated St'
        }
      }
      mockApiService.put.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useUpdateOrganizationSnapshot(123), {
        wrapper: createWrapper()
      })

      const updateData = {
        organizationName: 'Updated Organization',
        address: '456 Updated St'
      }

      result.current.mutate(updateData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.put).toHaveBeenCalledWith(
        '/organization-snapshot/123',
        updateData
      )
    })

    it('should handle update errors', async () => {
      const mockError = new Error('Update failed')
      mockApiService.put.mockRejectedValue(mockError)

      const { result } = renderHook(() => useUpdateOrganizationSnapshot(123), {
        wrapper: createWrapper()
      })

      result.current.mutate({ organizationName: 'Test Organization' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    it('should handle clearCache option', async () => {
      const mockResponse = {
        data: { id: 1, organizationName: 'Updated Organization' }
      }
      mockApiService.put.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useUpdateOrganizationSnapshot(123, { clearCache: true }),
        { wrapper: createWrapper() }
      )

      result.current.mutate({ organizationName: 'Updated Organization' })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.put).toHaveBeenCalled()
    })

    it('should handle invalidateRelatedQueries option', async () => {
      const mockResponse = {
        data: { id: 1, organizationName: 'Updated Organization' }
      }
      mockApiService.put.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () =>
          useUpdateOrganizationSnapshot(123, {
            invalidateRelatedQueries: true
          }),
        { wrapper: createWrapper() }
      )

      result.current.mutate({ organizationName: 'Updated Organization' })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.put).toHaveBeenCalled()
    })

    it('should call custom onSuccess handler', async () => {
      const mockResponse = {
        data: { id: 1, organizationName: 'Updated Organization' }
      }
      const mockOnSuccess = vi.fn()
      mockApiService.put.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useUpdateOrganizationSnapshot(123, { onSuccess: mockOnSuccess }),
        { wrapper: createWrapper() }
      )

      const updateData = { organizationName: 'Updated Organization' }
      result.current.mutate(updateData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockOnSuccess).toHaveBeenCalledWith(
        mockResponse,
        updateData,
        undefined
      )
    })

    it('should call custom onError handler', async () => {
      const mockError = new Error('Update failed')
      const mockOnError = vi.fn()
      mockApiService.put.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useUpdateOrganizationSnapshot(123, { onError: mockOnError }),
        { wrapper: createWrapper() }
      )

      const updateData = { organizationName: 'Test Organization' }
      result.current.mutate(updateData)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(mockOnError).toHaveBeenCalledWith(mockError, updateData, undefined)
    })

    it('should require reportID for update', async () => {
      const { result } = renderHook(() => useUpdateOrganizationSnapshot(null), {
        wrapper: createWrapper()
      })

      result.current.mutate({ organizationName: 'Test Organization' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error.message).toBe('Report ID is required')
    })
  })
})
