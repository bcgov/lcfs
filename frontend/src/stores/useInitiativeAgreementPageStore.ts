import { create } from 'zustand'

// Feeds the breadcrumb the agreement's code (e.g. "IA-26ORG1") while an
// initiative agreement detail page is mounted; mirrors useFuelCodePageStore.
type InitiativeAgreementPageStore = {
  agreementCrumb: string | null
  setAgreementCrumb: (title: string | null) => void
}

export const useInitiativeAgreementPageStore =
  create<InitiativeAgreementPageStore>((set) => ({
    agreementCrumb: null,
    setAgreementCrumb: (title) => set({ agreementCrumb: title })
  }))
