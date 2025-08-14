import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
import { useApiService } from '@/services/useApiService'
import { useQueryClient } from '@tanstack/react-query'
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => ({
    data: { organization: { organizationId: 1 } },
    hasRoles: () => true
  }))
}))
import {
  useOrganization,
  useOrganizationUser,
  useOrganizationBalance,
  useCurrentOrgBalance,
  useGetOrgComplianceReportReportedYears,
  useAvailableFormTypes,
  useOrganizationLinkKeys,
  useGenerateLinkKey,
  useRegenerateLinkKey,
  useValidateLinkKey,
  useCreditMarketListings,
  useUpdateOrganization,
  useUpdateOrganizationUser,
  useUpdateCurrentOrgCreditMarket
} from '../useOrganization'

vi.mock('@/services/useApiService')
const qcMock = {
  invalidateQueries: vi.fn(),
  removeQueries: vi.fn(),
  setQueryData: vi.fn()
}

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useQueryClient: () => qcMock
  }
})

describe('useOrganization hooks', () => {
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
    // reset query client spies
    qcMock.invalidateQueries.mockReset()
    qcMock.removeQueries.mockReset()
    qcMock.setQueryData.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('useOrganization fetches by id', async () => {
    mockGet.mockResolvedValue({ data: { id: 5, name: 'Org' } })
    const { result } = renderHook(() => useOrganization(5), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/organizations/5')
    expect(result.current.data).toEqual({ id: 5, name: 'Org' })
  })

  it('useOrganizationUser fetches user', async () => {
    mockGet.mockResolvedValue({ data: { id: 9 } })
    const { result } = renderHook(() => useOrganizationUser(1, 9), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/organization/1/users/9')
  })

  it('useOrganizationBalance guarded when orgID missing', async () => {
    const { result } = renderHook(() => useOrganizationBalance(), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('useCurrentOrgBalance fetches', async () => {
    mockGet.mockResolvedValue({ data: { total: 1 } })
    const { result } = renderHook(() => useCurrentOrgBalance(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/organizations/current/balances')
  })

  it('useCreditMarketListings fetches list', async () => {
    mockGet.mockResolvedValue({ data: { items: [] } })
    const { result } = renderHook(() => useCreditMarketListings(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith(
      '/organizations/credit-market-listings'
    )
  })

  it('useGetOrgComplianceReportReportedYears fetches', async () => {
    mockGet.mockResolvedValue({ data: [2023, 2024] })
    const { result } = renderHook(
      () => useGetOrgComplianceReportReportedYears(10),
      { wrapper }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalled()
  })

  it('useAvailableFormTypes fetches', async () => {
    mockGet.mockResolvedValue({ data: { forms: {} } })
    const { result } = renderHook(() => useAvailableFormTypes(2), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/organizations/2/forms')
  })

  it('useOrganizationLinkKeys fetches', async () => {
    mockGet.mockResolvedValue({ data: { linkKeys: [] } })
    const { result } = renderHook(() => useOrganizationLinkKeys(2), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/organizations/2/link-keys')
  })

  it('useGenerateLinkKey posts', async () => {
    mockPost.mockResolvedValue({ data: { ok: true } })
    const { result } = renderHook(() => useGenerateLinkKey(3), { wrapper })
    await result.current.mutateAsync({ formId: 7 })
    expect(mockPost).toHaveBeenCalledWith('/organizations/3/link-keys', {
      form_id: 7
    })
  })

  it('useUpdateOrganization success updates cache and invalidates', async () => {
    mockPut.mockResolvedValue({ data: { id: 3, name: 'X' } })
    const { result } = renderHook(
      () => useUpdateOrganization(3, { clearCache: false }),
      { wrapper }
    )
    await result.current.mutateAsync({ name: 'X' })
    expect(qcMock.setQueryData).toHaveBeenCalled()
    expect(qcMock.invalidateQueries).toHaveBeenCalled()
  })

  it('useUpdateOrganization error invalidates specific query', async () => {
    mockPut.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useUpdateOrganization(9), { wrapper })
    try {
      await result.current.mutateAsync({})
    } catch {}
    expect(qcMock.invalidateQueries).toHaveBeenCalledWith(['organization', 9])
  })

  it('useUpdateOrganizationUser success invalidates related queries', async () => {
    mockPut.mockResolvedValue({ data: { ok: true } })
    const { result } = renderHook(
      () => useUpdateOrganizationUser(1, 2, { clearCache: false }),
      { wrapper }
    )
    await result.current.mutateAsync({})
    expect(qcMock.setQueryData).toHaveBeenCalled()
    expect(qcMock.invalidateQueries).toHaveBeenCalled()
  })

  it('useUpdateOrganizationUser error invalidates specific query', async () => {
    mockPut.mockRejectedValue(new Error('bad'))
    const { result } = renderHook(() => useUpdateOrganizationUser(1, 2), {
      wrapper
    })
    try {
      await result.current.mutateAsync({})
    } catch {}
    expect(qcMock.invalidateQueries).toHaveBeenCalledWith([
      'organization-user',
      1,
      2
    ])
  })

  it('useUpdateCurrentOrgCreditMarket success invalidates related', async () => {
    mockPut.mockResolvedValue({ data: { ok: true } })
    const { result } = renderHook(
      () => useUpdateCurrentOrgCreditMarket({ clearCache: false }),
      { wrapper }
    )
    await result.current.mutateAsync({})
    expect(qcMock.setQueryData).toHaveBeenCalled()
    expect(qcMock.invalidateQueries).toHaveBeenCalled()
  })

  it('useOrganizationBalance disabled when user not government', async () => {
    // Override hasRoles to return false
    const { useCurrentUser } = await import('@/hooks/useCurrentUser')
    useCurrentUser.mockReturnValue({ hasRoles: () => false })
    const { result } = renderHook(() => useOrganizationBalance(1), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('useRegenerateLinkKey puts', async () => {
    mockPut.mockResolvedValue({ data: { ok: true } })
    const { result } = renderHook(() => useRegenerateLinkKey(3), { wrapper })
    await result.current.mutateAsync(7)
    expect(mockPut).toHaveBeenCalledWith('/organizations/3/link-keys/7')
  })

  it('useValidateLinkKey fetches validation', async () => {
    mockGet.mockResolvedValue({ data: { valid: true } })
    const { result } = renderHook(() => useValidateLinkKey('abc'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/organizations/validate-link-key/abc')
  })
})
