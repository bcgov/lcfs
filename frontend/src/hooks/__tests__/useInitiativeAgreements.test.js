import { waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, vi } from 'vitest'
import { useApiService } from '@/services/useApiService'
import {
  useGetInitiativeAgreement,
  useGetInitiativeAgreements,
  useInitiativeAgreementStatuses,
  useUpdateAgreement
} from '../useInitiativeAgreements'
import { test } from '@/tests/utils/fixtures'

vi.mock('@/services/useApiService')

describe('useInitiativeAgreements hooks', () => {
  const mockGet = vi.fn()
  const mockPost = vi.fn()
  const mockPut = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({
      get: mockGet,
      post: mockPost,
      put: mockPut
    })
  })

  test('list hook POSTs the default pagination body', async ({
    renderHook,
    query
  }) => {
    const data = { initiativeAgreements: [], pagination: { total: 0 } }
    mockPost.mockResolvedValue({ data })

    const { result } = renderHook(() => useGetInitiativeAgreements(), [query])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(data)
    expect(mockPost).toHaveBeenCalledWith('/initiative-agreements/list', {
      page: 1,
      size: 10,
      sortOrders: [],
      filters: []
    })
  })

  test('list hook passes pagination options through', async ({
    renderHook,
    query
  }) => {
    const data = { initiativeAgreements: [], pagination: { total: 0 } }
    mockPost.mockResolvedValue({ data })
    const sortOrders = [{ field: 'updateDate', direction: 'desc' }]

    const { result } = renderHook(
      () => useGetInitiativeAgreements({ page: 2, size: 25, sortOrders }),
      [query]
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/initiative-agreements/list', {
      page: 2,
      size: 25,
      sortOrders,
      filters: []
    })
  })

  test('detail hook GETs the agreement profile by id', async ({
    renderHook,
    query
  }) => {
    const data = { initiativeAgreementId: 5, designatedActions: [] }
    mockGet.mockResolvedValue({ data })

    const { result } = renderHook(() => useGetInitiativeAgreement(5), [query])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(data)
    expect(mockGet).toHaveBeenCalledWith('/initiative-agreements/5/profile')
  })

  test('statuses hook GETs the lifecycle statuses', async ({
    renderHook,
    query
  }) => {
    const data = [{ status: 'Underway' }]
    mockGet.mockResolvedValue({ data })

    const { result } = renderHook(
      () => useInitiativeAgreementStatuses(),
      [query]
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/initiative-agreements/statuses')
  })

  test('detail hook does not fire without an id', ({ renderHook, query }) => {
    const { result } = renderHook(
      () => useGetInitiativeAgreement(undefined),
      [query]
    )
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockGet).not.toHaveBeenCalled()
  })

  test('update hook PUTs the edit to the agreement and refreshes the lists', async ({
    renderHook,
    query
  }) => {
    const data = { initiativeAgreementId: 5, title: 'Corrected' }
    mockPut.mockResolvedValue({ data })

    const { result } = renderHook(() => useUpdateAgreement(5), [query])
    const returned = await result.current.mutateAsync({ title: 'Corrected' })

    expect(mockPut).toHaveBeenCalledWith(
      '/initiative-agreements/agreements/5',
      {
        title: 'Corrected'
      }
    )
    expect(returned).toEqual(data)
  })
})
