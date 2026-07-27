import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useApiService } from '@/services/useApiService'
import { wrapper } from '@/tests/utils/wrapper'
import { useReleaseNotes, useUpdateReleaseNote } from '../useReleaseNotes'

vi.mock('@/services/useApiService')

const mockRelease = {
  version: '1.0.0',
  tag: '1.0.0-20260612120000',
  date: '2026-06-12',
  releaseUrl: 'https://github.com/bcgov/lcfs/releases/tag/1.0.0-20260612120000',
  fullChangelogUrl: 'https://github.com/bcgov/lcfs/compare/1.0.0-previous...1.0.0',
  summary: 'Auto-generated summary.',
  sections: {
    features: ['Auto-generated feature'],
    fixes: [],
    security: [],
    breaking: [],
    dependencies: [],
    other: []
  },
  contributors: []
}

const mockFetchBaseJson = (data: unknown, ok = true) => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 500,
    json: async () => data
  } as Response)
}

describe('useReleaseNotes', () => {
  const mockGet = vi.fn()
  const mockPut = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({
      get: mockGet,
      put: mockPut
    } as any)
  })

  it('returns the auto-generated release notes unmodified when there are no overrides', async () => {
    mockFetchBaseJson([mockRelease])
    mockGet.mockResolvedValue({ data: [] })

    const { result } = renderHook(() => useReleaseNotes(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data).toEqual([mockRelease])
  })

  it('layers a System Admin override on top of the matching auto-generated release', async () => {
    mockFetchBaseJson([mockRelease])
    mockGet.mockResolvedValue({
      data: [
        {
          version: '1.0.0',
          summary: 'Admin-corrected summary.',
          sections: {
            features: ['Corrected feature text'],
            fixes: [],
            security: [],
            breaking: [],
            dependencies: [],
            other: []
          }
        }
      ]
    })

    const { result } = renderHook(() => useReleaseNotes(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data?.[0].summary).toBe('Admin-corrected summary.')
    expect(result.current.data?.[0].sections.features).toEqual([
      'Corrected feature text'
    ])
    // Non-overridden releases are untouched, and identity fields are preserved
    expect(result.current.data?.[0].tag).toBe(mockRelease.tag)
  })

  it('falls back to the auto-generated content for fields the override leaves null', async () => {
    mockFetchBaseJson([mockRelease])
    mockGet.mockResolvedValue({
      data: [{ version: '1.0.0', summary: 'Only the summary was edited.', sections: null }]
    })

    const { result } = renderHook(() => useReleaseNotes(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data?.[0].summary).toBe('Only the summary was edited.')
    expect(result.current.data?.[0].sections).toEqual(mockRelease.sections)
  })

  it('still renders auto-generated notes even if fetching overrides fails', async () => {
    mockFetchBaseJson([mockRelease])
    mockGet.mockRejectedValue(new Error('network error'))

    const { result } = renderHook(() => useReleaseNotes(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.isError).toBe(false)
    expect(result.current.data).toEqual([mockRelease])
  })

  it('reports an error only when the auto-generated JSON itself fails to load', async () => {
    mockFetchBaseJson({}, false)
    mockGet.mockResolvedValue({ data: [] })

    const { result } = renderHook(() => useReleaseNotes(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useUpdateReleaseNote', () => {
  const mockPut = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useApiService).mockReturnValue({ put: mockPut } as any)
  })

  it('PUTs to the version-specific endpoint with summary and sections', async () => {
    mockPut.mockResolvedValue({
      data: { version: '1.0.0', summary: 'Edited', sections: mockRelease.sections }
    })

    const { result } = renderHook(() => useUpdateReleaseNote(), { wrapper })

    result.current.mutate({
      version: '1.0.0',
      summary: 'Edited',
      sections: mockRelease.sections
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockPut).toHaveBeenCalledWith('/release-notes/1.0.0', {
      summary: 'Edited',
      sections: mockRelease.sections
    })
  })
})
