import { describe, it, expect, beforeEach, vi } from 'vitest'
import { suppressKeyboardEvent, isEqual } from '../eventHandlers'

// Helper to build a basic ag-cell DOM structure
const createCell = ({ children = [] } = {}) => {
  const cell = document.createElement('div')
  cell.className = 'ag-cell'
  children.forEach((child) => cell.appendChild(child))
  document.body.appendChild(cell)
  return cell
}

describe('suppressKeyboardEvent', () => {
  beforeEach(() => {
    // JSDOM does not implement closest on elements not in DOM by default for some old versions
    if (!Element.prototype.closest) {
      Element.prototype.closest = function (selector) {
        let el = this
        while (el) {
          if (el.matches(selector)) return el
          el = el.parentElement
        }
        return null
      }
    }
  })

  it('returns false for Enter key when no focusable children', () => {
    const cell = createCell()
    const event = { code: 'Enter', srcElement: cell }
    expect(suppressKeyboardEvent({ event })).toBe(false)
  })

  it('returns true for Enter key when there are focusable children', () => {
    const button = document.createElement('button')
    const cell = createCell({ children: [button] })
    const event = { code: 'Enter', srcElement: cell }
    expect(suppressKeyboardEvent({ event })).toBe(true)
  })

  it('handles Tab navigation within cell correctly', () => {
    const input1 = document.createElement('input')
    const input2 = document.createElement('input')
    const cell = createCell({ children: [input1, input2] })

    // Case: Tab pressed on last element -> should return false (allow move to next cell)
    let event = { code: 'Tab', srcElement: input2, shiftKey: false, key: 'Tab' }
    expect(suppressKeyboardEvent({ event })).toBe(false)

    // Case: Shift+Tab on first element -> false (move previous cell)
    event = { code: 'Tab', srcElement: input1, shiftKey: true, key: 'Tab' }
    expect(suppressKeyboardEvent({ event })).toBe(false)

    // Case: Tab pressed on first element -> true (stay within cell)
    event = { code: 'Tab', srcElement: input1, shiftKey: false, key: 'Tab' }
    expect(suppressKeyboardEvent({ event })).toBe(true)
  })

  it('triggers row navigation when Enter is pressed and keyboard navigation is enabled', () => {
    const cell = createCell()
    const event = { code: 'Enter', srcElement: cell }
    const mockOnRowClicked = vi.fn()
    const mockParams = {
      event,
      node: { id: 'test-row' },
      data: { id: 1 }
    }

    const result = suppressKeyboardEvent(mockParams, {
      enableKeyboardRowNavigation: true,
      onRowClicked: mockOnRowClicked
    })

    expect(result).toBe(true) // Should suppress default behavior
    expect(mockOnRowClicked).toHaveBeenCalledWith({
      ...mockParams,
      event: expect.objectContaining({
        target: cell,
        currentTarget: cell
      })
    })
  })

  it('does not trigger row navigation when Enter is pressed but keyboard navigation is disabled', () => {
    const cell = createCell()
    const event = { code: 'Enter', srcElement: cell }
    const mockOnRowClicked = vi.fn()
    const mockParams = {
      event,
      node: { id: 'test-row' },
      data: { id: 1 }
    }

    const result = suppressKeyboardEvent(mockParams, {
      enableKeyboardRowNavigation: false,
      onRowClicked: mockOnRowClicked
    })

    expect(result).toBe(false) // Should allow default behavior
    expect(mockOnRowClicked).not.toHaveBeenCalled()
  })

  it('does not trigger row navigation when Enter is pressed but no onRowClicked handler is provided', () => {
    const cell = createCell()
    const event = { code: 'Enter', srcElement: cell }
    const mockParams = {
      event,
      node: { id: 'test-row' },
      data: { id: 1 }
    }

    const result = suppressKeyboardEvent(mockParams, {
      enableKeyboardRowNavigation: true,
      onRowClicked: null
    })

    expect(result).toBe(false) // Should allow default behavior
  })

  it('does not trigger row navigation when Enter is pressed but no node is provided', () => {
    const cell = createCell()
    const event = { code: 'Enter', srcElement: cell }
    const mockOnRowClicked = vi.fn()
    const mockParams = {
      event,
      node: null,
      data: { id: 1 }
    }

    const result = suppressKeyboardEvent(mockParams, {
      enableKeyboardRowNavigation: true,
      onRowClicked: mockOnRowClicked
    })

    expect(result).toBe(false) // Should allow default behavior
    expect(mockOnRowClicked).not.toHaveBeenCalled()
  })
})

describe('isEqual utility', () => {
  it('compares primitives', () => {
    expect(isEqual(1, 1)).toBe(true)
    expect(isEqual('a', 'a')).toBe(true)
  })

  it('compares dates', () => {
    const d1 = new Date('2024-01-01')
    const d2 = new Date('2024-01-01')
    const d3 = new Date('2025-01-01')
    expect(isEqual(d1, d2)).toBe(true)
    expect(isEqual(d1, d3)).toBe(false)
  })

  it('compares arrays', () => {
    expect(isEqual([1, 2], [1, 2])).toBe(true)
    expect(isEqual([1, 2], [2, 1])).toBe(false)
  })

  it('compares objects', () => {
    const obj1 = { a: 1, b: { c: 2 } }
    const obj2 = { a: 1, b: { c: 2 } }
    const obj3 = { a: 1, b: { c: 3 } }
    expect(isEqual(obj1, obj2)).toBe(true)
    expect(isEqual(obj1, obj3)).toBe(false)
  })
})
