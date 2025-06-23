import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { wrapper } from '@/tests/utils/wrapper'
import { useAuditLog, useAuditLogs } from '../useAuditLog'

vi.mock('@/services/useApiService')

describe('useAuditLog', () => {
  const mockGet = vi.fn()
  const mockPost = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({
      get: mockGet,
      post: mockPost
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch audit log successfully by ID', async () => {
    const mockData = {
      auditLogId: 123,
      tableName: 'compliance_reports',
      operation: 'UPDATE',
      rowId: { id: 1 },
      oldValues: { status: 'Draft' },
      newValues: { status: 'Submitted' },
      createDate: '2023-01-01T10:00:00Z'
    }
    mockGet.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useAuditLog(123), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
    expect(mockGet).toHaveBeenCalledWith('/audit-log/123')
  })

  it('should not fetch when auditLogId is missing', async () => {
    const { result } = renderHook(() => useAuditLog(), { wrapper })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('should not fetch when auditLogId is null', async () => {
    const { result } = renderHook(() => useAuditLog(null), { wrapper })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('should handle API errors', async () => {
    const errorMessage = 'Failed to fetch audit log'
    mockGet.mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(() => useAuditLog(123, { retry: false }), {
      wrapper
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(new Error(errorMessage))
    expect(mockGet).toHaveBeenCalledWith('/audit-log/123')
  })

  it('should pass through custom options', async () => {
    const mockData = {
      auditLogId: 123,
      tableName: 'compliance_reports',
      operation: 'CREATE'
    }
    mockGet.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useAuditLog(123, { staleTime: 5000 }), {
      wrapper
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
  })

  it('should handle complex audit log data structure', async () => {
    const mockData = {
      auditLogId: 1,
      tableName: 'compliance_reports',
      operation: 'UPDATE',
      rowId: { id: 123 },
      createDate: '2023-01-01T10:00:00Z',
      createUser: 'John Doe',
      oldValues: { status: 'Draft', complianceUnits: 100 },
      newValues: { status: 'Submitted', complianceUnits: 150 },
      delta: { status: 'Submitted', complianceUnits: 150 }
    }
    mockGet.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useAuditLog(1), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
    expect(result.current.data.createUser).toBe('John Doe')
    expect(result.current.data.newValues.complianceUnits).toBe(150)
  })
})

describe('useAuditLogs', () => {
  const mockPost = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({ post: mockPost })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch audit logs successfully with all parameters', async () => {
    const mockData = {
      auditLogs: [
        { auditLogId: 1, operation: 'CREATE', createDate: '2023-01-01' },
        { auditLogId: 2, operation: 'UPDATE', createDate: '2023-01-02' }
      ],
      pagination: { total: 2, page: 1, size: 10 }
    }
    mockPost.mockResolvedValue({ data: mockData })

    const { result } = renderHook(
      () =>
        useAuditLogs({
          page: 1,
          size: 10,
          sortOrders: [{ field: 'createDate', direction: 'desc' }],
          filters: [{ field: 'operation', value: 'CREATE' }]
        }),
      { wrapper }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
    expect(mockPost).toHaveBeenCalledWith('/audit-log/list', {
      page: 1,
      size: 10,
      sortOrders: [{ field: 'createDate', direction: 'desc' }],
      filters: [{ field: 'operation', value: 'CREATE' }]
    })
  })

  it('should fetch audit logs with default parameters', async () => {
    const mockData = {
      auditLogs: [
        { auditLogId: 1, operation: 'CREATE', createDate: '2023-01-01' }
      ],
      pagination: { total: 1, page: 1, size: 10 }
    }
    mockPost.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useAuditLogs(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
    expect(mockPost).toHaveBeenCalledWith('/audit-log/list', {
      page: 1,
      size: 10,
      sortOrders: [],
      filters: []
    })
  })

  it('should handle pagination parameters correctly', async () => {
    const mockData = {
      auditLogs: [
        { auditLogId: 1, operation: 'CREATE', createDate: '2023-01-01' }
      ],
      pagination: { total: 1, page: 2, size: 20 }
    }
    mockPost.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useAuditLogs({ page: 2, size: 20 }), {
      wrapper
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
    expect(mockPost).toHaveBeenCalledWith('/audit-log/list', {
      page: 2,
      size: 20,
      sortOrders: [],
      filters: []
    })
  })

  it('should handle sort orders correctly', async () => {
    const mockData = {
      auditLogs: [
        { auditLogId: 1, operation: 'CREATE', createDate: '2023-01-01' }
      ],
      pagination: { total: 1, page: 1, size: 10 }
    }
    mockPost.mockResolvedValue({ data: mockData })

    const sortOrders = [
      { field: 'createDate', direction: 'desc' },
      { field: 'operation', direction: 'asc' }
    ]

    const { result } = renderHook(() => useAuditLogs({ sortOrders }), {
      wrapper
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
    expect(mockPost).toHaveBeenCalledWith('/audit-log/list', {
      page: 1,
      size: 10,
      sortOrders,
      filters: []
    })
  })

  it('should handle filters correctly', async () => {
    const mockData = {
      auditLogs: [
        { auditLogId: 1, operation: 'CREATE', createDate: '2023-01-01' }
      ],
      pagination: { total: 1, page: 1, size: 10 }
    }
    mockPost.mockResolvedValue({ data: mockData })

    const filters = [
      { field: 'operation', value: 'CREATE' },
      { field: 'createUser', value: 'admin' }
    ]

    const { result } = renderHook(() => useAuditLogs({ filters }), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
    expect(mockPost).toHaveBeenCalledWith('/audit-log/list', {
      page: 1,
      size: 10,
      sortOrders: [],
      filters
    })
  })

  it('should handle API errors', async () => {
    const errorMessage = 'Failed to fetch audit logs'
    mockPost.mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(() => useAuditLogs({ retry: false }), {
      wrapper
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(new Error(errorMessage))
  })
})
