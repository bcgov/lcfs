import { describe, it, expect } from 'vitest'
import { bulkChargingEquipmentColDefs } from '../_bulkSchema'

const chargingSiteId = (colDefs) =>
  colDefs.find((col) => col.field === 'chargingSiteId')

const makeParams = (data = {}, col = null) => ({
  data,
  colDef: col ?? { editable: () => true, field: 'chargingSiteId' }
})

describe('bulkChargingEquipmentColDefs – chargingSiteId editability', () => {
  const sites = [{ chargingSiteId: 1, siteName: 'Site A', latitude: 0, longitude: 0 }]

  describe('when isChargingSiteLocked = false (default)', () => {
    const colDefs = bulkChargingEquipmentColDefs(sites)
    const col = chargingSiteId(colDefs)

    it('is editable for a brand-new unsaved row (no chargingEquipmentId)', () => {
      expect(
        col.editable(makeParams({ status: 'Draft', registrationNumber: '' }))
      ).toBe(true)
    })

    it('is editable for a Draft record that has been saved (chargingEquipmentId present)', () => {
      expect(
        col.editable(
          makeParams({ chargingEquipmentId: 5, status: 'Draft', registrationNumber: '' })
        )
      ).toBe(true)
    })

    it('is NOT editable once a registration number has been assigned', () => {
      expect(
        col.editable(
          makeParams({
            chargingEquipmentId: 5,
            status: 'Draft',
            registrationNumber: 'LCFS-0001'
          })
        )
      ).toBe(false)
    })

    it('is NOT editable when registration number exists regardless of status', () => {
      for (const status of ['Draft', 'Updated', 'Validated']) {
        expect(
          col.editable(
            makeParams({ chargingEquipmentId: 5, status, registrationNumber: 'LCFS-0001' })
          )
        ).toBe(false)
      }
    })

    it('is NOT editable when status is Submitted (unrelated to registration)', () => {
      expect(
        col.editable(
          makeParams({ chargingEquipmentId: 5, status: 'Submitted', registrationNumber: '' })
        )
      ).toBe(false)
    })

    it('is NOT editable for a saved non-Draft record without registration number', () => {
      expect(
        col.editable(
          makeParams({ chargingEquipmentId: 5, status: 'Updated', registrationNumber: '' })
        )
      ).toBe(false)
    })
  })

  describe('when isChargingSiteLocked = true', () => {
    const colDefs = bulkChargingEquipmentColDefs(
      sites, [], [], [], [], {}, {}, null, true, true, true
    )
    const col = chargingSiteId(colDefs)

    it('is NOT editable even for a fresh Draft row', () => {
      expect(
        col.editable(makeParams({ status: 'Draft', registrationNumber: '' }))
      ).toBe(false)
    })
  })
})

describe('bulkChargingEquipmentColDefs – chargingSiteId cellStyle', () => {
  const sites = [{ chargingSiteId: 1, siteName: 'Site A', latitude: 0, longitude: 0 }]

  it('applies greyed-out style when registration number is present', () => {
    const col = chargingSiteId(bulkChargingEquipmentColDefs(sites))
    const data = { chargingEquipmentId: 5, status: 'Draft', registrationNumber: 'LCFS-0001' }
    const style = col.cellStyle(makeParams(data, col))
    expect(style).toMatchObject({
      backgroundColor: '#f5f5f5',
      cursor: 'not-allowed'
    })
  })

  it('does NOT apply greyed-out style when no registration number', () => {
    const col = chargingSiteId(bulkChargingEquipmentColDefs(sites))
    const data = { chargingEquipmentId: 5, status: 'Draft', registrationNumber: '' }
    const style = col.cellStyle(makeParams(data, col))
    expect(style).not.toMatchObject({
      backgroundColor: '#f5f5f5',
      cursor: 'not-allowed'
    })
  })

  it('applies greyed-out style when isChargingSiteLocked = true', () => {
    const col = chargingSiteId(
      bulkChargingEquipmentColDefs(sites, [], [], [], [], {}, {}, null, true, true, true)
    )
    const data = { status: 'Draft', registrationNumber: '' }
    const style = col.cellStyle(makeParams(data, col))
    expect(style).toMatchObject({
      backgroundColor: '#f5f5f5',
      cursor: 'not-allowed'
    })
  })
})
