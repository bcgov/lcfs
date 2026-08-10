import { waitFor } from '@testing-library/react'
import { describe, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { test } from '@/tests/utils/fixtures'
import {
  useTransfer,
  useCreateUpdateTransfer,
  useUpdateCategory
} from '../useTransfer'

vi.mock('@/services/useApiService')

describe('useTransfer', () => {
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

  describe('useTransfer', () => {
    test('should fetch transfer successfully', async ({
      renderHook,
      query
    }) => {
      const transferID = 123
      const mockData = {
        transferId: transferID,
        fromOrganization: 'Org A',
        toOrganization: 'Org B',
        quantity: 1000
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useTransfer(transferID), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/transfers/123')
    })

    test('should handle API errors', async ({ renderHook, query }) => {
      const transferID = 123
      const mockError = new Error('Transfer not found')
      mockGet.mockRejectedValue(mockError)

      const { result } = renderHook(() => useTransfer(transferID), [query])

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    test('should pass through custom options', async ({
      renderHook,
      query
    }) => {
      const transferID = 123
      const mockData = { transferId: transferID }
      mockGet.mockResolvedValue({ data: mockData })
      const customOptions = { enabled: false }

      const { result } = renderHook(
        () => useTransfer(transferID, customOptions),
        [query]
      )

      expect(result.current.fetchStatus).toBe('idle')
    })
  })

  describe('useCreateUpdateTransfer', () => {
    test('should create transfer when orgId provided but no transferId', async ({
      renderHook,
      query
    }) => {
      const orgId = 123
      const transferData = { quantity: 1000, toOrganization: 'Org B' }
      const mockResponse = { data: { transferId: 456 } }
      mockPost.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useCreateUpdateTransfer(orgId),
        [query]
      )

      result.current.mutate({ data: transferData })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPost).toHaveBeenCalledWith(
        'organization/123/transfers',
        transferData
      )
      expect(result.current.data).toEqual(mockResponse)
    })

    test('should update transfer when both orgId and transferId provided', async ({
      renderHook,
      query
    }) => {
      const orgId = 123
      const transferId = 456
      const transferData = { quantity: 2000 }
      const mockResponse = { data: { transferId } }
      mockPut.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useCreateUpdateTransfer(orgId, transferId),
        [query]
      )

      result.current.mutate({ data: transferData })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPut).toHaveBeenCalledWith(
        'organization/123/transfers/456',
        transferData
      )
    })

    test('should update transfer when only transferId provided (no orgId)', async ({
      renderHook,
      query
    }) => {
      const transferId = 456
      const transferData = { quantity: 1500 }
      const mockResponse = { data: { transferId } }
      mockPut.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useCreateUpdateTransfer(null, transferId),
        [query]
      )

      result.current.mutate({ data: transferData })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPut).toHaveBeenCalledWith('transfers/456', transferData)
    })

    test('should handle API errors during creation', async ({
      renderHook,
      query
    }) => {
      const orgId = 123
      const transferData = { quantity: 1000 }
      const mockError = new Error('Creation failed')
      mockPost.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useCreateUpdateTransfer(orgId),
        [query]
      )

      result.current.mutate({ data: transferData })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    test('should handle API errors during update', async ({
      renderHook,
      query
    }) => {
      const orgId = 123
      const transferId = 456
      const transferData = { quantity: 1000 }
      const mockError = new Error('Update failed')
      mockPut.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useCreateUpdateTransfer(orgId, transferId),
        [query]
      )

      result.current.mutate({ data: transferData })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    test('should return mutation object with correct properties', ({
      renderHook,
      query
    }) => {
      const { result } = renderHook(() => useCreateUpdateTransfer(123), [query])

      expect(result.current).toHaveProperty('mutate')
      expect(result.current).toHaveProperty('mutateAsync')
      expect(result.current).toHaveProperty('isPending')
      expect(result.current).toHaveProperty('isError')
      expect(result.current).toHaveProperty('isSuccess')
      expect(result.current).toHaveProperty('data')
      expect(result.current).toHaveProperty('error')
      expect(result.current).toHaveProperty('reset')
    })
  })

  describe('useUpdateCategory', () => {
    test('should update transfer category successfully', async ({
      renderHook,
      query
    }) => {
      const transferId = 123
      const category = 'Category A'
      const mockResponse = { data: { success: true } }
      mockPut.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useUpdateCategory(transferId),
        [query]
      )

      result.current.mutate(category)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPut).toHaveBeenCalledWith('transfers/123/category', category)
      expect(result.current.data).toEqual(mockResponse)
    })

    test('should handle API errors during category update', async ({
      renderHook,
      query
    }) => {
      const transferId = 123
      const category = 'Category A'
      const mockError = new Error('Category update failed')
      mockPut.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useUpdateCategory(transferId),
        [query]
      )

      result.current.mutate(category)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    test('should pass through custom options', async ({
      renderHook,
      query
    }) => {
      const transferId = 123
      const customOptions = { retry: 3 }
      const mockResponse = { data: { success: true } }
      mockPut.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useUpdateCategory(transferId, customOptions),
        [query]
      )

      result.current.mutate('Category A')

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPut).toHaveBeenCalledWith(
        'transfers/123/category',
        'Category A'
      )
    })

    test('should return mutation object with correct properties', ({
      renderHook,
      query
    }) => {
      const { result } = renderHook(() => useUpdateCategory(123), [query])

      expect(result.current).toHaveProperty('mutate')
      expect(result.current).toHaveProperty('mutateAsync')
      expect(result.current).toHaveProperty('isPending')
      expect(result.current).toHaveProperty('isError')
      expect(result.current).toHaveProperty('isSuccess')
      expect(result.current).toHaveProperty('data')
      expect(result.current).toHaveProperty('error')
      expect(result.current).toHaveProperty('reset')
    })
  })
})
