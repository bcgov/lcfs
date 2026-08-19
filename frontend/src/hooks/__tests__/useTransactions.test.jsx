import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { wrapper } from '@/tests/utils/wrapper'
import {
  useTransaction,
  useTransactionStatuses,
  useGetTransactionList,
  useTransactionDocuments,
  useDownloadTransactions
} from '../useTransactions'
import * as currentUserHooks from '@/hooks/useCurrentUser'
import { roles } from '@/constants/roles'
import { TRANSFER_STATUSES } from '@/constants/statuses'

vi.mock('@/services/useApiService')
vi.mock('@/hooks/useCurrentUser')

describe('useTransaction', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  it('fetches a single transaction by ID', async () => {
    const mockTxn = { transactionId: 42, status: 'Recorded' }
    mockGet.mockResolvedValue({ data: mockTxn })

    const { result } = renderHook(() => useTransaction(42, {}), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockTxn)
    expect(mockGet).toHaveBeenCalledWith('/transactions/42')
  })

  it('handles API errors gracefully', async () => {
    mockGet.mockRejectedValue(new Error('Not found'))

    const { result } = renderHook(
      () => useTransaction(999, { retry: false }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('Not found')
  })
})

describe('useTransactionStatuses', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  it('returns all statuses for a government user (no RECOMMENDED, no DELETED/SENT filter)', async () => {
    const statuses = [
      { status: TRANSFER_STATUSES.RECORDED },
      { status: TRANSFER_STATUSES.RECOMMENDED },
      { status: TRANSFER_STATUSES.DELETED }
    ]
    mockGet.mockResolvedValue({ data: statuses })
    vi.mocked(currentUserHooks.useCurrentUser).mockReturnValue({
      hasAnyRole: vi.fn(() => false),
      isLoading: false
    })

    const { result } = renderHook(() => useTransactionStatuses({}), {
      wrapper
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Government users see everything except DELETED and SENT
    expect(result.current.data).not.toContainEqual({ status: TRANSFER_STATUSES.DELETED })
  })

  it('excludes RECOMMENDED status for supplier users', async () => {
    const statuses = [
      { status: TRANSFER_STATUSES.RECORDED },
      { status: TRANSFER_STATUSES.RECOMMENDED },
      { status: 'Draft' }
    ]
    mockGet.mockResolvedValue({ data: statuses })
    vi.mocked(currentUserHooks.useCurrentUser).mockReturnValue({
      hasAnyRole: vi.fn((role) => role === roles.supplier),
      isLoading: false
    })

    const { result } = renderHook(() => useTransactionStatuses({}), {
      wrapper
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).not.toContainEqual({
      status: TRANSFER_STATUSES.RECOMMENDED
    })
    expect(result.current.data).toContainEqual({ status: TRANSFER_STATUSES.RECORDED })
  })

  it('excludes DELETED and SENT statuses for non-supplier users', async () => {
    const statuses = [
      { status: TRANSFER_STATUSES.DELETED },
      { status: TRANSFER_STATUSES.SENT },
      { status: TRANSFER_STATUSES.RECORDED }
    ]
    mockGet.mockResolvedValue({ data: statuses })
    vi.mocked(currentUserHooks.useCurrentUser).mockReturnValue({
      hasAnyRole: vi.fn(() => false),
      isLoading: false
    })

    const { result } = renderHook(() => useTransactionStatuses({}), {
      wrapper
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ status: TRANSFER_STATUSES.RECORDED }])
  })
})

describe('useGetTransactionList', () => {
  const mockPost = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({ post: mockPost })
    vi.mocked(currentUserHooks.useCurrentUser).mockReturnValue({
      hasRoles: vi.fn(() => false),
      isLoading: false
    })
  })

  it('calls the generic transactions endpoint for government users', async () => {
    const responseData = { transactions: [], total: 0 }
    mockPost.mockResolvedValue({ data: responseData })

    const { result } = renderHook(
      () => useGetTransactionList({ page: 1, size: 10 }, {}),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith(
      '/transactions/',
      expect.objectContaining({ page: 1, size: 10 })
    )
  })

  it('calls the org transactions endpoint for supplier users', async () => {
    vi.mocked(currentUserHooks.useCurrentUser).mockReturnValue({
      hasRoles: vi.fn((role) => role === roles.supplier),
      isLoading: false
    })
    mockPost.mockResolvedValue({ data: [] })

    const { result } = renderHook(
      () => useGetTransactionList({ page: 1, size: 5 }, {}),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith(
      '/organization/transactions',
      expect.objectContaining({ page: 1, size: 5 })
    )
  })

  it('calls the org-filtered endpoint when selectedOrgId is provided', async () => {
    mockPost.mockResolvedValue({ data: [] })

    const { result } = renderHook(
      () => useGetTransactionList({ page: 1, size: 10, selectedOrgId: 7 }, {}),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith(
      '/transactions/7',
      expect.any(Object)
    )
  })
})

describe('useTransactionDocuments', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  it('fetches documents for the given parent', async () => {
    const docs = [{ documentId: 1, fileName: 'report.pdf' }]
    mockGet.mockResolvedValue({ data: docs })

    const { result } = renderHook(
      () => useTransactionDocuments(10, 'transfer', {}),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(docs)
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('10')
    )
  })
})

describe('useDownloadTransactions', () => {
  const mockDownload = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({ download: mockDownload })
  })

  it('exposes a mutate function', () => {
    const { result } = renderHook(() => useDownloadTransactions({}), {
      wrapper
    })
    expect(typeof result.current.mutate).toBe('function')
  })

  it('calls download with the correct parameters when mutated', async () => {
    mockDownload.mockResolvedValue(new Blob(['data']))

    const { result } = renderHook(() => useDownloadTransactions({}), {
      wrapper
    })

    result.current.mutate({
      format: 'csv',
      body: { filters: [] },
      endpoint: '/transactions/export'
    })

    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledWith({
        url: '/transactions/export',
        method: 'post',
        params: { format: 'csv' },
        data: { filters: [] }
      })
    })
  })
})
