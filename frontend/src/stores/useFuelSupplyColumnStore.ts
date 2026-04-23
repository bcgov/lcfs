import type { ColumnState } from '@ag-grid-community/core'
import { create } from 'zustand'

/**
 * In-memory column state for the Fuel Supply summary grid in the compliance
 * report view.
 *
 * Scope: browser tab lifetime. Survives component unmount/remount (route
 * navigation), resets on refresh or new browser session.
 */
type FuelSupplyColumnStore = {
  columnState: ColumnState[] | null
  setColumnState: (columnState: ColumnState[] | null) => void
  resetColumnState: () => void
}

export const useFuelSupplyColumnStore = create<FuelSupplyColumnStore>(
  (set) => ({
    columnState: null,
    setColumnState: (columnState) => set({ columnState }),
    resetColumnState: () => set({ columnState: null })
  })
)
