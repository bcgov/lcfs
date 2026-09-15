// @ts-nocheck
import type { ColDef } from '@ag-grid-community/core'
import {
  numberFormatter,
  phoneNumberFormatter,
  timezoneFormatter
} from '@/utils/formatters'
import { BCDateFloatingFilter } from '@/components/BCDataGrid/components/index'
import { RoleRenderer } from '@/utils/grid/cellRenderers'

// Column definitions for the credit trading market table
export const creditMarketColDefs = (
  t: (key: string, fallback?: string) => string
): ColDef[] => [
  {
    headerName: t('creditMarket:organizationName', 'Organization name'),
    field: 'organizationName',
    flex: 2,
    minWidth: 200,
    sortable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: true
  },
  {
    headerName: t('creditMarket:creditsToSell', 'Credits to sell'),
    field: 'creditsToSell',
    flex: 1,
    minWidth: 160,
    sortable: true,
    filter: 'agNumberColumnFilter',
    floatingFilter: true,
    valueGetter: (params) => {
      // Show N/A if credits to sell is 0, null, or undefined
      if (
        params.data.creditsToSell === null ||
        params.data.creditsToSell === undefined ||
        params.data.creditsToSell === 0
      ) {
        return 'N/A'
      }
      return parseInt(params.data.creditsToSell)
    },
    valueFormatter: numberFormatter
  },
  {
    headerName: t('creditMarket:roleInMarket', 'Role in market'),
    field: 'roleInMarket',
    flex: 1.5,
    minWidth: 220,
    sortable: true,
    filter: 'agSetColumnFilter',
    floatingFilter: true,
    cellRenderer: (params) => {
      const roles = []
      if (params.data.isSeller) roles.push('Seller')
      if (params.data.isBuyer) roles.push('Buyer')
      return roles.length > 0 ? (
        <RoleRenderer value={roles} disableLink={true} />
      ) : (
        'N/A'
      )
    }
  },
  {
    headerName: t('creditMarket:contactPerson', 'Name'),
    field: 'contactPerson',
    flex: 1.5,
    minWidth: 150,
    sortable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: true
  },
  {
    headerName: t('creditMarket:phone', 'Phone'),
    field: 'phone',
    flex: 1.5,
    minWidth: 150,
    sortable: true,
    filter: 'agTextColumnFilter',
    valueFormatter: phoneNumberFormatter,
    floatingFilter: true
  },
  {
    headerName: t('creditMarket:email', 'Email'),
    field: 'email',
    flex: 2,
    minWidth: 200,
    sortable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: true
  }
]

export const defaultSortModel: Array<{ colId: string; sort: string }> = [
  {
    colId: 'organizationName',
    sort: 'asc'
  }
]

// Labels for the listing fields that can appear in an audit entry's diff
export const creditMarketAuditFieldLabels = (
  t: (key: string, fallback?: string) => string
): Record<string, string> => ({
  credit_market_contact_name: t('creditMarket:contactName', 'Contact name'),
  credit_market_contact_email: t('creditMarket:email', 'Email'),
  credit_market_contact_phone: t('creditMarket:telephone', 'Telephone'),
  credit_market_is_seller: t('creditMarket:seller', 'Seller'),
  credit_market_is_buyer: t('creditMarket:buyer', 'Buyer'),
  credits_to_sell: t('creditMarket:creditsToSell', 'Credits to sell'),
  display_in_credit_market: t(
    'creditMarket:displayInMarket',
    'Display in credit trading market'
  )
})

const formatAuditValue = (
  value: unknown,
  t: (key: string, fallback?: string) => string
): string => {
  if (value === null || value === undefined || value === '') {
    return t('creditMarket:auditValueEmpty', '(blank)')
  }
  if (value === true) return t('creditMarket:auditValueYes', 'Yes')
  if (value === false) return t('creditMarket:auditValueNo', 'No')
  return String(value)
}

// Turn an audit entry's field-level diff into "Label: old → new" lines
export const formatAuditChanges = (
  changes: Array<{ field: string; oldValue?: unknown; newValue?: unknown }>,
  t: (key: string, fallback?: string) => string
): string[] => {
  if (!Array.isArray(changes) || changes.length === 0) return []
  const labels = creditMarketAuditFieldLabels(t)
  return changes.map(
    (change) =>
      `${labels[change.field] ?? change.field}: ${formatAuditValue(
        change.oldValue,
        t
      )} → ${formatAuditValue(change.newValue, t)}`
  )
}

export const creditMarketAuditLogColDefs = (
  t: (key: string, fallback?: string) => string
): ColDef[] => [
  {
    headerName: t('creditMarket:organizationName', 'Organization name'),
    field: 'organizationName',
    flex: 2,
    minWidth: 200,
    sortable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: true
  },
  {
    headerName: t('creditMarket:action', 'Action'),
    field: 'action',
    flex: 1,
    minWidth: 120,
    sortable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: true,
    valueFormatter: (params) => params.value || 'N/A'
  },
  {
    headerName: t('creditMarket:changes', 'Changes'),
    field: 'changes',
    flex: 2.5,
    minWidth: 280,
    sortable: false,
    filter: false,
    floatingFilter: false,
    wrapText: true,
    autoHeight: true,
    valueGetter: (params) =>
      formatAuditChanges(params.data?.changes, t).join('; '),
    cellRenderer: (params) => {
      const lines = formatAuditChanges(params.data?.changes, t)
      if (lines.length === 0) {
        return t('creditMarket:noChangeDetails', 'Not recorded')
      }
      return (
        <div data-test="audit-changes">
          {lines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )
    }
  },
  {
    headerName: t('creditMarket:creditsToSell', 'Credits to sell'),
    field: 'creditsToSell',
    flex: 1,
    minWidth: 150,
    sortable: true,
    filter: 'agNumberColumnFilter',
    floatingFilter: true,
    valueFormatter: numberFormatter
  },
  {
    headerName: t('creditMarket:roleInMarket', 'Role in market'),
    field: 'roleInMarket',
    flex: 1.5,
    minWidth: 180,
    sortable: true,
    filter: false,
    floatingFilter: false,
    cellRenderer: (params) => {
      const roles = String(params.value || '')
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean)

      return roles.length > 0 ? (
        <RoleRenderer value={roles} disableLink={true} />
      ) : (
        'N/A'
      )
    }
  },
  {
    headerName: t('creditMarket:contactPerson', 'Contact person'),
    field: 'contactPerson',
    flex: 1.5,
    minWidth: 180,
    sortable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: true
  },
  {
    headerName: t('creditMarket:phone', 'Phone'),
    field: 'phone',
    flex: 1.2,
    minWidth: 150,
    sortable: true,
    filter: 'agTextColumnFilter',
    valueFormatter: phoneNumberFormatter,
    floatingFilter: true
  },
  {
    headerName: t('creditMarket:email', 'Email'),
    field: 'email',
    flex: 2,
    minWidth: 220,
    sortable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: true
  },
  {
    headerName: t('creditMarket:changedBy', 'Changed by'),
    field: 'changedBy',
    flex: 1.5,
    minWidth: 180,
    sortable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: true
  },
  {
    headerName: t('creditMarket:uploadedDate', 'Uploaded date'),
    field: 'uploadedDate',
    flex: 1.7,
    minWidth: 220,
    sortable: true,
    cellDataType: 'dateString',
    valueFormatter: timezoneFormatter,
    filter: 'agDateColumnFilter',
    filterParams: {
      filterOptions: ['equals', 'lessThan', 'greaterThan', 'inRange'],
      suppressAndOrCondition: true,
      buttons: ['clear']
    },
    floatingFilterComponent: BCDateFloatingFilter,
    suppressFloatingFilterButton: true
  }
]

export const defaultAuditSortModel: Array<{
  field: string
  direction: string
}> = [{ field: 'uploadedDate', direction: 'desc' }]
