import { waitFor } from '@testing-library/react'
import { describe, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { test } from '@/tests/utils/fixtures'
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
  useGetMyFuelCodes,
  useDownloadFuelCodes,
  useDownloadFuelCodeBulletins,
  useFuelCodeMutation,
  useFuelCodeBulletins
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
    test('should fetch fuel code options successfully', async ({
      renderHook,
      query
    }) => {
      const mockData = {
        options: [
          { id: 1, name: 'Option A' },
          { id: 2, name: 'Option B' }
        ]
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useFuelCodeOptions(), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/fuel-codes/table-options')
    })

    test('should handle API errors', async ({ renderHook, query }) => {
      const mockError = new Error('Failed to fetch options')
      mockGet.mockRejectedValue(mockError)

      const { result } = renderHook(() => useFuelCodeOptions(), [query])

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useGetFuelCode', () => {
    test('should fetch fuel code successfully when ID provided', async ({
      renderHook,
      query
    }) => {
      const fuelCodeID = 123
      const mockData = {
        fuelCodeId: fuelCodeID,
        fuelCode: 'FC001',
        fuelType: 'Gasoline'
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useGetFuelCode(fuelCodeID), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/fuel-codes/123')
    })

    test('should not fetch when ID is not provided', ({
      renderHook,
      query
    }) => {
      const { result } = renderHook(() => useGetFuelCode(), [query])

      expect(result.current.isLoading).toBe(false)
      expect(result.current.fetchStatus).toBe('idle')
      expect(mockGet).not.toHaveBeenCalled()
    })

    test('should not fetch when ID is null', ({ renderHook, query }) => {
      const { result } = renderHook(() => useGetFuelCode(null), [query])

      expect(result.current.isLoading).toBe(false)
      expect(result.current.fetchStatus).toBe('idle')
      expect(mockGet).not.toHaveBeenCalled()
    })
  })

  describe('useFuelCodeStatuses', () => {
    test('should fetch fuel code statuses successfully', async ({
      renderHook,
      query
    }) => {
      const mockData = {
        statuses: [
          { id: 1, name: 'Draft' },
          { id: 2, name: 'Approved' }
        ]
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useFuelCodeStatuses(), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/fuel-codes/statuses')
    })
  })

  describe('useTransportModes', () => {
    test('should fetch transport modes successfully', async ({
      renderHook,
      query
    }) => {
      const mockData = {
        transportModes: [
          { id: 1, name: 'Truck' },
          { id: 2, name: 'Pipeline' }
        ]
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useTransportModes(), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/fuel-codes/transport-modes')
    })
  })

  describe('useGetFuelCodes', () => {
    test('should fetch fuel codes with default parameters', async ({
      renderHook,
      query
    }) => {
      const mockData = {
        fuelCodes: [
          { fuelCodeId: 1, fuelCode: 'FC001' },
          { fuelCodeId: 2, fuelCode: 'FC002' }
        ],
        pagination: { page: 1, size: 10, total: 2 }
      }
      mockPost.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useGetFuelCodes(), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockPost).toHaveBeenCalledWith(
        '/fuel-codes/list',
        {
          page: 1,
          size: 10,
          sortOrders: [],
          filters: []
        },
        { params: undefined }
      )
    })

    test('should fetch fuel codes with custom parameters', async ({
      renderHook,
      query
    }) => {
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

      const { result } = renderHook(() => useGetFuelCodes(params), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPost).toHaveBeenCalledWith('/fuel-codes/list', params, {
        params: undefined
      })
    })

    test('should handle API errors', async ({ renderHook, query }) => {
      const mockError = new Error('Failed to fetch fuel codes')
      mockPost.mockRejectedValue(mockError)

      const { result } = renderHook(() => useGetFuelCodes(), [query])

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useGetMyFuelCodes', () => {
    test('posts to /fuel-codes/my-list with default pagination', async ({
      renderHook,
      query
    }) => {
      const mockData = {
        fuelCodes: [{ fuelCodeId: 9, fuelCode: 'BCLCF101.0' }],
        pagination: { page: 1, size: 10, total: 1 }
      }
      mockPost.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useGetMyFuelCodes(), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockPost).toHaveBeenCalledWith('/fuel-codes/my-list', {
        page: 1,
        size: 10,
        sortOrders: [],
        filters: []
      })
    })

    test('forwards pagination, sort and filter params to the request body', async ({
      renderHook,
      query
    }) => {
      const params = {
        page: 3,
        size: 50,
        sortOrders: [{ field: 'lastUpdated', direction: 'desc' }],
        filters: [
          {
            field: 'status',
            filterType: 'text',
            type: 'equals',
            filter: 'Approved'
          }
        ]
      }
      mockPost.mockResolvedValue({
        data: { fuelCodes: [], pagination: { page: 3, size: 50, total: 0 } }
      })

      const { result } = renderHook(() => useGetMyFuelCodes(params), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPost).toHaveBeenCalledWith('/fuel-codes/my-list', params)
    })

    test('surfaces API errors back through the query state', async ({
      renderHook,
      query
    }) => {
      const mockError = new Error('boom')
      mockPost.mockRejectedValue(mockError)

      const { result } = renderHook(() => useGetMyFuelCodes(), [query])

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useFuelCodeBulletins', () => {
    test('should fetch current bulletin rows with pagination payload', async ({
      renderHook,
      query
    }) => {
      const mockData = {
        cutoffDate: '2025-03-31',
        fuelCodes: [{ fuelCode: 'BCLCF101.0' }],
        pagination: { page: 1, size: 25, total: 1, totalPages: 1 }
      }
      mockPost.mockResolvedValue({ data: mockData })

      const pagination = {
        page: 1,
        size: 25,
        sortOrders: [{ field: 'fuelCode', direction: 'asc' }],
        filters: [{ field: 'company', filterType: 'text', type: 'contains', filter: 'co' }]
      }
      const { result } = renderHook(
        () => useFuelCodeBulletins('current', pagination),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockPost).toHaveBeenCalledWith(
        '/fuel-codes/bulletins?bulletinType=current',
        pagination
      )
    })

    test('should use defaults when pagination fields are missing', async ({
      renderHook,
      query
    }) => {
      mockPost.mockResolvedValue({
        data: { cutoffDate: '2025-03-31', fuelCodes: [], pagination: { total: 0 } }
      })

      const { result } = renderHook(
        () => useFuelCodeBulletins('archived', {}),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPost).toHaveBeenCalledWith(
        '/fuel-codes/bulletins?bulletinType=archived',
        {
          page: 1,
          size: 25,
          sortOrders: [],
          filters: []
        }
      )
    })
  })

  describe('useDownloadFuelCodeBulletins', () => {
    test('should call download with the bulletin export endpoint', async ({
      renderHook,
      query
    }) => {
      mockDownload.mockResolvedValue({ data: 'ok' })

      const { result } = renderHook(
        () => useDownloadFuelCodeBulletins(),
        [query]
      )

      await result.current.mutateAsync({
        bulletinType: 'current',
        format: 'xlsx',
        body: { page: 1, size: 25, sortOrders: [], filters: [] }
      })

      expect(mockDownload).toHaveBeenCalledWith({
        url: '/fuel-codes/bulletins/export',
        method: 'post',
        params: { bulletinType: 'current', format: 'xlsx' },
        data: { page: 1, size: 25, sortOrders: [], filters: [] }
      })
    })
  })

  describe('useFuelCodeMutation', () => {
    test('should handle create action successfully', async ({
      renderHook,
      query
    }) => {
      const fuelCodeData = {
        fuelCode: 'FC002',
        fuelType: 'Diesel'
      }
      const mockResponse = { data: { fuelCodeId: 456 } }
      mockPost.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFuelCodeMutation(), [query])

      result.current.mutate({ action: 'create', data: fuelCodeData })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPost).toHaveBeenCalledWith('/fuel-codes', fuelCodeData)
      expect(result.current.data).toEqual(mockResponse)
    })

    test('should handle update action successfully', async ({
      renderHook,
      query
    }) => {
      const fuelCodeId = 123
      const updateData = { fuelType: 'Updated Diesel' }
      const mockResponse = { data: { success: true } }
      mockPut.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFuelCodeMutation(), [query])

      result.current.mutate({ action: 'update', data: updateData, fuelCodeId })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPut).toHaveBeenCalledWith('/fuel-codes/123', updateData)
    })

    test('should handle approve action successfully', async ({
      renderHook,
      query
    }) => {
      const fuelCodeId = 123
      const mockResponse = { data: { approved: true } }
      mockPut.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFuelCodeMutation(), [query])

      result.current.mutate({ action: 'approve', fuelCodeId })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPut).toHaveBeenCalledWith('/fuel-codes/123', undefined)
    })

    test('should handle delete action successfully', async ({
      renderHook,
      query
    }) => {
      const fuelCodeId = 123
      const mockResponse = { data: { deleted: true } }
      mockDelete.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFuelCodeMutation(), [query])

      result.current.mutate({ action: 'delete', fuelCodeId })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockDelete).toHaveBeenCalledWith('/fuel-codes/123')
    })

    test('should handle download action successfully', async ({
      renderHook,
      query
    }) => {
      const downloadData = {
        format: 'xlsx',
        body: { filters: [] }
      }
      const mockResponse = { data: 'file-content' }
      mockDownload.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useFuelCodeMutation(), [query])

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

    test('should throw error for unknown action', async ({
      renderHook,
      query
    }) => {
      const { result } = renderHook(() => useFuelCodeMutation(), [query])

      result.current.mutate({ action: 'unknown' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error.message).toBe('Unknown action: unknown')
    })

    test('should throw error for update without fuelCodeId', async ({
      renderHook,
      query
    }) => {
      const { result } = renderHook(() => useFuelCodeMutation(), [query])

      result.current.mutate({ action: 'update', data: {} })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error.message).toBe(
        'fuelCodeId is required for update operation'
      )
    })

    test('should throw error for delete without fuelCodeId', async ({
      renderHook,
      query
    }) => {
      const { result } = renderHook(() => useFuelCodeMutation(), [query])

      result.current.mutate({ action: 'delete' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error.message).toBe(
        'fuelCodeId is required for delete operation'
      )
    })

    test('should throw error for download without required data', async ({
      renderHook,
      query
    }) => {
      const { result } = renderHook(() => useFuelCodeMutation(), [query])

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
    test('should create fuel code successfully', async ({
      renderHook,
      query
    }) => {
      const fuelCodeData = {
        fuelCode: 'FC002',
        fuelType: 'Diesel'
      }
      const mockResponse = { data: { fuelCodeId: 456 } }
      mockPost.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useCreateFuelCode(), [query])

      // Use mutateAsync since the backward compatibility hook wraps it
      await result.current.mutateAsync(fuelCodeData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPost).toHaveBeenCalledWith('/fuel-codes', fuelCodeData)
      expect(result.current.data).toEqual(mockResponse)
    })

    test('should handle API errors during creation', async ({
      renderHook,
      query
    }) => {
      const fuelCodeData = { fuelCode: 'FC002' }
      const mockError = new Error('Creation failed')
      mockPost.mockRejectedValue(mockError)

      const { result } = renderHook(() => useCreateFuelCode(), [query])

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
    test('should update fuel code successfully', async ({
      renderHook,
      query
    }) => {
      const fuelCodeID = 123
      const updateData = { fuelType: 'Updated Diesel' }
      const mockResponse = { data: { success: true } }
      mockPut.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useUpdateFuelCode(fuelCodeID),
        [query]
      )

      await result.current.mutateAsync(updateData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPut).toHaveBeenCalledWith('/fuel-codes/123', updateData)
    })

    test('should handle API errors during update', async ({
      renderHook,
      query
    }) => {
      const fuelCodeID = 123
      const updateData = { fuelType: 'Updated' }
      const mockError = new Error('Update failed')
      mockPut.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useUpdateFuelCode(fuelCodeID),
        [query]
      )

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
    test('should approve fuel code successfully', async ({
      renderHook,
      query
    }) => {
      const fuelCodeID = 123
      const mockResponse = { data: { approved: true } }
      mockPut.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useApproveFuelCode(), [query])

      await result.current.mutateAsync(fuelCodeID)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPut).toHaveBeenCalledWith('/fuel-codes/123', undefined)
    })

    test('should handle API errors during approval', async ({
      renderHook,
      query
    }) => {
      const fuelCodeID = 123
      const mockError = new Error('Approval failed')
      mockPut.mockRejectedValue(mockError)

      const { result } = renderHook(() => useApproveFuelCode(), [query])

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
    test('should delete fuel code successfully', async ({
      renderHook,
      query
    }) => {
      const fuelCodeID = 123
      const mockResponse = { data: { deleted: true } }
      mockDelete.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useDeleteFuelCode(), [query])

      await result.current.mutateAsync(fuelCodeID)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockDelete).toHaveBeenCalledWith('/fuel-codes/123')
    })

    test('should handle API errors during deletion', async ({
      renderHook,
      query
    }) => {
      const fuelCodeID = 123
      const mockError = new Error('Deletion failed')
      mockDelete.mockRejectedValue(mockError)

      const { result } = renderHook(() => useDeleteFuelCode(), [query])

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
    test('should download fuel codes successfully', async ({
      renderHook,
      query
    }) => {
      const downloadParams = {
        format: 'xlsx',
        body: { filters: [] }
      }
      const mockResponse = { data: 'file-content' }
      mockDownload.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useDownloadFuelCodes(), [query])

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

    test('should handle download errors', async ({ renderHook, query }) => {
      const downloadParams = { format: 'csv', body: {} }
      const mockError = new Error('Download failed')
      mockDownload.mockRejectedValue(mockError)

      const { result } = renderHook(() => useDownloadFuelCodes(), [query])

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
