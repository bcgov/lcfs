// @ts-nocheck
import type { ColDef } from '@ag-grid-community/core'
import { FuelCodeStatusRenderer } from '@/utils/grid/cellRenderers'
import { dateFormatter } from '@/utils/formatters'
import {
  BCDateFloatingFilter,
  BCSelectFloatingFilter
} from '@/components/BCDataGrid/components'
import { useFuelCodeStatuses } from '@/hooks/useFuelCode'

export const iterationColDefs = (t: (key: string) => string): ColDef[] => [
  {
    field: 'status',
    headerName: t('fuelCode:fuelCodeColLabels.status'),
    minWidth: 150,
    cellRenderer: FuelCodeStatusRenderer,
    filter: 'agTextColumnFilter',
    floatingFilter: true,
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      valueKey: 'status',
      labelKey: 'status',
      optionsQuery: useFuelCodeStatuses
    },
    suppressFloatingFilterButton: true,
    filterParams: {
      suppressFilterButton: true
    }
  },
  {
    field: 'prefix',
    headerName: t('fuelCode:fuelCodeColLabels.prefix'),
    minWidth: 140,
    floatingFilter: true,
    filter: 'agTextColumnFilter'
  },
  {
    field: 'fuelSuffix',
    headerName: t('fuelCode:detail.iteration'),
    minWidth: 140,
    floatingFilter: true,
    filter: 'agTextColumnFilter'
  },
  {
    field: 'carbonIntensity',
    headerName: 'CI (gCO2e/MJ)',
    minWidth: 200,
    type: 'numericColumn',
    headerClass: 'ag-left-aligned-header',
    cellStyle: { textAlign: 'left' },
    floatingFilter: true,
    filterValueGetter: (params) =>
      params.data?.carbonIntensity !== null &&
      params.data?.carbonIntensity !== undefined
        ? String(params.data.carbonIntensity)
        : '',
    filter: 'agTextColumnFilter',
    filterParams: {
      filterOptions: ['contains'],
      suppressAndOrCondition: true,
      trimInput: true
    }
  },
  {
    field: 'applicationDate',
    headerName: t('fuelCode:fuelCodeColLabels.applicationDate'),
    valueFormatter: dateFormatter,
    minWidth: 200,
    floatingFilter: true,
    floatingFilterComponent: BCDateFloatingFilter,
    floatingFilterComponentParams: {
      initialFilterType: 'equals',
      label: 'YYYY-MM-DD'
    },
    suppressFloatingFilterButton: true,
    filterParams: {
      suppressAndOrCondition: true,
      comparator: (filterLocalDateAtMidnight, cellValue) => {
        if (!cellValue) return -1
        const cellDate = new Date(cellValue)
        if (Number.isNaN(cellDate.getTime())) return -1
        const normalized = new Date(
          cellDate.getFullYear(),
          cellDate.getMonth(),
          cellDate.getDate()
        )
        if (normalized < filterLocalDateAtMidnight) return -1
        if (normalized > filterLocalDateAtMidnight) return 1
        return 0
      }
    },
    filter: 'agDateColumnFilter'
  },
  {
    field: 'approvalDate',
    headerName: t('fuelCode:fuelCodeColLabels.approvalDate'),
    valueFormatter: dateFormatter,
    minWidth: 180,
    floatingFilter: true,
    floatingFilterComponent: BCDateFloatingFilter,
    floatingFilterComponentParams: {
      initialFilterType: 'equals',
      label: 'YYYY-MM-DD'
    },
    suppressFloatingFilterButton: true,
    filterParams: {
      suppressAndOrCondition: true,
      comparator: (filterLocalDateAtMidnight, cellValue) => {
        if (!cellValue) return -1
        const cellDate = new Date(cellValue)
        if (Number.isNaN(cellDate.getTime())) return -1
        const normalized = new Date(
          cellDate.getFullYear(),
          cellDate.getMonth(),
          cellDate.getDate()
        )
        if (normalized < filterLocalDateAtMidnight) return -1
        if (normalized > filterLocalDateAtMidnight) return 1
        return 0
      }
    },
    filter: 'agDateColumnFilter'
  },
  {
    field: 'effectiveDate',
    headerName: t('fuelCode:fuelCodeColLabels.effectiveDate'),
    valueFormatter: dateFormatter,
    minWidth: 180,
    floatingFilter: true,
    floatingFilterComponent: BCDateFloatingFilter,
    floatingFilterComponentParams: {
      initialFilterType: 'equals',
      label: 'YYYY-MM-DD'
    },
    suppressFloatingFilterButton: true,
    filterParams: {
      suppressAndOrCondition: true,
      comparator: (filterLocalDateAtMidnight, cellValue) => {
        if (!cellValue) return -1
        const cellDate = new Date(cellValue)
        if (Number.isNaN(cellDate.getTime())) return -1
        const normalized = new Date(
          cellDate.getFullYear(),
          cellDate.getMonth(),
          cellDate.getDate()
        )
        if (normalized < filterLocalDateAtMidnight) return -1
        if (normalized > filterLocalDateAtMidnight) return 1
        return 0
      }
    },
    filter: 'agDateColumnFilter'
  },
  {
    field: 'expirationDate',
    headerName: t('fuelCode:fuelCodeColLabels.expirationDate'),
    valueFormatter: dateFormatter,
    minWidth: 180,
    floatingFilter: true,
    floatingFilterComponent: BCDateFloatingFilter,
    floatingFilterComponentParams: {
      initialFilterType: 'equals',
      label: 'YYYY-MM-DD'
    },
    suppressFloatingFilterButton: true,
    filterParams: {
      suppressAndOrCondition: true,
      comparator: (filterLocalDateAtMidnight, cellValue) => {
        if (!cellValue) return -1
        const cellDate = new Date(cellValue)
        if (Number.isNaN(cellDate.getTime())) return -1
        const normalized = new Date(
          cellDate.getFullYear(),
          cellDate.getMonth(),
          cellDate.getDate()
        )
        if (normalized < filterLocalDateAtMidnight) return -1
        if (normalized > filterLocalDateAtMidnight) return 1
        return 0
      }
    },
    filter: 'agDateColumnFilter'
  }
]

export const defaultSortModel = [{ field: 'fuelSuffix', direction: 'desc' }]
