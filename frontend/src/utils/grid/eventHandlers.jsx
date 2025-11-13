export const suppressKeyboardEvent = (params, options = {}) => {
  const e = params.event
  const { enableKeyboardRowNavigation = false, onRowClicked } = options

  if (e.code === 'Enter') {
    const focusableChildrenOfParent = e.srcElement
      .closest('.ag-cell')
      .querySelectorAll(
        'button, [href], :not(.ag-hidden) > input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )

    if (focusableChildrenOfParent.length === 0) {
      if (enableKeyboardRowNavigation && onRowClicked && params.node) {
        const mockClickEvent = {
          ...e,
          target: e.srcElement,
          currentTarget: e.srcElement
        }
        onRowClicked({
          ...params,
          event: mockClickEvent
        })
        return true
      }
      return false
    } else return true
  }
  if (e.code === 'Tab' || e.key === 'Tab' || e.code === 'ShiftLeft') {
    // get focusable children of parent cell
    const focusableChildrenOfParent = e.srcElement
      .closest('.ag-cell')
      .querySelectorAll(
        'button, [href], :not(.ag-hidden) > input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )

    if (
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
    // Determine if we should suppress the Tab or Shift+Tab key event
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

export function isEqual(value1, value2) {
  // Check if both values are strictly equal
  if (value1 === value2) return true

  // Check if both values are null or undefined
  if (value1 == null || value2 == null) return false

  // Check if both values are dates
  if (value1 instanceof Date && value2 instanceof Date) {
    return value1.getTime() === value2.getTime()
  }

  // Check if both values are arrays
  if (Array.isArray(value1) && Array.isArray(value2)) {
    if (value1.length !== value2.length) return false
    for (let i = 0; i < value1.length; i++) {
      if (!isEqual(value1[i], value2[i])) return false
    }
    return true
  }

  // Check if both values are objects (but not arrays or dates)
  if (typeof value1 === 'object' && typeof value2 === 'object') {
    const keys1 = Object.keys(value1)
    const keys2 = Object.keys(value2)
    if (keys1.length !== keys2.length) return false
    for (const key of keys1) {
      if (!keys2.includes(key) || !isEqual(value1[key], value2[key]))
        return false
    }
    return true
  }

  // For other types (number, string, etc.)
  return false
}
