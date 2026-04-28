import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  chargingSiteColDefs,
  chargingEquipmentColDefs,
  indexChargingSitesColDefs,
  defaultColDef,
  indexDefaultColDef
} from '../../components/_schema'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('@/i18n', () => ({
  default: { t: (key) => key },
  t: (key) => key
}))

vi.mock('@/hooks/useChargingSite', () => ({
  useChargingEquipmentStatuses: vi.fn(),
  useChargingSiteStatuses: vi.fn()
}))

vi.mock('@/components/BCDataGrid/FloatingFilters/BCSelectFloatingFilter', () => ({
  default: vi.fn()
}))

vi.mock('@/components/BCButton', () => ({
  __esModule: true,
  default: ({ children, title, onClick }) => (
    <button type="button" aria-label={title} onClick={onClick}>
      {children}
    </button>
  )
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockT = (key) => key
const mockErrors = {}
const mockWarnings = {}

/** Extract field names from a column-def array, skipping cols with no field. */
const fields = (colDefs) => colDefs.map((c) => c.field).filter(Boolean)

// ---------------------------------------------------------------------------
// chargingSiteColDefs
// ---------------------------------------------------------------------------

describe('chargingSiteColDefs', () => {
  const colDefs = () => chargingSiteColDefs(mockErrors, mockWarnings, true)

  it('returns a non-empty array', () => {
    expect(Array.isArray(colDefs())).toBe(true)
    expect(colDefs().length).toBeGreaterThan(0)
  })

  describe('required fields', () => {
    it.each([
      'siteName',
      'streetAddress',
      'city',
      'postalCode',
      'latitude',
      'longitude',
      'allocatingOrganization',
      'notes'
    ])('includes field "%s"', (field) => {
      expect(fields(colDefs())).toContain(field)
    })
  })

  describe('hidden / utility columns', () => {
    it('hides the id column', () => {
      const col = colDefs().find((c) => c.field === 'id')
      expect(col.hide).toBe(true)
    })

    it('hides the chargingSiteId column', () => {
      const col = colDefs().find((c) => c.field === 'chargingSiteId')
      expect(col.hide).toBe(true)
    })
  })

  describe('editable fields', () => {
    it.each(['siteName', 'streetAddress', 'city', 'postalCode', 'latitude', 'longitude', 'allocatingOrganization', 'notes'])(
      'marks "%s" as editable',
      (field) => {
        const col = colDefs().find((c) => c.field === field)
        expect(col?.editable).toBe(true)
      }
    )
  })

  describe('postalCode valueSetter', () => {
    it('converts input to uppercase', () => {
      const col = colDefs().find((c) => c.field === 'postalCode')
      const data = {}
      col.valueSetter({ newValue: 'v5k 1a1', data, colDef: { field: 'postalCode' } })
      expect(data.postalCode).toBe('V5K 1A1')
    })

    it('returns true (AG-Grid expects truthy to accept the change)', () => {
      const col = colDefs().find((c) => c.field === 'postalCode')
      const result = col.valueSetter({ newValue: 'a1b2c3', data: {}, colDef: { field: 'postalCode' } })
      expect(result).toBe(true)
    })
  })

  describe('streetAddress valueSetter', () => {
    let col, data

    beforeEach(() => {
      col = colDefs().find((c) => c.field === 'streetAddress')
      data = {}
    })

    it('clears all address fields when newValue is empty string', () => {
      data = { city: 'Victoria', postalCode: 'V8V1A1', latitude: 48.4, longitude: -123.3 }
      col.valueSetter({ newValue: '', data })
      expect(data.streetAddress).toBe('')
      expect(data.city).toBe('')
      expect(data.postalCode).toBe('')
      expect(data.latitude).toBe('')
      expect(data.longitude).toBe('')
    })

    it('sets only streetAddress when newValue is a plain string', () => {
      col.valueSetter({ newValue: '123 Main St', data })
      expect(data.streetAddress).toBe('123 Main St')
      // city / postal should not be overwritten by a raw string
      expect(data.city).toBeUndefined()
    })

    it('populates all fields from autocomplete object with fullAddress', () => {
      col.valueSetter({
        newValue: {
          fullAddress: '123 Main St, Victoria, BC V8V1A1',
          streetAddress: '123 Main St',
          city: 'Victoria',
          postalCode: 'V8V 1A1',
          latitude: 48.4,
          longitude: -123.3
        },
        data
      })
      expect(data.streetAddress).toBe('123 Main St')
      expect(data.city).toBe('Victoria')
      expect(data.postalCode).toBe('V8V 1A1')
      expect(data.latitude).toBe(48.4)
      expect(data.longitude).toBe(-123.3)
    })

    it('returns true to accept the change', async () => {
      const result = await col.valueSetter({ newValue: '123 Main', data })
      expect(result).toBe(true)
    })
  })

  describe('allocatingOrganization valueGetter and valueSetter', () => {
    let col

    beforeEach(() => {
      col = colDefs().find((c) => c.field === 'allocatingOrganization')
    })

    it('valueGetter returns allocatingOrganizationName', () => {
      expect(col.valueGetter({ data: { allocatingOrganizationName: 'BC Hydro' } })).toBe('BC Hydro')
    })

    it('valueGetter returns empty string when field is absent', () => {
      expect(col.valueGetter({ data: {} })).toBe('')
    })

    it('valueSetter with org object sets id and name', () => {
      const data = {}
      col.valueSetter({ newValue: { organizationId: 5, name: 'FortisBC' }, data })
      expect(data.allocatingOrganizationId).toBe(5)
      expect(data.allocatingOrganizationName).toBe('FortisBC')
    })

    it('valueSetter with plain string sets only name, clears id', () => {
      const data = { allocatingOrganizationId: 99 }
      col.valueSetter({ newValue: 'Custom Org Name', data })
      expect(data.allocatingOrganizationId).toBeNull()
      expect(data.allocatingOrganizationName).toBe('Custom Org Name')
    })

    it('valueSetter returns true', () => {
      const result = col.valueSetter({ newValue: 'test', data: {} })
      expect(result).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// chargingEquipmentColDefs
// ---------------------------------------------------------------------------

describe('chargingEquipmentColDefs', () => {
  describe('core fields always present', () => {
    it.each(['status', 'siteName', 'registrationNumber', 'version', 'serialNumber', 'manufacturer', 'model', 'levelOfEquipment', 'ports', 'allocatingOrganizationName'])(
      'always includes "%s"',
      (field) => {
        expect(fields(chargingEquipmentColDefs(mockT))).toContain(field)
      }
    )
  })

  describe('showOrganizationColumn option', () => {
    it('excludes organizationName when false (BCeID)', () => {
      const f = fields(chargingEquipmentColDefs(mockT, false, { showOrganizationColumn: false }))
      expect(f).not.toContain('organizationName')
    })

    it('includes organizationName when true (IDIR)', () => {
      const f = fields(chargingEquipmentColDefs(mockT, false, { showOrganizationColumn: true }))
      expect(f).toContain('organizationName')
    })
  })

  describe('allocatingOrganizationName column positioning', () => {
    it('immediately follows organizationName for IDIR users', () => {
      const f = fields(chargingEquipmentColDefs(mockT, false, { showOrganizationColumn: true }))
      expect(f.indexOf('allocatingOrganizationName')).toBe(f.indexOf('organizationName') + 1)
    })

    it('immediately follows siteName for BCeID users', () => {
      const f = fields(chargingEquipmentColDefs(mockT, false, { showOrganizationColumn: false }))
      expect(f.indexOf('allocatingOrganizationName')).toBe(f.indexOf('siteName') + 1)
    })

    it('appears before registrationNumber in both user modes', () => {
      for (const showOrg of [true, false]) {
        const f = fields(chargingEquipmentColDefs(mockT, false, { showOrganizationColumn: showOrg }))
        expect(f.indexOf('allocatingOrganizationName')).toBeLessThan(f.indexOf('registrationNumber'))
      }
    })
  })

  describe('allocatingOrganizationName valueGetter', () => {
    const allocCol = () =>
      chargingEquipmentColDefs(mockT).find((c) => c.field === 'allocatingOrganizationName')

    it('prefers chargingSite.allocatingOrganizationName', () => {
      const result = allocCol().valueGetter({
        data: {
          chargingSite: { allocatingOrganizationName: 'Site Level Org' },
          allocatingOrganizationName: 'Direct Org'
        }
      })
      expect(result).toBe('Site Level Org')
    })

    it('falls back to direct allocatingOrganizationName', () => {
      const result = allocCol().valueGetter({
        data: { allocatingOrganizationName: 'Direct Org' }
      })
      expect(result).toBe('Direct Org')
    })

    it('returns empty string when neither field is present', () => {
      expect(allocCol().valueGetter({ data: {} })).toBe('')
    })
  })

  describe('enableSelection option', () => {
    it('adds a leading __select__ checkbox column', () => {
      const f = fields(chargingEquipmentColDefs(mockT, false, { enableSelection: true }))
      expect(f[0]).toBe('__select__')
    })

    it('does not add checkbox column when false', () => {
      const f = fields(chargingEquipmentColDefs(mockT, false, { enableSelection: false }))
      expect(f).not.toContain('__select__')
    })
  })

  describe('historyMode option', () => {
    it('adds a leading history toggle column and compliance years column', () => {
      const f = fields(chargingEquipmentColDefs(mockT, false, { historyMode: true }))
      expect(f[0]).toBe('__historyToggle__')
      expect(f).toContain('complianceYears')
    })

    it('renders expand action for collapsed current rows', () => {
      const onToggleHistory = vi.fn()
      const col = chargingEquipmentColDefs(mockT, false, {
        historyMode: true,
        onToggleHistory,
        expandedRows: new Set()
      }).find((c) => c.field === '__historyToggle__')

      render(
        col.cellRenderer({
          data: {
            registrationNumber: 'REG-1',
            isCurrentVersionRow: true,
            hasHistory: true
          }
        })
      )

      const button = screen.getByRole('button', {
        name: 'chargingSite:buttons.expandHistory'
      })
      fireEvent.click(button)
      expect(onToggleHistory).toHaveBeenCalledWith('REG-1')
    })

    it('renders collapse action for expanded current rows', () => {
      const col = chargingEquipmentColDefs(mockT, false, {
        historyMode: true,
        onToggleHistory: vi.fn(),
        expandedRows: new Set(['REG-1'])
      }).find((c) => c.field === '__historyToggle__')

      render(
        col.cellRenderer({
          data: {
            registrationNumber: 'REG-1',
            isCurrentVersionRow: true,
            hasHistory: true
          }
        })
      )

      expect(
        screen.getByRole('button', {
          name: 'chargingSite:buttons.collapseHistory'
        })
      ).toBeInTheDocument()
    })

    it('prefixes registration number for history rows', () => {
      const col = chargingEquipmentColDefs(mockT, false, {
        historyMode: true
      }).find((c) => c.field === 'registrationNumber')

      expect(
        col.cellRenderer({
          value: 'REG-1',
          data: { isHistoryVersion: true }
        })
      ).toBe('↳ REG-1')
    })
  })

  describe('showDateColumns option', () => {
    it('adds createdDate and updatedDate when true', () => {
      const f = fields(chargingEquipmentColDefs(mockT, false, { showDateColumns: true }))
      expect(f).toContain('createdDate')
      expect(f).toContain('updatedDate')
    })

    it('omits date columns when false', () => {
      const f = fields(chargingEquipmentColDefs(mockT, false, { showDateColumns: false }))
      expect(f).not.toContain('createdDate')
      expect(f).not.toContain('updatedDate')
    })
  })

  describe('showIntendedUsers option', () => {
    it('includes intendedUsers column when true', () => {
      const f = fields(chargingEquipmentColDefs(mockT, false, { showIntendedUsers: true }))
      expect(f).toContain('intendedUsers')
    })

    it('excludes intendedUsers column when false', () => {
      const f = fields(chargingEquipmentColDefs(mockT, false, { showIntendedUsers: false }))
      expect(f).not.toContain('intendedUsers')
    })
  })

  describe('showLocationFields option', () => {
    it('includes latitude and longitude when true (default)', () => {
      const f = fields(chargingEquipmentColDefs(mockT, false, { showLocationFields: true }))
      expect(f).toContain('latitude')
      expect(f).toContain('longitude')
    })

    it('excludes latitude and longitude when false', () => {
      const f = fields(chargingEquipmentColDefs(mockT, false, { showLocationFields: false }))
      expect(f).not.toContain('latitude')
      expect(f).not.toContain('longitude')
    })
  })

  describe('showNotes option', () => {
    it('includes notes column when true', () => {
      const f = fields(chargingEquipmentColDefs(mockT, false, { showNotes: true }))
      expect(f).toContain('notes')
    })

    it('excludes notes column when false (default)', () => {
      const f = fields(chargingEquipmentColDefs(mockT, false, { showNotes: false }))
      expect(f).not.toContain('notes')
    })
  })

  describe('status column valueGetter', () => {
    const statusCol = () => chargingEquipmentColDefs(mockT).find((c) => c.field === 'status')

    it('reads nested status.status', () => {
      expect(statusCol().valueGetter({ data: { status: { status: 'Validated' } } })).toBe('Validated')
    })

    it('reads flat status string', () => {
      expect(statusCol().valueGetter({ data: { status: 'Draft' } })).toBe('Draft')
    })

    it('returns empty string when status is absent', () => {
      expect(statusCol().valueGetter({ data: {} })).toBe('')
    })
  })

  describe('siteName column valueGetter', () => {
    const siteCol = () => chargingEquipmentColDefs(mockT).find((c) => c.field === 'siteName')

    it('prefers chargingSite.siteName', () => {
      expect(siteCol().valueGetter({
        data: { chargingSite: { siteName: 'Alpha' }, siteName: 'Beta' }
      })).toBe('Alpha')
    })

    it('falls back to direct siteName', () => {
      expect(siteCol().valueGetter({ data: { siteName: 'Beta' } })).toBe('Beta')
    })

    it('returns empty string when absent', () => {
      expect(siteCol().valueGetter({ data: {} })).toBe('')
    })
  })

  describe('levelOfEquipment column valueGetter', () => {
    const levelCol = () => chargingEquipmentColDefs(mockT).find((c) => c.field === 'levelOfEquipment')

    it('reads nested levelOfEquipment.name', () => {
      expect(levelCol().valueGetter({ data: { levelOfEquipment: { name: 'Level 2' } } })).toBe('Level 2')
    })

    it('falls back to flat levelOfEquipmentName', () => {
      expect(levelCol().valueGetter({ data: { levelOfEquipmentName: 'Level 1' } })).toBe('Level 1')
    })

    it('returns empty string when absent', () => {
      expect(levelCol().valueGetter({ data: {} })).toBe('')
    })
  })

  describe('intendedUse column valueGetter and valueFormatter', () => {
    const intendedCol = () =>
      chargingEquipmentColDefs(mockT, false, { showIntendedUsers: true }).find(
        (c) => c.field === 'intendedUse'
      )

    it('maps array of intendedUseTypes to type strings', () => {
      const col = intendedCol()
      const result = col.valueGetter({
        data: { intendedUseTypes: [{ type: 'Commercial' }, { type: 'Fleet' }] }
      })
      // valueGetter extracts .type, returning an array of strings
      expect(result).toEqual(['Commercial', 'Fleet'])
    })

    it('falls back to intendedUses array and extracts type strings', () => {
      const col = intendedCol()
      const result = col.valueGetter({
        data: { intendedUses: [{ type: 'Public' }] }
      })
      expect(result).toEqual(['Public'])
    })

    it('valueFormatter joins type strings with ", "', () => {
      const col = intendedCol()
      const formatted = col.valueFormatter({
        value: ['Commercial', 'Fleet']
      })
      expect(formatted).toBe('Commercial, Fleet')
    })

    it('valueFormatter returns empty string for non-array', () => {
      const col = intendedCol()
      expect(col.valueFormatter({ value: null })).toBe('')
      expect(col.valueFormatter({ value: undefined })).toBe('')
    })
  })

  describe('intendedUsers column valueGetter', () => {
    const intendedUsersCol = () =>
      chargingEquipmentColDefs(mockT, false, { showIntendedUsers: true }).find(
        (c) => c.field === 'intendedUsers'
      )

    it('maps intendedUsers array to typeName values', () => {
      const result = intendedUsersCol().valueGetter({
        data: { intendedUsers: [{ typeName: 'Fleet' }, { typeName: 'Public' }] }
      })
      expect(result).toEqual(['Fleet', 'Public'])
    })

    it('falls back to intendedUserTypes', () => {
      const result = intendedUsersCol().valueGetter({
        data: { intendedUserTypes: [{ typeName: 'Multi-unit residential' }] }
      })
      expect(result).toEqual(['Multi-unit residential'])
    })

    it('valueFormatter joins with ", "', () => {
      const col = intendedUsersCol()
      expect(col.valueFormatter({ value: ['Fleet', 'Public'] })).toBe('Fleet, Public')
    })
  })
})

// ---------------------------------------------------------------------------
// indexChargingSitesColDefs
// ---------------------------------------------------------------------------

describe('indexChargingSitesColDefs', () => {
  const orgMap = { 1: 'Org One', 2: 'Org Two' }

  describe('required fields', () => {
    it.each([
      'status', 'organization', 'siteName', 'siteCode',
      'streetAddress', 'city', 'postalCode', 'allocatingOrganization', 'notes'
    ])('includes field "%s"', (field) => {
      expect(fields(indexChargingSitesColDefs(false, orgMap))).toContain(field)
    })
  })

  describe('organization column visibility', () => {
    it('is hidden for BCeID (isIDIR=false)', () => {
      const col = indexChargingSitesColDefs(false, orgMap).find((c) => c.field === 'organization')
      expect(col.hide).toBe(true)
    })

    it('is visible for IDIR (isIDIR=true)', () => {
      const col = indexChargingSitesColDefs(true, orgMap).find((c) => c.field === 'organization')
      expect(col.hide).toBe(false)
    })
  })

  describe('organization column valueGetter', () => {
    const orgCol = (isIDIR = false) =>
      indexChargingSitesColDefs(isIDIR, orgMap).find((c) => c.field === 'organization')

    it('prefers organization.name from nested object', () => {
      expect(orgCol().valueGetter({
        data: { organization: { name: 'From Object' }, organizationId: 1 }
      })).toBe('From Object')
    })

    it('falls back to orgIdToName lookup', () => {
      expect(orgCol().valueGetter({
        data: { organizationId: 2 }
      })).toBe('Org Two')
    })

    it('returns empty string when neither source is available', () => {
      expect(orgCol().valueGetter({ data: {} })).toBe('')
    })
  })

  describe('allocatingOrganization column valueGetter', () => {
    const allocCol = () =>
      indexChargingSitesColDefs(false, orgMap).find((c) => c.field === 'allocatingOrganization')

    it('prefers allocatingOrganization.name from nested object', () => {
      expect(allocCol().valueGetter({
        data: {
          allocatingOrganization: { name: 'BC Hydro' },
          allocatingOrganizationName: 'FortisBC'
        }
      })).toBe('BC Hydro')
    })

    it('falls back to allocatingOrganizationName text field', () => {
      expect(allocCol().valueGetter({
        data: { allocatingOrganizationName: 'FortisBC' }
      })).toBe('FortisBC')
    })

    it('returns empty string when neither is present', () => {
      expect(allocCol().valueGetter({ data: {} })).toBe('')
    })
  })

  describe('column properties', () => {
    it('allocatingOrganization column supports filter and sort', () => {
      const col = indexChargingSitesColDefs(false, orgMap).find((c) => c.field === 'allocatingOrganization')
      expect(col.filter).toBe(true)
      expect(col.sortable).toBe(true)
    })

    it('organization column supports filter and sort', () => {
      const col = indexChargingSitesColDefs(true, orgMap).find((c) => c.field === 'organization')
      expect(col.filter).toBe(true)
      expect(col.sortable).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// defaultColDef
// ---------------------------------------------------------------------------

describe('defaultColDef', () => {
  it('is not editable', () => expect(defaultColDef.editable).toBe(false))
  it('is resizable', () => expect(defaultColDef.resizable).toBe(true))
  it('has no filter', () => expect(defaultColDef.filter).toBe(false))
  it('is not sortable', () => expect(defaultColDef.sortable).toBe(false))
  it('uses single-click edit', () => expect(defaultColDef.singleClickEdit).toBe(true))
  it('has no floating filter', () => expect(defaultColDef.floatingFilter).toBe(false))
})

// ---------------------------------------------------------------------------
// indexDefaultColDef
// ---------------------------------------------------------------------------

describe('indexDefaultColDef', () => {
  it('is not editable', () => expect(indexDefaultColDef.editable).toBe(false))
  it('is resizable', () => expect(indexDefaultColDef.resizable).toBe(true))
  it('enables floating filter', () => expect(indexDefaultColDef.floatingFilter).toBe(true))
  it('suppresses floating filter button', () => expect(indexDefaultColDef.suppressFloatingFilterButton).toBe(true))
})
