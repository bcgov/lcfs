import { waitFor } from '@testing-library/react'
import axios from 'axios'
import { describe, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { useApiService } from '@/services/useApiService'
import { test } from '@/tests/utils/fixtures'
import {
  useCompliancePeriod,
  useListComplianceReports,
  useCreateComplianceReport,
  useGetComplianceReport,
  useGetComplianceReportSummary,
  useDeleteComplianceReport,
  useGetComplianceReportList,
  useGetComplianceReportStatuses,
  useComplianceReportWithCache
} from '../useComplianceReports'
import { roles } from '@/constants/roles'
import useComplianceReportStore from '@/stores/useComplianceReportStore'

vi.mock('@/services/useApiService')

const mockedCurrentUser = vi.hoisted(() => ({
  ready: true,
  organizationId: 1,
  roles: ['']
}))

vi.mock('../useCurrentUser', () => ({
  useCurrentUser: () => ({
    hasRoles: (...requestedRoles: string[]) =>
      requestedRoles.every((role) => mockedCurrentUser.roles.includes(role)),
    hasAnyRole: (...requestedRoles: string[]) =>
      requestedRoles.some((role) => mockedCurrentUser.roles.includes(role)),
    data: mockedCurrentUser.ready
      ? {
          organization:
            mockedCurrentUser.organizationId === 0
              ? null
              : { organizationId: mockedCurrentUser.organizationId }
        }
      : undefined,
    isLoading: !mockedCurrentUser.ready
  })
}))

describe('useComplianceReports', () => {
  const mockGet = vi.fn(
    (_url: string, _config?: unknown): Promise<{ data: unknown }> =>
      Promise.resolve({ data: undefined })
  )
  const mockPost = vi.fn(
    (_url: string, _data?: unknown): Promise<{ data: unknown }> =>
      Promise.resolve({ data: undefined })
  )
  const mockDelete = vi.fn(
    (_url: string, _config?: unknown): Promise<{ data: unknown }> =>
      Promise.resolve({ data: undefined })
  )
  const mockApiClient = Object.assign(axios.create(), {
    get: mockGet,
    post: mockPost,
    delete: mockDelete,
    download: async () => undefined
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue(mockApiClient)

    mockedCurrentUser.ready = true
    mockedCurrentUser.organizationId = 1
    mockedCurrentUser.roles = []
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
      const { result } = renderHook(
        () => useListComplianceReports(undefined),
        [query]
      )

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

  describe('useComplianceReportWithCache', () => {
    const report = { report: { complianceReportId: 1 } }

    const mockCurrentUser = async (
      organizationId: number | null | undefined
    ) => {
      mockedCurrentUser.ready = organizationId !== undefined
      mockedCurrentUser.organizationId = organizationId ?? 0
    }

    beforeEach(() => {
      // A page opened directly, or refreshed: nothing cached yet.
      useComplianceReportStore.setState({
        reportCache: new Map(),
        currentReport: null
      })
    })

    test('fetches the report for a government user, who has no organization', async ({
      renderHook,
      query
    }) => {
      await mockCurrentUser(null)
      mockGet.mockResolvedValue({ data: report })

      const { result } = renderHook(
        () => useComplianceReportWithCache(1),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
      expect(mockGet).toHaveBeenCalledWith('/reports/1')
      expect(result.current.data).toEqual(report)
    })

    test("fetches a supplier's report through its organization", async ({
      renderHook,
      query
    }) => {
      await mockCurrentUser(7)
      mockGet.mockResolvedValue({ data: report })

      const { result } = renderHook(
        () => useComplianceReportWithCache(1),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
      expect(mockGet).toHaveBeenCalledWith('/organization/7/reports/1')
    })

    test('waits for the current user before fetching', async ({
      renderHook,
      query
    }) => {
      await mockCurrentUser(undefined)

      const { result } = renderHook(
        () => useComplianceReportWithCache(1),
        [query]
      )

      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(mockGet).not.toHaveBeenCalled()
      expect(result.current.isPending).toBe(true)
    })

    test('returns a cached report without fetching', async ({
      renderHook,
      query
    }) => {
      await mockCurrentUser(null)
      useComplianceReportStore.setState({ reportCache: new Map([[1, report]]) })

      const { result } = renderHook(
        () => useComplianceReportWithCache(1),
        [query]
      )

      expect(result.current.data).toEqual(report)
      expect(result.current.isPending).toBe(false)
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(mockGet).not.toHaveBeenCalled()
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

      mockedCurrentUser.roles = [roles.government]

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

      mockedCurrentUser.roles = [roles.compliance_reporting]

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

      mockedCurrentUser.roles = [roles.signing_authority]

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
