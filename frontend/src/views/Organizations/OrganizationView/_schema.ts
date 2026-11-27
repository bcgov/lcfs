import type { TFunction } from 'i18next'
import type { ColDef } from 'ag-grid-community'
import type { BCGridRow } from '@/components/BCDataGrid/types'
import { numberFormatter } from '@/utils/formatters'
import {
  LinkRenderer,
  OrgStatusRenderer,
  OrgTypeRenderer,
  YesNoTextRenderer
} from '@/utils/grid/cellRenderers'
import { BCSelectFloatingFilter } from '@/components/BCDataGrid/components/Filters/BCSelectFloatingFilter'
import { useOrganizationListStatuses } from '@/hooks/useOrganizations'
import { useOrganizationTypes } from '@/hooks/useOrganization'
import {
  getOrgTypeDisplayLabel,
  getOrgTypesDisplayLabel
} from '@/utils/organizationTypes'
import { usersColumnDefs } from '@/views/Admin/AdminMenu/components/_schema'

type OrganizationTypeData = {
  organizationTypeId: number
  orgType?: string | null
  org_type?: string | null
  name?: string
  description?: string | null
}

const isOrganizationTypeOption = (
  value: unknown
): value is OrganizationTypeData =>
  typeof value === 'object' &&
  value !== null &&
  'organizationTypeId' in value &&
  typeof value.organizationTypeId === 'number' &&
  (!('orgType' in value) ||
    typeof value.orgType === 'string' ||
    value.orgType === null) &&
  (!('org_type' in value) ||
    typeof value.org_type === 'string' ||
    value.org_type === null) &&
  (!('name' in value) || typeof value.name === 'string') &&
  (!('description' in value) ||
    typeof value.description === 'string' ||
    value.description === null)

const useOrganizationTypeFilterOptions = () => {
  const result = useOrganizationTypes()
  const labeledData = Array.isArray(result.data)
    ? result.data.filter(isOrganizationTypeOption).map((type) => ({
        ...type,
        shortLabel: getOrgTypeDisplayLabel({
          orgType: type.orgType ?? type.org_type ?? type.name,
          description: type.description
        })
      }))
    : undefined

  return {
    ...result,
    data: labeledData
  }
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined

const getOrganizationTypeOptions = (value: unknown): OrganizationTypeData[] =>
  Array.isArray(value) ? value.filter(isOrganizationTypeOption) : []

export const organizationsColDefs = (t: TFunction): ColDef<BCGridRow>[] => [
  {
    colId: 'status',
    field: 'status',
    headerName: t('org:orgColLabels.registrationStatus'),
    minWidth: 140,
    valueGetter: (params) => {
      const status = asRecord(params.data?.orgStatus)?.status
      return typeof status === 'string' ? status : undefined
    },
    cellRenderer: OrgStatusRenderer,
    cellClass: 'vertical-middle',
    filter: true,
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      valueKey: 'status',
      labelKey: 'status',
      optionsQuery: useOrganizationListStatuses
    },
    suppressFloatingFilterButton: true
  },
  {
    colId: 'orgType',
    field: 'orgType',
    headerName: t('org:orgColLabels.orgType'),
    minWidth: 220,
    valueGetter: (params) => {
      const data = params.data
      const types = getOrganizationTypeOptions(data?.orgTypes)
      const primaryType = isOrganizationTypeOption(data?.orgType)
        ? data.orgType
        : undefined
      return types.length
        ? getOrgTypesDisplayLabel(types)
        : primaryType
          ? getOrgTypeDisplayLabel(primaryType)
          : ''
    },
    // Filtering is applied server-side (BCGridViewer forwards the filter
    // model to /organizations/, which matches any of an organization's
    // types), so this only feeds the grid's local row value: use the
    // primary type rather than a comma-joined list an equals filter would
    // never match.
    filterValueGetter: (params) => {
      const orgType = asRecord(params.data?.orgType)?.orgType
      return typeof orgType === 'string' ? orgType : ''
    },
    cellRenderer: OrgTypeRenderer,
    cellClass: 'vertical-middle',
    filter: true,
    sortable: true,
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      valueKey: 'orgType',
      labelKey: 'shortLabel',
      optionsQuery: useOrganizationTypeFilterOptions
    },
    suppressFloatingFilterButton: true
  },
  {
    colId: 'name',
    field: 'name',
    headerName: t('org:orgColLabels.orgName'),
    cellRenderer: LinkRenderer,
    minWidth: 400,
    flex: 1
  },
  {
    colId: 'hasEarlyIssuance',
    field: 'hasEarlyIssuance',
    headerName: t('org:orgColLabels.earlyIssuance'),
    minWidth: 200,
    valueGetter: (params) =>
      typeof params.data?.hasEarlyIssuance === 'boolean'
        ? params.data.hasEarlyIssuance
        : undefined,
    cellRenderer: YesNoTextRenderer,
    cellClass: 'vertical-middle',
    filter: true,
    sortable: true,
    filterParams: {
      textMatcher: () => {
        return true
      }
    },
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      valueKey: 'value',
      labelKey: 'label',
      optionsQuery: () => ({
        data: [
          { value: true, label: 'Yes' },
          { value: false, label: 'No' }
        ],
        isLoading: false
      })
    },
    suppressFloatingFilterButton: true
  },
  {
    colId: 'complianceUnits',
    headerName: t('org:orgColLabels.complianceUnits'),
    valueFormatter: numberFormatter,
    cellRenderer: LinkRenderer,
    minWidth: 300,
    valueGetter: (params) => params.data?.totalBalance,
    filter: false,
    sortable: false
  },
  {
    colId: 'reserve',
    headerName: t('org:orgColLabels.inReserve'),
    valueFormatter: numberFormatter,
    valueGetter: (params) => {
      const balance = params.data?.reservedBalance
      if (balance === null || balance === undefined) return undefined
      if (typeof balance === 'number') return Math.abs(balance)
      return typeof balance === 'string' ? Math.abs(Number(balance)) : undefined
    },
    minWidth: 300,
    cellRenderer: LinkRenderer,
    filter: false,
    sortable: false
  }
]

export const getUserColumnDefs = (t: TFunction) => {
  return usersColumnDefs(t).map((colDef) => {
    if (colDef.field === 'isActive') {
      return {
        ...colDef,
        sortable: false
      }
    } else if (colDef.field === 'role') {
      // pick only supplier roles
      return {
        ...colDef,
        floatingFilterComponentParams: {
          ...colDef.floatingFilterComponentParams,
          params: 'government_roles_only=false',
          key: 'organization-users'
        }
      }
    }
    return colDef
  })
}

export const defaultSortModel: Array<{
  field: string
  direction: 'asc' | 'desc'
}> = [{ field: 'firstName', direction: 'asc' }]
