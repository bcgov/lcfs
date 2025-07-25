import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce, useComponentWillMount } from '../debounce'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns initial value immediately', () => {
    const { result } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'foo', delay: 500 }
      }
    )
    expect(result.current).toBe('foo')
  })

  it('updates debounced value only after delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'foo', delay: 300 }
      }
    )

    // Update value
    rerender({ value: 'bar', delay: 300 })

    // Still old value before timer fires
    expect(result.current).toBe('foo')

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current).toBe('bar')
  })
})

describe('useComponentWillMount', () => {
  it('invokes callback exactly once before first render', () => {
    const spy = vi.fn()
    const { rerender } = renderHook(() => {
      useComponentWillMount(spy)
    })

    // should have been called once
    expect(spy).toHaveBeenCalledTimes(1)

    // re-render component again, should not call again
    rerender()
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
