import { describe, it, expect, vi } from 'vitest'
import {
  chargingSiteColDefs,
  chargingEquipmentColDefs,
  indexChargingSitesColDefs,
  defaultColDef,
  indexDefaultColDef
} from '../../components/_schema'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Fix the i18n mock to include a default export
vi.mock('@/i18n', () => ({
  default: {
    t: (key) => key
  },
  t: (key) => key // Also export t directly in case it's used as named export
}))

vi.mock('@/hooks/useChargingSite', () => ({
  useChargingEquipmentStatuses: vi.fn(),
  useChargingSiteStatuses: vi.fn()
}))

// Mock any other dependencies that might be needed
vi.mock(
  '@/components/BCDataGrid/FloatingFilters/BCSelectFloatingFilter',
  () => ({
    default: vi.fn()
  })
)

describe('_schema', () => {
  const mockErrors = {}
  const mockWarnings = {}
  const mockT = (key) => key
  const mockAllocationOrganizations = [
    { organization_id: 1, name: 'Org 1' },
    { organization_id: 2, name: 'Org 2' }
  ]

  describe('chargingSiteColDefs', () => {
    it('returns column definitions array', () => {
      const colDefs = chargingSiteColDefs(
        mockAllocationOrganizations,
        mockErrors,
        mockWarnings,
        true
      )

      expect(Array.isArray(colDefs)).toBe(true)
      expect(colDefs.length).toBeGreaterThan(0)
    })

    it('includes required fields', () => {
      const colDefs = chargingSiteColDefs(
        mockAllocationOrganizations,
        mockErrors,
        mockWarnings,
        true
      )

      const fieldNames = colDefs.map((col) => col.field)
      expect(fieldNames).toContain('siteName')
      expect(fieldNames).toContain('streetAddress')
      expect(fieldNames).toContain('city')
      expect(fieldNames).toContain('postalCode')
      expect(fieldNames).toContain('latitude')
      expect(fieldNames).toContain('longitude')
    })

    it('configures editable fields correctly', () => {
      const colDefs = chargingSiteColDefs(
        mockAllocationOrganizations,
        mockErrors,
        mockWarnings,
        true
      )

      const siteNameCol = colDefs.find((col) => col.field === 'siteName')
      expect(siteNameCol.editable).toBe(true)

      const idCol = colDefs.find((col) => col.field === 'id')
      expect(idCol.hide).toBe(true)
    })
  })

  describe('chargingEquipmentColDefs', () => {
    it('returns equipment column definitions', () => {
      const colDefs = chargingEquipmentColDefs(mockT, false)

      expect(Array.isArray(colDefs)).toBe(true)
      expect(colDefs.length).toBeGreaterThan(0)
    })



    it('includes equipment fields', () => {
      const colDefs = chargingEquipmentColDefs(mockT, true)

      const fieldNames = colDefs.map((col) => col.field)
      expect(fieldNames).toContain('status')
      expect(fieldNames).toContain('registrationNumber')
      expect(fieldNames).toContain('manufacturer')
      expect(fieldNames).toContain('model')
    })
  })

  describe('indexChargingSitesColDefs', () => {
    const mockOrgIdToName = { 1: 'Organization 1', 2: 'Organization 2' }

    it('returns index column definitions', () => {
      const colDefs = indexChargingSitesColDefs(false, mockOrgIdToName)

      expect(Array.isArray(colDefs)).toBe(true)
      expect(colDefs.length).toBeGreaterThan(0)
    })

    it('hides organization column for non-IDIR users', () => {
      const colDefs = indexChargingSitesColDefs(false, mockOrgIdToName)

      const orgCol = colDefs.find((col) => col.field === 'organization')
      expect(orgCol.hide).toBe(true)
    })

    it('shows organization column for IDIR users', () => {
      const colDefs = indexChargingSitesColDefs(true, mockOrgIdToName)

      const orgCol = colDefs.find((col) => col.field === 'organization')
      expect(orgCol.hide).toBe(false)
    })
  })

  describe('defaultColDef', () => {
    it('has correct default properties', () => {
      expect(defaultColDef.editable).toBe(false)
      expect(defaultColDef.resizable).toBe(true)
      expect(defaultColDef.filter).toBe(false)
      expect(defaultColDef.sortable).toBe(false)
      expect(defaultColDef.singleClickEdit).toBe(true)
    })
  })

  describe('indexDefaultColDef', () => {
    it('has correct index default properties', () => {
      expect(indexDefaultColDef.editable).toBe(false)
      expect(indexDefaultColDef.resizable).toBe(true)
      expect(indexDefaultColDef.floatingFilter).toBe(true)
      expect(indexDefaultColDef.suppressFloatingFilterButton).toBe(true)
    })
  })
})
