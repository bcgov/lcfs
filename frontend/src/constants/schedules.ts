export type PaginationSortOrder = Record<string, unknown>
export type PaginationFilter = Record<string, unknown>

export interface PaginationOptions {
  page: number
  size: number
  sortOrders: PaginationSortOrder[]
  filters: PaginationFilter[]
}

export const defaultInitialPagination: PaginationOptions = {
  page: 1,
  size: 10,
  sortOrders: [],
  filters: []
}
