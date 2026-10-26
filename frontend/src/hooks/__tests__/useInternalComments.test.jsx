import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useComments } from '../useComments'

// Mock the API service
const mockApiService = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}

vi.mock('@/services/useApiService', () => ({
  useApiService: () => mockApiService
}))

// Mock useCurrentUser hook
const mockHasAnyRole = vi.fn()
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    hasAnyRole: mockHasAnyRole
  })
}))

// Mock roles constants
vi.mock('@/constants/roles', () => ({
  roles: {
    government: 'government',
    director: 'director',
    analyst: 'analyst',
    compliance_manager: 'compliance_manager'
  }
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  return function QueryWrapper({ children }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe('useComments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasAnyRole.mockReturnValue(false)
  })

  describe('Comments fetching', () => {
    it('should fetch internal comments successfully with director role', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      const mockComments = [
        {
          internalCommentId: 2,
          comment: 'Latest comment',
          audience_scope: 'Director'
        },
        {
          internalCommentId: 1,
          comment: 'First comment',
          audience_scope: 'Director'
        }
      ]
      mockApiService.get.mockResolvedValue({ data: mockComments })

      const { result } = renderHook(
        () => useComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.comments).toEqual(mockComments)
      })

      expect(result.current.comments).toEqual(mockComments)
      expect(mockApiService.get).toHaveBeenCalledWith(
        '/internal_comments/compliance_report/123'
      )
    })

    it('should fetch internal comments with analyst role', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'analyst')

      const mockComments = [
        {
          internalCommentId: 1,
          comment: 'Analyst comment',
          audience_scope: 'Analyst'
        }
      ]
      mockApiService.get.mockResolvedValue({ data: mockComments })

      const { result } = renderHook(
        () => useComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.comments).toEqual(mockComments)
      })

      expect(result.current.comments).toEqual(mockComments)
    })

    it('should fetch internal comments with compliance manager role', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'compliance_manager')

      const mockComments = [
        {
          internalCommentId: 1,
          comment: 'Manager comment',
          audience_scope: 'Compliance Manager'
        }
      ]
      mockApiService.get.mockResolvedValue({ data: mockComments })

      const { result } = renderHook(
        () => useComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.comments).toEqual(mockComments)
      })

      expect(result.current.comments).toEqual(mockComments)
    })

    it('should sort comments in descending order by default', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      const mockComments = [
        { internalCommentId: 1, comment: 'First comment' },
        { internalCommentId: 3, comment: 'Third comment' },
        { internalCommentId: 2, comment: 'Second comment' }
      ]
      const expectedSorted = [
        { internalCommentId: 3, comment: 'Third comment' },
        { internalCommentId: 2, comment: 'Second comment' },
        { internalCommentId: 1, comment: 'First comment' }
      ]
      mockApiService.get.mockResolvedValue({ data: mockComments })

      const { result } = renderHook(
        () => useComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.comments).toEqual(expectedSorted)
      })

      expect(result.current.comments).toEqual(expectedSorted)
    })

    it('should sort comments in ascending order when specified', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      const mockComments = [
        { internalCommentId: 3, comment: 'Third comment' },
        { internalCommentId: 1, comment: 'First comment' },
        { internalCommentId: 2, comment: 'Second comment' }
      ]
      const expectedSorted = [
        { internalCommentId: 1, comment: 'First comment' },
        { internalCommentId: 2, comment: 'Second comment' },
        { internalCommentId: 3, comment: 'Third comment' }
      ]
      mockApiService.get.mockResolvedValue({ data: mockComments })

      const { result } = renderHook(
        () => useComments('compliance_report', 123, { sortOrder: 'asc' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.comments).toEqual(expectedSorted)
      })

      expect(result.current.comments).toEqual(expectedSorted)
    })

    it('should reorder cached comments without refetching when sort order changes', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      const mockComments = [
        { internalCommentId: 1, comment: 'First comment' },
        { internalCommentId: 3, comment: 'Third comment' },
        { internalCommentId: 2, comment: 'Second comment' }
      ]
      mockApiService.get.mockResolvedValue({ data: mockComments })

      const { result } = renderHook(
        () => useComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(
          result.current.comments.map((comment) => comment.internalCommentId)
        ).toEqual([3, 2, 1])
      })

      act(() => {
        result.current.handleSortOrderChange('asc')
      })

      expect(
        result.current.comments.map((comment) => comment.internalCommentId)
      ).toEqual([1, 2, 3])
      expect(mockApiService.get).toHaveBeenCalledTimes(1)
    })

    it('should not fetch when entityId is missing', () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      const { result } = renderHook(
        () => useComments('compliance_report', null),
        { wrapper: createWrapper() }
      )

      expect(result.current.isLoading).toBe(false)
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should not fetch when entityType is missing', () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      const { result } = renderHook(() => useComments(null, 123), {
        wrapper: createWrapper()
      })

      expect(result.current.isLoading).toBe(false)
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should handle enabled option', () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      const { result } = renderHook(
        () => useComments('compliance_report', 123, { enabled: false }),
        { wrapper: createWrapper() }
      )

      expect(result.current.isLoading).toBe(false)
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should handle autoFetch option', () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      const { result } = renderHook(
        () => useComments('compliance_report', 123, { autoFetch: false }),
        { wrapper: createWrapper() }
      )

      expect(result.current.isLoading).toBe(false)
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    it('should handle API errors', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')
      const mockError = new Error('Failed to fetch comments')
      mockApiService.get.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useComments('compliance_report', 123, { retry: 0 }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('Adding comments', () => {
    it('should add comment successfully with director role', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')
      const mockNewComment = {
        internalCommentId: 123,
        comment: 'New comment',
        audience_scope: 'Director'
      }
      mockApiService.post.mockResolvedValue({ data: mockNewComment })

      const { result } = renderHook(
        () => useComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      await act(async () => {
        result.current.handleCommentInputChange('New comment')
      })

      await act(async () => {
        await result.current.addComment()
      })

      expect(mockApiService.post).toHaveBeenCalledWith('/internal_comments/', {
        entityType: 'compliance_report',
        entityId: 123,
        comment: 'New comment',
        audience_scope: 'Director',
        visibility: 'Internal'
      })
    })

    it('should handle comment input state', () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      const { result } = renderHook(
        () => useComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.handleCommentInputChange('Test comment')
      })

      expect(result.current.commentInput).toBe('Test comment')
    })

    it('should clear comment input after successful addition', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')
      const mockNewComment = {
        internalCommentId: 123,
        comment: 'Test comment',
        audience_scope: 'Director'
      }
      mockApiService.post.mockResolvedValue({ data: mockNewComment })

      const { result } = renderHook(
        () => useComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.handleCommentInputChange('Test comment')
      })

      expect(result.current.commentInput).toBe('Test comment')

      await act(async () => {
        await result.current.addComment()
      })

      await waitFor(() => {
        expect(result.current.commentInput).toBe('')
      })
    })

    it('should handle add comment errors', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')
      const mockError = new Error('Failed to add comment')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.handleCommentInputChange('New comment')
      })

      await act(async () => {
        try {
          await result.current.addComment()
        } catch {
          // Expected to throw
        }
      })

      await waitFor(() => {
        expect(result.current.addError).toEqual(mockError)
      })
    })

    it('should submit with null audience scope when user has no gov role', async () => {
      mockHasAnyRole.mockReturnValue(false) // No valid role

      const { result } = renderHook(
        () => useComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.handleCommentInputChange('New comment')
      })

      await act(async () => {
        try {
          await result.current.addComment()
        } catch {
          // Expected to throw
        }
      })

      expect(mockApiService.post).toHaveBeenCalledWith('/internal_comments/', {
        entityType: 'compliance_report',
        entityId: 123,
        comment: 'New comment',
        audience_scope: null,
        visibility: 'Internal'
      })
    })

    it('should trim comment text before submission', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')
      const mockNewComment = {
        internalCommentId: 123,
        comment: 'Trimmed comment',
        audience_scope: 'Director'
      }
      mockApiService.post.mockResolvedValue({ data: mockNewComment })

      const { result } = renderHook(
        () => useComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.handleCommentInputChange('  Trimmed comment  ')
      })

      await act(async () => {
        await result.current.addComment()
      })

      expect(mockApiService.post).toHaveBeenCalledWith('/internal_comments/', {
        entityType: 'compliance_report',
        entityId: 123,
        comment: 'Trimmed comment',
        audience_scope: 'Director',
        visibility: 'Internal'
      })
    })

    it('should reject empty comments', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      const { result } = renderHook(
        () => useComments('compliance_report', 123),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.handleCommentInputChange('   ')
      })

      await act(async () => {
        await result.current.addComment()
      })

      expect(mockApiService.post).not.toHaveBeenCalled()
    })

    it('should force Public visibility for non-gov users in dual mode', async () => {
      mockHasAnyRole.mockReturnValue(false)
      mockApiService.post.mockResolvedValue({
        data: {
          internalCommentId: 200,
          comment: 'Public only',
          visibility: 'Public',
          audience_scope: null
        }
      })

      const { result } = renderHook(
        () =>
          useComments('compliance_report', 123, {
            commentMode: 'dual'
          }),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.handleVisibilityChange('Internal')
        result.current.handleCommentInputChange('Public only')
      })

      await act(async () => {
        await result.current.addComment()
      })

      expect(mockApiService.post).toHaveBeenCalledWith('/internal_comments/', {
        entityType: 'compliance_report',
        entityId: 123,
        comment: 'Public only',
        audience_scope: null,
        visibility: 'Public'
      })
    })

    it('should default gov-only users to Analyst audience scope in dual mode', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'government')
      mockApiService.post.mockResolvedValue({
        data: {
          internalCommentId: 201,
          comment: 'Internal gov note',
          visibility: 'Internal',
          audience_scope: 'Analyst'
        }
      })

      const { result } = renderHook(
        () =>
          useComments('compliance_report', 123, {
            commentMode: 'dual'
          }),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.handleVisibilityChange('Internal')
        result.current.handleCommentInputChange('Internal gov note')
      })

      await act(async () => {
        await result.current.addComment()
      })

      expect(mockApiService.post).toHaveBeenCalledWith('/internal_comments/', {
        entityType: 'compliance_report',
        entityId: 123,
        comment: 'Internal gov note',
        audience_scope: 'Analyst',
        visibility: 'Internal'
      })
    })

    it('should reset visibility to Internal after a gov user submits a Public comment in dual mode', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'government')
      mockApiService.post.mockResolvedValue({
        data: {
          internalCommentId: 202,
          comment: 'Public gov note',
          visibility: 'Public',
          audience_scope: null
        }
      })

      const { result } = renderHook(
        () =>
          useComments('compliance_report', 123, {
            commentMode: 'dual'
          }),
        { wrapper: createWrapper() }
      )

      act(() => {
        result.current.handleVisibilityChange('Public')
        result.current.handleCommentInputChange('Public gov note')
      })

      expect(result.current.visibility).toBe('Public')

      await act(async () => {
        await result.current.addComment()
      })

      await waitFor(() => {
        expect(result.current.visibility).toBe('Internal')
      })
    })
  })

  describe('Editing comments', () => {
    it('should omit audience_scope when setting visibility to Public so the backend preserves existing scope semantics', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')
      mockApiService.put.mockResolvedValue({
        data: {
          internalCommentId: 99,
          comment: 'Updated public',
          visibility: 'Public',
          audience_scope: null
        }
      })

      const { result } = renderHook(
        () =>
          useComments('compliance_report', 123, {
            commentMode: 'dual'
          }),
        { wrapper: createWrapper() }
      )

      await act(async () => {
        await result.current.editComment({
          commentId: 99,
          commentText: 'Updated public',
          visibility: 'Public'
        })
      })

      expect(mockApiService.put).toHaveBeenCalledWith('/internal_comments/99', {
        comment: 'Updated public',
        visibility: 'Public'
      })
    })

    it('should omit audience_scope when setting visibility to Internal so the backend preserves the original author scope', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'government')
      mockApiService.put.mockResolvedValue({
        data: {
          internalCommentId: 100,
          comment: 'Updated internal',
          visibility: 'Internal',
          audience_scope: 'Analyst'
        }
      })

      const { result } = renderHook(
        () =>
          useComments('compliance_report', 123, {
            commentMode: 'dual'
          }),
        { wrapper: createWrapper() }
      )

      await act(async () => {
        await result.current.editComment({
          commentId: 100,
          commentText: 'Updated internal',
          visibility: 'Internal'
        })
      })

      expect(mockApiService.put).toHaveBeenCalledWith(
        '/internal_comments/100',
        {
          comment: 'Updated internal',
          visibility: 'Internal'
        }
      )
    })
  })

  describe('Role and mode helpers', () => {
    it('should expose dual-mode permissions for non-gov users', () => {
      mockHasAnyRole.mockReturnValue(false)

      const { result } = renderHook(
        () =>
          useComments('compliance_report', 123, {
            commentMode: 'dual',
            autoFetch: false
          }),
        { wrapper: createWrapper() }
      )

      expect(result.current.canComment).toBe(true)
      expect(result.current.visibility).toBe('Public')
      expect(result.current.allowInternalVisibility).toBe(false)
    })

    it('should expose internal visibility control for gov users', () => {
      mockHasAnyRole.mockImplementation((role) => role === 'government')

      const { result } = renderHook(
        () =>
          useComments('compliance_report', 123, {
            commentMode: 'dual',
            autoFetch: false
          }),
        { wrapper: createWrapper() }
      )

      expect(result.current.canComment).toBe(true)
      expect(result.current.visibility).toBe('Internal')
      expect(result.current.allowInternalVisibility).toBe(true)
    })
  })

  describe('Optimistic updates', () => {
    it('should perform optimistic updates when enabled', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      // Mock initial comments
      const mockComments = [
        { internalCommentId: 1, comment: 'Existing comment' }
      ]
      mockApiService.get.mockResolvedValue({ data: mockComments })

      const mockNewComment = {
        internalCommentId: 2,
        comment: 'New comment',
        audience_scope: 'Director'
      }
      mockApiService.post.mockResolvedValue({ data: mockNewComment })

      const { result } = renderHook(
        () =>
          useComments('compliance_report', 123, {
            optimisticUpdates: true
          }),
        { wrapper: createWrapper() }
      )

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.comments).toEqual(mockComments)
      })

      act(() => {
        result.current.handleCommentInputChange('New comment')
      })

      await act(async () => {
        await result.current.addComment()
      })

      expect(mockApiService.post).toHaveBeenCalled()
    })

    it('should not perform optimistic updates when disabled', async () => {
      mockHasAnyRole.mockImplementation((role) => role === 'director')

      // Mock initial comments
      const mockComments = [
        { internalCommentId: 1, comment: 'Existing comment' }
      ]
      mockApiService.get.mockResolvedValue({ data: mockComments })

      const mockNewComment = {
        internalCommentId: 2,
        comment: 'New comment',
        audience_scope: 'Director'
      }
      mockApiService.post.mockResolvedValue({ data: mockNewComment })

      const { result } = renderHook(
        () =>
          useComments('compliance_report', 123, {
            optimisticUpdates: false
          }),
        { wrapper: createWrapper() }
      )

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.comments).toEqual(mockComments)
      })

      act(() => {
        result.current.handleCommentInputChange('New comment')
      })

      await act(async () => {
        await result.current.addComment()
      })

      expect(mockApiService.post).toHaveBeenCalled()
    })
  })
})

describe('penalty log comment attachments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasAnyRole.mockReturnValue(true)
    mockApiService.get.mockResolvedValue({ data: [] })
  })

  it('uploads multiple documents to the saved comment and retries failed uploads without duplicating it', async () => {
    const files = [new File(['a'], 'first.pdf'), new File(['b'], 'second.pdf')]
    const saved = { internalCommentId: 42, comment: 'Payment evidence' }
    let failSecond = true
    mockApiService.post.mockImplementation(async (url, body) => {
      if (url === '/internal_comments/') return { data: saved }
      if (body.get('file') === files[1] && failSecond) {
        throw new Error('Upload failed')
      }
      return { data: { documentId: body.get('file') === files[0] ? 81 : 82 } }
    })
    mockApiService.put.mockResolvedValue({ data: saved })
    const { result } = renderHook(() => useComments('penaltyLog', 7), {
      wrapper: createWrapper()
    })
    await act(async () => {
      result.current.handleCommentInputChange('Payment evidence')
      result.current.handleAttachmentsChange(files)
    })
    await act(async () => {
      await expect(result.current.addComment()).rejects.toThrow('Upload failed')
    })
    expect(result.current.commentInput).toBe('Payment evidence')
    failSecond = false
    await act(async () => {
      await result.current.addComment()
    })
    expect(
      mockApiService.post.mock.calls.filter(
        ([url]) => url === '/internal_comments/'
      )
    ).toHaveLength(1)
    expect(
      mockApiService.post.mock.calls.filter(
        ([, body]) => body instanceof FormData && body.get('file') === files[0]
      )
    ).toHaveLength(1)
    expect(
      mockApiService.post.mock.calls.filter(
        ([, body]) => body instanceof FormData && body.get('file') === files[1]
      )
    ).toHaveLength(2)
    expect(result.current.commentInput).toBe('')
    expect(result.current.attachments).toEqual([])
  })

  it('keeps the original attachment when uploading a replacement fails', async () => {
    mockApiService.put.mockResolvedValue({
      data: { internalCommentId: 42, comment: 'Replaced' }
    })
    mockApiService.post.mockRejectedValue(new Error('Upload failed'))
    const { result } = renderHook(() => useComments('penaltyLog', 7), {
      wrapper: createWrapper()
    })
    await act(async () => {
      await expect(
        result.current.editComment({
          commentId: 42,
          commentText: 'Replaced',
          newFiles: [new File(['a'], 'new.pdf')],
          removedDocumentIds: [81]
        })
      ).rejects.toThrow('Upload failed')
    })
    expect(mockApiService.delete).not.toHaveBeenCalled()
  })

  it('retries a partial removal without deleting an already removed document again', async () => {
    mockApiService.put.mockResolvedValue({
      data: { internalCommentId: 42, comment: 'Updated' }
    })
    let failSecond = true
    mockApiService.delete.mockImplementation(async (url) => {
      if (url.endsWith('/82') && failSecond) throw new Error('Removal failed')
      return { data: {} }
    })
    const { result } = renderHook(() => useComments('penaltyLog', 7), {
      wrapper: createWrapper()
    })
    const edit = {
      commentId: 42,
      commentText: 'Updated',
      removedDocumentIds: [81, 82]
    }
    await act(async () => {
      await expect(result.current.editComment(edit)).rejects.toThrow(
        'Removal failed'
      )
    })
    failSecond = false
    await act(async () => {
      await result.current.editComment(edit)
    })
    expect(
      mockApiService.delete.mock.calls.filter(([url]) => url.endsWith('/81'))
    ).toHaveLength(1)
    expect(
      mockApiService.delete.mock.calls.filter(([url]) => url.endsWith('/82'))
    ).toHaveLength(2)
  })

  it('sorts by creation date with a stable ID tiebreaker', async () => {
    mockApiService.get.mockResolvedValue({
      data: [
        {
          internalCommentId: 1,
          comment: 'Newer',
          createDate: '2026-10-22T12:00:00Z'
        },
        {
          internalCommentId: 2,
          comment: 'Older',
          createDate: '2026-10-21T12:00:00Z'
        }
      ]
    })
    const { result } = renderHook(() => useComments('penaltyLog', 7), {
      wrapper: createWrapper()
    })
    await waitFor(() => expect(result.current.comments).toHaveLength(2))
    expect(result.current.comments.map((c) => c.comment)).toEqual([
      'Newer',
      'Older'
    ])
    act(() => result.current.handleSortOrderChange('asc'))
    expect(result.current.comments.map((c) => c.comment)).toEqual([
      'Older',
      'Newer'
    ])
  })
})

describe('penalty attachment recovery', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockHasAnyRole.mockReturnValue(true)
    mockApiService.get.mockResolvedValue({ data: [] })
  })

  it.each(['add', 'edit'])(
    'removes a previously uploaded file discarded before retrying an %s',
    async (operation) => {
      const files = [
        new File(['a'], 'first.pdf'),
        new File(['b'], 'second.pdf')
      ]
      const saved = { internalCommentId: 42, comment: 'Evidence' }
      let failSecond = true
      mockApiService.post.mockImplementation(async (url, body) => {
        if (url === '/internal_comments/') return { data: saved }
        if (body.get('file') === files[1] && failSecond)
          throw new Error('Upload failed')
        return { data: { documentId: body.get('file') === files[0] ? 81 : 82 } }
      })
      mockApiService.put.mockResolvedValue({ data: saved })
      mockApiService.delete.mockResolvedValue({ data: {} })
      const { result } = renderHook(() => useComments('penaltyLog', 7), {
        wrapper: createWrapper()
      })
      await act(async () => {
        result.current.handleCommentInputChange('Evidence')
        result.current.handleAttachmentsChange(files)
      })
      await act(async () => {
        const save =
          operation === 'add'
            ? result.current.addComment()
            : result.current.editComment({
                commentId: 42,
                commentText: 'Evidence',
                newFiles: files
              })
        await expect(save).rejects.toThrow('Upload failed')
      })
      failSecond = false
      if (operation === 'add')
        act(() => result.current.handleAttachmentsChange([files[1]]))
      await act(async () => {
        if (operation === 'add') await result.current.addComment()
        else
          await result.current.editComment({
            commentId: 42,
            commentText: 'Evidence',
            newFiles: [files[1]]
          })
      })
      expect(mockApiService.delete).toHaveBeenCalledWith(
        '/documents/internal_comment/42/81'
      )
      expect(mockApiService.delete).not.toHaveBeenCalledWith(
        '/documents/internal_comment/42/82'
      )
      expect(
        mockApiService.post.mock.calls.filter(
          ([url]) => url === '/internal_comments/'
        )
      ).toHaveLength(operation === 'add' ? 1 : 0)
    }
  )

  it('releases attachment progress after an edit is cancelled', async () => {
    const file = new File(['a'], 'evidence.pdf')
    mockApiService.put.mockResolvedValue({
      data: { internalCommentId: 42, comment: 'Evidence' }
    })
    mockApiService.post.mockResolvedValue({ data: { documentId: 81 } })
    mockApiService.delete
      .mockRejectedValueOnce(new Error('Removal failed'))
      .mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useComments('penaltyLog', 7), {
      wrapper: createWrapper()
    })
    await act(async () => {
      await expect(
        result.current.editComment({
          commentId: 42,
          commentText: 'Evidence',
          newFiles: [file],
          removedDocumentIds: [80]
        })
      ).rejects.toThrow('Removal failed')
    })
    act(() => result.current.cancelEditComment(42))
    await act(async () => {
      await result.current.editComment({
        commentId: 42,
        commentText: 'Evidence',
        newFiles: [file]
      })
    })
    expect(mockApiService.post).toHaveBeenCalledTimes(2)
  })

  it('invalidates the affected organization without refreshing unrelated organizations', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    })
    const affectedKey = ['organization-comments', '7']
    const unrelatedKey = ['organization-comments', '8']
    queryClient.setQueryData(affectedKey, { comments: [] })
    queryClient.setQueryData(unrelatedKey, { comments: [] })
    mockApiService.post.mockResolvedValue({
      data: { internalCommentId: 42, comment: 'Evidence' }
    })
    const { result } = renderHook(() => useComments('penaltyLog', 7), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )
    })
    act(() => result.current.handleCommentInputChange('Evidence'))
    await act(async () => {
      await result.current.addComment()
    })
    expect(queryClient.getQueryState(affectedKey).isInvalidated).toBe(true)
    expect(queryClient.getQueryState(unrelatedKey).isInvalidated).toBe(false)
  })
})

it('shows the latest failed action and clears its error on a subsequent save', async () => {
  vi.resetAllMocks()
  mockHasAnyRole.mockReturnValue(true)
  mockApiService.get.mockResolvedValue({ data: [] })
  const addFailure = new Error('Create failed')
  const editFailure = new Error('Edit failed')
  mockApiService.post.mockRejectedValue(addFailure)
  mockApiService.put
    .mockRejectedValueOnce(editFailure)
    .mockResolvedValue({ data: { internalCommentId: 42, comment: 'Evidence' } })
  const { result } = renderHook(() => useComments('penaltyLog', 7), {
    wrapper: createWrapper()
  })
  act(() => result.current.handleCommentInputChange('Evidence'))
  await act(async () => {
    await expect(result.current.addComment()).rejects.toThrow('Create failed')
  })
  expect(result.current.mutationError).toBe(addFailure)
  await act(async () => {
    await expect(
      result.current.editComment({ commentId: 42, commentText: 'Evidence' })
    ).rejects.toThrow('Edit failed')
  })
  expect(result.current.mutationError).toBe(editFailure)
  await act(async () => {
    await result.current.editComment({ commentId: 42, commentText: 'Evidence' })
  })
  expect(result.current.mutationError).toBeNull()
})
