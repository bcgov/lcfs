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
  useDownloadFuelCodes,
  useFuelCodeMutation
} from '../useFuelCode'

vi.mock('@/services/useApiService')
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
      removeQueries: vi.fn()
    })
  }
})

describe('useFuelCode', () => {
  const mockGet = vi.fn()
  const mockPost = vi.fn()
  const mockPut = vi.fn()
  const mockDelete = vi.fn()
  const mockDownload = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({
      get: mockGet,
      post: mockPost,
      put: mockPut,
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

  describe('useFuelCodeMutation', () => {
    it('should handle create action successfully', async () => {
      const fuelCodeData = {
        fuelCode: 'FC002',
        fuelType: 'Diesel'
      }
      const mockResponse = { data: { fuelCodeId: 456 } }
      mockPost.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFuelCodeMutation(), { wrapper })

      result.current.mutate({ action: 'create', data: fuelCodeData })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPost).toHaveBeenCalledWith('/fuel-codes', fuelCodeData)
      expect(result.current.data).toEqual(mockResponse)
    })

    it('should handle update action successfully', async () => {
      const fuelCodeId = 123
      const updateData = { fuelType: 'Updated Diesel' }
      const mockResponse = { data: { success: true } }
      mockPut.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFuelCodeMutation(), { wrapper })

      result.current.mutate({ action: 'update', data: updateData, fuelCodeId })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPut).toHaveBeenCalledWith('/fuel-codes/123', updateData)
    })

    it('should handle approve action successfully', async () => {
      const fuelCodeId = 123
      const mockResponse = { data: { approved: true } }
      mockPut.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFuelCodeMutation(), { wrapper })

      result.current.mutate({ action: 'approve', fuelCodeId })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPut).toHaveBeenCalledWith('/fuel-codes/123', undefined)
    })

    it('should handle delete action successfully', async () => {
      const fuelCodeId = 123
      const mockResponse = { data: { deleted: true } }
      mockDelete.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFuelCodeMutation(), { wrapper })

      result.current.mutate({ action: 'delete', fuelCodeId })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockDelete).toHaveBeenCalledWith('/fuel-codes/123')
    })

    it('should handle download action successfully', async () => {
      const downloadData = {
        format: 'xlsx',
        body: { filters: [] }
      }
      const mockResponse = { data: 'file-content' }
      mockDownload.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFuelCodeMutation(), { wrapper })

      result.current.mutate({ action: 'download', data: downloadData })

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

    it('should throw error for unknown action', async () => {
      const { result } = renderHook(() => useFuelCodeMutation(), { wrapper })

      result.current.mutate({ action: 'unknown' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error.message).toBe('Unknown action: unknown')
    })

    it('should throw error for update without fuelCodeId', async () => {
      const { result } = renderHook(() => useFuelCodeMutation(), { wrapper })

      result.current.mutate({ action: 'update', data: {} })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error.message).toBe(
        'fuelCodeId is required for update operation'
      )
    })

    it('should throw error for delete without fuelCodeId', async () => {
      const { result } = renderHook(() => useFuelCodeMutation(), { wrapper })

      result.current.mutate({ action: 'delete' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error.message).toBe(
        'fuelCodeId is required for delete operation'
      )
    })

    it('should throw error for download without required data', async () => {
      const { result } = renderHook(() => useFuelCodeMutation(), { wrapper })

      result.current.mutate({ action: 'download', data: {} })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error.message).toBe(
        'format and body are required for download operation'
      )
    })
  })

  describe('useCreateFuelCode (backward compatibility)', () => {
    it('should create fuel code successfully', async () => {
      const fuelCodeData = {
        fuelCode: 'FC002',
        fuelType: 'Diesel'
      }
      const mockResponse = { data: { fuelCodeId: 456 } }
      mockPost.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useCreateFuelCode(), { wrapper })

      // Use mutateAsync since the backward compatibility hook wraps it
      await result.current.mutateAsync(fuelCodeData)

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

      try {
        await result.current.mutateAsync(fuelCodeData)
      } catch (error) {
        // Expected to throw
      }

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useUpdateFuelCode (backward compatibility)', () => {
    it('should update fuel code successfully', async () => {
      const fuelCodeID = 123
      const updateData = { fuelType: 'Updated Diesel' }
      const mockResponse = { data: { success: true } }
      mockPut.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useUpdateFuelCode(fuelCodeID), {
        wrapper
      })

      await result.current.mutateAsync(updateData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPut).toHaveBeenCalledWith('/fuel-codes/123', updateData)
    })

    it('should handle API errors during update', async () => {
      const fuelCodeID = 123
      const updateData = { fuelType: 'Updated' }
      const mockError = new Error('Update failed')
      mockPut.mockRejectedValue(mockError)

      const { result } = renderHook(() => useUpdateFuelCode(fuelCodeID), {
        wrapper
      })

      try {
        await result.current.mutateAsync(updateData)
      } catch (error) {
        // Expected to throw
      }

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useApproveFuelCode (backward compatibility)', () => {
    it('should approve fuel code successfully', async () => {
      const fuelCodeID = 123
      const mockResponse = { data: { approved: true } }
      mockPut.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useApproveFuelCode(), { wrapper })

      await result.current.mutateAsync(fuelCodeID)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPut).toHaveBeenCalledWith('/fuel-codes/123', undefined)
    })

    it('should handle API errors during approval', async () => {
      const fuelCodeID = 123
      const mockError = new Error('Approval failed')
      mockPut.mockRejectedValue(mockError)

      const { result } = renderHook(() => useApproveFuelCode(), { wrapper })

      try {
        await result.current.mutateAsync(fuelCodeID)
      } catch (error) {
        // Expected to throw
      }

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useDeleteFuelCode (backward compatibility)', () => {
    it('should delete fuel code successfully', async () => {
      const fuelCodeID = 123
      const mockResponse = { data: { deleted: true } }
      mockDelete.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useDeleteFuelCode(), { wrapper })

      await result.current.mutateAsync(fuelCodeID)

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

      try {
        await result.current.mutateAsync(fuelCodeID)
      } catch (error) {
        // Expected to throw
      }

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useDownloadFuelCodes (backward compatibility)', () => {
    it('should download fuel codes successfully', async () => {
      const downloadParams = {
        format: 'xlsx',
        body: { filters: [] }
      }
      const mockResponse = { data: 'file-content' }
      mockDownload.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useDownloadFuelCodes(), { wrapper })

      // Use mutateAsync since the backward compatibility hook wraps it
      await result.current.mutateAsync(downloadParams)

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

      try {
        await result.current.mutateAsync(downloadParams)
      } catch (error) {
        // Expected to throw
      }

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })
})
