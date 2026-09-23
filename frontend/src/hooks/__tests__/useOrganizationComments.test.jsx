import { act, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, vi } from 'vitest'
import { test } from '@/tests/utils/fixtures'
import { useLocation } from 'react-router-dom'

import { useApiService } from '@/services/useApiService'
import {
  parseFiltersFromParams,
  useOrganizationComments
} from '../useOrganizationComments'

vi.mock('@/services/useApiService')

const mockGet = vi.fn()

// Helper hook that surfaces the URL so we can assert on it.
const useHookWithLocation = (orgID) => {
  const hook = useOrganizationComments(orgID)
  const location = useLocation()
  return { hook, search: location.search }
}

describe('parseFiltersFromParams', () => {
  test('returns defaults for an empty URL', () => {
    const f = parseFiltersFromParams(new URLSearchParams(''))
    expect(f).toEqual({
      category: null,
      complianceYear: null,
      dateFrom: null,
      dateTo: null,
      visibility: null,
      search: '',
      sortBy: 'create_date',
      sortOrder: 'desc',
      page: 1,
      size: 25
    })
  })

  test('parses all known params', () => {
    const f = parseFiltersFromParams(
      new URLSearchParams(
        'category=Compliance%20notes&compliance_year=2024&date_from=2024-01-01&date_to=2024-12-31&visibility=Internal&search=foo&sort_by=update_date&sort_order=asc&page=3&size=50'
      )
    )
    expect(f).toEqual({
      category: 'Compliance notes',
      complianceYear: 2024,
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
      visibility: 'Internal',
      search: 'foo',
      sortBy: 'update_date',
      sortOrder: 'asc',
      page: 3,
      size: 50
    })
  })

  test('clamps invalid page/size and ignores unknown visibility', () => {
    const f = parseFiltersFromParams(
      new URLSearchParams('page=-9&size=99999&visibility=Bogus')
    )
    expect(f.page).toBe(1)
    expect(f.size).toBe(100)
    expect(f.visibility).toBeNull()
  })
})

describe('useOrganizationComments', () => {
  beforeEach(() => {
    vi.mocked(useApiService).mockReturnValue({ get: mockGet })
    mockGet.mockReset()
    mockGet.mockResolvedValue({
      data: {
        comments: [],
        pagination: { page: 1, size: 25, total: 0, totalPages: 0 }
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('forwards filters from URL params into the API request', async ({
    renderHook,
    query,
    router
  }) => {
    const { result } = renderHook(
      () => useHookWithLocation(42),
      [
        query,
        router.with({
          initialEntries: [
            '/?category=Compliance%20notes&compliance_year=2024&search=foo&page=2'
          ]
        })
      ]
    )

    await waitFor(() => expect(mockGet).toHaveBeenCalled())

    expect(mockGet).toHaveBeenCalledWith(
      '/organizations/42/comments',
      expect.objectContaining({
        params: expect.objectContaining({
          category: 'Compliance notes',
          compliance_year: 2024,
          search: 'foo',
          page: 2,
          size: 25,
          sort_by: 'create_date',
          sort_order: 'desc'
        })
      })
    )
    expect(result.current.hook.filters.category).toBe('Compliance notes')
    expect(result.current.hook.filters.complianceYear).toBe(2024)
  })

  test('writes filter changes back into the URL and resets page to 1', async ({
    renderHook,
    query,
    router
  }) => {
    const { result } = renderHook(
      () => useHookWithLocation(7),
      [query, router.with({ initialEntries: ['/?page=5'] })]
    )

    await waitFor(() => expect(mockGet).toHaveBeenCalled())

    act(() => {
      result.current.hook.setFilter('category', 'Person')
    })

    await waitFor(() =>
      expect(result.current.search).toContain('category=Person')
    )
    // page was 5 — applying a filter should drop it back to default (no `page` param).
    expect(result.current.search).not.toMatch(/page=/)
  })

  test('preserves page when changing page itself', async ({
    renderHook,
    query,
    router
  }) => {
    const { result } = renderHook(
      () => useHookWithLocation(7),
      [query, router.with({ initialEntries: ['/?category=Person'] })]
    )

    await waitFor(() => expect(mockGet).toHaveBeenCalled())

    act(() => {
      result.current.hook.setFilters({ page: 3 })
    })

    await waitFor(() => expect(result.current.search).toMatch(/page=3/))
    expect(result.current.search).toContain('category=Person')
  })

  test('clearFilters drops every filter param from the URL', async ({
    renderHook,
    query,
    router
  }) => {
    const { result } = renderHook(
      () => useHookWithLocation(7),
      [
        query,
        router.with({
          initialEntries: [
            '/?category=Person&compliance_year=2024&search=foo&visibility=Internal&page=2'
          ]
        })
      ]
    )

    await waitFor(() => expect(mockGet).toHaveBeenCalled())

    act(() => {
      result.current.hook.clearFilters()
    })

    await waitFor(() => expect(result.current.search).toBe(''))
  })

  test('does not fire when orgID is missing', ({
    renderHook,
    query,
    router
  }) => {
    renderHook(
      () => useOrganizationComments(undefined),
      [query, router.with({ initialEntries: ['/'] })]
    )
    expect(mockGet).not.toHaveBeenCalled()
  })
})
