import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
  useFinalSupplyEquipmentOptions,
  useGetFinalSupplyEquipments,
  useSaveFinalSupplyEquipment,
  useUpdateFinalSupplyEquipment,
  useDeleteFinalSupplyEquipment,
  useImportFinalSupplyEquipment,
  useGetFinalSupplyEquipmentImportJobStatus
} from '../useFinalSupplyEquipment'

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
    finalSupplyEquipmentOptions: '/final-supply-equipment/options',
    getAllFinalSupplyEquipments: '/final-supply-equipment/list',
    saveFinalSupplyEquipments: '/final-supply-equipment',
    importFinalSupplyEquipments: '/final-supply-equipment/import/:reportID',
    getImportFinalSupplyEquipmentsJobStatus:
      '/final-supply-equipment/import-job-status/:jobID'
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

describe('useFinalSupplyEquipment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useFinalSupplyEquipmentOptions', () => {
    it('should fetch options successfully', async () => {
      const mockOptions = {
        levelOfEquipment: ['Option 1', 'Option 2'],
        intendedUse: ['Use 1', 'Use 2']
      }
      mockApiService.get.mockResolvedValue({ data: mockOptions })

      const { result } = renderHook(() => useFinalSupplyEquipmentOptions(), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockOptions)
      expect(mockApiService.get).toHaveBeenCalledWith(
        '/final-supply-equipment/options'
      )
    })

    it('should handle enabled option', () => {
      const { result } = renderHook(
        () => useFinalSupplyEquipmentOptions({ enabled: false }),
        { wrapper: createWrapper() }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should handle API errors', async () => {
      const mockError = new Error('API Error')
      mockApiService.get.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useFinalSupplyEquipmentOptions({ retry: 0 }),
        {
          wrapper: createWrapper()
        }
      )

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true)
        },
        { timeout: 3000 }
      )

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useGetFinalSupplyEquipments', () => {
    it('should fetch final supply equipments successfully', async () => {
      const mockEquipments = {
        finalSupplyEquipments: [
          { id: 1, levelOfEquipment: 'Level 1' },
          { id: 2, levelOfEquipment: 'Level 2' }
        ],
        pagination: { total: 2, page: 1 }
      }
      mockApiService.post.mockResolvedValue({ data: mockEquipments })

      const pagination = { page: 1, size: 10 }
      const { result } = renderHook(
        () => useGetFinalSupplyEquipments(123, pagination),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockEquipments)
      expect(mockApiService.post).toHaveBeenCalledWith(
        '/final-supply-equipment/list',
        { complianceReportId: 123, ...pagination }
      )
    })

    it('should not fetch when complianceReportId is missing', () => {
      const { result } = renderHook(
        () => useGetFinalSupplyEquipments(null, { page: 1, size: 10 }),
        { wrapper: createWrapper() }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })

    it('should handle enabled option', () => {
      const { result } = renderHook(
        () =>
          useGetFinalSupplyEquipments(
            123,
            { page: 1, size: 10 },
            { enabled: false }
          ),
        { wrapper: createWrapper() }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })
  })

  describe('useSaveFinalSupplyEquipment', () => {
    it('should save final supply equipment successfully', async () => {
      const mockResponse = { data: { id: 1, levelOfEquipment: 'Level 1' } }
      mockApiService.post.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useSaveFinalSupplyEquipment(123), {
        wrapper: createWrapper()
      })

      const equipmentData = {
        levelOfEquipment: { name: 'Level 1' },
        intendedUse: 'Use 1'
      }

      result.current.mutate(equipmentData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/final-supply-equipment',
        {
          ...equipmentData,
          levelOfEquipment: 'Level 1',
          complianceReportId: 123
        }
      )
    })

    it('should handle levelOfEquipment as string', async () => {
      const mockResponse = { data: { id: 1 } }
      mockApiService.post.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useSaveFinalSupplyEquipment(123), {
        wrapper: createWrapper()
      })

      const equipmentData = {
        levelOfEquipment: 'Level 1',
        intendedUse: 'Use 1'
      }

      result.current.mutate(equipmentData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/final-supply-equipment',
        {
          ...equipmentData,
          complianceReportId: 123
        }
      )
    })

    it('should handle save errors', async () => {
      const mockError = new Error('Save failed')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(() => useSaveFinalSupplyEquipment(123), {
        wrapper: createWrapper()
      })

      result.current.mutate({ levelOfEquipment: 'Level 1' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useUpdateFinalSupplyEquipment', () => {
    it('should update final supply equipment successfully', async () => {
      const mockResponse = {
        data: { id: 1, levelOfEquipment: 'Updated Level' }
      }
      mockApiService.put.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useUpdateFinalSupplyEquipment(123), {
        wrapper: createWrapper()
      })

      const equipmentData = {
        id: 1,
        levelOfEquipment: { name: 'Updated Level' },
        intendedUse: 'Updated Use'
      }

      result.current.mutate(equipmentData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.put).toHaveBeenCalledWith(
        '/final-supply-equipment/1',
        {
          ...equipmentData,
          levelOfEquipment: 'Updated Level',
          complianceReportId: 123
        }
      )
    })

    it('should handle update errors', async () => {
      const mockError = new Error('Update failed')
      mockApiService.put.mockRejectedValue(mockError)

      const { result } = renderHook(() => useUpdateFinalSupplyEquipment(123), {
        wrapper: createWrapper()
      })

      result.current.mutate({ id: 1, levelOfEquipment: 'Level 1' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useDeleteFinalSupplyEquipment', () => {
    it('should delete final supply equipment successfully', async () => {
      mockApiService.delete.mockResolvedValue({ data: {} })

      const { result } = renderHook(() => useDeleteFinalSupplyEquipment(123), {
        wrapper: createWrapper()
      })

      result.current.mutate(1)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.delete).toHaveBeenCalledWith(
        '/final-supply-equipment/1'
      )
    })

    it('should handle delete errors', async () => {
      const mockError = new Error('Delete failed')
      mockApiService.delete.mockRejectedValue(mockError)

      const { result } = renderHook(() => useDeleteFinalSupplyEquipment(123), {
        wrapper: createWrapper()
      })

      result.current.mutate(1)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useImportFinalSupplyEquipment', () => {
    it('should import final supply equipment successfully', async () => {
      const mockResponse = { data: { jobId: 'job-123', status: 'started' } }
      mockApiService.post.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useImportFinalSupplyEquipment(123), {
        wrapper: createWrapper()
      })

      const file = new File(['csv content'], 'equipment.csv', {
        type: 'text/csv'
      })
      result.current.mutate({ file })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/final-supply-equipment/import/123',
        expect.any(FormData),
        expect.objectContaining({
          accept: 'application/json',
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      )
    })

    it('should handle import errors', async () => {
      const mockError = new Error('Import failed')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(() => useImportFinalSupplyEquipment(123), {
        wrapper: createWrapper()
      })

      const file = new File(['csv content'], 'equipment.csv', {
        type: 'text/csv'
      })
      result.current.mutate({ file })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useGetFinalSupplyEquipmentImportJobStatus', () => {
    it('should fetch job status successfully', async () => {
      const mockJobStatus = {
        jobId: 'job-123',
        status: 'completed',
        progress: 100
      }
      mockApiService.get.mockResolvedValue({ data: mockJobStatus })

      const { result } = renderHook(
        () => useGetFinalSupplyEquipmentImportJobStatus('job-123'),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockJobStatus)
      expect(mockApiService.get).toHaveBeenCalledWith(
        '/final-supply-equipment/import-job-status/job-123'
      )
    })

    it('should not fetch when jobID is missing', () => {
      const { result } = renderHook(
        () => useGetFinalSupplyEquipmentImportJobStatus(null),
        { wrapper: createWrapper() }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should handle enabled option', () => {
      const { result } = renderHook(
        () =>
          useGetFinalSupplyEquipmentImportJobStatus('job-123', {
            enabled: false
          }),
        { wrapper: createWrapper() }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should handle API errors', async () => {
      const mockError = new Error('API Error')
      mockApiService.get.mockRejectedValue(mockError)

      const { result } = renderHook(
        () =>
          useGetFinalSupplyEquipmentImportJobStatus('job-123', { retry: 0 }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })
})
