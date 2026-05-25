import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'
import { ORGANIZATION_STATUSES } from '@/constants/statuses'
import type { QueryOptions, PaginationParams } from './types'

export const useOrganizationStatuses = (options: QueryOptions<unknown>) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['organization-statuses'],
    queryFn: async () => (await client.get('/organizations/statuses/')).data,
    ...options
  })
}
export const useOrganizationListStatuses = (options: QueryOptions<unknown>) => {
  const { data, isLoading, ...rest } = useOrganizationStatuses(options)

  const validStatuses = [
    ORGANIZATION_STATUSES.REGISTERED,
    ORGANIZATION_STATUSES.UNREGISTERED
  ]

  const filteredData = (data as any)?.filter((status: any) =>
    validStatuses.includes(status.status)
  )

  return {
    data: filteredData,
    isLoading,
    ...rest
  }
}

/**
 * Fetches organization summaries for dropdowns and selectors.
 *
 * @param {string[]|null} statuses Optional array of organization status filters.
 * @param {Object} queryParamsOrOptions Either:
 *   - React Query options (legacy signature), or
 *   - An object with optional `orgFilter` (defaults to `fuel_supplier`) and
 *     `filters` (key/value pairs matching Organization columns). Provide a third
 *     argument to pass React Query options when using query params.
 * @param {Object} options React Query options when `queryParamsOrOptions` is used
 *   for query params.
 *
 * @example
 * // Default fuel suppliers
 * const { data } = useOrganizationNames()
 *
 * @example
 * // All organizations with additional filters and custom query options
 * const { data } = useOrganizationNames(
 *   ['Registered'],
 *   { orgFilter: 'all', filters: { name: ['Sample Corp'], city: ['Victoria'] } },
 *   { staleTime: 5 * 60 * 1000 }
 * )
 */
export const useOrganizationNames = (statuses: any = null, queryParamsOrOptions: any = {}, options: QueryOptions<unknown> = {}) => {
  const client = useApiService()

  const hasQueryParams =
    queryParamsOrOptions &&
    (Object.prototype.hasOwnProperty.call(queryParamsOrOptions, 'orgFilter') ||
      Object.prototype.hasOwnProperty.call(queryParamsOrOptions, 'filters'))

  const queryParams = {
    orgFilter: 'fuel_supplier',
    filters: {}
  }

  if (hasQueryParams) {
    queryParams.orgFilter =
      queryParamsOrOptions.orgFilter ?? queryParams.orgFilter
    queryParams.filters = queryParamsOrOptions.filters ?? queryParams.filters
  }

  const queryOptions = hasQueryParams
    ? (options ?? {})
    : (queryParamsOrOptions ?? options ?? {})

  const basePath =
    queryParams.orgFilter && queryParams.orgFilter !== 'fuel_supplier'
      ? `/organizations/names/${encodeURIComponent(queryParams.orgFilter)}`
      : '/organizations/names/'

  const statusParams =
    Array.isArray(statuses) && statuses.length > 0
      ? statuses
          .filter(
            (status) => typeof status === 'string' && status.trim().length > 0
          )
          .map((status: any) => `statuses=${encodeURIComponent(status)}`)
      : []

  const filterEntries: string[] = []
  if (queryParams.filters && typeof queryParams.filters === 'object') {
    Object.entries(queryParams.filters).forEach(([key, rawValue]) => {
      if (rawValue === null || rawValue === undefined) return

      const values = Array.isArray(rawValue) ? rawValue : [rawValue]
      values
        .filter(
          (value: any) =>
            value !== null &&
            value !== undefined &&
            String(value).trim().length > 0
        )
        .forEach((value: any) => {
          filterEntries.push(
            `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
          )
        })
    })
  }

  const querySegments = [...statusParams, ...filterEntries]
  const queryString =
    querySegments.length > 0 ? `?${querySegments.join('&')}` : ''
  const filtersKey = JSON.stringify(queryParams.filters || {})

  return useQuery({
    queryKey: [
      'organization-names',
      Array.isArray(statuses) ? statuses : null,
      queryParams.orgFilter,
      filtersKey
    ],
    queryFn: async () => {
      const response = await client.get(`${basePath}${queryString}`)
      return response.data
    },
    ...queryOptions
  })
}

export const useRegExtOrgs = (options: QueryOptions<unknown>) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['registered-external-orgs'],
    queryFn: async () =>
      (await client.get('/organizations/registered/external')).data,
    initialData: [],
    ...options
  })
}

export const useOrganizationsList = (paginationOptions: PaginationParams, options: QueryOptions<unknown>) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['organizations-list', paginationOptions],
    queryFn: async () => {
      const response = await client.post('/organizations/', paginationOptions)
      return response.data
    },
    ...options
  })
}

export const useOrganizationUsers = (orgID: number | string | undefined | null, paginationOptions: PaginationParams, options: QueryOptions<unknown>) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['organization-users', orgID, paginationOptions],
    queryFn: async () => {
      const response = await client.post(
        `/organization/${orgID}/users/list`,
        paginationOptions
      )
      return response.data
    },
    enabled: !!orgID,
    ...options
  })
}
