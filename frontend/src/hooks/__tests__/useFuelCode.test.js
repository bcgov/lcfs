import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { wrapper } from '@/tests/utils/wrapper'
import {
  useFuelCodeOptions,
  useGetFuelCode,
  useCreateFuelCode,
  useUpdateFuelCode,
  useApproveFuelCode,
  useDeleteFuelCode,
  useFuelCodeStatuses,
  useTransportModes,
  useGetFuelCodes,
  useDownloadFuelCodes
} from '../useFuelCode'

vi.mock('@/services/useApiService')

describe('useFuelCode', () => {
  const mockGet = vi.fn()
  const mockPost = vi.fn()
  const mockDelete = vi.fn()
  const mockDownload = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({
      get: mockGet,
      post: mockPost,
      delete: mockDelete,
      download: mockDownload
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('useFuelCodeOptions', () => {
    it('should fetch fuel code options successfully', async () => {
      const mockData = {
        options: [
          { id: 1, name: 'Option A' },
          { id: 2, name: 'Option B' }
        ]
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useFuelCodeOptions(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/fuel-codes/table-options')
    })

    it('should handle API errors', async () => {
      const mockError = new Error('Failed to fetch options')
      mockGet.mockRejectedValue(mockError)

      const { result } = renderHook(() => useFuelCodeOptions(), { wrapper })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useGetFuelCode', () => {
    it('should fetch fuel code successfully when ID provided', async () => {
      const fuelCodeID = 123
      const mockData = {
        fuelCodeId: fuelCodeID,
        fuelCode: 'FC001',
        fuelType: 'Gasoline'
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useGetFuelCode(fuelCodeID), {
        wrapper
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/fuel-codes/123')
    })

    it('should not fetch when ID is not provided', () => {
      const { result } = renderHook(() => useGetFuelCode(), { wrapper })

      expect(result.current.isLoading).toBe(false)
      expect(result.current.fetchStatus).toBe('idle')
      expect(mockGet).not.toHaveBeenCalled()
    })

    it('should not fetch when ID is null', () => {
      const { result } = renderHook(() => useGetFuelCode(null), { wrapper })

      expect(result.current.isLoading).toBe(false)
      expect(result.current.fetchStatus).toBe('idle')
      expect(mockGet).not.toHaveBeenCalled()
    })
  })

  describe('useCreateFuelCode', () => {
    it('should create fuel code successfully', async () => {
      const fuelCodeData = {
        fuelCode: 'FC002',
        fuelType: 'Diesel'
      }
      const mockResponse = { data: { fuelCodeId: 456 } }
      mockPost.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useCreateFuelCode(), { wrapper })

      result.current.mutate(fuelCodeData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPost).toHaveBeenCalledWith('/fuel-codes', fuelCodeData)
      expect(result.current.data).toEqual(mockResponse)
    })

    it('should handle API errors during creation', async () => {
      const fuelCodeData = { fuelCode: 'FC002' }
      const mockError = new Error('Creation failed')
      mockPost.mockRejectedValue(mockError)

      const { result } = renderHook(() => useCreateFuelCode(), { wrapper })

      result.current.mutate(fuelCodeData)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useUpdateFuelCode', () => {
    it('should update fuel code successfully', async () => {
      const fuelCodeID = 123
      const updateData = { fuelType: 'Updated Diesel' }
      const mockResponse = { data: { success: true } }
      mockPost.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useUpdateFuelCode(fuelCodeID), {
        wrapper
      })

      result.current.mutate(updateData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPost).toHaveBeenCalledWith('/fuel-codes', {
        ...updateData,
        fuelCodeID
      })
    })

    it('should handle API errors during update', async () => {
      const fuelCodeID = 123
      const updateData = { fuelType: 'Updated' }
      const mockError = new Error('Update failed')
      mockPost.mockRejectedValue(mockError)

      const { result } = renderHook(() => useUpdateFuelCode(fuelCodeID), {
        wrapper
      })

      result.current.mutate(updateData)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useApproveFuelCode', () => {
    it('should approve fuel code successfully', async () => {
      const fuelCodeID = 123
      const mockResponse = { data: { approved: true } }
      mockPost.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useApproveFuelCode(), { wrapper })

      result.current.mutate(fuelCodeID)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPost).toHaveBeenCalledWith('/fuel-codes/123/approve')
    })

    it('should handle API errors during approval', async () => {
      const fuelCodeID = 123
      const mockError = new Error('Approval failed')
      mockPost.mockRejectedValue(mockError)

      const { result } = renderHook(() => useApproveFuelCode(), { wrapper })

      result.current.mutate(fuelCodeID)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useDeleteFuelCode', () => {
    it('should delete fuel code successfully', async () => {
      const fuelCodeID = 123
      const mockResponse = { data: { deleted: true } }
      mockDelete.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useDeleteFuelCode(), { wrapper })

      result.current.mutate(fuelCodeID)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockDelete).toHaveBeenCalledWith('/fuel-codes/123')
    })

    it('should handle API errors during deletion', async () => {
      const fuelCodeID = 123
      const mockError = new Error('Deletion failed')
      mockDelete.mockRejectedValue(mockError)

      const { result } = renderHook(() => useDeleteFuelCode(), { wrapper })

      result.current.mutate(fuelCodeID)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useFuelCodeStatuses', () => {
    it('should fetch fuel code statuses successfully', async () => {
      const mockData = {
        statuses: [
          { id: 1, name: 'Draft' },
          { id: 2, name: 'Approved' }
        ]
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useFuelCodeStatuses(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/fuel-codes/statuses')
    })
  })

  describe('useTransportModes', () => {
    it('should fetch transport modes successfully', async () => {
      const mockData = {
        transportModes: [
          { id: 1, name: 'Truck' },
          { id: 2, name: 'Pipeline' }
        ]
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useTransportModes(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/fuel-codes/transport-modes')
    })
  })

  describe('useGetFuelCodes', () => {
    it('should fetch fuel codes with default parameters', async () => {
      const mockData = {
        fuelCodes: [
          { fuelCodeId: 1, fuelCode: 'FC001' },
          { fuelCodeId: 2, fuelCode: 'FC002' }
        ],
        pagination: { page: 1, size: 10, total: 2 }
      }
      mockPost.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useGetFuelCodes(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockPost).toHaveBeenCalledWith('/fuel-codes/list', {
        page: 1,
        size: 10,
        sortOrders: [],
        filters: []
      })
    })

    it('should fetch fuel codes with custom parameters', async () => {
      const params = {
        page: 2,
        size: 20,
        sortOrders: [{ field: 'fuelCode', direction: 'asc' }],
        filters: [{ field: 'status', value: 'approved' }]
      }
      const mockData = {
        fuelCodes: [],
        pagination: { page: 2, size: 20, total: 0 }
      }
      mockPost.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useGetFuelCodes(params), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPost).toHaveBeenCalledWith('/fuel-codes/list', params)
    })

    it('should handle API errors', async () => {
      const mockError = new Error('Failed to fetch fuel codes')
      mockPost.mockRejectedValue(mockError)

      const { result } = renderHook(() => useGetFuelCodes(), { wrapper })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useDownloadFuelCodes', () => {
    it('should download fuel codes successfully', async () => {
      const downloadParams = {
        format: 'xlsx',
        body: { filters: [] }
      }
      const mockResponse = { data: 'file-content' }
      mockDownload.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useDownloadFuelCodes(), { wrapper })

      result.current.mutate(downloadParams)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockDownload).toHaveBeenCalledWith({
        url: '/fuel-codes/export',
        method: 'post',
        params: { format: 'xlsx' },
        data: { filters: [] }
      })
    })

    it('should handle download errors', async () => {
      const downloadParams = { format: 'csv', body: {} }
      const mockError = new Error('Download failed')
      mockDownload.mockRejectedValue(mockError)

      const { result } = renderHook(() => useDownloadFuelCodes(), { wrapper })

      result.current.mutate(downloadParams)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })
})
