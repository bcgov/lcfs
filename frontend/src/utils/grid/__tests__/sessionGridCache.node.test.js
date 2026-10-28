import { describe, expect, it, beforeEach } from 'vitest'
import {
  clearGridSessionCache,
  getSessionColumnState,
  getSessionPagination,
  gridCacheKey,
  readSessionJson,
  writeGridCache
} from '../sessionGridCache'

const defaults = {
  page: 1,
  size: 10,
  sortOrders: [{ field: 'updateDate', direction: 'desc' }],
  filters: []
}

const localStore = new Map()
const sessionStore = new Map()

const createMemoryStorage = (store) => ({
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear()
})

global.localStorage = createMemoryStorage(localStore)
global.sessionStorage = createMemoryStorage(sessionStore)

describe('sessionGridCache', () => {
  beforeEach(() => {
    localStore.clear()
    sessionStore.clear()
  })

  it('builds cache keys from the grid key', () => {
    expect(gridCacheKey('initiative-agreements-grid', 'pagination')).toBe(
      'initiative-agreements-grid-pagination'
    )
  })

  it('returns defaults when nothing is cached', () => {
    expect(
      getSessionPagination('initiative-agreements-grid', defaults)
    ).toEqual(defaults)
    expect(getSessionColumnState('initiative-agreements-grid')).toBeNull()
  })

  it('stores pagination in localStorage so a closed window can restore it', () => {
    writeGridCache(
      'initiative-agreements-grid-pagination',
      {
        page: 3,
        size: 25,
        sortOrders: [{ field: 'iaCode', direction: 'asc' }],
        filters: []
      },
      'login'
    )

    sessionStore.clear()

    expect(
      getSessionPagination('initiative-agreements-grid', defaults)
    ).toEqual({
      page: 3,
      size: 25,
      sortOrders: [{ field: 'iaCode', direction: 'asc' }],
      filters: []
    })
  })

  it('restores saved column layout from localStorage after sessionStorage is empty', () => {
    const columnState = [
      { colId: 'iaCode', width: 320, hide: false },
      { colId: 'contactName', hide: true }
    ]
    writeGridCache('initiative-agreements-grid-column', columnState, 'login')
    sessionStore.clear()

    expect(getSessionColumnState('initiative-agreements-grid')).toEqual(
      columnState
    )
  })

  it('falls back to sessionStorage values from dashboard links', () => {
    sessionStorage.setItem(
      'initiative-agreements-grid-pagination',
      JSON.stringify({ page: 2, size: 20, sortOrders: [], filters: [] })
    )

    expect(
      getSessionPagination('initiative-agreements-grid', defaults).page
    ).toBe(2)
    expect(localStorage.getItem('initiative-agreements-grid-pagination')).toBe(
      JSON.stringify({ page: 2, size: 20, sortOrders: [], filters: [] })
    )
  })

  it('ignores invalid JSON instead of throwing', () => {
    localStorage.setItem('initiative-agreements-grid-pagination', '{not json')
    expect(readSessionJson('initiative-agreements-grid-pagination')).toBeNull()
    expect(
      getSessionPagination('initiative-agreements-grid', defaults)
    ).toEqual(defaults)
  })

  it('clears filter, pagination and column keys from both storages', () => {
    localStorage.setItem('ia-grid-filter', '{}')
    sessionStorage.setItem('ia-grid-filter', '{}')
    localStorage.setItem('ia-grid-pagination', '{}')
    localStorage.setItem('ia-grid-column', '[]')

    clearGridSessionCache('ia-grid')

    expect(localStorage.getItem('ia-grid-filter')).toBeNull()
    expect(sessionStorage.getItem('ia-grid-filter')).toBeNull()
    expect(localStorage.getItem('ia-grid-pagination')).toBeNull()
    expect(localStorage.getItem('ia-grid-column')).toBeNull()
  })
})
