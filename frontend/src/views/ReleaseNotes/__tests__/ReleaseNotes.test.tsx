import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
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

// ── Fetch mock helpers ────────────────────────────────────────────────────────
const mockFetch = (data: unknown, ok = true) => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 500,
    json: async () => data
  } as Response)
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('ReleaseNotes', () => {
  it('renders the page title and subtitle', async () => {
    mockFetch([mockRelease])
    render(<ReleaseNotes />, { wrapper })

    expect(screen.getByText('Release Notes')).toBeInTheDocument()
    expect(
      screen.getByText('Track new features, improvements, and fixes.')
    ).toBeInTheDocument()
  })

  it('shows loading skeletons while fetching', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(new Promise(() => {}))
    render(<ReleaseNotes />, { wrapper })

    expect(screen.getByTestId('release-notes-loading')).toBeInTheDocument()
  })

  it('shows error alert when fetch fails', async () => {
    mockFetch({}, false)
    render(<ReleaseNotes />, { wrapper })

    await waitFor(() =>
      expect(
        screen.getByText('Unable to load release notes.')
      ).toBeInTheDocument()
    )
  })

  it('shows empty state when response is an empty array', async () => {
    mockFetch([])
    render(<ReleaseNotes />, { wrapper })

    await waitFor(() =>
      expect(
        screen.getByText('No release notes are available yet.')
      ).toBeInTheDocument()
    )
  })

  it('renders release version and date', async () => {
    mockFetch([mockRelease])
    render(<ReleaseNotes />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('v1.0.0')).toBeInTheDocument()
      expect(screen.getByText('June 12, 2026')).toBeInTheDocument()
    })
  })

  it('shows LATEST badge on the most recent release', async () => {
    mockFetch([mockRelease])
    render(<ReleaseNotes />, { wrapper })

    await waitFor(() => expect(screen.getByText('LATEST')).toBeInTheDocument())
  })

  it('first release is expanded by default', async () => {
    mockFetch([mockRelease])
    render(<ReleaseNotes />, { wrapper })

    await waitFor(() =>
      expect(screen.getByText('Added bulk import for fuel codes')).toBeVisible()
    )
  })

  it('renders feature and fix change items', async () => {
    mockFetch([mockRelease])
    render(<ReleaseNotes />, { wrapper })

    await waitFor(() => {
      expect(
        screen.getByText('Added bulk import for fuel codes')
      ).toBeInTheDocument()
      expect(screen.getByText('New compliance dashboard')).toBeInTheDocument()
    })
  })

  it('auto-links ticket references in change items to GitHub', async () => {
    mockFetch([mockRelease])
    render(<ReleaseNotes />, { wrapper })

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

  it('renders contributor chips with GitHub profile links', async () => {
    mockFetch([mockRelease])
    render(<ReleaseNotes />, { wrapper })

    await waitFor(() => {
      const dev1Link = screen.getByText('@dev1').closest('a')
      expect(dev1Link).toHaveAttribute('href', 'https://github.com/dev1')
      expect(dev1Link).toHaveAttribute('target', '_blank')
      expect(dev1Link).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  it('renders the GitHub release and full changelog links', async () => {
    mockFetch([mockRelease])
    render(<ReleaseNotes />, { wrapper })

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

  it('collapses a release when its header is clicked again', async () => {
    mockFetch([mockRelease])
    render(<ReleaseNotes />, { wrapper })

    const header = await screen.findByText('v1.0.0')
    fireEvent.click(header)

    await waitFor(() =>
      expect(
        screen.queryByText('Added bulk import for fuel codes')
      ).not.toBeVisible()
    )
  })

  it('renders multiple releases, LATEST only on the first', async () => {
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
    mockFetch([mockRelease, olderRelease])
    render(<ReleaseNotes />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('v1.0.0')).toBeInTheDocument()
      expect(screen.getByText('v0.9.0')).toBeInTheDocument()
      // LATEST badge appears exactly once
      expect(screen.getAllByText('LATEST')).toHaveLength(1)
    })
  })
})
