import { useCallback, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'

import type { QueryOptions } from './types'

const DEFAULT_STALE_TIME = 60 * 1000 // 1 minute
const DEFAULT_CACHE_TIME = 5 * 60 * 1000 // 5 minutes
const DEFAULT_SIZE = 25
const MAX_SIZE = 100

export type CommentLogVisibility = 'Internal' | 'Public'
export type CommentLogSortField = 'create_date' | 'update_date'
export type CommentLogSortOrder = 'asc' | 'desc'

export interface OrganizationCommentRecord {
  internalCommentId: number
  comment: string | null
  plainTextComment: string | null
  entityType: string | null
  entityId: number | null
  category: string | null
  complianceYear: number | null
  organizationId: number | null
  organizationName: string | null
  visibility: CommentLogVisibility | null
  audienceScope: string | null
  createUser: string | null
  fullName: string | null
  createDate: string | null
  updateDate: string | null
  canEdit: boolean
}

export interface OrganizationCommentsResponse {
  comments: OrganizationCommentRecord[]
  pagination: {
    page: number
    size: number
    total: number
    totalPages: number
  }
}

export interface CommentLogFilters {
  category: string | null
  complianceYear: number | null
  dateFrom: string | null
  dateTo: string | null
  visibility: CommentLogVisibility | null
  search: string
  sortBy: CommentLogSortField
  sortOrder: CommentLogSortOrder
  page: number
  size: number
}

const FILTER_PARAM_KEYS = [
  'category',
  'compliance_year',
  'date_from',
  'date_to',
  'visibility',
  'search',
  'sort_by',
  'sort_order',
  'page',
  'size'
] as const

const clampPage = (raw: string | null): number => {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}

const clampSize = (raw: string | null): number => {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_SIZE
  return Math.min(Math.floor(n), MAX_SIZE)
}

const parseYear = (raw: string | null): number | null => {
  if (raw === null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) && Number.isInteger(n) ? n : null
}

const parseVisibility = (raw: string | null): CommentLogVisibility | null => {
  if (raw === 'Internal' || raw === 'Public') return raw
  return null
}

const parseSortField = (raw: string | null): CommentLogSortField =>
  raw === 'update_date' ? 'update_date' : 'create_date'

const parseSortOrder = (raw: string | null): CommentLogSortOrder =>
  raw === 'asc' ? 'asc' : 'desc'

export const parseFiltersFromParams = (
  params: URLSearchParams
): CommentLogFilters => ({
  category: params.get('category') || null,
  complianceYear: parseYear(params.get('compliance_year')),
  dateFrom: params.get('date_from') || null,
  dateTo: params.get('date_to') || null,
  visibility: parseVisibility(params.get('visibility')),
  search: params.get('search') || '',
  sortBy: parseSortField(params.get('sort_by')),
  sortOrder: parseSortOrder(params.get('sort_order')),
  page: clampPage(params.get('page')),
  size: clampSize(params.get('size'))
})

const buildRequestParams = (filters: CommentLogFilters) => {
  const out: Record<string, string | number> = {
    page: filters.page,
    size: filters.size,
    sort_by: filters.sortBy,
    sort_order: filters.sortOrder
  }
  if (filters.category) out.category = filters.category
  if (filters.complianceYear !== null)
    out.compliance_year = filters.complianceYear
  if (filters.dateFrom) out.date_from = filters.dateFrom
  if (filters.dateTo) out.date_to = filters.dateTo
  if (filters.visibility) out.visibility = filters.visibility
  if (filters.search.trim()) out.search = filters.search.trim()
  return out
}

export interface UseOrganizationCommentsResult {
  filters: CommentLogFilters
  setFilter: (key: keyof CommentLogFilters, value: unknown) => void
  setFilters: (next: Partial<CommentLogFilters>) => void
  clearFilters: () => void
  data: OrganizationCommentsResponse | undefined
  isLoading: boolean
  isFetching: boolean
  isError: boolean
  error: unknown
  refetch: () => void
}

export const useOrganizationComments = (
  orgID: number | string | undefined | null,
  options: QueryOptions<OrganizationCommentsResponse> = {}
): UseOrganizationCommentsResult => {
  const client = useApiService()
  const [searchParams, setSearchParams] = useSearchParams()

  const {
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  const filters = useMemo(
    () => parseFiltersFromParams(searchParams),
    [searchParams]
  )

  const applyToParams = useCallback(
    (next: Partial<CommentLogFilters>) => {
      setSearchParams(
        (prev) => {
          const out = new URLSearchParams(prev)
          const merged = { ...filters, ...next }

          // Filter changes reset to page 1 unless the caller is changing page itself.
          if (!('page' in next)) merged.page = 1

          const writes: Array<[string, string | number | null]> = [
            ['category', merged.category],
            [
              'compliance_year',
              merged.complianceYear !== null ? merged.complianceYear : null
            ],
            ['date_from', merged.dateFrom],
            ['date_to', merged.dateTo],
            ['visibility', merged.visibility],
            ['search', merged.search?.trim() || null],
            ['sort_by', merged.sortBy !== 'create_date' ? merged.sortBy : null],
            [
              'sort_order',
              merged.sortOrder !== 'desc' ? merged.sortOrder : null
            ],
            ['page', merged.page !== 1 ? merged.page : null],
            ['size', merged.size !== DEFAULT_SIZE ? merged.size : null]
          ]

          for (const [key, value] of writes) {
            if (value === null || value === '' || value === undefined) {
              out.delete(key)
            } else {
              out.set(key, String(value))
            }
          }
          return out
        },
        { replace: true }
      )
    },
    [filters, setSearchParams]
  )

  const setFilter = useCallback(
    (key: keyof CommentLogFilters, value: unknown) => {
      applyToParams({ [key]: value } as Partial<CommentLogFilters>)
    },
    [applyToParams]
  )

  const clearFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        const out = new URLSearchParams(prev)
        for (const key of FILTER_PARAM_KEYS) {
          out.delete(key)
        }
        return out
      },
      { replace: true }
    )
  }, [setSearchParams])

  const query = useQuery<OrganizationCommentsResponse>({
    queryKey: ['organization-comments', orgID, filters],
    queryFn: async () => {
      if (!orgID) {
        throw new Error('Organization ID is required')
      }
      const url = apiRoutes.organizationComments.replace(
        ':orgID',
        String(orgID)
      )
      const response = await client.get(url, {
        params: buildRequestParams(filters)
      })
      return response.data
    },
    enabled: enabled && !!orgID,
    placeholderData: (prev) => prev, // keep previous page while fetching next
    staleTime,
    gcTime,
    retry: 1,
    ...restOptions
  })

  return {
    filters,
    setFilter,
    setFilters: applyToParams,
    clearFilters,
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch
  }
}

export const useEditOrganizationComment = (
  orgID: number | string | undefined | null
) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      commentId,
      comment,
      visibility
    }: {
      commentId: number
      comment: string
      visibility?: string
    }) => {
      const payload: Record<string, any> = { comment }
      if (visibility) payload.visibility = visibility
      const response = await client.put(
        apiRoutes.internalComment.replace(':commentId', String(commentId)),
        payload
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['organization-comments', orgID]
      })
    }
  })
}

// The dedicated org-dashboard Company Overview thread is an ORGANIZATION-entity
// internal-comment thread filed under this seeded category (#4608). It flows
// into the org Comment Log filterable by the same category.
export const COMPANY_OVERVIEW_CATEGORY = 'Company Overview'
export const COMPANY_OVERVIEW_ENTITY_TYPE = 'Organization'

/**
 * List the Company Overview comment thread for an organization. Independent of
 * the Comment Log's URL-driven filters — this is a self-contained thread shown
 * on the dashboard. Comments are returned oldest-first like a conversation.
 */
export const useOrganizationCommentThread = (
  orgID: number | string | undefined | null,
  category: string = COMPANY_OVERVIEW_CATEGORY,
  options: QueryOptions<OrganizationCommentsResponse> = {}
) => {
  const client = useApiService()
  const { enabled = true, ...restOptions } = options
  return useQuery<OrganizationCommentsResponse>({
    queryKey: ['organization-comments', orgID, 'thread', category],
    queryFn: async () => {
      if (!orgID) {
        throw new Error('Organization ID is required')
      }
      const url = apiRoutes.organizationComments.replace(
        ':orgID',
        String(orgID)
      )
      const response = await client.get(url, {
        params: {
          category,
          size: MAX_SIZE,
          sort_by: 'create_date',
          sort_order: 'asc'
        }
      })
      return response.data
    },
    enabled: enabled && !!orgID,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    ...restOptions
  })
}

/**
 * Create a Company Overview comment (an ORGANIZATION-entity internal comment
 * filed under the Company Overview category) for an organization.
 */
export const useCreateOrganizationComment = (
  orgID: number | string | undefined | null,
  category: string = COMPANY_OVERVIEW_CATEGORY
) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      comment,
      visibility = 'Internal'
    }: {
      comment: string
      visibility?: CommentLogVisibility
    }) => {
      if (!orgID) {
        throw new Error('Organization ID is required')
      }
      const payload = {
        entityType: COMPANY_OVERVIEW_ENTITY_TYPE,
        entityId: Number(orgID),
        comment,
        commentCategory: category,
        visibility
      }
      const response = await client.post('/internal_comments/', payload)
      return response.data
    },
    onSuccess: () => {
      // Prefix-invalidates both the dashboard thread and the Comment Log feed.
      queryClient.invalidateQueries({
        queryKey: ['organization-comments', orgID]
      })
    }
  })
}

export const useCommentCategories = () => {
  const client = useApiService()
  return useQuery<string[]>({
    queryKey: ['comment-categories'],
    queryFn: async () => {
      const response = await client.get(apiRoutes.commentCategories)
      return response.data
    },
    staleTime: 10 * 60 * 1000, // categories rarely change
    gcTime: 30 * 60 * 1000
  })
}
