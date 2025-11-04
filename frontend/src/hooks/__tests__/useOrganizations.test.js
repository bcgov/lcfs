import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { wrapper } from '@/tests/utils/wrapper'
import {
  useOrganizationStatuses,
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
    it('should fetch organization statuses successfully', async () => {
      const mockData = {
        statuses: [
          { id: 1, name: 'Active', description: 'Active organization' },
          { id: 2, name: 'Inactive', description: 'Inactive organization' }
        ]
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useOrganizationStatuses(), {
        wrapper
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/organizations/statuses/')
    })

    it('should handle API errors', async () => {
      const mockError = new Error('Failed to fetch statuses')
      mockGet.mockRejectedValue(mockError)

      const { result } = renderHook(() => useOrganizationStatuses(), {
        wrapper
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    it('should pass through custom options', async () => {
      const mockData = { statuses: [] }
      mockGet.mockResolvedValue({ data: mockData })
      const customOptions = { retry: 3 }

      const { result } = renderHook(
        () => useOrganizationStatuses(customOptions),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith('/organizations/statuses/')
    })
  })

  describe('useOrganizationNames', () => {
    it('should fetch organization names without status filter', async () => {
      const mockData = {
        organizations: [
          { id: 1, name: 'Org A' },
          { id: 2, name: 'Org B' }
        ]
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useOrganizationNames(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith('/organizations/names/')
    })

    it('should fetch organization names with single status filter', async () => {
      const mockData = {
        organizations: [{ id: 1, name: 'Active Org A' }]
      }
      const statuses = ['active']
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useOrganizationNames(statuses), {
        wrapper
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith(
        '/organizations/names/?statuses=active'
      )
    })

    it('should fetch organization names with multiple status filters', async () => {
      const mockData = {
        organizations: [
          { id: 1, name: 'Active Org A' },
          { id: 2, name: 'Pending Org B' }
        ]
      }
      const statuses = ['active', 'pending']
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useOrganizationNames(statuses), {
        wrapper
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(mockGet).toHaveBeenCalledWith(
        '/organizations/names/?statuses=active&statuses=pending'
      )
    })

    it('should handle empty status array', async () => {
      const mockData = { organizations: [] }
      const statuses = []
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useOrganizationNames(statuses), {
        wrapper
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith('/organizations/names/')
    })

    it('should handle null status parameter', async () => {
      const mockData = { organizations: [] }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useOrganizationNames(null), {
        wrapper
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith('/organizations/names/')
    })

    it('should handle non-array status parameter', async () => {
      const mockData = { organizations: [] }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useOrganizationNames('active'), {
        wrapper
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith('/organizations/names/')
    })

    it('should handle API errors', async () => {
      const mockError = new Error('Failed to fetch organization names')
      mockGet.mockRejectedValue(mockError)

      const { result } = renderHook(() => useOrganizationNames(), { wrapper })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
    })

    it('should pass through custom options', async () => {
      const mockData = { organizations: [] }
      mockGet.mockResolvedValue({ data: mockData })
      const customOptions = { staleTime: 5000 }

      const { result } = renderHook(
        () => useOrganizationNames(['active'], customOptions),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith(
        '/organizations/names/?statuses=active'
      )
    })

    it('should support custom org filters', async () => {
      const mockData = { organizations: [] }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useOrganizationNames(['active'], { orgFilter: 'all' }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith(
        '/organizations/names/all?statuses=active'
      )
    })

    it('should append arbitrary organization filters', async () => {
      const mockData = { organizations: [] }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () =>
          useOrganizationNames(null, {
            orgFilter: 'all',
            filters: { name: ['Org A'], city: 'Victoria', active: true }
          }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith(
        '/organizations/names/all?name=Org%20A&city=Victoria&active=true'
      )
    })

    it('should allow query params and react-query options together', async () => {
      const mockData = { organizations: [] }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () =>
          useOrganizationNames(
            ['Registered'],
            { orgFilter: 'all', filters: { city: 'Victoria' } },
            { staleTime: 1000 }
          ),
        { wrapper }
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
    it('should fetch registered external organizations successfully', async () => {
      const mockData = {
        organizations: [
          { id: 1, name: 'External Org A', type: 'external' },
          { id: 2, name: 'External Org B', type: 'external' }
        ]
      }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useRegExtOrgs(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
        expect(result.current.data).toEqual(mockData)
      })

      expect(mockGet).toHaveBeenCalledWith('/organizations/registered/external')
    })

    it('should have initial data as empty array', () => {
      const { result } = renderHook(() => useRegExtOrgs(), { wrapper })

      expect(result.current.data).toEqual([])
    })

    it('should handle API errors', async () => {
      const mockError = new Error('Failed to fetch external orgs')
      mockGet.mockRejectedValue(mockError)

      const { result } = renderHook(() => useRegExtOrgs(), { wrapper })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(mockError)
      // Should still have initial data even on error
      expect(result.current.data).toEqual([])
    })

    it('should pass through custom options', async () => {
      const mockData = { organizations: [] }
      mockGet.mockResolvedValue({ data: mockData })
      const customOptions = { refetchOnWindowFocus: false }

      const { result } = renderHook(() => useRegExtOrgs(customOptions), {
        wrapper
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGet).toHaveBeenCalledWith('/organizations/registered/external')
    })

    it('should use correct query key for caching', async () => {
      const mockData = { organizations: [] }
      mockGet.mockResolvedValue({ data: mockData })

      const { result } = renderHook(() => useRegExtOrgs(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
        expect(result.current.data).toEqual(mockData)
      })

      // The hook should use ['registered-external-orgs'] as query key
      expect(mockGet).toHaveBeenCalledWith('/organizations/registered/external')
    })
  })
})
