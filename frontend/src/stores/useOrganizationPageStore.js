import { create } from 'zustand'

/**
 * Stores contextual information for the organization dashboard so that
 * layout elements can stay in sync with the currently selected tab.
 */
export const useOrganizationPageStore = create((set) => ({
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

