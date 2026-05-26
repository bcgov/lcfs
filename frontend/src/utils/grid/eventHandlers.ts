interface SuppressKeyboardOptions {
  enableKeyboardRowNavigation?: boolean
  onRowClicked?: (params: SuppressKeyboardEventParams) => void
}

interface SuppressKeyboardEventParams {
  event: KeyboardEvent & { srcElement: HTMLElement }
  node?: unknown
  [key: string]: unknown
}

export const suppressKeyboardEvent = (
  params: SuppressKeyboardEventParams,
  options: SuppressKeyboardOptions = {}
): boolean => {
  const e = params.event
  const { enableKeyboardRowNavigation = false, onRowClicked } = options

  if (e.code === 'Enter') {
    const focusableChildrenOfParent = (e.srcElement as HTMLElement)
      .closest('.ag-cell')
      ?.querySelectorAll(
        'button, [href], :not(.ag-hidden) > input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )

    if (!focusableChildrenOfParent || focusableChildrenOfParent.length === 0) {
      if (enableKeyboardRowNavigation && onRowClicked && params.node) {
        const mockClickEvent = {
          ...e,
          target: e.srcElement,
          currentTarget: e.srcElement
        }
        onRowClicked({
          ...params,
          event: mockClickEvent as unknown as KeyboardEvent & {
            srcElement: HTMLElement
          }
        })
        return true
      }
      return false
    } else return true
  }
  if (e.code === 'Tab' || e.key === 'Tab' || e.code === 'ShiftLeft') {
    const focusableChildrenOfParent = (e.srcElement as HTMLElement)
      .closest('.ag-cell')
      ?.querySelectorAll(
        'button, [href], :not(.ag-hidden) > input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )

    if (
      !focusableChildrenOfParent ||
      focusableChildrenOfParent.length === 0 ||
      (e.shiftKey === false &&
        e.srcElement ===
          focusableChildrenOfParent[focusableChildrenOfParent.length - 1]) ||
      (e.shiftKey === true && e.srcElement === focusableChildrenOfParent[0]) ||
      (e.shiftKey === true && e.srcElement.classList.contains('ag-cell'))
    )
      return false // do not suppress

    const isLastElement =
      e.srcElement ===
      focusableChildrenOfParent[focusableChildrenOfParent.length - 1]
    const isFirstElement = e.srcElement === focusableChildrenOfParent[0]
    if (!e.shiftKey && isLastElement) {
      return false // Move to the next cell
    } else if (e.shiftKey && isFirstElement) {
      return false // Move to the previous cell
    } else {
      return true // Stay within the current cell, suppress the event
    }
  }
  return false // do not suppress by default
}

export function isEqual(value1: unknown, value2: unknown): boolean {
  if (value1 === value2) return true

  if (value1 == null || value2 == null) return false

  if (value1 instanceof Date && value2 instanceof Date) {
    return value1.getTime() === value2.getTime()
  }

  if (Array.isArray(value1) && Array.isArray(value2)) {
    if (value1.length !== value2.length) return false
    for (let i = 0; i < value1.length; i++) {
      if (!isEqual(value1[i], value2[i])) return false
    }
    return true
  }

  if (typeof value1 === 'object' && typeof value2 === 'object') {
    const obj1 = value1 as Record<string, unknown>
    const obj2 = value2 as Record<string, unknown>
    const keys1 = Object.keys(obj1)
    const keys2 = Object.keys(obj2)
    if (keys1.length !== keys2.length) return false
    for (const key of keys1) {
      if (!keys2.includes(key) || !isEqual(obj1[key], obj2[key])) return false
    }
    return true
  }

  return false
}
