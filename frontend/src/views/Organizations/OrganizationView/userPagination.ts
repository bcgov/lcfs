import type { BCPaginationOptions } from '@/components/BCDataGrid/types'
import type { OrganizationUsersPaginationParams } from '@/hooks/useOrganizations'

export const toOrganizationUsersPaginationParams = (
  paginationOptions: BCPaginationOptions
): OrganizationUsersPaginationParams => ({
  page: paginationOptions.page,
  size: paginationOptions.size,
  sortOrders: paginationOptions.sortOrders?.map(({ field, direction }) => ({
    field: field ?? '',
    direction: direction === 'desc' ? 'desc' : 'asc'
  })),
  filters: paginationOptions.filters?.flatMap((filter) => {
    if (typeof filter.field !== 'string') return []
    return [{ ...filter, field: filter.field }]
  })
})
