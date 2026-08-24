import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { wrapper } from '@/tests/utils/wrapper'
import {
  useGetInitiativeAgreement,
  useGetInitiativeAgreements
} from '../useInitiativeAgreements'

vi.mock('@/services/useApiService')

describe('useInitiativeAgreements hooks', () => {
  const mockGet = vi.fn()
  const mockPost = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet, post: mockPost })
  })

  it('list hook stays disabled until the agreement-management API lands', () => {
    const { result } = renderHook(() => useGetInitiativeAgreements(), {
      wrapper
    })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('list hook POSTs the pagination body when enabled', async () => {
    const data = { initiativeAgreements: [], pagination: { total: 0 } }
    mockPost.mockResolvedValue({ data })

    const { result } = renderHook(
      () => useGetInitiativeAgreements({ page: 2, size: 25 }, { enabled: true }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(data)
    expect(mockPost).toHaveBeenCalledWith('/initiative-agreements/list', {
      page: 2,
      size: 25,
      sortOrders: [],
      filters: []
    })
  })

  it('detail hook stays disabled by default', () => {
    const { result } = renderHook(() => useGetInitiativeAgreement(5), {
      wrapper
    })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('detail hook GETs the agreement by id when enabled', async () => {
    const data = { initiativeAgreementId: 5 }
    mockGet.mockResolvedValue({ data })

    const { result } = renderHook(
      () => useGetInitiativeAgreement(5, { enabled: true }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/initiative-agreements/5')
  })
})
