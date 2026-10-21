import { describe, expect, it, vi } from 'vitest'
import {
  createAgGridFilterPills,
  createSortPills,
  FILTER_VALUE_DISPLAY_LIMIT
} from '../filterUtils'

describe('createAgGridFilterPills', () => {
  it('returns an empty array when no filters are provided', () => {
    const pills = createAgGridFilterPills({ filters: [] })
    expect(pills).toEqual([])
  })

  it('creates pills for text filters and truncates the value', () => {
    const filters = [
      {
        field: 'serialNumber',
        filterType: 'text',
        filter: 'ABCDEFGHIJKLMNO'
      }
    ]

    const pills = createAgGridFilterPills({
      filters,
      columnLabelLookup: { serialNumber: 'Serial Number' }
    })

    expect(pills).toHaveLength(1)
    expect(pills[0].label).toBe('Serial Number')
    expect(pills[0].value?.length).toBe(FILTER_VALUE_DISPLAY_LIMIT + 1) // includes ellipsis
    expect(pills[0].value).toBe('ABCDEFGHIJKL…')
  })

  it('creates a pill for each value in a set filter', () => {
    const filters = [
      {
        field: 'status',
        filterType: 'set',
        values: ['Draft', 'Validated']
      }
    ]

    const pills = createAgGridFilterPills({
      filters,
      columnLabelLookup: { status: 'Status' }
    })

    expect(pills).toHaveLength(2)
    expect(pills[0].value).toBe('Draft')
    expect(pills[1].value).toBe('Validated')
  })

  it('wires the onRemove handler for each pill instance', () => {
    const onRemove = vi.fn()

    const pills = createAgGridFilterPills({
      filters: [
        {
          field: 'status',
          filterType: 'text',
          filter: 'Draft'
        }
      ],
      columnLabelLookup: { status: 'Status' },
      onRemove
    })

    expect(pills).toHaveLength(1)
    pills[0].onRemove?.()
    expect(onRemove).toHaveBeenCalledWith('status', 'Draft')
  })

  it('attaches custom renderContent when column pill renderer provided', () => {
    const renderer = vi.fn(() => 'Custom')
    const pills = createAgGridFilterPills({
      filters: [
        {
          field: 'status',
          filterType: 'text',
          filter: 'Validated'
        }
      ],
      columnPillRenderers: {
        status: renderer
      }
    })

    expect(typeof pills[0].renderContent).toBe('function')
    pills[0].renderContent?.(pills[0])
    expect(renderer).toHaveBeenCalled()
  })
})

describe('createSortPills', () => {
  it('creates pills with sort direction metadata', () => {
    const pills = createSortPills({
      sortOrders: [
        { field: 'siteName', direction: 'asc' },
        { field: 'status', direction: 'desc' }
      ],
      columnLabelLookup: {
        siteName: 'Site name',
        status: 'Status'
      }
    })

    expect(pills).toHaveLength(2)
    expect(pills[0].label).toBe('Site name')
    expect(pills[0].sortDirection).toBe('asc')
    expect(pills[1].sortDirection).toBe('desc')
  })

  it('invokes onRemove callback per pill', () => {
    const onRemove = vi.fn()
    const pills = createSortPills({
      sortOrders: [{ field: 'siteName', direction: 'asc' }],
      onRemove
    })

    pills[0].onRemove?.()
    expect(onRemove).toHaveBeenCalledWith('siteName')
  })
})
