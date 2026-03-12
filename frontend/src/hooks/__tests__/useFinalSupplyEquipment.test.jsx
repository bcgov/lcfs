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
  useGetFinalSupplyEquipmentImportJobStatus,
  useGetFSEReportingList,
  useSaveFSEReporting,
  useDeleteFSEReportingBatch,
  useUpdateFSEReportingActiveStatus,
  useSetFSEReportingDefaultDates,
  useImportFSEReportingUpdate,
  useGetFSEReportingUpdateJobStatus
} from '../useFinalSupplyEquipment'

// Mock the API service
const mockApiService = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  patch: vi.fn()
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
      '/final-supply-equipment/import-job-status/:jobID',
    saveFSEReportingBatch: '/final-supply-equipments/reporting/batch',
    updateFSEReportingActiveStatus:
      '/final-supply-equipments/reporting/active-status',
    fseReportingBulkUpdate:
      '/final-supply-equipments/reporting/bulk-update/:reportID',
    fseReportingBulkUpdateStatus:
      '/final-supply-equipments/reporting/bulk-update/status/:jobID'
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

  describe('useGetFSEReportingList', () => {
    it('should fetch FSE reporting list successfully', async () => {
      const mockData = {
        fseReports: [
          { id: 1, chargingEquipmentComplianceId: 1 },
          { id: 2, chargingEquipmentComplianceId: 2 }
        ],
        pagination: { total: 2, page: 1 }
      }
      mockApiService.post.mockResolvedValue({ data: mockData })

      const pagination = { page: 1, size: 10, filters: [], sort_orders: [] }
      const { result } = renderHook(
        () => useGetFSEReportingList(123, pagination, {}, 456),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockApiService.post).toHaveBeenCalledWith(
        '/final-supply-equipments/reporting/list?organizationId=456&complianceReportId=123',
        pagination
      )
    })

    it('should include mode in query params when provided', async () => {
      const mockData = { fseReports: [], pagination: {} }
      mockApiService.post.mockResolvedValue({ data: mockData })

      const pagination = { page: 1, size: 10, filters: [], sort_orders: [] }
      const { result } = renderHook(
        () => useGetFSEReportingList(123, pagination, {}, 456, 'edit'),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/final-supply-equipments/reporting/list?organizationId=456&complianceReportId=123&mode=edit',
        pagination
      )
    })

    it('should not fetch when organizationId is missing', () => {
      const pagination = { page: 1, size: 10, filters: [], sort_orders: [] }
      const { result } = renderHook(
        () => useGetFSEReportingList(123, pagination, {}, null),
        { wrapper: createWrapper() }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.post).not.toHaveBeenCalled()
    })

    it('should handle API errors', async () => {
      const mockError = new Error('Fetch failed')
      mockApiService.post.mockRejectedValue(mockError)

      const pagination = { page: 1, size: 10, filters: [], sort_orders: [] }
      const { result } = renderHook(
        () => useGetFSEReportingList(123, pagination, { retry: 0 }, 456),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useSaveFSEReporting', () => {
    it('should save single FSE reporting record successfully', async () => {
      const mockResponse = { data: { id: 1 } }
      mockApiService.put.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useSaveFSEReporting(456, 123), {
        wrapper: createWrapper()
      })

      const reportData = {
        chargingEquipmentComplianceId: 1,
        quantity: 100
      }

      result.current.mutate(reportData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.put).toHaveBeenCalledWith(
        '/final-supply-equipments/reporting/1',
        reportData
      )
    })

    it('should handle batch save operations', async () => {
      const mockResponse = { data: [] }
      mockApiService.post.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useSaveFSEReporting(456, 123), {
        wrapper: createWrapper()
      })

      const batchData = [
        { chargingEquipmentComplianceId: 1, quantity: 100 },
        { chargingEquipmentComplianceId: 2, quantity: 200 }
      ]

      result.current.mutate(batchData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/final-supply-equipments/reporting/batch',
        {
          fseReports: batchData,
          complianceReportId: 123,
          organizationId: 456
        }
      )
    })

    it('should handle save errors', async () => {
      const mockError = new Error('Save failed')
      mockApiService.put.mockRejectedValue(mockError)

      const { result } = renderHook(() => useSaveFSEReporting(456, 123), {
        wrapper: createWrapper()
      })

      result.current.mutate({ chargingEquipmentComplianceId: 1 })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useDeleteFSEReportingBatch', () => {
    it('should delete FSE reporting records in batch', async () => {
      const mockResponse = { data: {} }
      mockApiService.delete.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useDeleteFSEReportingBatch(123, 456),
        {
          wrapper: createWrapper()
        }
      )

      const reportingIds = [1, 2, 3]
      result.current.mutate(reportingIds)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.delete).toHaveBeenCalledWith(
        '/final-supply-equipments/reporting/batch',
        {
          data: {
            reportingIds,
            complianceReportId: 123,
            organizationId: 456
          }
        }
      )
    })

    it('should handle delete errors', async () => {
      const mockError = new Error('Delete failed')
      mockApiService.delete.mockRejectedValue(mockError)

      const { result } = renderHook(() => useDeleteFSEReportingBatch(123), {
        wrapper: createWrapper()
      })

      result.current.mutate([1, 2])

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('useUpdateFSEReportingActiveStatus', () => {
    it('should update active status for reporting rows', async () => {
      const mockResponse = { data: { updated: 2 } }
      mockApiService.patch.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useUpdateFSEReportingActiveStatus(123, 456),
        { wrapper: createWrapper() }
      )

      await result.current.mutateAsync({
        reportingIds: [1, 2],
        isActive: false
      })

      expect(mockApiService.patch).toHaveBeenCalledWith(
        '/final-supply-equipments/reporting/active-status',
        {
          reportingIds: [1, 2],
          isActive: false,
          complianceReportId: 123,
          organizationId: 456
        }
      )
    })

    it('should throw when payload is invalid', async () => {
      const { result } = renderHook(
        () => useUpdateFSEReportingActiveStatus(123),
        { wrapper: createWrapper() }
      )

      await expect(
        result.current.mutateAsync({ reportingIds: [], isActive: true })
      ).rejects.toThrow('Reporting IDs array is required')
    })
  })

  describe('useSetFSEReportingDefaultDates', () => {
    it('should set default dates successfully', async () => {
      const mockResponse = { data: { success: true } }
      mockApiService.post.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useSetFSEReportingDefaultDates(123), {
        wrapper: createWrapper()
      })

      const dateData = {
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      }

      result.current.mutate(dateData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/final-supply-equipments/reporting/set-default',
        dateData
      )
    })

    it('should handle errors', async () => {
      const mockError = new Error('Set default dates failed')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(() => useSetFSEReportingDefaultDates(123), {
        wrapper: createWrapper()
      })

      result.current.mutate({ startDate: '2024-01-01' })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  // -------------------------------------------------------------------------
  // useImportFSEReportingUpdate
  // -------------------------------------------------------------------------

  describe('useImportFSEReportingUpdate', () => {
    it('should upload the file and return job data on success', async () => {
      const mockResponse = { data: { jobId: 'bulk-job-1' } }
      mockApiService.post.mockResolvedValue(mockResponse)

      const { result } = renderHook(
        () => useImportFSEReportingUpdate(123),
        { wrapper: createWrapper() }
      )

      const file = new File(['xlsx'], 'update.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      result.current.mutate({ file })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/final-supply-equipments/reporting/bulk-update/123',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      )
    })

    it('should throw when complianceReportId is missing', async () => {
      const { result } = renderHook(
        () => useImportFSEReportingUpdate(null),
        { wrapper: createWrapper() }
      )

      const file = new File(['xlsx'], 'update.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      result.current.mutate({ file })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error.message).toMatch(/Compliance report ID is required/)
    })

    it('should call onSuccess callback when provided', async () => {
      const onSuccess = vi.fn()
      mockApiService.post.mockResolvedValue({ data: { jobId: 'bulk-job-2' } })

      const { result } = renderHook(
        () => useImportFSEReportingUpdate(456, { onSuccess }),
        { wrapper: createWrapper() }
      )

      const file = new File(['xlsx'], 'update.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      result.current.mutate({ file })

      await waitFor(() => {
        // React Query v5 calls onSuccess(data, variables, context, mutation)
        expect(onSuccess).toHaveBeenCalled()
        expect(onSuccess.mock.calls[0][0]).toEqual({ jobId: 'bulk-job-2' })
      })
    })

    it('should call onError callback when upload fails', async () => {
      const onError = vi.fn()
      const mockError = new Error('Upload failed')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useImportFSEReportingUpdate(123, { onError }),
        { wrapper: createWrapper() }
      )

      const file = new File(['xlsx'], 'update.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      result.current.mutate({ file })

      await waitFor(() => {
        // React Query v5 calls onError(error, variables, context, mutation)
        expect(onError).toHaveBeenCalled()
        expect(onError.mock.calls[0][0]).toEqual(mockError)
      })
    })
  })

  // -------------------------------------------------------------------------
  // useGetFSEReportingUpdateJobStatus
  // -------------------------------------------------------------------------

  describe('useGetFSEReportingUpdateJobStatus', () => {
    it('should fetch job status including skipped count', async () => {
      const mockStatus = {
        progress: 100,
        status: 'Import process completed.',
        created: 10,
        rejected: 2,
        skipped: 3,
        errors: []
      }
      mockApiService.get.mockResolvedValue({ data: mockStatus })

      const { result } = renderHook(
        () => useGetFSEReportingUpdateJobStatus('bulk-job-1'),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockStatus)
      expect(result.current.data.skipped).toBe(3)
      expect(mockApiService.get).toHaveBeenCalledWith(
        '/final-supply-equipments/reporting/bulk-update/status/bulk-job-1'
      )
    })

    it('should not fetch when jobId is falsy', () => {
      const { result } = renderHook(
        () => useGetFSEReportingUpdateJobStatus(null),
        { wrapper: createWrapper() }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should not fetch when enabled is false', () => {
      const { result } = renderHook(
        () => useGetFSEReportingUpdateJobStatus('bulk-job-1', { enabled: false }),
        { wrapper: createWrapper() }
      )

      expect(result.current.status).toBe('pending')
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should handle API errors', async () => {
      const mockError = new Error('Status fetch failed')
      mockApiService.get.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useGetFSEReportingUpdateJobStatus('bad-job', { retry: 0 }),
        { wrapper: createWrapper() }
      )

      await waitFor(
        () => { expect(result.current.isError).toBe(true) },
        { timeout: 5000 }
      )

      expect(result.current.error).toEqual(mockError)
    })
  })
})
