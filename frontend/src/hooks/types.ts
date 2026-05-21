import type { UseQueryOptions, UseMutationOptions } from '@tanstack/react-query'

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface SortOrder {
  field: string
  direction?: 'asc' | 'desc'
}

export interface Filter {
  field: string
  filter: string | number | boolean
  type: string
  filterType?: string
}

export interface PaginationParams {
  page?: number
  size?: number
  filters?: Filter[]
  sort_orders?: SortOrder[]
  sortOrders?: SortOrder[]
  organizationId?: number | string
  [key: string]: unknown
}

export interface PaginatedResponse<T = unknown> {
  pagination: {
    total: number
    page: number
    size: number
  }
  data?: T[]
}

// ─── Common option helpers ────────────────────────────────────────────────────

// Query options without 'queryKey' and 'queryFn', TData is 'unknown' by default
export type QueryOptions<TData = unknown> = Omit<
  UseQueryOptions<TData, Error>,
  'queryKey' | 'queryFn'
>

// Mutation options excluding 'mutationFn'
export type MutationOptions<
  TData = unknown,
  TVariables = unknown,
  TContext = unknown
> = Omit<UseMutationOptions<TData, Error, TVariables, TContext>, 'mutationFn'>

// Legacy mutation callback signatures (data, variables, context).
type LegacyMutationCallbacks<
  TData = unknown,
  TVariables = any,
  TContext = unknown
> = {
  onSuccess?: (
    data: TData,
    variables: TVariables,
    context: TContext | undefined
  ) => void | Promise<void>
  onError?: (
    error: Error,
    variables: TVariables,
    context: TContext | undefined
  ) => void | Promise<void>
  onSettled?: (
    data: TData | undefined,
    error: Error | null,
    variables: TVariables,
    context: TContext | undefined
  ) => void | Promise<void>
}

// Extended mutation options with control flags and legacy callbacks.
export type ExtMutationOptions<
  TData = unknown,
  TVariables = any,
  TContext = unknown
> = Omit<
  MutationOptions<TData, TVariables, TContext>,
  'onSuccess' | 'onError' | 'onSettled'
> &
  LegacyMutationCallbacks<TData, TVariables, TContext> & {
    invalidateRelatedQueries?: boolean
    clearCache?: boolean
    invalidateAll?: boolean
    invalidateListQuery?: boolean
    onUploadProgress?: (progressEvent: any) => void
    userID?: number | string
    [key: string]: unknown
  }

// ─── Common destructured query-options shape ──────────────────────────────────

export interface BaseQueryOptionsFields<TData = unknown>
  extends QueryOptions<TData> {
  gcTime?: number
}

// ─── Shared domain types ─────────────────────────────────────────────────────

export type ID = number | string

// Generic shape for mutation payloads.
export type AnyData = Record<string, unknown>
