import { describe, it, expect, vi } from 'vite-plus/test'
import {
  organizationsColDefs,
  getUserColumnDefs,
  defaultSortModel
} from '../_schema'
import {
  LinkRenderer,
  OrgStatusRenderer,
  OrgTypeRenderer,
  YesNoTextRenderer
} from '@/utils/grid/cellRenderers'
import { numberFormatter } from '@/utils/formatters'
import i18n from '@/i18n'

// Mock dependencies
vi.mock('@/hooks/useOrganizations', () => ({
  useOrganizationListStatuses: vi.fn()
}))

vi.mock('@/hooks/useOrganization', () => ({
  useOrganizationTypes: vi.fn(() => ({
    data: [
      {
        organizationTypeId: 1,
        orgType: 'fuel_supplier',
        description: 'Fuel supplier',
        isBceidUser: true
      },
      {
        organizationTypeId: 2,
        orgType: 'aggregator',
        description: 'Aggregator',
        isBceidUser: true
      },
      {
        organizationTypeId: 3,
        orgType: 'custom_type',
        description: 'Custom type description'
      }
    ],
    isLoading: false
  }))
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
    const t = i18n.t
    const colDefs = organizationsColDefs(t)
    const getColumn = (colId: string) => {
      const column = colDefs.find((candidate) => candidate.colId === colId)
      if (!column) throw new Error(`Missing organization column: ${colId}`)
      return column
    }
    const getFilterParams = (column: (typeof colDefs)[number]) => {
      const params = column.floatingFilterComponentParams
      if (!params)
        throw new Error(`Missing filter parameters for ${column.colId}`)
      return params
    }
    const callValueGetter = (
      column: (typeof colDefs)[number],
      data: Record<string, unknown>
    ) => {
      const getter = column.valueGetter
      if (typeof getter !== 'function')
        throw new Error(`Missing value getter for ${column.colId}`)
      return getter({ data } as Parameters<typeof getter>[0])
    }
    const callFilterValueGetter = (
      column: (typeof colDefs)[number],
      data: Record<string, unknown>
    ) => {
      const getter = column.filterValueGetter
      if (typeof getter !== 'function')
        throw new Error(`Missing filter getter for ${column.colId}`)
      return getter({ data } as Parameters<typeof getter>[0])
    }

    it('defines the correct number of columns', () => {
      expect(colDefs).toHaveLength(6)
    })

    it('defines the status column as the first column', () => {
      const statusCol = colDefs[0]
      expect(statusCol.colId).toBe('status')
      expect(statusCol.field).toBe('status')
      expect(statusCol.headerName).toBe('Registration status')
      expect(statusCol.cellRenderer).toBe(OrgStatusRenderer)
      expect(statusCol.filter).toBe(true)
      expect(statusCol.suppressFloatingFilterButton).toBe(true)
    })

    it('defines the organization name column correctly', () => {
      const nameCol = getColumn('name')
      expect(nameCol).toBeDefined()
      expect(nameCol.field).toBe('name')
      expect(nameCol.headerName).toBe('Organization name')
      expect(nameCol.cellRenderer).toBe(LinkRenderer)
    })

    it('defines the organization type column correctly', () => {
      const orgTypeCol = getColumn('orgType')
      expect(orgTypeCol).toBeDefined()
      expect(orgTypeCol.headerName).toBe('Organization type')
      expect(orgTypeCol.cellRenderer).toBe(OrgTypeRenderer)
      expect(orgTypeCol.filter).toBe(true)
      expect(orgTypeCol.sortable).toBe(true)
      const filterParams = getFilterParams(orgTypeCol)
      expect(filterParams.valueKey).toBe('orgType')
      expect(filterParams.labelKey).toBe('shortLabel')
    })

    it('formats organization type values to shorter labels', () => {
      const orgTypeCol = getColumn('orgType')
      const mockParams = {
        data: {
          orgType: { orgType: 'fuel_supplier', description: 'Fuel supplier' }
        }
      }
      expect(callValueGetter(orgTypeCol, mockParams.data)).toBe('Supplier')
      expect(callFilterValueGetter(orgTypeCol, mockParams.data)).toBe(
        'fuel_supplier'
      )
    })

    it('preserves descriptions for unrecognized organization types', () => {
      const orgTypeCol = getColumn('orgType')
      const mockParams = {
        data: {
          orgTypes: [
            {
              orgType: 'custom_type',
              description: 'Custom type description'
            }
          ]
        }
      }
      expect(callValueGetter(orgTypeCol, mockParams.data)).toBe(
        'Custom type description'
      )

      const optionsQuery = getFilterParams(orgTypeCol).optionsQuery
      if (typeof optionsQuery !== 'function') {
        throw new Error('Missing organization type options query')
      }
      const optionsData: unknown = optionsQuery().data
      if (!Array.isArray(optionsData)) {
        throw new Error('Missing organization type options')
      }
      const option = optionsData.find(
        (
          item: unknown
        ): item is { organizationTypeId: number; shortLabel: string } =>
          typeof item === 'object' &&
          item !== null &&
          'organizationTypeId' in item &&
          item.organizationTypeId === 3 &&
          'shortLabel' in item &&
          typeof item.shortLabel === 'string'
      )
      expect(option?.shortLabel).toBe('Custom type description')
    })

    it('defines the early issuance column correctly', () => {
      const earlyIssuanceCol = getColumn('hasEarlyIssuance')
      expect(earlyIssuanceCol).toBeDefined()
      expect(earlyIssuanceCol.field).toBe('hasEarlyIssuance')
      expect(earlyIssuanceCol.headerName).toBe('Early issuance')
      expect(earlyIssuanceCol.cellRenderer).toBe(YesNoTextRenderer)
      expect(earlyIssuanceCol.filter).toBe(true)
      expect(earlyIssuanceCol.sortable).toBe(true)
      expect(earlyIssuanceCol.suppressFloatingFilterButton).toBe(true)
    })

    it('calculates early issuance value correctly in valueGetter', () => {
      const earlyIssuanceCol = getColumn('hasEarlyIssuance')
      const mockParams = { data: { hasEarlyIssuance: true } }
      expect(callValueGetter(earlyIssuanceCol, mockParams.data)).toBe(true)
    })

    it('defines early issuance filter options correctly', () => {
      const earlyIssuanceCol = getColumn('hasEarlyIssuance')
      const filterParams = getFilterParams(earlyIssuanceCol)
      expect(filterParams.valueKey).toBe('value')
      expect(filterParams.labelKey).toBe('label')

      const optionsQuery = filterParams.optionsQuery
      if (typeof optionsQuery !== 'function')
        throw new Error('Missing organization type options')
      const options = optionsQuery()
      expect(options.data).toHaveLength(2)
      expect(options.data[0]).toEqual({ value: true, label: 'Yes' })
      expect(options.data[1]).toEqual({ value: false, label: 'No' })
      expect(options.isLoading).toBe(false)
    })

    it('defines the compliance units column correctly', () => {
      const cuCol = getColumn('complianceUnits')
      expect(cuCol).toBeDefined()
      expect(cuCol.valueFormatter).toBe(numberFormatter)
      expect(cuCol.filter).toBe(false)
    })

    it('calculates total balance correctly in valueGetter', () => {
      const cuCol = getColumn('complianceUnits')
      const mockParams = { totalBalance: 150 }
      expect(callValueGetter(cuCol, mockParams)).toBe(150)
    })

    it('calculates reserve balance correctly in valueGetter', () => {
      const reserveCol = getColumn('reserve')
      const mockParams = { reservedBalance: -75 }
      expect(callValueGetter(reserveCol, mockParams)).toBe(75) // Should return absolute value
    })

    it('defines the status column with correct renderer and filter', () => {
      const statusCol = getColumn('status')
      expect(statusCol).toBeDefined()
      expect(statusCol.cellRenderer).toBe(OrgStatusRenderer)
      expect(statusCol.filter).toBe(true)
      expect(statusCol.suppressFloatingFilterButton).toBe(true)
    })

    it('uses useOrganizationListStatuses hook for status filter options', () => {
      const statusCol = getColumn('status')
      const filterParams = getFilterParams(statusCol)

      expect(filterParams.valueKey).toBe('status')
      expect(filterParams.labelKey).toBe('status')
      expect(filterParams.optionsQuery).toBeDefined()
      expect(typeof filterParams.optionsQuery).toBe('function')
    })
  })

  // Test user column definitions
  describe('getUserColumnDefs', () => {
    const t = i18n.t
    const userColDefs = getUserColumnDefs(t)
    const getUserColumn = (field: string) => {
      const column = userColDefs.find((candidate) => candidate.field === field)
      if (!column) throw new Error(`Missing user column: ${field}`)
      return column
    }

    it('modifies isActive column to be non-sortable', () => {
      const isActiveCol = getUserColumn('isActive')
      expect(isActiveCol).toBeDefined()
      expect(isActiveCol.sortable).toBe(false)
    })

    it('configures role column with correct filter parameters', () => {
      const roleCol = getUserColumn('role')
      expect(roleCol).toBeDefined()
      const filterParams = roleCol.floatingFilterComponentParams
      if (!filterParams || !('key' in filterParams)) {
        throw new Error('Missing organization user filter parameters')
      }
      expect(filterParams.params).toBe('government_roles_only=false')
      expect(filterParams.key).toBe('organization-users')
    })

    it('preserves other columns without modification', () => {
      const otherCol = getUserColumn('someOtherField')
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
