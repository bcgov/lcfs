import { create } from 'zustand'

// Feeds the breadcrumb what the URL's numeric segments stand for while an
// Initiative Agreements page is mounted; mirrors useFuelCodePageStore.
//
// On an agreement page the last segment is the agreement, so agreementCrumb
// is its code ("IA-26ORG1"). On a designated action page the last segment
// is the action ("DA3-IA1") and the agreement segment before it needs a
// label of its own, which is parentCrumb.
type InitiativeAgreementPageStore = {
  agreementCrumb: string | null
  parentCrumb: string | null
  setAgreementCrumb: (title: string | null) => void
  setParentCrumb: (title: string | null) => void
}

export const useInitiativeAgreementPageStore =
  create<InitiativeAgreementPageStore>((set) => ({
    agreementCrumb: null,
    parentCrumb: null,
    setAgreementCrumb: (title) => set({ agreementCrumb: title }),
    setParentCrumb: (title) => set({ parentCrumb: title })
  }))
