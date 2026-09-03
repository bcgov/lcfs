import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { wrapper } from '@/tests/utils/wrapper'
import {
  useGetInitiativeAgreement,
  useGetInitiativeAgreements,
  useInitiativeAgreementStatuses
} from '../useInitiativeAgreements'

vi.mock('@/services/useApiService')

describe('useInitiativeAgreements hooks', () => {
  const mockGet = vi.fn()
  const mockPost = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet, post: mockPost })
  })

  it('list hook POSTs the default pagination body', async () => {
    const data = { initiativeAgreements: [], pagination: { total: 0 } }
    mockPost.mockResolvedValue({ data })

    const { result } = renderHook(() => useGetInitiativeAgreements(), {
      wrapper
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(data)
    expect(mockPost).toHaveBeenCalledWith('/initiative-agreements/list', {
      page: 1,
      size: 10,
      sortOrders: [],
      filters: []
    })
  })

  it('list hook passes pagination options through', async () => {
    const data = { initiativeAgreements: [], pagination: { total: 0 } }
    mockPost.mockResolvedValue({ data })
    const sortOrders = [{ field: 'updateDate', direction: 'desc' }]

    const { result } = renderHook(
      () => useGetInitiativeAgreements({ page: 2, size: 25, sortOrders }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/initiative-agreements/list', {
      page: 2,
      size: 25,
      sortOrders,
      filters: []
    })
  })

  it('detail hook GETs the agreement profile by id', async () => {
    const data = { initiativeAgreementId: 5, designatedActions: [] }
    mockGet.mockResolvedValue({ data })

    const { result } = renderHook(() => useGetInitiativeAgreement(5), {
      wrapper
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(data)
    expect(mockGet).toHaveBeenCalledWith('/initiative-agreements/5/profile')
  })

  it('statuses hook GETs the lifecycle statuses', async () => {
    const data = [{ status: 'Underway' }]
    mockGet.mockResolvedValue({ data })

    const { result } = renderHook(() => useInitiativeAgreementStatuses(), {
      wrapper
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/initiative-agreements/statuses')
  })

  it('detail hook does not fire without an id', () => {
    const { result } = renderHook(() => useGetInitiativeAgreement(undefined), {
      wrapper
    })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockGet).not.toHaveBeenCalled()
  })
})
