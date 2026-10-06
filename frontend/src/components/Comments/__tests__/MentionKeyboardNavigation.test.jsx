import { test } from '@/tests/utils/fixtures'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, vi, beforeAll, beforeEach, expect } from 'vitest'
import Comments from '@/components/Comments'

// jsdom doesn't implement range layout geometry; Quill's setSelection calls
// scrollIntoView, which needs these to exist (real browsers obviously do).
beforeAll(() => {
  const rect = {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({})
  }
  Range.prototype.getBoundingClientRect = () => rect
  Range.prototype.getClientRects = () => ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* () {}
  })
})

// Real react-quill so the toolbar button + keyboard handling under test are
// the actual production code path, not a stub.
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

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { keycloakUsername: 'idir-user' },
    hasAnyRole: (...roles) => roles.includes('Government')
  })
}))

const mentionableUsers = [
  { userProfileId: 1, displayName: 'Al Ring', email: 'al.ring@gov.bc.ca' },
  {
    userProfileId: 2,
    displayName: 'Alex Zorkin',
    email: 'alex.zorkin@gov.bc.ca'
  },
  { userProfileId: 3, displayName: 'Hamed Bayeki', email: 'hamed@gov.bc.ca' }
]

describe('Mention dropdown keyboard navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiService.get.mockImplementation((url) => {
      if (url.startsWith('/internal_comments/mentionable-users')) {
        return Promise.resolve({ data: mentionableUsers })
      }
      return Promise.resolve({ data: [] })
    })
  })

  test('ArrowDown/ArrowUp move the highlighted option and Enter selects it', async ({
    render,
    query,
    theme
  }) => {
    render(
      <Comments entityType="ciApplication" entityId={123} commentMode="dual" />,
      [query, theme]
    )

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'internalComment:mentionButtonLabel'
      })
    )

    const options = await screen.findAllByRole('option')
    expect(options).toHaveLength(3)
    expect(options[0]).toHaveAttribute('aria-selected', 'true')

    const editor = document.querySelector('.ql-editor')
    fireEvent.keyDown(editor, { key: 'ArrowDown' })

    await waitFor(() => {
      expect(screen.getAllByRole('option')[1]).toHaveAttribute(
        'aria-selected',
        'true'
      )
    })
    expect(screen.getAllByRole('option')[0]).toHaveAttribute(
      'aria-selected',
      'false'
    )

    fireEvent.keyDown(editor, { key: 'ArrowUp' })
    await waitFor(() => {
      expect(screen.getAllByRole('option')[0]).toHaveAttribute(
        'aria-selected',
        'true'
      )
    })

    fireEvent.keyDown(editor, { key: 'ArrowDown' })
    await waitFor(() => {
      expect(screen.getAllByRole('option')[1]).toHaveAttribute(
        'aria-selected',
        'true'
      )
    })

    fireEvent.keyDown(editor, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
    expect(editor.querySelector('.mention')).toHaveTextContent('@Alex Zorkin')
  })

  test('arrow keys do not scroll the page while results are still loading', async ({
    render,
    query,
    theme
  }) => {
    mockApiService.get.mockImplementation((url) =>
      url.startsWith('/internal_comments/mentionable-users')
        ? new Promise(() => {})
        : Promise.resolve({ data: [] })
    )
    render(
      <Comments entityType="ciApplication" entityId={123} commentMode="dual" />,
      [query, theme]
    )

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'internalComment:mentionButtonLabel'
      })
    )
    await screen.findByRole('listbox')

    const editor = document.querySelector('.ql-editor')
    // fireEvent returns false when the default action was prevented.
    expect(fireEvent.keyDown(editor, { key: 'ArrowDown' })).toBe(false)
    expect(fireEvent.keyDown(editor, { key: 'ArrowUp' })).toBe(false)
  })

  test('arrow keys still navigate when focus is on the toolbar button', async ({
    render,
    query,
    theme
  }) => {
    render(
      <Comments entityType="ciApplication" entityId={123} commentMode="dual" />,
      [query, theme]
    )

    const button = await screen.findByRole('button', {
      name: 'internalComment:mentionButtonLabel'
    })
    fireEvent.click(button)
    await screen.findAllByRole('option')

    // Re-query: the toolbar may have been re-rendered since the click.
    const currentButton = document.querySelector('.ql-mention')
    expect(fireEvent.keyDown(currentButton, { key: 'ArrowDown' })).toBe(false)
    await waitFor(() => {
      expect(screen.getAllByRole('option')[1]).toHaveAttribute(
        'aria-selected',
        'true'
      )
    })
  })
})
