import { waitFor, act } from '@testing-library/react'
import { vi, describe, expect, beforeEach } from 'vitest'
import { test } from '@/tests/utils/fixtures'

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

describe('useComments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasAnyRole.mockReturnValue(false)
  })

  describe('Comments fetching', () => {
    test('should fetch internal comments successfully with director role', async ({
      renderHook,
      query
    }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('director')
      )

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
        [query]
      )

      await waitFor(() => {
        expect(result.current.comments).toEqual(mockComments)
      })

      expect(result.current.comments).toEqual(mockComments)
      expect(mockApiService.get).toHaveBeenCalledWith(
        '/internal_comments/compliance_report/123'
      )
    })

    test('should fetch internal comments with analyst role', async ({
      renderHook,
      query
    }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('analyst')
      )

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
        [query]
      )

      await waitFor(() => {
        expect(result.current.comments).toEqual(mockComments)
      })

      expect(result.current.comments).toEqual(mockComments)
    })

    test('should fetch internal comments with compliance manager role', async ({
      renderHook,
      query
    }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('compliance_manager')
      )

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
        [query]
      )

      await waitFor(() => {
        expect(result.current.comments).toEqual(mockComments)
      })

      expect(result.current.comments).toEqual(mockComments)
    })

    test('should sort comments in descending order by default', async ({
      renderHook,
      query
    }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('director')
      )

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
        [query]
      )

      await waitFor(() => {
        expect(result.current.comments).toEqual(expectedSorted)
      })

      expect(result.current.comments).toEqual(expectedSorted)
    })

    test('should sort comments in ascending order when specified', async ({
      renderHook,
      query
    }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('director')
      )

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
        [query]
      )

      await waitFor(() => {
        expect(result.current.comments).toEqual(expectedSorted)
      })

      expect(result.current.comments).toEqual(expectedSorted)
    })

    test('should reorder cached comments without refetching when sort order changes', async ({
      renderHook,
      query
    }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('director')
      )

      const mockComments = [
        { internalCommentId: 1, comment: 'First comment' },
        { internalCommentId: 3, comment: 'Third comment' },
        { internalCommentId: 2, comment: 'Second comment' }
      ]
      mockApiService.get.mockResolvedValue({ data: mockComments })

      const { result } = renderHook(
        () => useComments('compliance_report', 123),
        [query]
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

    test('should not fetch when entityId is missing', ({
      renderHook,
      query
    }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('director')
      )

      const { result } = renderHook(
        () => useComments('compliance_report', null),
        [query]
      )

      expect(result.current.isLoading).toBe(false)
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    test('should not fetch when entityType is missing', ({
      renderHook,
      query
    }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('director')
      )

      const { result } = renderHook(() => useComments(null, 123), [query])

      expect(result.current.isLoading).toBe(false)
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    test('should handle enabled option', ({ renderHook, query }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('director')
      )

      const { result } = renderHook(
        () => useComments('compliance_report', 123, { enabled: false }),
        [query]
      )

      expect(result.current.isLoading).toBe(false)
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    test('should handle autoFetch option', ({ renderHook, query }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('director')
      )

      const { result } = renderHook(
        () => useComments('compliance_report', 123, { autoFetch: false }),
        [query]
      )

      expect(result.current.isLoading).toBe(false)
      expect(mockApiService.get).not.toHaveBeenCalled()
    })

    test('should handle API errors', async ({ renderHook, query }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('director')
      )
      const mockError = new Error('Failed to fetch comments')
      mockApiService.get.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useComments('compliance_report', 123, { retry: 0 }),
        [query]
      )

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })

      expect(result.current.error).toEqual(mockError)
    })
  })

  describe('Adding comments', () => {
    test('should add comment successfully with director role', async ({
      renderHook,
      query
    }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('director')
      )
      const mockNewComment = {
        internalCommentId: 123,
        comment: 'New comment',
        audience_scope: 'Director'
      }
      mockApiService.post.mockResolvedValue({ data: mockNewComment })

      const { result } = renderHook(
        () => useComments('compliance_report', 123),
        [query]
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

    test('should handle comment input state', ({ renderHook, query }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('director')
      )

      const { result } = renderHook(
        () => useComments('compliance_report', 123),
        [query]
      )

      act(() => {
        result.current.handleCommentInputChange('Test comment')
      })

      expect(result.current.commentInput).toBe('Test comment')
    })

    test('should clear comment input after successful addition', async ({
      renderHook,
      query
    }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('director')
      )
      const mockNewComment = {
        internalCommentId: 123,
        comment: 'Test comment',
        audience_scope: 'Director'
      }
      mockApiService.post.mockResolvedValue({ data: mockNewComment })

      const { result } = renderHook(
        () => useComments('compliance_report', 123),
        [query]
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

    test('should handle add comment errors', async ({ renderHook, query }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('director')
      )
      const mockError = new Error('Failed to add comment')
      mockApiService.post.mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useComments('compliance_report', 123),
        [query]
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

    test('should submit with null audience scope when user has no gov role', async ({
      renderHook,
      query
    }) => {
      mockHasAnyRole.mockReturnValue(false) // No valid role

      const { result } = renderHook(
        () => useComments('compliance_report', 123),
        [query]
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

    test('should trim comment text before submission', async ({
      renderHook,
      query
    }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('director')
      )
      const mockNewComment = {
        internalCommentId: 123,
        comment: 'Trimmed comment',
        audience_scope: 'Director'
      }
      mockApiService.post.mockResolvedValue({ data: mockNewComment })

      const { result } = renderHook(
        () => useComments('compliance_report', 123),
        [query]
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

    test('should reject empty comments', async ({ renderHook, query }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('director')
      )

      const { result } = renderHook(
        () => useComments('compliance_report', 123),
        [query]
      )

      act(() => {
        result.current.handleCommentInputChange('   ')
      })

      await act(async () => {
        await result.current.addComment()
      })

      expect(mockApiService.post).not.toHaveBeenCalled()
    })

    test('should force Public visibility for non-gov users in dual mode', async ({
      renderHook,
      query
    }) => {
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
        [query]
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

    test('should default gov-only users to Analyst audience scope in dual mode', async ({
      renderHook,
      query
    }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('government')
      )
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
        [query]
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

    test('should reset visibility to Internal after a gov user submits a Public comment in dual mode', async ({
      renderHook,
      query
    }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('government')
      )
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
        [query]
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
    test('should omit audience_scope when setting visibility to Public so the backend preserves existing scope semantics', async ({
      renderHook,
      query
    }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('director')
      )
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
        [query]
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

    test('should omit audience_scope when setting visibility to Internal so the backend preserves the original author scope', async ({
      renderHook,
      query
    }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('government')
      )
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
        [query]
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
    test('should expose dual-mode permissions for non-gov users', ({
      renderHook,
      query
    }) => {
      mockHasAnyRole.mockReturnValue(false)

      const { result } = renderHook(
        () =>
          useComments('compliance_report', 123, {
            commentMode: 'dual',
            autoFetch: false
          }),
        [query]
      )

      expect(result.current.canComment).toBe(true)
      expect(result.current.visibility).toBe('Public')
      expect(result.current.allowInternalVisibility).toBe(false)
    })

    test('should expose internal visibility control for gov users', ({
      renderHook,
      query
    }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('government')
      )

      const { result } = renderHook(
        () =>
          useComments('compliance_report', 123, {
            commentMode: 'dual',
            autoFetch: false
          }),
        [query]
      )

      expect(result.current.canComment).toBe(true)
      expect(result.current.visibility).toBe('Internal')
      expect(result.current.allowInternalVisibility).toBe(true)
    })
  })

  describe('Optimistic updates', () => {
    test('should perform optimistic updates when enabled', async ({
      renderHook,
      query
    }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('director')
      )

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
        [query]
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

    test('should not perform optimistic updates when disabled', async ({
      renderHook,
      query
    }) => {
      mockHasAnyRole.mockImplementation((...requested) =>
        requested.includes('director')
      )

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
        [query]
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
