export const runOnNextFrame = (cb) => {
  if (
    typeof window !== 'undefined' &&
    typeof window.requestAnimationFrame === 'function'
  ) {
    window.requestAnimationFrame(cb)
  } else {
    setTimeout(cb, 0)
  }
}

export const getGridScrollInfo = (gridContainerRef) => {
  if (!gridContainerRef?.current) return null

  const centerViewport = gridContainerRef.current.querySelector(
    '.ag-center-cols-viewport'
  )
  const centerContainer = gridContainerRef.current.querySelector(
    '.ag-center-cols-container'
  )
  const horizontalViewport = gridContainerRef.current.querySelector(
    '.ag-body-horizontal-scroll-viewport'
  )
  const horizontalContainer = gridContainerRef.current.querySelector(
    '.ag-body-horizontal-scroll-container'
  )
  const headerViewport = gridContainerRef.current.querySelector(
    '.ag-header-viewport'
  )

  const viewportWidth =
    centerViewport?.clientWidth ??
    horizontalViewport?.clientWidth ??
    headerViewport?.clientWidth ??
    0
  const contentWidth =
    centerContainer?.scrollWidth ||
    horizontalContainer?.scrollWidth ||
    headerViewport?.scrollWidth ||
    viewportWidth

  const scrollLeft =
    horizontalViewport?.scrollLeft ??
    centerViewport?.scrollLeft ??
    headerViewport?.scrollLeft ??
    0

  return {
    centerViewport,
    horizontalViewport,
    headerViewport,
    contentWidth,
    scrollLeft,
    maxScrollLeft: Math.max(contentWidth - viewportWidth, 0)
  }
}

export const syncGridScrollPositions = (gridContainerRef, scrollLeft) => {
  if (!gridContainerRef?.current) return

  const centerViewport = gridContainerRef.current.querySelector(
    '.ag-center-cols-viewport'
  )
  const horizontalViewport = gridContainerRef.current.querySelector(
    '.ag-body-horizontal-scroll-viewport'
  )
  const headerViewport = gridContainerRef.current.querySelector(
    '.ag-header-viewport'
  )

  if (centerViewport && centerViewport.scrollLeft !== scrollLeft) {
    centerViewport.scrollLeft = scrollLeft
  }
  if (horizontalViewport && horizontalViewport.scrollLeft !== scrollLeft) {
    horizontalViewport.scrollLeft = scrollLeft
  }
  if (headerViewport && headerViewport.scrollLeft !== scrollLeft) {
    headerViewport.scrollLeft = scrollLeft
  }
}

export const syncCustomScrollbarToGrid = ({
  gridContainerRef,
  customScrollbarRef,
  showScrollbar = true,
  infoOverride
}) => {
  if (!showScrollbar || !customScrollbarRef?.current) return

  const info = infoOverride ?? getGridScrollInfo(gridContainerRef)
  if (!info) return

  const { scrollLeft, maxScrollLeft } = info
  const customMax = Math.max(
    customScrollbarRef.current.scrollWidth -
      customScrollbarRef.current.clientWidth,
    0
  )
  const ratio = maxScrollLeft > 0 ? scrollLeft / maxScrollLeft : 0

  customScrollbarRef.current.scrollLeft = ratio * customMax
}
