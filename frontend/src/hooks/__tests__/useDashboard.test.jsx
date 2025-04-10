import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useDirectorReviewCounts,
  useOrgComplianceReportCounts,
  useOrgTransactionCounts,
  useTransactionCounts,
  useComplianceReportCounts,
  useFuelCodeCounts
} from '@/hooks/useDashboard'
import { useApiService } from '@/services/useApiService'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('@/services/useApiService')

describe('useDirectorReviewCounts', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  it('fetches the director review counts successfully', async () => {
    mockGet.mockResolvedValueOnce({
      data: { review_counts: 10 }
    })

    const { result } = renderHook(() => useDirectorReviewCounts(), {
      wrapper
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ review_counts: 10 })
    expect(mockGet).toHaveBeenCalledWith('/dashboard/director-review-counts')
  })

  it('handles errors correctly', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'))

    const { result } = renderHook(() => useDirectorReviewCounts(), {
      wrapper
    })

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

  it('fetches the transaction counts successfully', async () => {
    mockGet.mockResolvedValueOnce({
      data: { transaction_counts: 20 }
    })

    const { result } = renderHook(() => useTransactionCounts(), {
      wrapper
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ transaction_counts: 20 })
    expect(mockGet).toHaveBeenCalledWith('/dashboard/transaction-counts')
  })

  it('handles errors correctly', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'))

    const { result } = renderHook(() => useTransactionCounts(), {
      wrapper
    })

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

  it('fetches the org transaction counts successfully', async () => {
    mockGet.mockResolvedValueOnce({
      data: { org_transaction_counts: 30 }
    })

    const { result } = renderHook(() => useOrgTransactionCounts(), {
      wrapper
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ org_transaction_counts: 30 })
    expect(mockGet).toHaveBeenCalledWith('/dashboard/org-transaction-counts')
  })

  it('handles errors correctly', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'))

    const { result } = renderHook(() => useOrgTransactionCounts(), {
      wrapper
    })

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

  it('fetches the org compliance report counts successfully', async () => {
    mockGet.mockResolvedValueOnce({
      data: { org_compliance_report_counts: 40 }
    })

    const { result } = renderHook(() => useOrgComplianceReportCounts(), {
      wrapper
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ org_compliance_report_counts: 40 })
    expect(mockGet).toHaveBeenCalledWith(
      '/dashboard/org-compliance-report-counts'
    )
  })

  it('handles errors correctly', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'))

    const { result } = renderHook(() => useOrgComplianceReportCounts(), {
      wrapper
    })

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

  it('fetches compliance report counts successfully', async () => {
    mockGet.mockResolvedValueOnce({
      data: { pendingReviews: 15 }
    })

    const { result } = renderHook(() => useComplianceReportCounts(), {
      wrapper
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ pendingReviews: 15 })
    expect(mockGet).toHaveBeenCalledWith('/dashboard/compliance-report-counts')
  })

  it('handles errors correctly', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'))

    const { result } = renderHook(() => useComplianceReportCounts(), {
      wrapper
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual(new Error('Failed to fetch'))
  })
})

describe('useFuelCodeCounts', () => {
  const mockGet = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
  })

  it('fetches fuel code counts successfully', async () => {
    mockGet.mockResolvedValueOnce({
      data: { draftFuelCodes: 8 }
    })

    const { result } = renderHook(() => useFuelCodeCounts(), {
      wrapper
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ draftFuelCodes: 8 })
    expect(mockGet).toHaveBeenCalledWith('/dashboard/fuel-code-counts')
  })

  it('handles errors correctly', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'))

    const { result } = renderHook(() => useFuelCodeCounts(), {
      wrapper
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toEqual(new Error('Failed to fetch'))
  })
})
