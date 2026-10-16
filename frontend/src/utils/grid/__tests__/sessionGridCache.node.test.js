import { describe, expect, it, beforeEach } from 'vitest'
import {
  clearGridSessionCache,
  getSessionColumnState,
  getSessionPagination,
  gridCacheKey,
  readSessionJson
} from '../sessionGridCache'

const defaults = {
  page: 1,
  size: 10,
  sortOrders: [{ field: 'updateDate', direction: 'desc' }],
  filters: []
}

const memoryStore = new Map()
global.sessionStorage = {
  getItem: (key) => (memoryStore.has(key) ? memoryStore.get(key) : null),
  setItem: (key, value) => memoryStore.set(key, String(value)),
  removeItem: (key) => memoryStore.delete(key),
  clear: () => memoryStore.clear()
}

describe('sessionGridCache', () => {
  beforeEach(() => {
    memoryStore.clear()
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

  it('restores pagination so a remount keeps page size and sort', () => {
    sessionStorage.setItem(
      'initiative-agreements-grid-pagination',
      JSON.stringify({
        page: 3,
        size: 25,
        sortOrders: [{ field: 'iaCode', direction: 'asc' }],
        filters: []
      })
    )

    expect(
      getSessionPagination('initiative-agreements-grid', defaults)
    ).toEqual({
      page: 3,
      size: 25,
      sortOrders: [{ field: 'iaCode', direction: 'asc' }],
      filters: []
    })
  })

  it('restores saved column layout', () => {
    const columnState = [
      { colId: 'iaCode', width: 320, hide: false },
      { colId: 'contactName', hide: true }
    ]
    sessionStorage.setItem(
      'initiative-agreements-grid-column',
      JSON.stringify(columnState)
    )

    expect(getSessionColumnState('initiative-agreements-grid')).toEqual(
      columnState
    )
  })

  it('ignores invalid JSON instead of throwing', () => {
    sessionStorage.setItem('initiative-agreements-grid-pagination', '{not json')
    expect(readSessionJson('initiative-agreements-grid-pagination')).toBeNull()
    expect(
      getSessionPagination('initiative-agreements-grid', defaults)
    ).toEqual(defaults)
  })

  it('clears filter, pagination and column keys', () => {
    sessionStorage.setItem('ia-grid-filter', '{}')
    sessionStorage.setItem('ia-grid-pagination', '{}')
    sessionStorage.setItem('ia-grid-column', '[]')

    clearGridSessionCache('ia-grid')

    expect(sessionStorage.getItem('ia-grid-filter')).toBeNull()
    expect(sessionStorage.getItem('ia-grid-pagination')).toBeNull()
    expect(sessionStorage.getItem('ia-grid-column')).toBeNull()
  })
})
