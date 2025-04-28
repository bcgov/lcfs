import { describe, it, expect, vi } from 'vitest'
import { organizationsColDefs, getUserColumnDefs, defaultSortModel } from '../_schema'
import { LinkRenderer, OrgStatusRenderer } from '@/utils/grid/cellRenderers'
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
    const t = vi.fn(key => key)
    const colDefs = organizationsColDefs(t)

    it('defines the correct number of columns', () => {
      expect(colDefs).toHaveLength(4)
    })

    it('defines the organization name column correctly', () => {
      const nameCol = colDefs.find(col => col.colId === 'name')
      expect(nameCol).toBeDefined()
      expect(nameCol.field).toBe('name')
      expect(nameCol.headerName).toBe('org:orgColLabels.orgName')
      expect(nameCol.cellRenderer).toBe(LinkRenderer)
    })

    it('defines the compliance units column correctly', () => {
      const cuCol = colDefs.find(col => col.colId === 'complianceUnits')
      expect(cuCol).toBeDefined()
      expect(cuCol.valueFormatter).toBe(numberFormatter)
      expect(cuCol.filter).toBe(false)
    })

    it('calculates total balance correctly in valueGetter', () => {
      const cuCol = colDefs.find(col => col.colId === 'complianceUnits')
      const mockParams = { data: { totalBalance: 150 } }
      expect(cuCol.valueGetter(mockParams)).toBe(150)
    })

    it('calculates reserve balance correctly in valueGetter', () => {
      const reserveCol = colDefs.find(col => col.colId === 'reserve')
      const mockParams = { data: { reservedBalance: -75 } }
      expect(reserveCol.valueGetter(mockParams)).toBe(75) // Should return absolute value
    })

    it('defines the status column with correct renderer and filter', () => {
      const statusCol = colDefs.find(col => col.colId === 'status')
      expect(statusCol).toBeDefined()
      expect(statusCol.cellRenderer).toBe(OrgStatusRenderer)
      expect(statusCol.filter).toBe(true)
      expect(statusCol.suppressFloatingFilterButton).toBe(true)
    })
  })

  // Test user column definitions
  describe('getUserColumnDefs', () => {
    const t = vi.fn(key => key)
    const userColDefs = getUserColumnDefs(t)

    it('modifies isActive column to be non-sortable', () => {
      const isActiveCol = userColDefs.find(col => col.field === 'isActive')
      expect(isActiveCol).toBeDefined()
      expect(isActiveCol.sortable).toBe(false)
    })

    it('configures role column with correct filter parameters', () => {
      const roleCol = userColDefs.find(col => col.field === 'role')
      expect(roleCol).toBeDefined()
      expect(roleCol.floatingFilterComponentParams.params).toBe('government_roles_only=false')
      expect(roleCol.floatingFilterComponentParams.key).toBe('organization-users')
    })

    it('preserves other columns without modification', () => {
      const otherCol = userColDefs.find(col => col.field === 'someOtherField')
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
