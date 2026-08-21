import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { wrapper } from '@/tests/utils/wrapper'
import {
  useAssignCIApplicationAnalyst,
  useCIApplicationOptions,
  useCIFacilityLocationSearch,
  useCreateCIApplication,
  useDeleteCIApplication,
  useGetCIApplication,
  useGetCIApplications,
  useRecordCIDecision,
  useRequestCIApplicationPathwayChanges,
  useSubmitCIApplication,
  useUpdateCIApplicationRiskAssessment,
  useUpdateCIApplicationStep1
} from '../useCIApplication'

vi.mock('@/services/useApiService')

const mockInvalidateQueries = vi.fn()
const mockSetQueryData = vi.fn()
const mockSetQueriesData = vi.fn()

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
      setQueryData: mockSetQueryData,
      setQueriesData: mockSetQueriesData
    })
  }
})

describe('useCIApplication hooks', () => {
  const mockGet = vi.fn()
  const mockPost = vi.fn()
  const mockPut = vi.fn()
  const mockDelete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete
    })
  })

  afterEach(() => vi.clearAllMocks())

  // ------------------------------------------------------------------
  // useCIApplicationOptions
  // ------------------------------------------------------------------

  describe('useCIApplicationOptions', () => {
    it('GETs /ci-applications/table-options and returns data', async () => {
      const data = { statuses: [], unitsOfMeasure: [] }
      mockGet.mockResolvedValue({ data })

      const { result } = renderHook(() => useCIApplicationOptions(), {
        wrapper
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(data)
      expect(mockGet).toHaveBeenCalledWith('/ci-applications/table-options')
    })

    it('surfaces errors', async () => {
      const err = new Error('boom')
      mockGet.mockRejectedValue(err)
      const { result } = renderHook(() => useCIApplicationOptions(), {
        wrapper
      })
      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error).toBe(err)
    })
  })

  describe('useCIFacilityLocationSearch', () => {
    it('GETs /ci-applications/location-search with city param', async () => {
      mockGet.mockResolvedValue({ data: ['Vancouver, BC, Canada'] })

      const { result } = renderHook(
        () => useCIFacilityLocationSearch({ city: 'Van' }),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(['Vancouver, BC, Canada'])
      expect(mockGet).toHaveBeenCalledWith(
        '/ci-applications/location-search?city=Van'
      )
    })

    it('does not fetch when no search term is provided', async () => {
      const { result } = renderHook(
        () => useCIFacilityLocationSearch({}),
        { wrapper }
      )

      expect(result.current.fetchStatus).toBe('idle')
      expect(mockGet).not.toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // useGetCIApplications (paginated list)
  // ------------------------------------------------------------------

  describe('useGetCIApplications', () => {
    it('POSTs /ci-applications/list with default pagination', async () => {
      const data = { ciApplications: [], pagination: { total: 0 } }
      mockPost.mockResolvedValue({ data })

      const { result } = renderHook(() => useGetCIApplications(), { wrapper })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(mockPost).toHaveBeenCalledWith('/ci-applications/list', {
        page: 1,
        size: 10,
        sortOrders: [],
        filters: []
      })
    })

    it('passes through custom pagination', async () => {
      mockPost.mockResolvedValue({
        data: { ciApplications: [], pagination: {} }
      })
      const params = {
        page: 3,
        size: 25,
        sortOrders: [{ field: 'updateDate', direction: 'desc' }],
        filters: [{ field: 'facilityCountry', filter: 'Canada' }]
      }
      const { result } = renderHook(() => useGetCIApplications(params), {
        wrapper
      })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(mockPost).toHaveBeenCalledWith('/ci-applications/list', params)
    })
  })

  // ------------------------------------------------------------------
  // useGetCIApplication (single)
  // ------------------------------------------------------------------

  describe('useGetCIApplication', () => {
    it('GETs /ci-applications/:id when id is provided', async () => {
      const data = { ciApplicationId: 7 }
      mockGet.mockResolvedValue({ data })
      const { result } = renderHook(() => useGetCIApplication(7), { wrapper })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(mockGet).toHaveBeenCalledWith('/ci-applications/7')
      expect(result.current.data).toEqual(data)
    })

    it('does not fetch when id is undefined', () => {
      const { result } = renderHook(() => useGetCIApplication(undefined), {
        wrapper
      })
      expect(result.current.fetchStatus).toBe('idle')
      expect(mockGet).not.toHaveBeenCalled()
    })

    it('does not fetch when id is null', () => {
      const { result } = renderHook(() => useGetCIApplication(null), {
        wrapper
      })
      expect(result.current.fetchStatus).toBe('idle')
      expect(mockGet).not.toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // useCreateCIApplication
  // ------------------------------------------------------------------

  describe('useCreateCIApplication', () => {
    it('POSTs /ci-applications and primes detail cache on success', async () => {
      const created = { ciApplicationId: 99, facilityCountry: 'Argentina' }
      mockPost.mockResolvedValue({ data: created })

      const { result } = renderHook(() => useCreateCIApplication(), { wrapper })
      const payload = { facilityCountry: 'Argentina' }
      const out = await result.current.mutateAsync(payload)

      expect(mockPost).toHaveBeenCalledWith('/ci-applications', payload)
      expect(out).toEqual(created)
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['ci-applications']
      })
      expect(mockSetQueryData).toHaveBeenCalledWith(
        ['ci-application', '99'],
        created
      )
    })

    it('propagates errors', async () => {
      mockPost.mockRejectedValue(new Error('api down'))
      const { result } = renderHook(() => useCreateCIApplication(), { wrapper })
      await expect(result.current.mutateAsync({})).rejects.toThrow('api down')
    })
  })

  // ------------------------------------------------------------------
  // useUpdateCIApplicationStep1
  // ------------------------------------------------------------------

  describe('useUpdateCIApplicationStep1', () => {
    it('PUTs /ci-applications/:id/step1 and updates cache', async () => {
      const updated = { ciApplicationId: 12, facilityCountry: 'Canada' }
      mockPut.mockResolvedValue({ data: updated })

      const { result } = renderHook(() => useUpdateCIApplicationStep1(12), {
        wrapper
      })
      const out = await result.current.mutateAsync({
        facilityCountry: 'Canada'
      })

      expect(mockPut).toHaveBeenCalledWith('/ci-applications/12/step1', {
        facilityCountry: 'Canada'
      })
      expect(out).toEqual(updated)
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['ci-applications']
      })
      expect(mockSetQueryData).toHaveBeenCalledWith(
        ['ci-application', '12'],
        updated
      )
    })
  })

  describe('useAssignCIApplicationAnalyst', () => {
    it('PUTs /ci-applications/:id/assign and updates detail and list caches', async () => {
      const updated = {
        ciApplicationId: 12,
        assignedAnalyst: null,
        preliminaryRiskAssessment: 'Low',
        priorityScore: 120
      }
      mockPut.mockResolvedValue({ data: updated })

      const { result } = renderHook(() => useAssignCIApplicationAnalyst(12), {
        wrapper
      })
      const out = await result.current.mutateAsync(null)

      expect(mockPut).toHaveBeenCalledWith('/ci-applications/12/assign', {
        assignedAnalystId: null
      })
      expect(out).toEqual(updated)
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['ci-applications']
      })
      expect(mockSetQueryData).toHaveBeenCalledWith(
        ['ci-application', '12'],
        updated
      )
      expect(mockSetQueriesData).toHaveBeenCalledWith(
        { queryKey: ['ci-applications'] },
        expect.any(Function)
      )
    })
  })

  // ------------------------------------------------------------------
  // useDeleteCIApplication
  // ------------------------------------------------------------------

  // ------------------------------------------------------------------
  // useSubmitCIApplication
  // ------------------------------------------------------------------

  describe('useSubmitCIApplication', () => {
    it('POSTs /ci-applications/:id/submit and updates cache', async () => {
      const submitted = { ciApplicationId: 12, status: { status: 'Submitted' } }
      mockPost.mockResolvedValue({ data: submitted })

      const { result } = renderHook(() => useSubmitCIApplication(12), {
        wrapper
      })
      const out = await result.current.mutateAsync({
        declarationInformationTrue: true,
        declarationResponse8Weeks: true,
        declarationSection206: true,
        consultantConsent: false,
        consultantName: null,
        consultantCompany: null,
        consultantEmail: null
      })

      expect(mockPost).toHaveBeenCalledWith(
        '/ci-applications/12/submit',
        expect.objectContaining({ declarationInformationTrue: true })
      )
      expect(out).toEqual(submitted)
      expect(mockSetQueryData).toHaveBeenCalledWith(
        ['ci-application', '12'],
        submitted
      )
    })
  })

  // ------------------------------------------------------------------
  // useRecordCIDecision
  // ------------------------------------------------------------------

  describe('useRecordCIDecision', () => {
    it('POSTs /ci-applications/:id/decision and invalidates the list cache', async () => {
      const completed = { ciApplicationId: 12, status: { status: 'Completed' } }
      mockPost.mockResolvedValue({ data: completed })

      const { result } = renderHook(() => useRecordCIDecision(12), { wrapper })
      const out = await result.current.mutateAsync({ status: 'Completed' })

      expect(mockPost).toHaveBeenCalledWith('/ci-applications/12/decision', {
        status: 'Completed'
      })
      expect(out).toEqual(completed)
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['ci-applications']
      })
    })
  })

  describe('useUpdateCIApplicationRiskAssessment', () => {
    it('PUTs /ci-applications/:id/risk-assessment and updates caches', async () => {
      const saved = {
        ciApplicationId: 12,
        preliminaryRiskAssessment: 'Low',
        priorityScore: 42
      }
      mockPut.mockResolvedValue({ data: saved })

      const { result } = renderHook(
        () => useUpdateCIApplicationRiskAssessment(12),
        { wrapper }
      )
      const out = await result.current.mutateAsync({
        preliminaryRiskAssessment: 'Low',
        priorityScore: 42
      })

      expect(mockPut).toHaveBeenCalledWith(
        '/ci-applications/12/risk-assessment',
        { preliminaryRiskAssessment: 'Low', priorityScore: 42 }
      )
      expect(out).toEqual(saved)
      expect(mockSetQueryData).toHaveBeenCalledWith(
        ['ci-application', '12'],
        saved
      )
    })

    it('does not restore a stale PUT when a newer autosave is already queued', async () => {
      const stale = {
        ciApplicationId: 12,
        preliminaryRiskAssessment: 'Low',
        priorityScore: 10
      }
      const latest = {
        ciApplicationId: 12,
        preliminaryRiskAssessment: 'High',
        priorityScore: 20
      }
      let resolveFirst
      mockPut
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirst = resolve
            })
        )
        .mockResolvedValueOnce({ data: latest })

      const { result } = renderHook(
        () => useUpdateCIApplicationRiskAssessment(12),
        { wrapper }
      )

      result.current.mutate({
        preliminaryRiskAssessment: 'Low',
        priorityScore: 10
      })
      await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1))

      result.current.mutate({
        preliminaryRiskAssessment: 'High',
        priorityScore: 20
      })
      // Let the second mutate mark itself pending before the first PUT resolves.
      await Promise.resolve()

      resolveFirst({ data: stale })

      await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(2))
      expect(mockPut).toHaveBeenLastCalledWith(
        '/ci-applications/12/risk-assessment',
        { preliminaryRiskAssessment: 'High', priorityScore: 20 }
      )
      expect(mockSetQueryData).toHaveBeenLastCalledWith(
        ['ci-application', '12'],
        latest
      )
      expect(mockSetQueryData).not.toHaveBeenCalledWith(
        ['ci-application', '12'],
        stale
      )
    })
  })

  describe('useRequestCIApplicationPathwayChanges', () => {
    it('POSTs the supplemental pathway request and updates the detail cache', async () => {
      const submitted = {
        ciApplicationId: 12,
        status: { status: 'Submitted' },
        pathwaySupplementalEditEnabled: true,
        pathwayChangesRequestedAt: '2026-06-10T10:00:00Z'
      }
      mockPost.mockResolvedValue({ data: submitted })

      const { result } = renderHook(
        () => useRequestCIApplicationPathwayChanges(12),
        { wrapper }
      )
      const out = await result.current.mutateAsync()

      expect(mockPost).toHaveBeenCalledWith(
        '/ci-applications/12/request-pathway-changes',
        {}
      )
      expect(out).toEqual(submitted)
      expect(mockSetQueryData).toHaveBeenCalledWith(
        ['ci-application', '12'],
        submitted
      )
    })
  })

  // Step 5 comments now use the shared <Comments entityType="ciApplication" />
  // widget via the internal_comments framework — see useComments. The
  // legacy useGetCIComments / useAddCIComment hooks were removed along
  // with the /ci-applications/{id}/comments endpoints.

  describe('useDeleteCIApplication', () => {
    it('DELETEs /ci-applications/:id and invalidates the list cache', async () => {
      mockDelete.mockResolvedValue({
        data: { message: 'CI application deleted.' }
      })
      const { result } = renderHook(() => useDeleteCIApplication(), { wrapper })

      await result.current.mutateAsync(50)

      expect(mockDelete).toHaveBeenCalledWith('/ci-applications/50')
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['ci-applications']
      })
    })
  })
})
