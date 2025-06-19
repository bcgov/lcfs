import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { wrapper } from '@/tests/utils/wrapper'
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
    it('should fetch transfer successfully', async () => {
      const transferID = 123
      const mockData = {
        transferId: transferID,
        fromOrganization: 'Org A',
        toOrganization: 'Org B',
        quantity: 1000
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useTransfer(transferID), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/transfers/123')
    })

    it('should handle API errors', async () => {
      const transferID = 123
      const mockError = new Error('Transfer not found')
      mockGet.mockRejectedValue(mockError)

      const { result } = renderHook(() => useTransfer(transferID), { wrapper })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    it('should pass through custom options', async () => {
      const transferID = 123
      const mockData = { transferId: transferID }
      mockGet.mockResolvedValue({ data: mockData })
      const customOptions = { enabled: false }

      const { result } = renderHook(
        () => useTransfer(transferID, customOptions),
        { wrapper }
      )

      expect(result.current.fetchStatus).toBe('idle')
    })
  })

  describe('useCreateUpdateTransfer', () => {
    it('should create transfer when orgId provided but no transferId', async () => {
      const orgId = 123
      const transferData = { quantity: 1000, toOrganization: 'Org B' }
      const mockResponse = { data: { transferId: 456 } }
      mockPost.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useCreateUpdateTransfer(orgId), {
        wrapper
      })

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

    it('should update transfer when both orgId and transferId provided', async () => {
      const orgId = 123
      const transferId = 456
      const transferData = { quantity: 2000 }
      const mockResponse = { data: { transferId } }
      mockPut.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useCreateUpdateTransfer(orgId, transferId),
        { wrapper }
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

    it('should update transfer when only transferId provided (no orgId)', async () => {
      const transferId = 456
      const transferData = { quantity: 1500 }
      const mockResponse = { data: { transferId } }
      mockPut.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useCreateUpdateTransfer(null, transferId),
        { wrapper }
      )

      result.current.mutate({ data: transferData })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPut).toHaveBeenCalledWith('transfers/456', transferData)
    })

    it('should handle API errors during creation', async () => {
      const orgId = 123
      const transferData = { quantity: 1000 }
      const mockError = new Error('Creation failed')
      mockPost.mockRejectedValue(mockError)

      const { result } = renderHook(() => useCreateUpdateTransfer(orgId), {
        wrapper
      })

      result.current.mutate({ data: transferData })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    it('should handle API errors during update', async () => {
      const orgId = 123
      const transferId = 456
      const transferData = { quantity: 1000 }
      const mockError = new Error('Update failed')
      mockPut.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useCreateUpdateTransfer(orgId, transferId),
        { wrapper }
      )

      result.current.mutate({ data: transferData })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    it('should return mutation object with correct properties', () => {
      const { result } = renderHook(() => useCreateUpdateTransfer(123), {
        wrapper
      })

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
    it('should update transfer category successfully', async () => {
      const transferId = 123
      const category = 'Category A'
      const mockResponse = { data: { success: true } }
      mockPut.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useUpdateCategory(transferId), {
        wrapper
      })

      result.current.mutate(category)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPut).toHaveBeenCalledWith('transfers/123/category', category)
      expect(result.current.data).toEqual(mockResponse)
    })

    it('should handle API errors during category update', async () => {
      const transferId = 123
      const category = 'Category A'
      const mockError = new Error('Category update failed')
      mockPut.mockRejectedValue(mockError)

      const { result } = renderHook(() => useUpdateCategory(transferId), {
        wrapper
      })

      result.current.mutate(category)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    it('should pass through custom options', async () => {
      const transferId = 123
      const customOptions = { retry: 3 }
      const mockResponse = { data: { success: true } }
      mockPut.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useUpdateCategory(transferId, customOptions),
        { wrapper }
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

    it('should return mutation object with correct properties', () => {
      const { result } = renderHook(() => useUpdateCategory(123), { wrapper })

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
