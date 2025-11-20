import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  runOnNextFrame,
  getGridScrollInfo,
  syncGridScrollPositions,
  syncCustomScrollbarToGrid
} from '@/components/BCDataGrid/floatingScrollbarUtils'

const defineDimension = (element, prop, value) => {
  Object.defineProperty(element, prop, {
    value,
    configurable: true
  })
}

const createGridContainerRef = ({
  scrollLeft = 25,
  viewportWidth = 100,
  contentWidth = 400
} = {}) => {
  const container = document.createElement('div')

  const centerViewport = document.createElement('div')
  centerViewport.className = 'ag-center-cols-viewport'
  defineDimension(centerViewport, 'clientWidth', viewportWidth)
  centerViewport.scrollLeft = scrollLeft

  const centerContainer = document.createElement('div')
  centerContainer.className = 'ag-center-cols-container'
  defineDimension(centerContainer, 'scrollWidth', contentWidth)

  const horizontalViewport = document.createElement('div')
  horizontalViewport.className = 'ag-body-horizontal-scroll-viewport'
  defineDimension(horizontalViewport, 'clientWidth', viewportWidth)
  horizontalViewport.scrollLeft = scrollLeft

  const horizontalContainer = document.createElement('div')
  horizontalContainer.className = 'ag-body-horizontal-scroll-container'
  defineDimension(horizontalContainer, 'scrollWidth', contentWidth)

  const headerViewport = document.createElement('div')
  headerViewport.className = 'ag-header-viewport'
  defineDimension(headerViewport, 'clientWidth', viewportWidth)
  headerViewport.scrollLeft = scrollLeft
  defineDimension(headerViewport, 'scrollWidth', contentWidth)

  const horizontalWrapper = document.createElement('div')
  horizontalWrapper.className = 'ag-body-horizontal-scroll'

  horizontalViewport.appendChild(horizontalContainer)
  horizontalWrapper.appendChild(horizontalViewport)
  container.appendChild(centerViewport)
  container.appendChild(centerContainer)
  container.appendChild(horizontalWrapper)
  container.appendChild(headerViewport)

  return { current: container }
}

describe('floatingScrollbarUtils', () => {
  describe('runOnNextFrame', () => {
    const originalRAF = globalThis.requestAnimationFrame

    afterEach(() => {
      globalThis.requestAnimationFrame = originalRAF
      vi.useRealTimers()
    })

    it('uses requestAnimationFrame when available', () => {
      const rafSpy = vi.fn((cb) => cb())
      globalThis.requestAnimationFrame = rafSpy
      const cb = vi.fn()

      runOnNextFrame(cb)

      expect(rafSpy).toHaveBeenCalledTimes(1)
      expect(cb).toHaveBeenCalledTimes(1)
    })

    it('falls back to setTimeout when requestAnimationFrame is missing', () => {
      globalThis.requestAnimationFrame = undefined
      vi.useFakeTimers()
      const cb = vi.fn()

      runOnNextFrame(cb)
      vi.runAllTimers()

      expect(cb).toHaveBeenCalledTimes(1)
    })
  })

  describe('getGridScrollInfo', () => {
    it('returns null when the ref is missing', () => {
      expect(getGridScrollInfo()).toBeNull()
      expect(getGridScrollInfo({ current: null })).toBeNull()
    })

    it('captures viewport sizes and scroll positions', () => {
      const gridRef = createGridContainerRef({
        scrollLeft: 50,
        viewportWidth: 120,
        contentWidth: 520
      })

      const info = getGridScrollInfo(gridRef)

      expect(info).not.toBeNull()
      expect(info.contentWidth).toBe(520)
      expect(info.scrollLeft).toBe(50)
      expect(info.maxScrollLeft).toBe(400)
      expect(info.centerViewport.className).toContain('ag-center-cols-viewport')
    })
  })

  describe('syncGridScrollPositions', () => {
    it('applies the provided scrollLeft to all grid viewports', () => {
      const gridRef = createGridContainerRef({ scrollLeft: 0 })

      syncGridScrollPositions(gridRef, 180)

      const info = getGridScrollInfo(gridRef)
      expect(info.scrollLeft).toBe(180)
    })
  })

  describe('syncCustomScrollbarToGrid', () => {
    let customScrollbarRef

    beforeEach(() => {
      customScrollbarRef = {
        current: document.createElement('div')
      }
      defineDimension(customScrollbarRef.current, 'clientWidth', 100)
      defineDimension(customScrollbarRef.current, 'scrollWidth', 300)
    })

    it('updates the custom scrollbar to match grid scroll ratios', () => {
      const gridRef = createGridContainerRef({
        scrollLeft: 100,
        viewportWidth: 100,
        contentWidth: 500
      })

      syncCustomScrollbarToGrid({
        gridContainerRef: gridRef,
        customScrollbarRef,
        showScrollbar: true
      })

      // Grid ratio = 100 / (500-100) = 0.25 -> custom scrollLeft = 0.25 * (300-100)
      expect(customScrollbarRef.current.scrollLeft).toBeCloseTo(50)
    })

    it('does nothing when showScrollbar is false', () => {
      const gridRef = createGridContainerRef({
        scrollLeft: 200,
        viewportWidth: 100,
        contentWidth: 500
      })
      customScrollbarRef.current.scrollLeft = 0

      syncCustomScrollbarToGrid({
        gridContainerRef: gridRef,
        customScrollbarRef,
        showScrollbar: false
      })

      expect(customScrollbarRef.current.scrollLeft).toBe(0)
    })
  })
})
