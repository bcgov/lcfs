import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useFuelSupplyColumnStore } from '../useFuelSupplyColumnStore'

describe('useFuelSupplyColumnStore', () => {
  beforeEach(() => {
    act(() => {
      useFuelSupplyColumnStore.setState({ columnState: null })
    })
  })

  it('initializes with null column state', () => {
    const { result } = renderHook(() => useFuelSupplyColumnStore())

    expect(result.current.columnState).toBeNull()
  })

  it('stores column state via setColumnState', () => {
    const { result } = renderHook(() => useFuelSupplyColumnStore())

    const mockState = [
      { colId: 'fuelType' },
      { colId: 'complianceUnits' }
    ] as Array<Record<string, unknown>>

    act(() => {
      result.current.setColumnState(mockState)
    })

    expect(result.current.columnState).toEqual(mockState)
  })

  it('resets column state via resetColumnState', () => {
    const { result } = renderHook(() => useFuelSupplyColumnStore())

    const mockState = [{ colId: 'fuelType' }] as Array<Record<string, unknown>>

    act(() => {
      result.current.setColumnState(mockState)
    })

    expect(result.current.columnState).toEqual(mockState)

    act(() => {
      result.current.resetColumnState()
    })

    expect(result.current.columnState).toBeNull()
  })

  it('shares state across multiple hook consumers', () => {
    const { result: a } = renderHook(() => useFuelSupplyColumnStore())
    const { result: b } = renderHook(() => useFuelSupplyColumnStore())

    const mockState = [{ colId: 'fuelType' }] as Array<Record<string, unknown>>

    act(() => {
      a.current.setColumnState(mockState)
    })

    expect(b.current.columnState).toEqual(mockState)
  })
})
