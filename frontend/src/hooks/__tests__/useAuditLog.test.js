import { waitFor } from '@testing-library/react'
import { describe, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { test } from '@/tests/utils/fixtures'
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

  test('should fetch audit log successfully by ID', async ({
    renderHook,
    query
  }) => {
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

    const { result } = renderHook(() => useAuditLog(123), [query])

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
    expect(mockGet).toHaveBeenCalledWith('/audit-log/123')
  })

  test('should not fetch when auditLogId is missing', async ({
    renderHook,
    query
  }) => {
    const { result } = renderHook(() => useAuditLog(), [query])

    expect(result.current.isLoading).toBe(false)
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockGet).not.toHaveBeenCalled()
  })

  test('should not fetch when auditLogId is null', async ({
    renderHook,
    query
  }) => {
    const { result } = renderHook(() => useAuditLog(null), [query])

    expect(result.current.isLoading).toBe(false)
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockGet).not.toHaveBeenCalled()
  })

  test('should handle API errors', async ({ renderHook, query }) => {
    const errorMessage = 'Failed to fetch audit log'
    mockGet.mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(
      () => useAuditLog(123, { retry: false }),
      [query]
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(new Error(errorMessage))
    expect(mockGet).toHaveBeenCalledWith('/audit-log/123')
  })

  test('should pass through custom options', async ({ renderHook, query }) => {
    const mockData = {
      auditLogId: 123,
      tableName: 'compliance_reports',
      operation: 'CREATE'
    }
    mockGet.mockResolvedValue({ data: mockData })

    const { result } = renderHook(
      () => useAuditLog(123, { staleTime: 5000 }),
      [query]
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
  })

  test('should handle complex audit log data structure', async ({
    renderHook,
    query
  }) => {
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

    const { result } = renderHook(() => useAuditLog(1), [query])

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

  test('should fetch audit logs successfully with all parameters', async ({
    renderHook,
    query
  }) => {
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
      [query]
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

  test('should fetch audit logs with default parameters', async ({
    renderHook,
    query
  }) => {
    const mockData = {
      auditLogs: [
        { auditLogId: 1, operation: 'CREATE', createDate: '2023-01-01' }
      ],
      pagination: { total: 1, page: 1, size: 10 }
    }
    mockPost.mockResolvedValue({ data: mockData })

    const { result } = renderHook(() => useAuditLogs(), [query])

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

  test('should handle pagination parameters correctly', async ({
    renderHook,
    query
  }) => {
    const mockData = {
      auditLogs: [
        { auditLogId: 1, operation: 'CREATE', createDate: '2023-01-01' }
      ],
      pagination: { total: 1, page: 2, size: 20 }
    }
    mockPost.mockResolvedValue({ data: mockData })

    const { result } = renderHook(
      () => useAuditLogs({ page: 2, size: 20 }),
      [query]
    )

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

  test('should handle sort orders correctly', async ({ renderHook, query }) => {
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

    const { result } = renderHook(() => useAuditLogs({ sortOrders }), [query])

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

  test('should handle filters correctly', async ({ renderHook, query }) => {
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

    const { result } = renderHook(() => useAuditLogs({ filters }), [query])

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

  test('should handle API errors', async ({ renderHook, query }) => {
    const errorMessage = 'Failed to fetch audit logs'
    mockPost.mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(() => useAuditLogs({ retry: false }), [query])

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(new Error(errorMessage))
  })
})
