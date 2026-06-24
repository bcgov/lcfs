import { create } from 'zustand'

type FuelCodePageStore = {
  fuelCodeTitle: string | null
  setFuelCodeTitle: (title: string | null) => void
}

export const useFuelCodePageStore = create<FuelCodePageStore>((set) => ({
  fuelCodeTitle: null,
  setFuelCodeTitle: (title) => set({ fuelCodeTitle: title })
}))
