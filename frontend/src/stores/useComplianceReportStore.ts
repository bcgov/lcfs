import { create } from 'zustand'

export type ReportId = number | string

export type ComplianceReport = {
  report: {
    id?: ReportId
    [key: string]: unknown
  }
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

type ComplianceReportStore = {
  currentReport: ComplianceReport | null
  reportCache: Map<ReportId, ComplianceReport>
  setCurrentReport: (reportData: ComplianceReport | null) => void
  cacheReport: (reportId: ReportId, reportData: ComplianceReport) => void
  getCachedReport: (reportId: ReportId) => ComplianceReport | undefined
  shouldFetchReport: (reportId: ReportId) => boolean
  clearCurrentReport: () => void
  removeReport: (reportId: ReportId) => void
  getCurrentReportId: () => ReportId | undefined
  isReportCached: (reportId: ReportId) => boolean
  getAllCachedReports: () => ComplianceReport[]
  getReportByIdOrCurrent: (reportId: ReportId) => ComplianceReport | null
}

const useComplianceReportStore = create<ComplianceReportStore>((set, get) => ({
  currentReport: null,
  reportCache: new Map<ReportId, ComplianceReport>(),

  setCurrentReport: (reportData) => set({ currentReport: reportData }),

  cacheReport: (reportId, reportData) =>
    set((state) => ({
      reportCache: new Map(state.reportCache).set(reportId, reportData)
    })),

  getCachedReport: (reportId) => get().reportCache.get(reportId),
  shouldFetchReport: (reportId) => !get().reportCache.has(reportId),
  clearCurrentReport: () => set({ currentReport: null }),
  removeReport: (reportId) =>
    set((state) => {
      const newCache = new Map(state.reportCache)
      newCache.delete(reportId)

      // If the current report is the one being removed, clear it too
      const currentReportId = state.currentReport?.report?.id
      const newCurrentReport =
        currentReportId === reportId ? null : state.currentReport

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
