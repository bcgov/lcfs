import { test } from '@/tests/utils/fixtures'
import { screen, waitFor } from '@testing-library/react'
import { describe, vi, beforeEach, expect } from 'vitest'
import Comments from '@/components/Comments'

// Real react-quill (not the textarea stub used by CommentList.test.jsx) so the
// actual toolbar — including the custom "mention" button — renders, proving
// the feature is wired up for whichever entityType is passed in, including
// CI applications.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

const mockApiService = {
  get: vi.fn(),
  post: vi.fn()
}
vi.mock('@/services/useApiService', () => ({
  useApiService: () => mockApiService
}))

const mockHasAnyRole = vi.fn()
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { keycloakUsername: 'idir-user' },
    hasAnyRole: mockHasAnyRole
  })
}))

describe('Comments on a CI application (entityType="ciApplication")', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiService.get.mockResolvedValue({ data: [] })
  })

  test('shows the @mention toolbar button for an IDIR (government) commenter', async ({
    render,
    query,
    theme
  }) => {
    mockHasAnyRole.mockImplementation((...checkedRoles) =>
      checkedRoles.includes('Government')
    )

    render(
      <Comments entityType="ciApplication" entityId={123} commentMode="dual" />,
      [query, theme]
    )

    await waitFor(() => {
      expect(mockApiService.get).toHaveBeenCalledWith(
        '/internal_comments/ciApplication/123'
      )
    })

    expect(
      await screen.findByRole('button', {
        name: 'internalComment:mentionButtonLabel'
      })
    ).toBeInTheDocument()
  })

  test('hides the @mention toolbar button for a non-IDIR (BCeID) commenter', async ({
    render,
    query,
    theme
  }) => {
    mockHasAnyRole.mockReturnValue(false)

    render(
      <Comments entityType="ciApplication" entityId={123} commentMode="dual" />,
      [query, theme]
    )

    await waitFor(() => {
      expect(mockApiService.get).toHaveBeenCalledWith(
        '/internal_comments/ciApplication/123'
      )
    })

    expect(
      screen.queryByRole('button', {
        name: 'internalComment:mentionButtonLabel'
      })
    ).not.toBeInTheDocument()
  })
})
