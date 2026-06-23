import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import React from 'react'

import { useApiService } from '@/services/useApiService'
import {
  parseFiltersFromParams,
  useOrganizationComments
} from '../useOrganizationComments'

vi.mock('@/services/useApiService')

const mockGet = vi.fn()

const makeWrapper = (initialEntries) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } }
  })
  return ({ children }) =>
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(
        MemoryRouter,
        { initialEntries: initialEntries || ['/?'] },
        children
      )
    )
}

// Helper hook that surfaces the URL so we can assert on it.
const useHookWithLocation = (orgID) => {
  const hook = useOrganizationComments(orgID)
  const location = useLocation()
  return { hook, search: location.search }
}

describe('parseFiltersFromParams', () => {
  it('returns defaults for an empty URL', () => {
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

  it('parses all known params', () => {
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

  it('clamps invalid page/size and ignores unknown visibility', () => {
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

  it('forwards filters from URL params into the API request', async () => {
    const wrapper = makeWrapper([
      '/?category=Compliance%20notes&compliance_year=2024&search=foo&page=2'
    ])
    const { result } = renderHook(() => useHookWithLocation(42), { wrapper })

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

  it('writes filter changes back into the URL and resets page to 1', async () => {
    const wrapper = makeWrapper(['/?page=5'])
    const { result } = renderHook(() => useHookWithLocation(7), { wrapper })

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

  it('preserves page when changing page itself', async () => {
    const wrapper = makeWrapper(['/?category=Person'])
    const { result } = renderHook(() => useHookWithLocation(7), { wrapper })

    await waitFor(() => expect(mockGet).toHaveBeenCalled())

    act(() => {
      result.current.hook.setFilters({ page: 3 })
    })

    await waitFor(() => expect(result.current.search).toMatch(/page=3/))
    expect(result.current.search).toContain('category=Person')
  })

  it('clearFilters drops every filter param from the URL', async () => {
    const wrapper = makeWrapper([
      '/?category=Person&compliance_year=2024&search=foo&visibility=Internal&page=2'
    ])
    const { result } = renderHook(() => useHookWithLocation(7), { wrapper })

    await waitFor(() => expect(mockGet).toHaveBeenCalled())

    act(() => {
      result.current.hook.clearFilters()
    })

    await waitFor(() => expect(result.current.search).toBe(''))
  })

  it('does not fire when orgID is missing', () => {
    const wrapper = makeWrapper(['/'])
    renderHook(() => useOrganizationComments(undefined), { wrapper })
    expect(mockGet).not.toHaveBeenCalled()
  })
})
