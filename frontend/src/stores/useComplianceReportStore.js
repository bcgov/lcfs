import { create } from 'zustand'

const useComplianceReportStore = create((set, get) => ({
  currentReport: null,
  reportCache: new Map(),

  setCurrentReport: (reportData) => set({ currentReport: reportData }),

  cacheReport: (reportId, reportData) =>
    set((state) => ({
      reportCache: new Map(state.reportCache).set(reportId, reportData)
    })),

  getCachedReport: (reportId) => get().reportCache.get(reportId),

  clearCurrentReport: () => set({ currentReport: null }),
  removeReport: (reportId) =>
    set((state) => {
      const newCache = new Map(state.reportCache)
      newCache.delete(reportId)

      // If the current report is the one being removed, clear it too
      const newCurrentReport =
        state.currentReport?.report?.id === reportId
          ? null
          : state.currentReport

      return {
        reportCache: newCache,
        currentReport: newCurrentReport
      }
    }),

  getCurrentReportId: () => get().currentReport?.report?.id,

  isReportCached: (reportId) => get().reportCache.has(reportId),

  getAllCachedReports: () => Array.from(get().reportCache.values()),

  getReportByIdOrCurrent: (reportId) => {
    const state = get()
    return (
      state.getCachedReport(reportId) ||
      (state.currentReport?.report?.id === reportId
        ? state.currentReport
        : null)
    )
  }
}))

export default useComplianceReportStore
