import { describe, it, expect, vi } from 'vitest'
import {
  organizationsColDefs,
  getUserColumnDefs,
  defaultSortModel
} from '../_schema'
import {
  LinkRenderer,
  OrgStatusRenderer,
  YesNoTextRenderer
} from '@/utils/grid/cellRenderers'
import { numberFormatter } from '@/utils/formatters'

// Mock dependencies
vi.mock('@/hooks/useOrganizations', () => ({
  useOrganizationStatuses: vi.fn()
}))

vi.mock('@/views/Admin/AdminMenu/components/_schema', () => ({
  usersColumnDefs: () => [
    {
      field: 'isActive',
      sortable: true,
      headerName: 'Status',
      width: 120
    },
    {
      field: 'role',
      headerName: 'Role',
      floatingFilterComponentParams: {
        params: '',
        key: ''
      }
    },
    {
      field: 'someOtherField',
      headerName: 'Other Field'
    }
  ]
}))

describe('ViewOrganization Schema', () => {
  // Test organizations column definitions
  describe('organizationsColDefs', () => {
    const t = vi.fn((key) => key)
    const colDefs = organizationsColDefs(t)

    it('defines the correct number of columns', () => {
      expect(colDefs).toHaveLength(5)
    })

    it('defines the status column as the first column', () => {
      const statusCol = colDefs[0]
      expect(statusCol.colId).toBe('status')
      expect(statusCol.field).toBe('status')
      expect(statusCol.headerName).toBe('org:orgColLabels.status')
      expect(statusCol.cellRenderer).toBe(OrgStatusRenderer)
      expect(statusCol.filter).toBe(true)
      expect(statusCol.suppressFloatingFilterButton).toBe(true)
    })

    it('defines the organization name column correctly', () => {
      const nameCol = colDefs.find((col) => col.colId === 'name')
      expect(nameCol).toBeDefined()
      expect(nameCol.field).toBe('name')
      expect(nameCol.headerName).toBe('org:orgColLabels.orgName')
      expect(nameCol.cellRenderer).toBe(LinkRenderer)
    })

    it('defines the early issuance column correctly', () => {
      const earlyIssuanceCol = colDefs.find(
        (col) => col.colId === 'hasEarlyIssuance'
      )
      expect(earlyIssuanceCol).toBeDefined()
      expect(earlyIssuanceCol.field).toBe('hasEarlyIssuance')
      expect(earlyIssuanceCol.headerName).toBe('org:orgColLabels.earlyIssuance')
      expect(earlyIssuanceCol.cellRenderer).toBe(YesNoTextRenderer)
      expect(earlyIssuanceCol.filter).toBe(true)
      expect(earlyIssuanceCol.sortable).toBe(true)
      expect(earlyIssuanceCol.suppressFloatingFilterButton).toBe(true)
    })

    it('calculates early issuance value correctly in valueGetter', () => {
      const earlyIssuanceCol = colDefs.find(
        (col) => col.colId === 'hasEarlyIssuance'
      )
      const mockParams = { data: { hasEarlyIssuance: true } }
      expect(earlyIssuanceCol.valueGetter(mockParams)).toBe(true)
    })

    it('defines early issuance filter options correctly', () => {
      const earlyIssuanceCol = colDefs.find(
        (col) => col.colId === 'hasEarlyIssuance'
      )
      const filterParams = earlyIssuanceCol.floatingFilterComponentParams
      expect(filterParams.valueKey).toBe('value')
      expect(filterParams.labelKey).toBe('label')

      const options = filterParams.optionsQuery()
      expect(options.data).toHaveLength(2)
      expect(options.data[0]).toEqual({ value: true, label: 'Yes' })
      expect(options.data[1]).toEqual({ value: false, label: 'No' })
      expect(options.isLoading).toBe(false)
    })

    it('defines the compliance units column correctly', () => {
      const cuCol = colDefs.find((col) => col.colId === 'complianceUnits')
      expect(cuCol).toBeDefined()
      expect(cuCol.valueFormatter).toBe(numberFormatter)
      expect(cuCol.filter).toBe(false)
    })

    it('calculates total balance correctly in valueGetter', () => {
      const cuCol = colDefs.find((col) => col.colId === 'complianceUnits')
      const mockParams = { data: { totalBalance: 150 } }
      expect(cuCol.valueGetter(mockParams)).toBe(150)
    })

    it('calculates reserve balance correctly in valueGetter', () => {
      const reserveCol = colDefs.find((col) => col.colId === 'reserve')
      const mockParams = { data: { reservedBalance: -75 } }
      expect(reserveCol.valueGetter(mockParams)).toBe(75) // Should return absolute value
    })

    it('defines the status column with correct renderer and filter', () => {
      const statusCol = colDefs.find((col) => col.colId === 'status')
      expect(statusCol).toBeDefined()
      expect(statusCol.cellRenderer).toBe(OrgStatusRenderer)
      expect(statusCol.filter).toBe(true)
      expect(statusCol.suppressFloatingFilterButton).toBe(true)
    })
  })

  // Test user column definitions
  describe('getUserColumnDefs', () => {
    const t = vi.fn((key) => key)
    const userColDefs = getUserColumnDefs(t)

    it('modifies isActive column to be non-sortable', () => {
      const isActiveCol = userColDefs.find((col) => col.field === 'isActive')
      expect(isActiveCol).toBeDefined()
      expect(isActiveCol.sortable).toBe(false)
    })

    it('configures role column with correct filter parameters', () => {
      const roleCol = userColDefs.find((col) => col.field === 'role')
      expect(roleCol).toBeDefined()
      expect(roleCol.floatingFilterComponentParams.params).toBe(
        'government_roles_only=false'
      )
      expect(roleCol.floatingFilterComponentParams.key).toBe(
        'organization-users'
      )
    })

    it('preserves other columns without modification', () => {
      const otherCol = userColDefs.find((col) => col.field === 'someOtherField')
      expect(otherCol).toBeDefined()
      // Verify the column is unchanged from original definition
    })
  })

  // Test default sort model
  describe('defaultSortModel', () => {
    it('defines the correct default sort configuration', () => {
      expect(defaultSortModel).toHaveLength(1)
      expect(defaultSortModel[0].field).toBe('firstName')
      expect(defaultSortModel[0].direction).toBe('asc')
    })
  })
})
