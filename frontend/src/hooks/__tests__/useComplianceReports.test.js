import { waitFor } from '@testing-library/react'
import { describe, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { roles } from '@/constants/roles'
import { test } from '@/tests/utils/fixtures'
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
    test('should fetch compliance periods successfully', async ({
      renderHook,
      query
    }) => {
      const mockData = [
        { id: 1, description: '2023' },
        { id: 2, description: '2024' }
      ]
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useCompliancePeriod(), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/reports/compliance-periods')
    })
  })

  describe('useListComplianceReports', () => {
    test('should fetch compliance reports list successfully', async ({
      renderHook,
      query
    }) => {
      const orgID = 123
      const mockData = {
        reports: [
          { complianceReportId: 1, status: 'Draft' },
          { complianceReportId: 2, status: 'Submitted' }
        ]
      }
      mockPost.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useListComplianceReports(orgID),
        [query]
      )

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

    test('should not fetch when orgID is missing', async ({
      renderHook,
      query
    }) => {
      const { result } = renderHook(() => useListComplianceReports(), [query])

      expect(result.current.isLoading).toBe(false)
      expect(mockPost).not.toHaveBeenCalled()
    })
  })

  describe('useCreateComplianceReport', () => {
    test('should create compliance report successfully', async ({
      renderHook,
      query
    }) => {
      const orgID = 123
      const mockData = { complianceReportId: 1, status: 'Draft' }
      mockPost.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useCreateComplianceReport(orgID),
        [query]
      )

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
    test('should fetch compliance report successfully with orgID', async ({
      renderHook,
      query
    }) => {
      const orgID = 123
      const reportID = 1
      const mockData = { complianceReportId: 1, status: 'Draft' }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useGetComplianceReport(orgID, reportID),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/organization/123/reports/1')
    })

    test('should fetch compliance report successfully without orgID', async ({
      renderHook,
      query
    }) => {
      const reportID = 1
      const mockData = { complianceReportId: 1, status: 'Draft' }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useGetComplianceReport(null, reportID),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/reports/1')
    })
  })

  describe('useGetComplianceReportSummary', () => {
    test('should fetch compliance report summary successfully', async ({
      renderHook,
      query
    }) => {
      const reportID = 1
      const mockData = {
        complianceReportId: 1,
        summary: { totalCredits: 100, totalDebits: 50 }
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useGetComplianceReportSummary(reportID),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/reports/1/summary')
    })
  })

  describe('useDeleteComplianceReport', () => {
    test('should delete compliance report successfully', async ({
      renderHook,
      query
    }) => {
      const orgID = 123
      const reportID = 1
      const mockData = { message: 'Report deleted successfully' }
      mockDelete.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useDeleteComplianceReport(orgID, reportID),
        [query]
      )

      result.current.mutate()

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual({ data: mockData })
    })
  })

  describe('useGetComplianceReportList', () => {
    test('should fetch compliance report list for government user', async ({
      renderHook,
      query
    }) => {
      const mockData = {
        reports: [{ complianceReportId: 1, status: 'Draft' }],
        pagination: { total: 1, page: 1, size: 10 }
      }
      mockPost.mockResolvedValue({ data: mockData })

      const { useCurrentUser } = await import('../useCurrentUser')
      vi.mocked(useCurrentUser).mockReturnValue({
        hasRoles: vi.fn((...requestedRoles) =>
          requestedRoles.includes(roles.government)
        ),
        hasAnyRole: vi.fn(() => false),
        data: { organization: { organizationId: 1 } },
        isLoading: false
      })

      const { result } = renderHook(() => useGetComplianceReportList(), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockPost).toHaveBeenCalledWith('/reports/list', {
        page: 1,
        size: 10,
        sort_orders: [],
        filters: []
      })
    })

    test('should fetch org compliance reports for user with compliance_reporting role only', async ({
      renderHook,
      query
    }) => {
      const mockData = {
        reports: [{ complianceReportId: 1, status: 'Draft' }],
        pagination: { total: 1, page: 1, size: 10 }
      }
      mockPost.mockResolvedValue({ data: mockData })

      const { useCurrentUser } = await import('../useCurrentUser')
      vi.mocked(useCurrentUser).mockReturnValue({
        hasRoles: vi.fn(() => false),
        hasAnyRole: vi.fn((...requestedRoles) =>
          requestedRoles.includes(roles.compliance_reporting)
        ),
        data: { organization: { organizationId: 1 } },
        isLoading: false
      })

      const { result } = renderHook(() => useGetComplianceReportList(), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockPost).toHaveBeenCalledWith('/organization/1/reports/list', {
        page: 1,
        size: 10,
        sort_orders: [],
        filters: []
      })
    })

    test('should fetch org compliance reports for user with signing_authority role only', async ({
      renderHook,
      query
    }) => {
      const mockData = {
        reports: [{ complianceReportId: 1, status: 'Draft' }],
        pagination: { total: 1, page: 1, size: 10 }
      }
      mockPost.mockResolvedValue({ data: mockData })

      const { useCurrentUser } = await import('../useCurrentUser')
      vi.mocked(useCurrentUser).mockReturnValue({
        hasRoles: vi.fn(() => false),
        hasAnyRole: vi.fn((...requestedRoles) =>
          requestedRoles.includes(roles.signing_authority)
        ),
        data: { organization: { organizationId: 1 } },
        isLoading: false
      })

      const { result } = renderHook(() => useGetComplianceReportList(), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockPost).toHaveBeenCalledWith('/organization/1/reports/list', {
        page: 1,
        size: 10,
        sort_orders: [],
        filters: []
      })
    })
  })

  describe('useGetComplianceReportStatuses', () => {
    test('should fetch compliance report statuses successfully', async ({
      renderHook,
      query
    }) => {
      const mockData = [
        { id: 1, status: 'Draft' },
        { id: 2, status: 'Submitted' }
      ]
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useGetComplianceReportStatuses(),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/reports/statuses')
    })
  })
})
