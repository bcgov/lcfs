import { waitFor } from '@testing-library/react'
import { describe, beforeEach, afterEach, expect, vi } from 'vitest'
import { test } from '@/tests/utils/fixtures'
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
  useCreditMarketAuditLogs,
  useUpdateOrganization,
  useUpdateOrganizationUser,
  useUpdateCurrentOrgCreditMarket,
  useUpdateOrganizationCreditMarket
} from '../useOrganization'

vi.mock('@/services/useApiService')
const qcMock = {
  invalidateQueries: vi.fn(),
  removeQueries: vi.fn(),
  setQueryData: vi.fn(),
  refetchQueries: vi.fn()
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
    qcMock.refetchQueries.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('useOrganization fetches by id', async ({ renderHook, query }) => {
    mockGet.mockResolvedValue({ data: { id: 5, name: 'Org' } })
    const { result } = renderHook(() => useOrganization(5), [query])
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/organizations/5')
    expect(result.current.data).toEqual({ id: 5, name: 'Org' })
  })

  test('useOrganizationUser fetches user', async ({ renderHook, query }) => {
    mockGet.mockResolvedValue({ data: { id: 9 } })
    const { result } = renderHook(() => useOrganizationUser(1, 9), [query])
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/organization/1/users/9')
  })

  test('useOrganizationBalance guarded when orgID missing', async ({
    renderHook,
    query
  }) => {
    const { result } = renderHook(() => useOrganizationBalance(), [query])
    expect(result.current.fetchStatus).toBe('idle')
  })

  test('useCurrentOrgBalance fetches', async ({ renderHook, query }) => {
    mockGet.mockResolvedValue({ data: { total: 1 } })
    const { result } = renderHook(() => useCurrentOrgBalance(), [query])
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/organizations/current/balances')
  })

  test('useCreditMarketListings fetches list', async ({
    renderHook,
    query
  }) => {
    mockGet.mockResolvedValue({ data: { items: [] } })
    const { result } = renderHook(() => useCreditMarketListings(), [query])
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith(
      '/organizations/credit-market-listings'
    )
  })

  test('useCreditMarketAuditLogs posts paginated request', async ({
    renderHook,
    query
  }) => {
    mockPost.mockResolvedValue({
      data: { pagination: { total: 0 }, creditMarketAuditLogs: [] }
    })
    const { result } = renderHook(
      () =>
        useCreditMarketAuditLogs({
          page: 2,
          size: 20,
          sortOrders: [{ field: 'uploadedDate', direction: 'desc' }],
          filters: []
        }),
      [query]
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith(
      '/organizations/credit-market-audit-logs/list',
      {
        page: 2,
        size: 20,
        sortOrders: [{ field: 'uploadedDate', direction: 'desc' }],
        filters: []
      }
    )
  })

  test('useGetOrgComplianceReportReportedYears fetches', async ({
    renderHook,
    query
  }) => {
    mockGet.mockResolvedValue({ data: [2023, 2024] })
    const { result } = renderHook(
      () => useGetOrgComplianceReportReportedYears(10),
      [query]
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalled()
  })

  test('useAvailableFormTypes fetches', async ({ renderHook, query }) => {
    mockGet.mockResolvedValue({ data: { forms: {} } })
    const { result } = renderHook(() => useAvailableFormTypes(2), [query])
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/organizations/2/forms')
  })

  test('useOrganizationLinkKeys fetches', async ({ renderHook, query }) => {
    mockGet.mockResolvedValue({ data: { linkKeys: [] } })
    const { result } = renderHook(() => useOrganizationLinkKeys(2), [query])
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/organizations/2/link-keys')
  })

  test('useGenerateLinkKey posts', async ({ renderHook, query }) => {
    mockPost.mockResolvedValue({ data: { ok: true } })
    const { result } = renderHook(() => useGenerateLinkKey(3), [query])
    await result.current.mutateAsync({ formId: 7 })
    expect(mockPost).toHaveBeenCalledWith('/organizations/3/link-keys', {
      form_id: 7
    })
  })

  test('useUpdateOrganization success updates cache and invalidates', async ({
    renderHook,
    query
  }) => {
    mockPut.mockResolvedValue({ data: { id: 3, name: 'X' } })
    const { result } = renderHook(
      () => useUpdateOrganization(3, { clearCache: false }),
      [query]
    )
    await result.current.mutateAsync({ name: 'X' })
    expect(qcMock.setQueryData).toHaveBeenCalled()
    expect(qcMock.invalidateQueries).toHaveBeenCalled()
  })

  test('useUpdateOrganization error invalidates specific query', async ({
    renderHook,
    query
  }) => {
    mockPut.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useUpdateOrganization(9), [query])
    try {
      await result.current.mutateAsync({})
    } catch {}
    expect(qcMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['organization', 9] })
  })

  test('useUpdateOrganizationUser success invalidates related queries', async ({
    renderHook,
    query
  }) => {
    mockPut.mockResolvedValue({ data: { ok: true } })
    const { result } = renderHook(
      () => useUpdateOrganizationUser(1, 2, { clearCache: false }),
      [query]
    )
    await result.current.mutateAsync({})
    expect(qcMock.setQueryData).toHaveBeenCalled()
    expect(qcMock.invalidateQueries).toHaveBeenCalled()
  })

  test('useUpdateOrganizationUser error invalidates specific query', async ({
    renderHook,
    query
  }) => {
    mockPut.mockRejectedValue(new Error('bad'))
    const { result } = renderHook(
      () => useUpdateOrganizationUser(1, 2),
      [query]
    )
    try {
      await result.current.mutateAsync({})
    } catch {}
    expect(qcMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: [
      'organization-user',
      1,
      2
    ] })
  })

  test('useUpdateCurrentOrgCreditMarket success invalidates related', async ({
    renderHook,
    query
  }) => {
    mockPut.mockResolvedValue({ data: { ok: true } })
    const { result } = renderHook(
      () => useUpdateCurrentOrgCreditMarket({ clearCache: false }),
      [query]
    )
    await result.current.mutateAsync({})
    expect(qcMock.setQueryData).toHaveBeenCalled()
    expect(qcMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['organization'] })
    expect(qcMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: [
      'current-org-balance'
    ] })
    expect(qcMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: [
      'credit-market-listings'
    ] })
    expect(qcMock.refetchQueries).toHaveBeenCalledWith({ queryKey: [
      'credit-market-listings'
    ] })
  })

  test('useUpdateOrganizationCreditMarket invalidates caches and listings', async ({
    renderHook,
    query
  }) => {
    mockPut.mockResolvedValue({ data: { ok: true } })
    const { result } = renderHook(
      () => useUpdateOrganizationCreditMarket(5, { clearCache: true }),
      [query]
    )
    await result.current.mutateAsync({})
    expect(mockPut).toHaveBeenCalledWith('/organizations/5/credit-market', {})
    expect(qcMock.removeQueries).toHaveBeenCalledWith({ queryKey: ['organization', 5] })
    expect(qcMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['organization'] })
    expect(qcMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: [
      'credit-market-listings'
    ] })
    expect(qcMock.refetchQueries).toHaveBeenCalledWith({ queryKey: [
      'credit-market-listings'
    ] })
  })

  test('useOrganizationBalance disabled when user not government', async ({
    renderHook,
    query
  }) => {
    // Override hasRoles to return false
    const { useCurrentUser } = await import('@/hooks/useCurrentUser')
    useCurrentUser.mockReturnValue({ hasRoles: () => false })
    const { result } = renderHook(() => useOrganizationBalance(1), [query])
    expect(result.current.fetchStatus).toBe('idle')
  })

  test('useRegenerateLinkKey puts', async ({ renderHook, query }) => {
    mockPut.mockResolvedValue({ data: { ok: true } })
    const { result } = renderHook(() => useRegenerateLinkKey(3), [query])
    await result.current.mutateAsync(7)
    expect(mockPut).toHaveBeenCalledWith('/organizations/3/link-keys/7')
  })

  test('useValidateLinkKey fetches validation', async ({
    renderHook,
    query
  }) => {
    mockGet.mockResolvedValue({ data: { valid: true } })
    const { result } = renderHook(() => useValidateLinkKey('abc'), [query])
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/organizations/validate-link-key/abc')
  })
})
