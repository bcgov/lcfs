import type { ColumnState } from 'ag-grid-community'
import type { BCPaginationOptions } from '@/components/BCDataGrid/types'

export const gridCacheKey = (
  gridKey: string,
  kind: 'pagination' | 'filter' | 'column'
) => `${gridKey}-${kind}`

export const readSessionJson = <T>(key: string): T | null => {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch (error) {
    console.warn(`Failed to parse session cache for ${key}:`, error)
    return null
  }
}

export const getSessionPagination = (
  gridKey: string,
  defaults: BCPaginationOptions
): BCPaginationOptions => {
  const cached = readSessionJson<BCPaginationOptions>(
    gridCacheKey(gridKey, 'pagination')
  )
  return cached ? { ...defaults, ...cached } : defaults
}

export const getSessionColumnState = (gridKey?: string | null) => {
  if (!gridKey) return null
  const cached = readSessionJson<ColumnState[]>(gridCacheKey(gridKey, 'column'))
  return Array.isArray(cached) && cached.length ? cached : null
}

export const clearGridSessionCache = (gridKey: string) => {
  try {
    sessionStorage.removeItem(gridCacheKey(gridKey, 'filter'))
    sessionStorage.removeItem(gridCacheKey(gridKey, 'pagination'))
    sessionStorage.removeItem(gridCacheKey(gridKey, 'column'))
  } catch (error) {
    console.warn(`Failed to clear grid cache for ${gridKey}:`, error)
  }
}
