import type { ColumnState } from 'ag-grid-community'
import type { BCPaginationOptions } from '@/components/BCDataGrid/types'

export type GridCacheMode = 'session' | 'login'

export const gridCacheKey = (
  gridKey: string,
  kind: 'pagination' | 'filter' | 'column'
) => `${gridKey}-${kind}`

const readStorageJson = <T>(storage: Storage, key: string): T | null => {
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch (error) {
    console.warn('Failed to parse grid cache for key:', key, error)
    return null
  }
}

const writeStorageJson = (storage: Storage, key: string, value: unknown) => {
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn('Failed to write grid cache for key:', key, error)
  }
}

const getStorage = (
  name: 'localStorage' | 'sessionStorage'
): Storage | null => {
  try {
    return globalThis[name] ?? null
  } catch {
    return null
  }
}

const storagesForRead = (mode: GridCacheMode): Storage[] => {
  const storages: Storage[] = []
  // Login-session prefs live in localStorage so they survive closing the
  // window. sessionStorage is still checked so dashboard status links and
  // older same-tab values keep working.
  if (mode === 'login') {
    const local = getStorage('localStorage')
    if (local) storages.push(local)
  }
  const session = getStorage('sessionStorage')
  if (session) storages.push(session)
  return storages
}

const storageForWrite = (mode: GridCacheMode): Storage | null =>
  mode === 'login' ? getStorage('localStorage') : getStorage('sessionStorage')

export const readGridCache = <T>(
  key: string,
  mode: GridCacheMode = 'login'
): T | null => {
  const storages = storagesForRead(mode)
  for (const storage of storages) {
    const value = readStorageJson<T>(storage, key)
    if (value === null) continue
    const primary = storageForWrite(mode)
    if (primary && storage !== primary) {
      writeStorageJson(primary, key, value)
    }
    return value
  }
  return null
}

export const writeGridCache = (
  key: string,
  value: unknown,
  mode: GridCacheMode = 'login'
) => {
  const storage = storageForWrite(mode)
  if (!storage) return
  writeStorageJson(storage, key, value)
}

export const removeGridCache = (key: string, mode: GridCacheMode = 'login') => {
  for (const storage of storagesForRead(mode)) {
    try {
      storage.removeItem(key)
    } catch (error) {
      console.warn('Failed to clear grid cache for key:', key, error)
    }
  }
}

export const readSessionJson = <T>(key: string): T | null =>
  readGridCache<T>(key, 'login')

export const getSessionPagination = (
  gridKey: string,
  defaults: BCPaginationOptions,
  mode: GridCacheMode = 'login'
): BCPaginationOptions => {
  const cached = readGridCache<BCPaginationOptions>(
    gridCacheKey(gridKey, 'pagination'),
    mode
  )
  return cached ? { ...defaults, ...cached } : defaults
}

export const getSessionColumnState = (
  gridKey?: string | null,
  mode: GridCacheMode = 'login'
) => {
  if (!gridKey) return null
  const cached = readGridCache<ColumnState[]>(
    gridCacheKey(gridKey, 'column'),
    mode
  )
  return Array.isArray(cached) && cached.length ? cached : null
}

export const clearGridSessionCache = (
  gridKey: string,
  mode: GridCacheMode = 'login'
) => {
  removeGridCache(gridCacheKey(gridKey, 'filter'), mode)
  removeGridCache(gridCacheKey(gridKey, 'pagination'), mode)
  removeGridCache(gridCacheKey(gridKey, 'column'), mode)
}
