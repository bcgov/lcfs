import { create } from 'zustand'

export type UserRole = {
  name: string
  [key: string]: unknown
}

export type UserOrganization = {
  organizationId?: number | string
  [key: string]: unknown
}

export type User = {
  id: number | string
  name?: string
  email?: string
  role?: string
  firstName?: string
  lastName?: string
  roles?: UserRole[]
  organization?: UserOrganization
  [key: string]: unknown
}

type UserStore = {
  user: User | null
  setUser: (user: User | null) => void
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  setUser: (user) => set({ user })
}))
