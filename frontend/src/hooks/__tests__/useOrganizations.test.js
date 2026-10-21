import { waitFor } from '@testing-library/react'
import { describe, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { test } from '@/tests/utils/fixtures'
import { ORGANIZATION_STATUSES } from '@/constants/statuses'
import {
  useOrganizationStatuses,
  useOrganizationListStatuses,
  useOrganizationNames,
  useRegExtOrgs
} from '../useOrganizations'

vi.mock('@/services/useApiService')

describe('useOrganizations', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({
      get: mockGet
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('useOrganizationStatuses', () => {
    test('should fetch organization statuses successfully', async ({
      renderHook,
      query
    }) => {
      const mockData = {
        statuses: [
          { id: 1, name: 'Active', description: 'Active organization' },
          { id: 2, name: 'Inactive', description: 'Inactive organization' }
        ]
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useOrganizationStatuses(), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/organizations/statuses/')
    })

    test('should handle API errors', async ({ renderHook, query }) => {
      const mockError = new Error('Failed to fetch statuses')
      mockGet.mockRejectedValue(mockError)

      const { result } = renderHook(() => useOrganizationStatuses(), [query])

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    test('should pass through custom options', async ({
      renderHook,
      query
    }) => {
      const mockData = { statuses: [] }
      mockGet.mockResolvedValue({ data: mockData })
      const customOptions = { retry: 3 }

      const { result } = renderHook(
        () => useOrganizationStatuses(customOptions),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith('/organizations/statuses/')
    })
  })

  describe('useOrganizationListStatuses', () => {
    test('should filter organization statuses to only Registered and Unregistered', async ({
      renderHook,
      query
    }) => {
      const mockData = [
        { status: ORGANIZATION_STATUSES.REGISTERED, organizationStatusId: 1 },
        { status: ORGANIZATION_STATUSES.UNREGISTERED, organizationStatusId: 2 },
        { status: ORGANIZATION_STATUSES.SUSPENDED, organizationStatusId: 3 },
        { status: ORGANIZATION_STATUSES.CANCELED, organizationStatusId: 4 }
      ]
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useOrganizationListStatuses(),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toHaveLength(2)
      expect(result.current.data).toEqual([
        { status: ORGANIZATION_STATUSES.REGISTERED, organizationStatusId: 1 },
        { status: ORGANIZATION_STATUSES.UNREGISTERED, organizationStatusId: 2 }
      ])
      expect(mockGet).toHaveBeenCalledWith('/organizations/statuses/')
    })

    test('should handle empty data', async ({ renderHook, query }) => {
      mockGet.mockResolvedValue({ data: [] })

      const { result } = renderHook(
        () => useOrganizationListStatuses(),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual([])
    })

    test('should handle only valid statuses in response', async ({
      renderHook,
      query
    }) => {
      const mockData = [
        { status: ORGANIZATION_STATUSES.REGISTERED, organizationStatusId: 1 },
        { status: ORGANIZATION_STATUSES.UNREGISTERED, organizationStatusId: 2 }
      ]
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useOrganizationListStatuses(),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toHaveLength(2)
      expect(result.current.data).toEqual(mockData)
    })

    test('should handle API errors', async ({ renderHook, query }) => {
      const mockError = new Error('Failed to fetch statuses')
      mockGet.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useOrganizationListStatuses(),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    test('should pass through custom options', async ({
      renderHook,
      query
    }) => {
      const mockData = [
        { status: ORGANIZATION_STATUSES.REGISTERED, organizationStatusId: 1 }
      ]
      mockGet.mockResolvedValue({ data: mockData })
      const customOptions = { retry: 3 }

      const { result } = renderHook(
        () => useOrganizationListStatuses(customOptions),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith('/organizations/statuses/')
    })
  })

  describe('useOrganizationNames', () => {
    test('should fetch organization names without status filter', async ({
      renderHook,
      query
    }) => {
      const mockData = {
        organizations: [
          { id: 1, name: 'Org A' },
          { id: 2, name: 'Org B' }
        ]
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useOrganizationNames(), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/organizations/names/')
    })

    test('should fetch organization names with single status filter', async ({
      renderHook,
      query
    }) => {
      const mockData = {
        organizations: [{ id: 1, name: 'Active Org A' }]
      }
      const statuses = ['active']
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useOrganizationNames(statuses),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith(
        '/organizations/names/?statuses=active'
      )
    })

    test('should fetch organization names with multiple status filters', async ({
      renderHook,
      query
    }) => {
      const mockData = {
        organizations: [
          { id: 1, name: 'Active Org A' },
          { id: 2, name: 'Pending Org B' }
        ]
      }
      const statuses = ['active', 'pending']
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useOrganizationNames(statuses),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith(
        '/organizations/names/?statuses=active&statuses=pending'
      )
    })

    test('should handle empty status array', async ({ renderHook, query }) => {
      const mockData = { organizations: [] }
      const statuses = []
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useOrganizationNames(statuses),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith('/organizations/names/')
    })

    test('should handle null status parameter', async ({
      renderHook,
      query
    }) => {
      const mockData = { organizations: [] }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useOrganizationNames(null), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith('/organizations/names/')
    })

    test('should handle non-array status parameter', async ({
      renderHook,
      query
    }) => {
      const mockData = { organizations: [] }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useOrganizationNames('active'),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith('/organizations/names/')
    })

    test('should handle API errors', async ({ renderHook, query }) => {
      const mockError = new Error('Failed to fetch organization names')
      mockGet.mockRejectedValue(mockError)

      const { result } = renderHook(() => useOrganizationNames(), [query])

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    test('should pass through custom options', async ({
      renderHook,
      query
    }) => {
      const mockData = { organizations: [] }
      mockGet.mockResolvedValue({ data: mockData })
      const customOptions = { staleTime: 5000 }

      const { result } = renderHook(
        () => useOrganizationNames(['active'], customOptions),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith(
        '/organizations/names/?statuses=active'
      )
    })

    test('should support custom org filters', async ({ renderHook, query }) => {
      const mockData = { organizations: [] }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useOrganizationNames(['active'], { orgFilter: 'all' }),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith(
        '/organizations/names/all?statuses=active'
      )
    })

    test('should append arbitrary organization filters', async ({
      renderHook,
      query
    }) => {
      const mockData = { organizations: [] }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () =>
          useOrganizationNames(null, {
            orgFilter: 'all',
            filters: { name: ['Org A'], city: 'Victoria', active: true }
          }),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith(
        '/organizations/names/all?name=Org%20A&city=Victoria&active=true'
      )
    })

    test('should allow query params and react-query options together', async ({
      renderHook,
      query
    }) => {
      const mockData = { organizations: [] }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () =>
          useOrganizationNames(
            ['Registered'],
            { orgFilter: 'all', filters: { city: 'Victoria' } },
            { staleTime: 1000 }
          ),
        [query]
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith(
        '/organizations/names/all?statuses=Registered&city=Victoria'
      )
    })
  })

  describe('useRegExtOrgs', () => {
    test('should fetch registered external organizations successfully', async ({
      renderHook,
      query
    }) => {
      const mockData = {
        organizations: [
          { id: 1, name: 'External Org A', type: 'external' },
          { id: 2, name: 'External Org B', type: 'external' }
        ]
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useRegExtOrgs(), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
        expect(result.current.data).toEqual(mockData)
      })

      expect(mockGet).toHaveBeenCalledWith('/organizations/registered/external')
    })

    test('should have initial data as empty array', ({ renderHook, query }) => {
      const { result } = renderHook(() => useRegExtOrgs(), [query])

      expect(result.current.data).toEqual([])
    })

    test('should handle API errors', async ({ renderHook, query }) => {
      const mockError = new Error('Failed to fetch external orgs')
      mockGet.mockRejectedValue(mockError)

      const { result } = renderHook(() => useRegExtOrgs(), [query])

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
      // Should still have initial data even on error
      expect(result.current.data).toEqual([])
    })

    test('should pass through custom options', async ({
      renderHook,
      query
    }) => {
      const mockData = { organizations: [] }
      mockGet.mockResolvedValue({ data: mockData })
      const customOptions = { refetchOnWindowFocus: false }

      const { result } = renderHook(() => useRegExtOrgs(customOptions), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith('/organizations/registered/external')
    })

    test('should use correct query key for caching', async ({
      renderHook,
      query
    }) => {
      const mockData = { organizations: [] }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useRegExtOrgs(), [query])

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
        expect(result.current.data).toEqual(mockData)
      })

      // The hook should use ['registered-external-orgs'] as query key
      expect(mockGet).toHaveBeenCalledWith('/organizations/registered/external')
    })
  })
})
