import { create } from 'zustand'

export type ReportId = number | string

export interface ComplianceReportHistoryEntry {
  complianceReportId?: ReportId
  createDate: string
  displayName?: string
  userProfile: { firstName: string; lastName: string }
  status: { status: string }
}

export interface ComplianceReport {
  report: {
    id?: ReportId
    complianceReportId?: ReportId
    version?: number
    nickname?: string
    history?: ComplianceReportHistoryEntry[] | null
    supplementalInitiator?: string | null
    reportingFrequency?: string
    compliancePeriod?: { description?: string }
    organizationId?: number | string
    currentStatus?: { status?: string }
    assessmentStatement?: string | null
    supplementalNote?: string | null
    updateDate?: string | Date | null
    isNonAssessment?: boolean
    hasSupplemental?: boolean
    isRenewableFuelExempted?: boolean
    isLowCarbonFuelExempted?: boolean
    [key: string]: unknown
  }
  metadata?: Record<string, unknown>
  chain?: Array<{
    version: number
    complianceReportId?: ReportId
    timestamp?: string
    history?: ComplianceReportHistoryEntry[] | null
    assessmentStatement?: string | null
    currentStatus?: { status: string }
    compliancePeriod?: { description?: string }
    nickname?: string
    organization?: { name?: string }
    summary?: {
      line11NonCompliancePenaltyPayable?: number | string | null
      line11FossilDerivedBaseFuelTotal?: number | string | null
      line21NonCompliancePenaltyPayable?: number | string | null
      hasRenewableFuelRequirement?: boolean
    }
    isLowCarbonFuelExempted?: boolean
    isRenewableFuelExempted?: boolean
    isNonAssessment?: boolean
    [key: string]: unknown
  }>
  hasGovernmentReassessmentInProgress?: boolean
  isNewest?: boolean
  hadBeenAssessed?: boolean
  isNonAssessment?: boolean
  isRenewableFuelExempted?: boolean
  isLowCarbonFuelExempted?: boolean
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
