import { describe, it, expect, beforeEach } from 'vitest'
import {
  SAVED_ROW_TTL_MS,
  applySavedRows,
  useFseReportingSavedRowsStore
} from '../useFseReportingSavedRowsStore'

const store = () => useFseReportingSavedRowsStore.getState()

const row = (overrides = {}) => ({
  chargingEquipmentId: 1,
  chargingEquipmentVersion: 2,
  chargingEquipmentComplianceId: 99,
  supplyFromDate: '2024-01-01',
  supplyToDate: '2024-12-31',
  kwhUsage: 100,
  complianceNotes: null,
  ...overrides
})

const savedValues = {
  supplyFromDate: '2024-01-01',
  supplyToDate: '2024-12-31',
  kwhUsage: 250,
  complianceNotes: null
}

const SAVED_AT = 1_000

describe('useFseReportingSavedRowsStore', () => {
  beforeEach(() => {
    useFseReportingSavedRowsStore.setState({ savedRows: {} })
  })

  describe('applySavedRows', () => {
    it('returns the response unchanged when nothing was saved', () => {
      const data = { finalSupplyEquipments: [row()] }

      expect(applySavedRows(undefined, data)).toBe(data)
    })

    it('lays saved values over a row the list returns as it was', () => {
      store().rememberSavedRow('123', row(), savedValues, SAVED_AT)
      const other = row({ chargingEquipmentId: 2 })
      const data = { finalSupplyEquipments: [row(), other], pagination: {} }

      const result = applySavedRows(
        store().savedRows['123'],
        data,
        SAVED_AT + 1
      )

      expect(result).not.toBe(data)
      expect(result?.finalSupplyEquipments?.[0]).toMatchObject({
        chargingEquipmentId: 1,
        kwhUsage: 250
      })
      expect(result?.finalSupplyEquipments?.[1]).toBe(other)
      expect(result?.pagination).toBe(data.pagination)
    })

    it('leaves the response alone once it shows the saved values', () => {
      store().rememberSavedRow('123', row(), savedValues, SAVED_AT)
      const data = { finalSupplyEquipments: [row({ kwhUsage: '250' })] }

      expect(applySavedRows(store().savedRows['123'], data, SAVED_AT + 1)).toBe(
        data
      )
    })

    it('stops applying a saved row after it expires', () => {
      store().rememberSavedRow('123', row(), savedValues, SAVED_AT)
      const data = { finalSupplyEquipments: [row()] }

      expect(
        applySavedRows(
          store().savedRows['123'],
          data,
          SAVED_AT + SAVED_ROW_TTL_MS + 1
        )
      ).toBe(data)
    })
  })

  describe('rememberSavedRow', () => {
    it('keeps the latest save per report and grid row', () => {
      store().rememberSavedRow('123', row(), savedValues, SAVED_AT)
      store().rememberSavedRow(
        123,
        row(),
        { ...savedValues, kwhUsage: 300 },
        SAVED_AT + 5
      )
      store().rememberSavedRow('456', row(), savedValues, SAVED_AT)

      expect(store().savedRows['123']['1-2']).toEqual({
        chargingEquipmentId: 1,
        values: { ...savedValues, kwhUsage: 300 },
        savedAt: SAVED_AT + 5
      })
      expect(Object.keys(store().savedRows)).toEqual(['123', '456'])
    })
  })

  describe('pruneSavedRows', () => {
    const NOW = SAVED_AT + 10

    beforeEach(() => {
      store().rememberSavedRow('123', row(), savedValues, SAVED_AT)
    })

    it('keeps a row when the list was fetched before the save', () => {
      // AG Grid writes the edit into the cached row, so an earlier fetch can
      // already show the new value without the server having caught up.
      store().pruneSavedRows('123', [row({ kwhUsage: 250 })], SAVED_AT - 1, NOW)

      expect(store().savedRows['123']).toBeDefined()
    })

    it('keeps a row while a later fetch still returns the old value', () => {
      store().pruneSavedRows('123', [row()], SAVED_AT + 1, NOW)

      expect(store().savedRows['123']).toBeDefined()
    })

    it('drops a row once a later fetch returns the saved values', () => {
      store().pruneSavedRows('123', [row({ kwhUsage: 250 })], SAVED_AT + 1, NOW)

      expect(store().savedRows['123']).toBeUndefined()
    })

    it('drops expired rows even when the list does not contain them', () => {
      store().pruneSavedRows(
        '123',
        [],
        SAVED_AT + 1,
        SAVED_AT + SAVED_ROW_TTL_MS + 1
      )

      expect(store().savedRows['123']).toBeUndefined()
    })

    it('leaves the store untouched when nothing can be dropped', () => {
      const before = store().savedRows

      store().pruneSavedRows('123', [row()], SAVED_AT + 1, NOW)

      expect(store().savedRows).toBe(before)
    })
  })

  describe('forgetSavedDates', () => {
    it('drops the saved dates of the given equipment but keeps the kWh', () => {
      store().rememberSavedRow('123', row(), savedValues, SAVED_AT)
      store().rememberSavedRow(
        '123',
        row({ chargingEquipmentId: 7 }),
        savedValues,
        SAVED_AT
      )

      store().forgetSavedDates('123', [1])

      expect(store().savedRows['123']['1-2'].values).toEqual({
        kwhUsage: 250,
        complianceNotes: null
      })
      expect(store().savedRows['123']['7-2'].values).toEqual(savedValues)
    })

    it('drops a row when only dates were left to apply', () => {
      store().rememberSavedRow(
        '123',
        row(),
        { supplyFromDate: '2024-03-01', supplyToDate: '2024-03-31' },
        SAVED_AT
      )

      store().forgetSavedDates('123', [1])

      expect(store().savedRows['123']).toBeUndefined()
    })
  })

  describe('forgetReport', () => {
    it('drops every saved row of that report only', () => {
      store().rememberSavedRow('123', row(), savedValues, SAVED_AT)
      store().rememberSavedRow('456', row(), savedValues, SAVED_AT)

      store().forgetReport(123)

      expect(store().savedRows).toEqual({
        456: expect.any(Object)
      })
    })
  })
})
