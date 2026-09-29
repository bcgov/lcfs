import type { ColumnState } from '@ag-grid-community/core'
import { describe, it, expect, beforeEach } from 'vitest'
import { useFuelSupplyColumnStore } from '../useFuelSupplyColumnStore'

const getStoreResult = () => ({
  result: {
    get current() {
      return useFuelSupplyColumnStore.getState()
    }
  }
})

const run = <T>(callback: () => T): T => callback()

describe('useFuelSupplyColumnStore', () => {
  beforeEach(() => {
    run(() => {
      useFuelSupplyColumnStore.setState({ columnState: null })
    })
  })

  it('initializes with null column state', () => {
    const { result } = getStoreResult()

    expect(result.current.columnState).toBeNull()
  })

  it('stores column state via setColumnState', () => {
    const { result } = getStoreResult()

    const mockState = [
      { colId: 'fuelType' },
      { colId: 'complianceUnits' }
    ] satisfies ColumnState[]

    run(() => {
      result.current.setColumnState(mockState)
    })

    expect(result.current.columnState).toEqual(mockState)
  })

  it('resets column state via resetColumnState', () => {
    const { result } = getStoreResult()

    const mockState = [{ colId: 'fuelType' }] satisfies ColumnState[]

    run(() => {
      result.current.setColumnState(mockState)
    })

    expect(result.current.columnState).toEqual(mockState)

    run(() => {
      result.current.resetColumnState()
    })

    expect(result.current.columnState).toBeNull()
  })

  it('shares state across multiple hook consumers', () => {
    const { result: a } = getStoreResult()
    const { result: b } = getStoreResult()

    const mockState = [{ colId: 'fuelType' }] satisfies ColumnState[]

    run(() => {
      a.current.setColumnState(mockState)
    })

    expect(b.current.columnState).toEqual(mockState)
  })
})
