export const suppressKeyboardEvent = (params) => {
  const e = params.event
  if (e.code === 'Enter') {
    const focusableChildrenOfParent = e.srcElement
      .closest('.ag-cell')
      .querySelectorAll(
        'button, [href], :not(.ag-hidden) > input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    if (focusableChildrenOfParent.length === 0) return false
    else return true
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
