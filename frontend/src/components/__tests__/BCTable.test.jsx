import { describe, it, expect, vi } from 'vitest'
import {
  addFlexToColumns,
  getColumnMinWidthSum,
  relaxColumnMinWidths
} from '@/components/BCDataGrid/columnSizingUtils'

describe('addFlexToColumns', () => {
  it('adds flex:1 to columns that have neither flex nor width', () => {
    const cols = [{ colId: 'name' }, { colId: 'date' }]
    const { columnDefs, hasFlexColumns } = addFlexToColumns(cols)
    expect(columnDefs[0]).toEqual({ colId: 'name', flex: 1 })
    expect(columnDefs[1]).toEqual({ colId: 'date', flex: 1 })
    expect(hasFlexColumns).toBe(true)
  })

  it('leaves columns with an explicit flex value unchanged', () => {
    const cols = [{ colId: 'a', flex: 2 }]
    const { columnDefs, hasFlexColumns } = addFlexToColumns(cols)
    expect(columnDefs[0].flex).toBe(2)
    expect(hasFlexColumns).toBe(true)
  })

  it('leaves columns with an explicit width value unchanged (no flex added)', () => {
    const cols = [{ colId: 'b', width: 200 }]
    const { columnDefs, hasFlexColumns } = addFlexToColumns(cols)
    expect(columnDefs[0].flex).toBeUndefined()
    expect(hasFlexColumns).toBe(false)
  })

  it('returns hasFlexColumns:false when every column has a fixed width', () => {
    const cols = [
      { colId: 'x', width: 100 },
      { colId: 'y', width: 150 }
    ]
    const { hasFlexColumns } = addFlexToColumns(cols)
    expect(hasFlexColumns).toBe(false)
  })

  it('handles an empty array', () => {
    const { columnDefs, hasFlexColumns } = addFlexToColumns([])
    expect(columnDefs).toEqual([])
    expect(hasFlexColumns).toBe(false)
  })

  it('returns the original value unchanged when input is not an array', () => {
    const result = addFlexToColumns(null)
    expect(result).toEqual({ columnDefs: null, hasFlexColumns: false })

    const result2 = addFlexToColumns(undefined)
    expect(result2).toEqual({ columnDefs: undefined, hasFlexColumns: false })
  })
})

describe('getColumnMinWidthSum', () => {
  it('sums width properties when present', () => {
    const cols = [{ width: 100 }, { width: 200 }]
    expect(getColumnMinWidthSum(cols)).toBe(300)
  })

  it('uses minWidth when width is absent', () => {
    const cols = [{ minWidth: 120 }, { minWidth: 80 }]
    expect(getColumnMinWidthSum(cols)).toBe(200)
  })

  it('prefers width over minWidth', () => {
    const cols = [{ width: 150, minWidth: 80 }]
    expect(getColumnMinWidthSum(cols)).toBe(150)
  })

  it('falls back to the provided fallbackWidth for columns with neither width nor minWidth', () => {
    const cols = [{ colId: 'a' }, { colId: 'b' }]
    expect(getColumnMinWidthSum(cols, 120)).toBe(240)
  })

  it('uses default fallback of 100 when none provided', () => {
    const cols = [{ colId: 'a' }]
    expect(getColumnMinWidthSum(cols)).toBe(100)
  })

  it('returns 0 for an empty array', () => {
    expect(getColumnMinWidthSum([])).toBe(0)
  })

  it('returns 0 for non-array input', () => {
    expect(getColumnMinWidthSum(null)).toBe(0)
    expect(getColumnMinWidthSum(undefined)).toBe(0)
  })

  it('ignores non-finite width values and uses the fallback', () => {
    const cols = [{ width: NaN }, { width: Infinity }]
    expect(getColumnMinWidthSum(cols, 50)).toBe(100)
  })
})

describe('relaxColumnMinWidths', () => {
  it('does nothing when api is null', () => {
    expect(() => relaxColumnMinWidths(null)).not.toThrow()
  })

  it('does nothing when api lacks getColumnDefs', () => {
    expect(() => relaxColumnMinWidths({})).not.toThrow()
  })

  it('does nothing when getColumnDefs returns empty array', () => {
    const api = { getColumnDefs: vi.fn(() => []) }
    relaxColumnMinWidths(api)
    expect(api.getColumnDefs).toHaveBeenCalled()
  })

  it('sets minWidth on all column defs and calls setGridOption', () => {
    const currentDefs = [
      { colId: 'a', minWidth: 150 },
      { colId: 'b', minWidth: 200 }
    ]
    const api = {
      getColumnDefs: vi.fn(() => currentDefs),
      setGridOption: vi.fn(),
      getColumnState: vi.fn(() => [])
    }

    relaxColumnMinWidths(api, null, 50)

    expect(api.setGridOption).toHaveBeenCalledWith(
      'columnDefs',
      [
        { colId: 'a', minWidth: 50 },
        { colId: 'b', minWidth: 50 }
      ]
    )
  })

  it('restores column state after updating defs when columnApi provides state', () => {
    const currentDefs = [{ colId: 'a' }]
    const columnState = [{ colId: 'a', width: 180 }]
    const api = {
      getColumnDefs: vi.fn(() => currentDefs),
      setGridOption: vi.fn()
    }
    const columnApi = {
      getColumnState: vi.fn(() => columnState),
      applyColumnState: vi.fn()
    }

    relaxColumnMinWidths(api, columnApi, 40)

    expect(columnApi.applyColumnState).toHaveBeenCalledWith({
      state: columnState,
      applyOrder: true
    })
  })
})
