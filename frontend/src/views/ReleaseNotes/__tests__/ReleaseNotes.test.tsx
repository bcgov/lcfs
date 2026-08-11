import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, expect, vi, beforeEach } from 'vitest'
import { test } from '@/tests/utils/fixtures'
import { ReleaseNotes } from '../ReleaseNotes'

// ── i18n mock ────────────────────────────────────────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'releaseNotes:pageTitle': 'Release Notes',
        'releaseNotes:pageSubtitle':
          'Track new features, improvements, and fixes.',
        'releaseNotes:loadError': 'Unable to load release notes.',
        'releaseNotes:noReleases': 'No release notes are available yet.',
        'releaseNotes:noChangesInRelease':
          'No categorized changes recorded for this release.',
        'releaseNotes:viewOnGitHub': 'View release on GitHub',
        'releaseNotes:fullChangelog': 'Full changelog',
        'releaseNotes:contributors': 'Contributors',
        'releaseNotes:summaryLabel': "What's in this release",
        'releaseNotes:editReleaseNote': 'Edit release note',
        'releaseNotes:saveChanges': 'Save changes',
        'releaseNotes:cancelEdit': 'Cancel',
        'releaseNotes:addItem': 'Add line',
        'releaseNotes:removeItem': 'Remove line',
        'releaseNotes:resetToDefault': 'Reset to default',
        'releaseNotes:resetModalTitle': 'Reset to default?',
        'releaseNotes:resetModalContent':
          'This release note will revert to its original auto-generated content.',
        'releaseNotes:resetConfirm': 'Reset',
        'common:cancel': 'Cancel',
        'releaseNotes:categories.features': 'Features',
        'releaseNotes:categories.fixes': 'Bug Fixes',
        'releaseNotes:categories.security': 'Security',
        'releaseNotes:categories.breaking': 'Breaking Changes',
        'releaseNotes:categories.dependencies': 'Dependencies',
        'releaseNotes:categories.other': 'Other'
      }
      return map[key] ?? key
    }
  })
}))

// ── Hook mocks ───────────────────────────────────────────────────────────────
// Following the established pattern (see LoginScreenBackground.test.jsx) of
// mocking the data hooks directly rather than the underlying auth/HTTP
// context, which isn't wired up in the test render providers.
const mockUseReleaseNotes = vi.fn()
const mockUpdateMutate = vi.fn()
const mockResetMutate = vi.fn()
const mockHasAnyRole = vi.fn()

vi.mock('@/hooks/useReleaseNotes', () => ({
  useReleaseNotes: () => mockUseReleaseNotes(),
  useUpdateReleaseNote: (options: any) => ({
    mutate: (variables: unknown) => {
      mockUpdateMutate(variables)
      options?.onSuccess?.({}, variables, undefined)
    },
    isPending: false
  }),
  useResetReleaseNote: (options: any) => ({
    mutate: (variables: unknown) => {
      mockResetMutate(variables)
      options?.onSuccess?.({}, variables, undefined)
    },
    isPending: false
  })
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ hasAnyRole: mockHasAnyRole })
}))

// ── Test data ─────────────────────────────────────────────────────────────────
const mockRelease = {
  version: '1.0.0',
  tag: '1.0.0-20260612120000',
  date: '2026-06-12',
  releaseUrl: 'https://github.com/bcgov/lcfs/releases/tag/1.0.0-20260612120000',
  fullChangelogUrl:
    'https://github.com/bcgov/lcfs/compare/1.0.0-previous...1.0.0-20260612120000',
  summary: 'User-friendly AI-enhanced summary.',
  sections: {
    features: ['Added bulk import for fuel codes', 'New compliance dashboard'],
    fixes: ['Fixed date calculation in compliance reports (#4482).'],
    security: [],
    breaking: [],
    dependencies: [],
    other: []
  },
  contributors: ['@dev1', '@dev2']
}

const setReleaseNotes = (
  overrides: {
    data?: unknown
    isLoading?: boolean
    isError?: boolean
    overriddenVersions?: Set<string>
  } = {}
) => {
  mockUseReleaseNotes.mockReturnValue({
    data: overrides.data ?? [mockRelease],
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    overriddenVersions: overrides.overriddenVersions ?? new Set()
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockHasAnyRole.mockReturnValue(false)
  setReleaseNotes()
})

describe('ReleaseNotes', () => {
  test('renders the page title and subtitle', async ({
    render,
    theme,
    router
  }) => {
    render(<ReleaseNotes />, [theme, router])

    expect(screen.getByText('Release Notes')).toBeInTheDocument()
    expect(
      screen.getByText('Track new features, improvements, and fixes.')
    ).toBeInTheDocument()
  })

  test('shows loading skeletons while fetching', ({
    render,
    theme,
    router
  }) => {
    setReleaseNotes({ data: undefined, isLoading: true })
    render(<ReleaseNotes />, [theme, router])

    expect(screen.getByTestId('release-notes-loading')).toBeInTheDocument()
  })

  test('shows error alert when fetch fails', async ({
    render,
    theme,
    router
  }) => {
    setReleaseNotes({ data: undefined, isError: true })
    render(<ReleaseNotes />, [theme, router])

    await waitFor(() =>
      expect(
        screen.getByText('Unable to load release notes.')
      ).toBeInTheDocument()
    )
  })

  test('shows empty state when response is an empty array', async ({
    render,
    theme,
    router
  }) => {
    setReleaseNotes({ data: [] })
    render(<ReleaseNotes />, [theme, router])

    await waitFor(() =>
      expect(
        screen.getByText('No release notes are available yet.')
      ).toBeInTheDocument()
    )
  })

  test('renders release version and date', async ({
    render,
    theme,
    router
  }) => {
    render(<ReleaseNotes />, [theme, router])

    await waitFor(() => {
      expect(screen.getByText('v1.0.0')).toBeInTheDocument()
      expect(screen.getByText('Jun 12, 2026')).toBeInTheDocument()
    })
  })

  test('shows LATEST badge on the most recent release', async ({
    render,
    theme,
    router
  }) => {
    render(<ReleaseNotes />, [theme, router])

    await waitFor(() => expect(screen.getByText('LATEST')).toBeInTheDocument())
  })

  test('first release is expanded by default', async ({
    render,
    theme,
    router
  }) => {
    render(<ReleaseNotes />, [theme, router])

    await waitFor(() =>
      expect(screen.getByText('Added bulk import for fuel codes')).toBeVisible()
    )
  })

  test('renders feature and fix change items', async ({
    render,
    theme,
    router
  }) => {
    render(<ReleaseNotes />, [theme, router])

    await waitFor(() => {
      expect(
        screen.getByText('Added bulk import for fuel codes')
      ).toBeInTheDocument()
      expect(screen.getByText('New compliance dashboard')).toBeInTheDocument()
    })
  })

  test('auto-links ticket references in change items to GitHub', async ({
    render,
    theme,
    router
  }) => {
    render(<ReleaseNotes />, [theme, router])

    await waitFor(() => {
      const ticketLink = screen.getByText('#4482').closest('a')
      expect(ticketLink).toHaveAttribute(
        'href',
        'https://github.com/bcgov/lcfs/issues/4482'
      )
      expect(ticketLink).toHaveAttribute('target', '_blank')
      expect(ticketLink).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  test('does not render contributor chips (feature removed)', async ({
    render,
    theme,
    router
  }) => {
    render(<ReleaseNotes />, [theme, router])

    await waitFor(() => {
      expect(screen.queryByText('@dev1')).not.toBeInTheDocument()
      expect(screen.queryByText('@dev2')).not.toBeInTheDocument()
    })
  })

  test('renders the GitHub release and full changelog links', async ({
    render,
    theme,
    router
  }) => {
    render(<ReleaseNotes />, [theme, router])

    await waitFor(() => {
      const releaseLink = screen
        .getByText('View release on GitHub')
        .closest('a')
      expect(releaseLink).toHaveAttribute(
        'href',
        'https://github.com/bcgov/lcfs/releases/tag/1.0.0-20260612120000'
      )
      expect(releaseLink).toHaveAttribute('target', '_blank')
      expect(releaseLink).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  test('collapses a release when its header is clicked again', async ({
    render,
    theme,
    router
  }) => {
    render(<ReleaseNotes />, [theme, router])

    const header = await screen.findByText('v1.0.0')
    fireEvent.click(header)

    await waitFor(() =>
      expect(
        screen.queryByText('Added bulk import for fuel codes')
      ).not.toBeVisible()
    )
  })

  test('renders multiple releases, LATEST only on the first', async ({
    render,
    theme,
    router
  }) => {
    const olderRelease = {
      ...mockRelease,
      version: '0.9.0',
      tag: '0.9.0-20260501120000',
      date: '2026-05-01',
      sections: {
        ...mockRelease.sections,
        features: ['Initial release of the LCFS platform'],
        fixes: []
      },
      contributors: []
    }
    setReleaseNotes({ data: [mockRelease, olderRelease] })
    render(<ReleaseNotes />, [theme, router])

    await waitFor(() => {
      expect(screen.getByText('v1.0.0')).toBeInTheDocument()
      expect(screen.getByText('v0.9.0')).toBeInTheDocument()
      // LATEST badge appears exactly once
      expect(screen.getAllByText('LATEST')).toHaveLength(1)
    })
  })

  // ── System Admin edit permissions ─────────────────────────────────────────

  describe('System Admin editing', () => {
    test('does not render an edit control for non-System-Admin users', async ({
      render,
      theme,
      router
    }) => {
      mockHasAnyRole.mockReturnValue(false)
      render(<ReleaseNotes />, [theme, router])

      await screen.findByText('v1.0.0')
      expect(
        screen.queryByTestId(`edit-release-${mockRelease.tag}`)
      ).not.toBeInTheDocument()
    })

    test('renders an edit control for System Admin users', async ({
      render,
      theme,
      router
    }) => {
      mockHasAnyRole.mockReturnValue(true)
      render(<ReleaseNotes />, [theme, router])

      await waitFor(() =>
        expect(
          screen.getByTestId(`edit-release-${mockRelease.tag}`)
        ).toBeInTheDocument()
      )
    })

    test('opens an edit form pre-filled with the current summary and sections', async ({
      render,
      theme,
      router
    }) => {
      mockHasAnyRole.mockReturnValue(true)
      render(<ReleaseNotes />, [theme, router])

      fireEvent.click(
        await screen.findByTestId(`edit-release-${mockRelease.tag}`)
      )

      expect(
        screen.getByDisplayValue('User-friendly AI-enhanced summary.')
      ).toBeInTheDocument()
      expect(
        screen.getByDisplayValue('Added bulk import for fuel codes')
      ).toBeInTheDocument()
      expect(
        screen.getByDisplayValue(
          'Fixed date calculation in compliance reports (#4482).'
        )
      ).toBeInTheDocument()
    })

    test('saves edited content and calls the update mutation with the new values', async ({
      render,
      theme,
      router
    }) => {
      mockHasAnyRole.mockReturnValue(true)
      render(<ReleaseNotes />, [theme, router])

      fireEvent.click(
        await screen.findByTestId(`edit-release-${mockRelease.tag}`)
      )

      const summaryField = screen.getByDisplayValue(
        'User-friendly AI-enhanced summary.'
      )
      fireEvent.change(summaryField, {
        target: { value: 'Corrected summary.' }
      })

      const firstFeatureField = screen.getByDisplayValue(
        'Added bulk import for fuel codes'
      )
      fireEvent.change(firstFeatureField, {
        target: { value: 'Edited feature description' }
      })

      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() =>
        expect(mockUpdateMutate).toHaveBeenCalledWith({
          version: '1.0.0',
          summary: 'Corrected summary.',
          sections: {
            features: [
              'Edited feature description',
              'New compliance dashboard'
            ],
            fixes: ['Fixed date calculation in compliance reports (#4482).'],
            security: [],
            breaking: [],
            dependencies: [],
            other: []
          }
        })
      )

      // Edit form closes after a successful save
      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'Save changes' })
        ).not.toBeInTheDocument()
      )
    })

    test('discards changes and exits edit mode without saving when Cancel is clicked', async ({
      render,
      theme,
      router
    }) => {
      mockHasAnyRole.mockReturnValue(true)
      render(<ReleaseNotes />, [theme, router])

      fireEvent.click(
        await screen.findByTestId(`edit-release-${mockRelease.tag}`)
      )

      const summaryField = screen.getByDisplayValue(
        'User-friendly AI-enhanced summary.'
      )
      fireEvent.change(summaryField, { target: { value: 'Unsaved edit.' } })

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(mockUpdateMutate).not.toHaveBeenCalled()
      await waitFor(() =>
        expect(
          screen.queryByDisplayValue('Unsaved edit.')
        ).not.toBeInTheDocument()
      )
      // Original content is shown again, unedited
      expect(
        screen.getByText('User-friendly AI-enhanced summary.')
      ).toBeInTheDocument()
    })

    test('adds and removes section line items while editing', async ({
      render,
      theme,
      router
    }) => {
      mockHasAnyRole.mockReturnValue(true)
      render(<ReleaseNotes />, [theme, router])

      fireEvent.click(
        await screen.findByTestId(`edit-release-${mockRelease.tag}`)
      )

      // Remove line buttons render in category order: 2 for "features",
      // then 1 for "fixes" — click the third (the "fixes" item).
      const removeButtons = screen.getAllByRole('button', {
        name: 'Remove line'
      })
      fireEvent.click(removeButtons[2])

      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() =>
        expect(mockUpdateMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            sections: expect.objectContaining({ fixes: [] })
          })
        )
      )
    })
  })

  describe('Reset to default', () => {
    test('does not show a reset button when the release has no override', async ({
      render,
      theme,
      router
    }) => {
      mockHasAnyRole.mockReturnValue(true)
      setReleaseNotes({ overriddenVersions: new Set() })
      render(<ReleaseNotes />, [theme, router])

      fireEvent.click(
        await screen.findByTestId(`edit-release-${mockRelease.tag}`)
      )

      expect(
        screen.queryByTestId(`reset-release-${mockRelease.tag}`)
      ).not.toBeInTheDocument()
    })

    test('shows a reset button for a release with an active override', async ({
      render,
      theme,
      router
    }) => {
      mockHasAnyRole.mockReturnValue(true)
      setReleaseNotes({ overriddenVersions: new Set([mockRelease.version]) })
      render(<ReleaseNotes />, [theme, router])

      fireEvent.click(
        await screen.findByTestId(`edit-release-${mockRelease.tag}`)
      )

      expect(
        screen.getByTestId(`reset-release-${mockRelease.tag}`)
      ).toBeInTheDocument()
    })

    test('opens a confirmation modal instead of resetting immediately', async ({
      render,
      theme,
      router
    }) => {
      mockHasAnyRole.mockReturnValue(true)
      setReleaseNotes({ overriddenVersions: new Set([mockRelease.version]) })
      render(<ReleaseNotes />, [theme, router])

      fireEvent.click(
        await screen.findByTestId(`edit-release-${mockRelease.tag}`)
      )
      fireEvent.click(screen.getByTestId(`reset-release-${mockRelease.tag}`))

      expect(mockResetMutate).not.toHaveBeenCalled()
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('Reset to default?')).toBeInTheDocument()
    })

    test('resets the release note when the modal is confirmed', async ({
      render,
      theme,
      router
    }) => {
      mockHasAnyRole.mockReturnValue(true)
      setReleaseNotes({ overriddenVersions: new Set([mockRelease.version]) })
      render(<ReleaseNotes />, [theme, router])

      fireEvent.click(
        await screen.findByTestId(`edit-release-${mockRelease.tag}`)
      )
      fireEvent.click(screen.getByTestId(`reset-release-${mockRelease.tag}`))
      const modal = screen.getByTestId('modal')
      fireEvent.click(within(modal).getByRole('button', { name: 'Reset' }))

      await waitFor(() =>
        expect(mockResetMutate).toHaveBeenCalledWith({
          version: mockRelease.version
        })
      )

      // Modal and edit form both close after a successful reset
      await waitFor(() =>
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
      )
      expect(
        screen.queryByRole('button', { name: 'Save changes' })
      ).not.toBeInTheDocument()
    })

    test('does not reset when the modal is cancelled', async ({
      render,
      theme,
      router
    }) => {
      mockHasAnyRole.mockReturnValue(true)
      setReleaseNotes({ overriddenVersions: new Set([mockRelease.version]) })
      render(<ReleaseNotes />, [theme, router])

      fireEvent.click(
        await screen.findByTestId(`edit-release-${mockRelease.tag}`)
      )
      fireEvent.click(screen.getByTestId(`reset-release-${mockRelease.tag}`))
      const modal = screen.getByTestId('modal')
      fireEvent.click(within(modal).getByRole('button', { name: 'Cancel' }))

      expect(mockResetMutate).not.toHaveBeenCalled()
      await waitFor(() =>
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
      )
      // Edit form (with the reset button) is still open, unaffected
      expect(
        screen.getByTestId(`reset-release-${mockRelease.tag}`)
      ).toBeInTheDocument()
    })
  })
})
