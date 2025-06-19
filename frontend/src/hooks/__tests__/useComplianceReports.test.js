import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { wrapper } from '@/tests/utils/wrapper'
import {
  useCompliancePeriod,
  useListComplianceReports,
  useCreateComplianceReport,
  useGetComplianceReport,
  useGetComplianceReportSummary,
  useDeleteComplianceReport,
  useGetComplianceReportList,
  useGetComplianceReportStatuses
} from '../useComplianceReports'

vi.mock('@/services/useApiService')
vi.mock('../useCurrentUser')

describe('useComplianceReports', () => {
  const mockGet = vi.fn()
  const mockPost = vi.fn()
  const mockDelete = vi.fn()

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({
      get: mockGet,
      post: mockPost,
      delete: mockDelete
    })

    // Mock useCurrentUser for hooks that depend on it
    const { useCurrentUser } = await import('../useCurrentUser')
    vi.mocked(useCurrentUser).mockReturnValue({
      hasRoles: vi.fn(() => false),
      data: { organization: { organizationId: 1 } },
      isLoading: false
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('useCompliancePeriod', () => {
    it('should fetch compliance periods successfully', async () => {
      const mockData = [
        { id: 1, description: '2023' },
        { id: 2, description: '2024' }
      ]
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useCompliancePeriod(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/reports/compliance-periods')
    })
  })

  describe('useListComplianceReports', () => {
    it('should fetch compliance reports list successfully', async () => {
      const orgID = 123
      const mockData = {
        reports: [
          { complianceReportId: 1, status: 'Draft' },
          { complianceReportId: 2, status: 'Submitted' }
        ]
      }
      mockPost.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useListComplianceReports(orgID), {
        wrapper
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockPost).toHaveBeenCalledWith('/organization/123/reports/list', {
        page: 0,
        size: 20,
        sort_orders: [],
        filters: []
      })
    })

    it('should not fetch when orgID is missing', async () => {
      const { result } = renderHook(() => useListComplianceReports(), {
        wrapper
      })

      expect(result.current.isLoading).toBe(false)
      expect(mockPost).not.toHaveBeenCalled()
    })
  })

  describe('useCreateComplianceReport', () => {
    it('should create compliance report successfully', async () => {
      const orgID = 123
      const mockData = { complianceReportId: 1, status: 'Draft' }
      mockPost.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useCreateComplianceReport(orgID), {
        wrapper
      })

      const reportData = { compliancePeriodId: 1 }
      result.current.mutate(reportData)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockPost).toHaveBeenCalledWith(
        '/organization/123/reports',
        reportData
      )
      expect(result.current.data).toEqual({ data: mockData })
    })
  })

  describe('useGetComplianceReport', () => {
    it('should fetch compliance report successfully with orgID', async () => {
      const orgID = 123
      const reportID = 1
      const mockData = { complianceReportId: 1, status: 'Draft' }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useGetComplianceReport(orgID, reportID),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/organization/123/reports/1')
    })

    it('should fetch compliance report successfully without orgID', async () => {
      const reportID = 1
      const mockData = { complianceReportId: 1, status: 'Draft' }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useGetComplianceReport(null, reportID),
        {
          wrapper
        }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/reports/1')
    })
  })

  describe('useGetComplianceReportSummary', () => {
    it('should fetch compliance report summary successfully', async () => {
      const reportID = 1
      const mockData = {
        complianceReportId: 1,
        summary: { totalCredits: 100, totalDebits: 50 }
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useGetComplianceReportSummary(reportID),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/reports/1/summary')
    })
  })

  describe('useDeleteComplianceReport', () => {
    it('should delete compliance report successfully', async () => {
      const orgID = 123
      const reportID = 1
      const mockData = { message: 'Report deleted successfully' }
      mockDelete.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useDeleteComplianceReport(orgID, reportID),
        { wrapper }
      )

      result.current.mutate()

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual({ data: mockData })
    })
  })

  describe('useGetComplianceReportList', () => {
    it('should fetch compliance report list with default parameters', async () => {
      const mockData = {
        reports: [{ complianceReportId: 1, status: 'Draft' }],
        pagination: { total: 1, page: 1, size: 10 }
      }
      mockPost.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useGetComplianceReportList(), {
        wrapper
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockPost).toHaveBeenCalledWith('/reports/list', {
        page: 1,
        size: 10,
        sortOrders: [],
        filters: []
      })
    })
  })

  describe('useGetComplianceReportStatuses', () => {
    it('should fetch compliance report statuses successfully', async () => {
      const mockData = [
        { id: 1, status: 'Draft' },
        { id: 2, status: 'Submitted' }
      ]
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useGetComplianceReportStatuses(), {
        wrapper
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/reports/statuses')
    })
  })
})
