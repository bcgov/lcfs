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
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
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
        () =>
          useComments('compliance_report', 123, { sortOrder: 'asc' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.comments).toEqual(expectedSorted)
      })

      expect(result.current.comments).toEqual(expectedSorted)
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
        () =>
          useComments('compliance_report', 123, { autoFetch: false }),
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
        } catch (error) {
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
        } catch (error) {
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
  })

  describe('Editing comments', () => {
    it('should send null audience scope when setting visibility to Public', async () => {
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
        visibility: 'Public',
        audience_scope: null
      })
    })

    it('should send analyst audience scope when setting visibility to Internal for gov-only user', async () => {
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

      expect(mockApiService.put).toHaveBeenCalledWith('/internal_comments/100', {
        comment: 'Updated internal',
        visibility: 'Internal',
        audience_scope: 'Analyst'
      })
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
