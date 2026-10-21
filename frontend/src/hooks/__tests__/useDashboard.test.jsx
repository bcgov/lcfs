import { waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, vi } from 'vitest'
import {
  useDirectorReviewCounts,
  useOrgComplianceReportCounts,
  useOrgTransactionCounts,
  useTransactionCounts,
  useComplianceReportCounts,
  useCIApplicationCounts
} from '@/hooks/useDashboard'
import { useApiService } from '@/services/useApiService'
import { test } from '@/tests/utils/fixtures'

vi.mock('@/services/useApiService')

describe('useDirectorReviewCounts', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  test('fetches the director review counts successfully', async ({
    renderHook,
    query
  }) => {
    mockGet.mockResolvedValueOnce({
      data: { review_counts: 10 }
    })

    const { result } = renderHook(() => useDirectorReviewCounts(), [query])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ review_counts: 10 })
    expect(mockGet).toHaveBeenCalledWith('/dashboard/director-review-counts')
  })

  test('handles errors correctly', async ({ renderHook, query }) => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'))

    const { result } = renderHook(() => useDirectorReviewCounts(), [query])

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual(new Error('Failed to fetch'))
  })
})

describe('useTransactionCounts', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  test('fetches the transaction counts successfully', async ({
    renderHook,
    query
  }) => {
    mockGet.mockResolvedValueOnce({
      data: { transaction_counts: 20 }
    })

    const { result } = renderHook(() => useTransactionCounts(), [query])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ transaction_counts: 20 })
    expect(mockGet).toHaveBeenCalledWith('/dashboard/transaction-counts')
  })

  test('handles errors correctly', async ({ renderHook, query }) => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'))

    const { result } = renderHook(() => useTransactionCounts(), [query])

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual(new Error('Failed to fetch'))
  })
})

describe('useOrgTransactionCounts', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  test('fetches the org transaction counts successfully', async ({
    renderHook,
    query
  }) => {
    mockGet.mockResolvedValueOnce({
      data: { org_transaction_counts: 30 }
    })

    const { result } = renderHook(() => useOrgTransactionCounts(), [query])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ org_transaction_counts: 30 })
    expect(mockGet).toHaveBeenCalledWith('/dashboard/org-transaction-counts')
  })

  test('handles errors correctly', async ({ renderHook, query }) => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'))

    const { result } = renderHook(() => useOrgTransactionCounts(), [query])

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual(new Error('Failed to fetch'))
  })
})

describe('useOrgComplianceReportCounts', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  test('fetches the org compliance report counts successfully', async ({
    renderHook,
    query
  }) => {
    mockGet.mockResolvedValueOnce({
      data: { org_compliance_report_counts: 40 }
    })

    const { result } = renderHook(() => useOrgComplianceReportCounts(), [query])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ org_compliance_report_counts: 40 })
    expect(mockGet).toHaveBeenCalledWith(
      '/dashboard/org-compliance-report-counts'
    )
  })

  test('handles errors correctly', async ({ renderHook, query }) => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'))

    const { result } = renderHook(() => useOrgComplianceReportCounts(), [query])

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual(new Error('Failed to fetch'))
  })
})

describe('useComplianceReportCounts', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  test('fetches compliance report counts successfully', async ({
    renderHook,
    query
  }) => {
    mockGet.mockResolvedValueOnce({
      data: { pendingReviews: 15 }
    })

    const { result } = renderHook(() => useComplianceReportCounts(), [query])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ pendingReviews: 15 })
    expect(mockGet).toHaveBeenCalledWith('/dashboard/compliance-report-counts')
  })

  test('handles errors correctly', async ({ renderHook, query }) => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'))

    const { result } = renderHook(() => useComplianceReportCounts(), [query])

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual(new Error('Failed to fetch'))
  })
})

describe('useCIApplicationCounts', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  test('fetches CI application counts successfully', async ({
    renderHook,
    query
  }) => {
    mockGet.mockResolvedValueOnce({
      data: { inProgress: 17 }
    })

    const { result } = renderHook(() => useCIApplicationCounts(), [query])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ inProgress: 17 })
    expect(mockGet).toHaveBeenCalledWith('/dashboard/ci-application-counts')
  })

  test('handles errors correctly', async ({ renderHook, query }) => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'))

    const { result } = renderHook(() => useCIApplicationCounts(), [query])

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual(new Error('Failed to fetch'))
  })
})
