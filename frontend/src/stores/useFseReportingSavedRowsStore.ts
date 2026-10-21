import { create } from 'zustand'

/**
 * Values saved from the FSE reporting grid, per compliance report and grid row.
 *
 * The reporting list is read from mv_fse_reporting_base_pref, which a
 * background job refreshes on an interval. A list fetched right after a save
 * can still hold the row as it was, and the grid would put the old value back
 * in the cell. The grid lays these saved values over such rows until a fetch
 * made after the save returns them, or until SAVED_ROW_TTL_MS passes, so a
 * change made somewhere else is never hidden for long.
 *
 * Scope: browser tab lifetime. Survives route navigation, resets on refresh.
 */
export const SAVED_ROW_TTL_MS = 10 * 60 * 1000

export type SavedReportingValues = {
  supplyFromDate?: string | null
  supplyToDate?: string | null
  kwhUsage?: number | null
  complianceNotes?: string | null
  chargingEquipmentComplianceId?: number
}

export type ReportingRow = {
  chargingEquipmentId: number
  chargingEquipmentVersion: number
  [field: string]: unknown
}

type SavedRow = {
  chargingEquipmentId: number
  values: SavedReportingValues
  savedAt: number
}

export type SavedRowsForReport = Record<string, SavedRow>

type FseReportingSavedRowsStore = {
  savedRows: Record<string, SavedRowsForReport>
  rememberSavedRow: (
    reportId: number | string,
    row: ReportingRow,
    values: SavedReportingValues,
    savedAt?: number
  ) => void
  forgetSavedDates: (reportId: number | string, equipmentIds: number[]) => void
  forgetReport: (reportId: number | string) => void
  pruneSavedRows: (
    reportId: number | string,
    rows: ReportingRow[] | undefined,
    fetchedAt: number,
    now?: number
  ) => void
}

/** Same identity the reporting grid uses for its rows (getRowId). */
export const reportingRowKey = (
  row: Pick<ReportingRow, 'chargingEquipmentId' | 'chargingEquipmentVersion'>
) => `${row.chargingEquipmentId}-${row.chargingEquipmentVersion}`

const isSameValue = (field: string, saved: unknown, current: unknown) => {
  if (field === 'kwhUsage') return Number(saved ?? 0) === Number(current ?? 0)
  if (field === 'chargingEquipmentComplianceId') {
    return Number(saved) === Number(current)
  }
  return (saved ?? '') === (current ?? '')
}

const hasSavedValues = (row: ReportingRow, values: SavedReportingValues) =>
  Object.entries(values).every(([field, value]) =>
    isSameValue(field, value, row[field])
  )

const isExpired = (entry: SavedRow, now: number) =>
  now - entry.savedAt > SAVED_ROW_TTL_MS

/**
 * Lay saved values over the rows of a reporting list response. Returns the
 * response unchanged when no row needs it, so the grid is not re-rendered.
 */
export const applySavedRows = <
  T extends { finalSupplyEquipments?: ReportingRow[] }
>(
  savedRows: SavedRowsForReport | undefined,
  data: T | undefined,
  now = Date.now()
): T | undefined => {
  const rows = data?.finalSupplyEquipments
  if (!savedRows || !Array.isArray(rows)) return data

  let changed = false
  const nextRows = rows.map((row) => {
    const entry = savedRows[reportingRowKey(row)]
    if (!entry || isExpired(entry, now) || hasSavedValues(row, entry.values)) {
      return row
    }
    changed = true
    return { ...row, ...entry.values }
  })

  return changed ? { ...data, finalSupplyEquipments: nextRows } : data
}

const withReport = (
  savedRows: Record<string, SavedRowsForReport>,
  key: string,
  forReport: SavedRowsForReport
) => {
  const next = { ...savedRows }
  if (Object.keys(forReport).length > 0) {
    next[key] = forReport
  } else {
    delete next[key]
  }
  return next
}

export const useFseReportingSavedRowsStore = create<FseReportingSavedRowsStore>(
  (set) => ({
    savedRows: {},

    rememberSavedRow: (reportId, row, values, savedAt = Date.now()) =>
      set((state) => {
        const key = String(reportId)
        return {
          savedRows: withReport(state.savedRows, key, {
            ...state.savedRows[key],
            [reportingRowKey(row)]: {
              chargingEquipmentId: row.chargingEquipmentId,
              values,
              savedAt
            }
          })
        }
      }),

    // Default dates were just written over these rows, so the dates saved
    // earlier must no longer win over what the list returns.
    forgetSavedDates: (reportId, equipmentIds) =>
      set((state) => {
        const key = String(reportId)
        const forReport = state.savedRows[key]
        if (!forReport) return state

        const ids = new Set(equipmentIds.map(Number))
        let changed = false
        const next: SavedRowsForReport = {}
        Object.entries(forReport).forEach(([rowKey, entry]) => {
          if (!ids.has(Number(entry.chargingEquipmentId))) {
            next[rowKey] = entry
            return
          }
          changed = true
          const values = { ...entry.values }
          delete values.supplyFromDate
          delete values.supplyToDate
          if (Object.keys(values).length > 0) {
            next[rowKey] = { ...entry, values }
          }
        })

        return changed
          ? { savedRows: withReport(state.savedRows, key, next) }
          : state
      }),

    forgetReport: (reportId) =>
      set((state) => {
        const key = String(reportId)
        if (!state.savedRows[key]) return state
        return { savedRows: withReport(state.savedRows, key, {}) }
      }),

    pruneSavedRows: (reportId, rows, fetchedAt, now = Date.now()) =>
      set((state) => {
        const key = String(reportId)
        const forReport = state.savedRows[key]
        if (!forReport) return state

        const rowsByKey = new Map(
          (rows ?? []).map((row) => [reportingRowKey(row), row])
        )
        let changed = false
        const next: SavedRowsForReport = {}
        Object.entries(forReport).forEach(([rowKey, entry]) => {
          const row = rowsByKey.get(rowKey)
          // A list fetched before the save can hold the value AG Grid wrote
          // into the cached row, so only a later fetch shows it caught up.
          const caughtUp =
            row !== undefined &&
            fetchedAt > entry.savedAt &&
            hasSavedValues(row, entry.values)
          if (caughtUp || isExpired(entry, now)) {
            changed = true
            return
          }
          next[rowKey] = entry
        })

        return changed
          ? { savedRows: withReport(state.savedRows, key, next) }
          : state
      })
  })
)
