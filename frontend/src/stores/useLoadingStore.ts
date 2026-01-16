import { create } from 'zustand'

export type LoadingDetails = {
  isLoading: boolean
  operations?: string[]
  completed?: number
  total?: number
  hasError?: boolean
  error?: string
} & Record<string, unknown>

export type LoadingState = boolean | LoadingDetails

type LoadingStore = {
  loading: LoadingState
  setLoading: (loading: LoadingState) => void
}

export const useLoadingStore = create<LoadingStore>((set) => ({
  loading: false,
  setLoading: (loading) => set({ loading })
}))
