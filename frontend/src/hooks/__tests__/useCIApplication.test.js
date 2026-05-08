import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { wrapper } from '@/tests/utils/wrapper'
import {
  useAddCIComment,
  useCIApplicationOptions,
  useCreateCIApplication,
  useDeleteCIApplication,
  useGetCIApplication,
  useGetCIApplications,
  useGetCIComments,
  useRecordCIDecision,
  useSubmitCIApplication,
  useUpdateCIApplicationStep1
} from '../useCIApplication'

vi.mock('@/services/useApiService')

const mockInvalidateQueries = vi.fn()
const mockSetQueryData = vi.fn()

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
      setQueryData: mockSetQueryData
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

      const { result } = renderHook(() => useCIApplicationOptions(), { wrapper })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(data)
      expect(mockGet).toHaveBeenCalledWith('/ci-applications/table-options')
    })

    it('surfaces errors', async () => {
      const err = new Error('boom')
      mockGet.mockRejectedValue(err)
      const { result } = renderHook(() => useCIApplicationOptions(), { wrapper })
      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error).toBe(err)
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
      mockPost.mockResolvedValue({ data: { ciApplications: [], pagination: {} } })
      const params = {
        page: 3,
        size: 25,
        sortOrders: [{ field: 'updateDate', direction: 'desc' }],
        filters: [{ field: 'facilityCountry', filter: 'Canada' }]
      }
      const { result } = renderHook(() => useGetCIApplications(params), { wrapper })
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
      const { result } = renderHook(() => useGetCIApplication(null), { wrapper })
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
      const out = await result.current.mutateAsync({ facilityCountry: 'Canada' })

      expect(mockPut).toHaveBeenCalledWith('/ci-applications/12/step1', {
        facilityCountry: 'Canada'
      })
      expect(out).toEqual(updated)
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['ci-applications']
      })
      expect(mockSetQueryData).toHaveBeenCalledWith(['ci-application', '12'], updated)
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
    it('POSTs /ci-applications/:id/decision and invalidates comments + detail', async () => {
      const completed = { ciApplicationId: 12, status: { status: 'Completed' } }
      mockPost.mockResolvedValue({ data: completed })

      const { result } = renderHook(() => useRecordCIDecision(12), { wrapper })
      const out = await result.current.mutateAsync({
        status: 'Completed',
        comment: 'looks good'
      })
      expect(mockPost).toHaveBeenCalledWith('/ci-applications/12/decision', {
        status: 'Completed',
        comment: 'looks good'
      })
      expect(out).toEqual(completed)
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['ci-application-comments', '12']
      })
    })
  })

  // ------------------------------------------------------------------
  // useGetCIComments
  // ------------------------------------------------------------------

  describe('useGetCIComments', () => {
    it('GETs /ci-applications/:id/comments when an id is provided', async () => {
      const comments = [{ commentId: 1, text: 'hi' }]
      mockGet.mockResolvedValue({ data: comments })
      const { result } = renderHook(() => useGetCIComments(7), { wrapper })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(mockGet).toHaveBeenCalledWith('/ci-applications/7/comments')
      expect(result.current.data).toEqual(comments)
    })

    it('does not fetch without an id', () => {
      const { result } = renderHook(() => useGetCIComments(undefined), {
        wrapper
      })
      expect(result.current.fetchStatus).toBe('idle')
      expect(mockGet).not.toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // useAddCIComment
  // ------------------------------------------------------------------

  describe('useAddCIComment', () => {
    it('POSTs the text payload and invalidates the comments cache', async () => {
      const created = { commentId: 99, text: 'hi' }
      mockPost.mockResolvedValue({ data: created })

      const { result } = renderHook(() => useAddCIComment(12), { wrapper })
      const out = await result.current.mutateAsync('hi')

      expect(mockPost).toHaveBeenCalledWith('/ci-applications/12/comments', {
        text: 'hi'
      })
      expect(out).toEqual(created)
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['ci-application-comments', '12']
      })
    })
  })

  describe('useDeleteCIApplication', () => {
    it('DELETEs /ci-applications/:id and invalidates the list cache', async () => {
      mockDelete.mockResolvedValue({ data: { message: 'CI application deleted.' } })
      const { result } = renderHook(() => useDeleteCIApplication(), { wrapper })

      await result.current.mutateAsync(50)

      expect(mockDelete).toHaveBeenCalledWith('/ci-applications/50')
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['ci-applications']
      })
    })
  })
})
