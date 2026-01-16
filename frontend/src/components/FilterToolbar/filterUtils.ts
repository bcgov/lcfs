import startCase from 'lodash/startCase'

export const FILTER_VALUE_DISPLAY_LIMIT = 12

import { ReactNode } from 'react'

export interface FilterToolbarPill {
  id: string
  label: string
  value?: string
  rawValue?: unknown
  type?: 'grid' | 'preset' | 'select' | 'search' | 'sort'
  sortDirection?: 'asc' | 'desc'
  onRemove?: () => void
  renderContent?: (pill: FilterToolbarPill) => ReactNode
}

export interface AgGridFilterModel {
  field: string
  filterType?: string
  type?: string
  filter?: string | number | boolean | null
  filterTo?: string | number | boolean | null
  values?: Array<string | number | boolean | null>
  operator?: 'AND' | 'OR'
  condition1?: Omit<AgGridFilterModel, 'field'>
  condition2?: Omit<AgGridFilterModel, 'field'>
  dateFrom?: string | null
  dateTo?: string | null
}

export interface FilterPillRendererParams {
  label: string
  value: string
  rawValue: unknown
  field: string
}

export type FilterPillRenderer = (
  params: FilterPillRendererParams
) => ReactNode

export interface CreateAgGridPillsOptions {
  filters?: AgGridFilterModel[]
  columnLabelLookup?: Record<string, string>
  columnPillRenderers?: Record<string, FilterPillRenderer>
  maxValueLength?: number
  onRemove?: (field: string, value?: string | number | boolean | null) => void
}

export interface SortOrder {
  field: string
  direction: 'asc' | 'desc'
}

export interface CreateSortPillsOptions {
  sortOrders?: SortOrder[]
  columnLabelLookup?: Record<string, string>
  onRemove?: (field: string) => void
}

const truncateValue = (
  value: string,
  maxLength: number = FILTER_VALUE_DISPLAY_LIMIT
) => {
  if (!value || value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength)}…`
}

const deriveLabel = (
  field: string,
  columnLabelLookup: Record<string, string> = {}
) => {
  return columnLabelLookup[field] || startCase(field)
}

const normalizeValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

const extractFilterValues = (
  filter: Omit<AgGridFilterModel, 'field'> | undefined | null
): Array<string | number | boolean | null> => {
  if (!filter) {
    return []
  }

  if (filter.operator && filter.condition1 && filter.condition2) {
    return [
      ...extractFilterValues(filter.condition1),
      ...extractFilterValues(filter.condition2)
    ]
  }

  if (filter.filterType === 'set') {
    const valuesArray = Array.isArray(filter.values)
      ? filter.values
      : Array.isArray(filter.filter)
        ? filter.filter
        : []
    return valuesArray.filter(
      (val) => val !== undefined && val !== null && val !== ''
    )
  }

  if (filter.type === 'inRange') {
    const startValue = filter.filter ?? filter.dateFrom
    const endValue = filter.filterTo ?? filter.dateTo

    if (startValue && endValue) {
      return [`${startValue} – ${endValue}`]
    }

    if (startValue || endValue) {
      return [startValue ?? endValue]
    }
  }

  if (filter.dateFrom || filter.dateTo) {
    if (filter.dateFrom && filter.dateTo) {
      return [`${filter.dateFrom} – ${filter.dateTo}`]
    }
    return [filter.dateFrom ?? filter.dateTo]
  }

  if (filter.filter !== undefined && filter.filter !== null) {
    if (
      typeof filter.filter === 'string' &&
      filter.filter.includes(',')
    ) {
      return filter.filter
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    }
    return [filter.filter]
  }

  return []
}

export const createAgGridFilterPills = ({
  filters = [],
  columnLabelLookup = {},
  columnPillRenderers = {},
  maxValueLength = FILTER_VALUE_DISPLAY_LIMIT,
  onRemove
}: CreateAgGridPillsOptions): FilterToolbarPill[] => {
  if (!Array.isArray(filters) || filters.length === 0) {
    return []
  }

  const pills: FilterToolbarPill[] = []

  filters.forEach((filterModel) => {
    if (!filterModel?.field) {
      return
    }

    const values = extractFilterValues(filterModel)
    const label = deriveLabel(filterModel.field, columnLabelLookup)

    values.forEach((value, index) => {
      const normalizedValue = normalizeValue(value)
      if (!normalizedValue) {
        return
      }

      const pill: FilterToolbarPill = {
        id: `${filterModel.field}-${index}-${normalizedValue}`,
        label,
        value: truncateValue(normalizedValue, maxValueLength),
        rawValue: value,
        type: 'grid',
        onRemove: onRemove
          ? () => onRemove(filterModel.field, value)
          : undefined
      }

      const pillRenderer = columnPillRenderers[filterModel.field]
      if (pillRenderer) {
        pill.renderContent = () =>
          pillRenderer({
            label,
            value: pill.value || '',
            rawValue: value,
            field: filterModel.field
          })
      }

      pills.push(pill)
    })
  })

  return pills
}

export const createSortPills = ({
  sortOrders = [],
  columnLabelLookup = {},
  onRemove
}: CreateSortPillsOptions): FilterToolbarPill[] => {
  if (!Array.isArray(sortOrders) || sortOrders.length === 0) {
    return []
  }

  return sortOrders.map((sort, index) => ({
    id: `${sort.field}-sort-${index}`,
    label: deriveLabel(sort.field, columnLabelLookup),
    value: sort.direction === 'asc' ? 'Ascending' : 'Descending',
    type: 'sort',
    sortDirection: sort.direction,
    onRemove: onRemove ? () => onRemove(sort.field) : undefined
  }))
}
