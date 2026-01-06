import { create } from 'zustand'

type OrganizationContext = {
  organizationName: string | null
  activeTabLabel?: string | null
}

type OrganizationPageStore = {
  organizationName: string | null
  activeTabLabel: string | null
  setOrganizationContext: (context: OrganizationContext) => void
  resetOrganizationContext: () => void
}

/**
 * Stores contextual information for the organization dashboard so that
 * layout elements can stay in sync with the currently selected tab.
 */
export const useOrganizationPageStore = create<OrganizationPageStore>((set) => ({
  organizationName: null,
  activeTabLabel: null,
  setOrganizationContext: ({ organizationName, activeTabLabel }) =>
    set({
      organizationName,
      activeTabLabel: activeTabLabel || null
    }),
  resetOrganizationContext: () =>
    set({
      organizationName: null,
      activeTabLabel: null
    })
}))
