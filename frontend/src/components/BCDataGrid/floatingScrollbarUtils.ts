import type { RefObject } from 'react'

export interface GridScrollInfo {
  centerViewport: HTMLElement | null | undefined
  horizontalViewport: HTMLElement | null | undefined
  headerViewport: HTMLElement | null | undefined
  contentWidth: number
  scrollLeft: number
  maxScrollLeft: number
}

export interface GridScrollInfoOverride {
  scrollLeft: number
  maxScrollLeft: number
}

type GridContainerRef = RefObject<HTMLElement | null> | null | undefined

export const runOnNextFrame = (cb: FrameRequestCallback) => {
  if (
    typeof window !== 'undefined' &&
    typeof window.requestAnimationFrame === 'function'
  ) {
    window.requestAnimationFrame(cb)
  } else {
    setTimeout(cb, 0)
  }
}

export const getGridScrollInfo = (
  gridContainerRef?: GridContainerRef
): GridScrollInfo | null => {
  if (!gridContainerRef?.current) return null

  const centerViewport = gridContainerRef.current.querySelector<HTMLElement>(
    '.ag-center-cols-viewport'
  )
  const centerContainer = gridContainerRef.current.querySelector<HTMLElement>(
    '.ag-center-cols-container'
  )
  const horizontalViewport =
    gridContainerRef.current.querySelector<HTMLElement>(
      '.ag-body-horizontal-scroll-viewport'
    )
  const horizontalContainer =
    gridContainerRef.current.querySelector<HTMLElement>(
      '.ag-body-horizontal-scroll-container'
    )
  const headerViewport = gridContainerRef.current.querySelector<HTMLElement>(
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

export const syncGridScrollPositions = (
  gridContainerRef: GridContainerRef,
  scrollLeft: number
) => {
  if (!gridContainerRef?.current) return

  const centerViewport = gridContainerRef.current.querySelector<HTMLElement>(
    '.ag-center-cols-viewport'
  )
  const horizontalViewport =
    gridContainerRef.current.querySelector<HTMLElement>(
      '.ag-body-horizontal-scroll-viewport'
    )
  const headerViewport = gridContainerRef.current.querySelector<HTMLElement>(
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
}: {
  gridContainerRef?: GridContainerRef
  customScrollbarRef: RefObject<HTMLElement | null>
  showScrollbar?: boolean
  infoOverride?: GridScrollInfoOverride | null
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
