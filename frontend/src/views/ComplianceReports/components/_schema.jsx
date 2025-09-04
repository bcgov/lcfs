import {
  BCDateFloatingFilter,
  BCSelectFloatingFilter
} from '@/components/BCDataGrid/components'
import { SUMMARY } from '@/constants/common'
import {
  ReportsStatusRenderer,
  LastCommentRenderer
} from '@/utils/grid/cellRenderers'
import { timezoneFormatter } from '@/utils/formatters'
import { useGetComplianceReportStatuses, useGetAvailableAnalysts } from '@/hooks/useComplianceReports'
import { AssignedAnalystCell } from './AssignedAnalystCell'

export const reportsColDefs = (t, isSupplier, onRefresh) => [
  {
    field: 'status',
    headerName: t('report:reportColLabels.status'),
    width: 220,
    valueGetter: ({ data }) => data.reportStatus || '',
    filterParams: {
      textFormatter: (value) => value.replace(/\s+/g, '_').toLowerCase(),
      textCustomComparator: (filter, value, filterText) => {
        // Split the filter text by comma and trim each value
        const filterValues = filterText
          .split(',')
          .map((text) => text.trim().replace(/\s+/g, '_').toLowerCase())

        const cleanValue = value.replace(/[\s]+/g, '_').toLowerCase()

        // Return true if the value matches any of the filter values
        return filterValues.some((filterValue) =>
          cleanValue.includes(filterValue)
        )
      },
      buttons: ['clear']
    },
    cellRenderer: ReportsStatusRenderer,
    cellRendererParams: {
      url: ({ data }) => `${data.compliancePeriod}/${data.complianceReportId}`
    },
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      optionsQuery: useGetComplianceReportStatuses,
      valueKey: 'status',
      labelKey: 'status'
    },
    suppressFloatingFilterButton: true
  },
  {
    field: 'assignedAnalyst',
    headerName: t('report:reportColLabels.assignedAnalyst'),
    width: 180,
    hide: isSupplier,
    valueGetter: ({ data }) => data.assignedAnalyst?.initials || '',
    cellRenderer: AssignedAnalystCell,
    cellRendererParams: {
      onRefresh
    },
    filter: 'agTextColumnFilter',
    filterParams: {
      textFormatter: (value) => value || '',
      textCustomComparator: (filter, value, filterText) => {
        // Handle filtering by initials
        const cleanValue = (value || '').toLowerCase()
        const cleanFilter = filterText.toLowerCase()
        return cleanValue.includes(cleanFilter)
      },
      buttons: ['clear']
    },
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      optionsQuery: useGetAvailableAnalysts,
      valueKey: 'initials',
      labelKey: 'fullName'
    },
    suppressFloatingFilterButton: true,
    suppressHeaderFilterButton: true
  },
  {
    field: 'lastComment',
    headerName: t('report:reportColLabels.lastComment'),
    width: 160,
    hide: isSupplier, // Only show for IDIR users
    cellRenderer: LastCommentRenderer,
    sortable: false,
    filter: false,
    floatingFilter: false,
    suppressHeaderFilterButton: true,
    valueGetter: ({ data }) => data.lastComment || null
  },
  {
    field: 'compliancePeriod',
    headerName: t('report:reportColLabels.compliancePeriod'),
    width: 210,
    valueGetter: ({ data }) => data.compliancePeriod || '',
    filterParams: {
      buttons: ['clear']
    }
  },
  {
    field: 'organization',
    headerName: t('report:reportColLabels.organization'),
    flex: 2,
    hide: isSupplier,
    valueGetter: ({ data }) => data.organizationName || ''
  },
  {
    field: 'type',
    headerName: t('report:reportColLabels.type'),
    flex: 2,
    valueGetter: ({ data }) => data.reportType,
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      optionsQuery: () => ({
        data: [
          { id: 1, name: 'Early issuance' },
          { id: 2, name: 'Original report' },
          { id: 3, name: 'Supplemental report' },
          {
            id: 4,
            name: 'Government adjustment'
          },
          {
            id: 5,
            name: 'Reassessment'
          }
        ],
        isLoading: false
      }),
      initialFilterType: 'contains',
      valueKey: 'name',
      labelKey: 'name'
    }
  },
  {
    field: 'updateDate',
    cellDataType: 'dateString',
    headerName: t('report:reportColLabels.lastUpdated'),
    minWidth: '80',
    valueGetter: ({ data }) => data.updateDate || '',
    valueFormatter: timezoneFormatter,
    filter: 'agDateColumnFilter',
    filterParams: {
      filterOptions: ['equals', 'lessThan', 'greaterThan', 'inRange'],
      suppressAndOrCondition: true,
      buttons: ['clear'],
      maxValidYear: 2400
    },
    floatingFilterComponent: BCDateFloatingFilter,
    suppressFloatingFilterButton: true
  }
]

export const renewableFuelColumns = (
  t,
  data,
  editable,
  compliancePeriodYear,
  lines7And9Locked = false
) => {
  /**
   * Editable Lines Logic:
   *
   * Lines 6 & 7:
   * - Only visible if cells G2, D2, and J2 do not show a balance of zero and
   *   there is a surplus above the renewable requirement.
   *
   * Lines 8 & 9:
   * - When I am short of my renewable obligation and in a penalty situation,
   *   then the free text fields in cells G8, D8, and J8 are available
   *   for input and I see the fields only if there is a deficiency.
   *
   * Line 8:
   * - Line 8 is editable when Line 2 < Line 4 (indicating a deficiency).
   * - For Jet Fuel, Line 8 is unavailable until 2028.
   * - From 2028 onward, Jet Fuel follows the same logic as Gasoline and Diesel.
   */

  let gasolineEditableCells = []
  let dieselEditableCells = []
  let jetFuelEditableCells = []

  // ========= Gasoline Logic ============
  if (
    data[SUMMARY.LINE_2].gasoline > 0 &&
    data[SUMMARY.LINE_2].gasoline - data[SUMMARY.LINE_4].gasoline > 0
  )
    gasolineEditableCells = [SUMMARY.LINE_6]
  else if (
    data[SUMMARY.LINE_1].gasoline > 0 &&
    data[SUMMARY.LINE_2].gasoline - data[SUMMARY.LINE_4].gasoline > 0
  )
    gasolineEditableCells = [SUMMARY.LINE_8]

  // Line 8
  if (data[SUMMARY.LINE_2].gasoline < data[SUMMARY.LINE_4].gasoline) {
    // If Line 2 is less than Line 4, ensure Line 8 is available
    if (!gasolineEditableCells.includes(SUMMARY.LINE_8)) {
      gasolineEditableCells.push(SUMMARY.LINE_8)
    }
  } else {
    // If Line 2 meets or exceeds Line 4, remove Line 8 if it's there
    gasolineEditableCells = gasolineEditableCells.filter(
      (line) => line !== SUMMARY.LINE_8
    )
  }

  // ============ Diesel Logic ============
  if (
    data[SUMMARY.LINE_2].diesel > 0 &&
    data[SUMMARY.LINE_2].diesel - data[SUMMARY.LINE_4].diesel > 0
  )
    dieselEditableCells = [SUMMARY.LINE_6]
  else if (
    data[SUMMARY.LINE_1].diesel > 0 &&
    data[SUMMARY.LINE_2].diesel - data[SUMMARY.LINE_4].diesel > 0
  )
    dieselEditableCells = [SUMMARY.LINE_8]

  // Line 8
  if (data[SUMMARY.LINE_2].diesel < data[SUMMARY.LINE_4].diesel) {
    // If Line 2 is less than Line 4, ensure Line 8 is available
    if (!dieselEditableCells.includes(SUMMARY.LINE_8)) {
      dieselEditableCells.push(SUMMARY.LINE_8)
    }
  } else {
    // If Line 2 meets or exceeds Line 4, remove Line 8 if it's there
    dieselEditableCells = dieselEditableCells.filter(
      (line) => line !== SUMMARY.LINE_8
    )
  }

  // ============ Jet Fuel Logic ============
  if (
    data[SUMMARY.LINE_2].jetFuel > 0 &&
    data[SUMMARY.LINE_2].jetFuel - data[SUMMARY.LINE_4].jetFuel > 0
  )
    jetFuelEditableCells = [SUMMARY.LINE_6]
  else if (
    data[SUMMARY.LINE_1].jetFuel > 0 &&
    data[SUMMARY.LINE_2].jetFuel - data[SUMMARY.LINE_4].jetFuel > 0
  )
    jetFuelEditableCells = [SUMMARY.LINE_8]

  // Line 8
  if (parseInt(compliancePeriodYear) >= 2028) {
    if (data[SUMMARY.LINE_2].jetFuel < data[SUMMARY.LINE_4].jetFuel) {
      // If Line 2 is less than Line 4, ensure Line 8 is available
      if (!jetFuelEditableCells.includes(SUMMARY.LINE_8)) {
        jetFuelEditableCells.push(SUMMARY.LINE_8)
      }
    } else {
      // If Line 2 meets or exceeds Line 4, remove Line 8 if it's there
      jetFuelEditableCells = jetFuelEditableCells.filter(
        (line) => line !== SUMMARY.LINE_8
      )
    }
  } else {
    // Before 2028, Line 8 is unavailable for Jet Fuel
    jetFuelEditableCells = jetFuelEditableCells.filter(
      (line) => line !== SUMMARY.LINE_8
    )
  }

  if (parseInt(compliancePeriodYear) === 2024) {
    // by default enable in editing mode for compliance period 2024, but respect locks for Lines 7 & 9
    if (!lines7And9Locked) {
      gasolineEditableCells = [...gasolineEditableCells, SUMMARY.LINE_7, SUMMARY.LINE_9]
      dieselEditableCells = [...dieselEditableCells, SUMMARY.LINE_7, SUMMARY.LINE_9]
    }
  } else if (parseInt(compliancePeriodYear) >= 2025) {
    // For 2025+ reports, only allow editing Lines 7 & 9 if not locked
    if (!lines7And9Locked) {
      gasolineEditableCells = [...gasolineEditableCells, SUMMARY.LINE_7, SUMMARY.LINE_9]
      dieselEditableCells = [...dieselEditableCells, SUMMARY.LINE_7, SUMMARY.LINE_9]
    }
  }
  if (parseInt(compliancePeriodYear) < 2029) {
    // The Jet Fuel cells for lines 7 and 9 should remain unavailable until 2029 (one year after the first renewable requirements come into effect for 2028).
    jetFuelEditableCells = []
  }

  return [
    {
      id: 'line',
      label: t('report:summaryLabels.line'),
      align: 'center',
      width: '100px',
      bold: true
    },
    {
      id: 'description',
      label: t('report:renewableFuelTargetSummary'),
      maxWidth: '300px'
    },
    {
      id: 'gasoline',
      label: t('report:fuelLabels.gasoline'),
      align: 'right',
      width: '150px',
      editable,
      editableCells: gasolineEditableCells,
      cellConstraints: {
        5: { min: 0, max: Math.round(0.05 * data[SUMMARY.LINE_4].gasoline) },
        6: { min: 0, max: Math.round(0.05 * data[SUMMARY.LINE_4].gasoline) },
        7: { min: 0, max: Math.round(0.05 * data[SUMMARY.LINE_4].gasoline) }
      }
    },
    {
      id: 'diesel',
      label: t('report:fuelLabels.diesel'),
      align: 'right',
      width: '150px',
      editable,
      editableCells: dieselEditableCells,
      cellConstraints: {
        5: { min: 0, max: Math.round(0.05 * data[SUMMARY.LINE_4].diesel) },
        6: { min: 0, max: Math.round(0.05 * data[SUMMARY.LINE_4].diesel) },
        7: { min: 0, max: Math.round(0.05 * data[SUMMARY.LINE_4].diesel) }
      }
    },
    {
      id: 'jetFuel',
      label: t('report:fuelLabels.jetFuel'),
      align: 'right',
      width: '150px',
      editable,
      editableCells: jetFuelEditableCells,
      cellConstraints: {
        5: { min: 0, max: Math.round(0.05 * data[SUMMARY.LINE_4].jetFuel) },
        6: { min: 0, max: Math.round(0.05 * data[SUMMARY.LINE_4].jetFuel) },
        7: { min: 0, max: Math.round(0.05 * data[SUMMARY.LINE_4].jetFuel) }
      }
    }
  ]
}

export const lowCarbonColumns = (t) => [
  {
    id: 'line',
    label: t('report:summaryLabels.line'),
    align: 'center',
    width: '100px',
    bold: true
  },
  {
    id: 'description',
    label: t('report:lowCarbonFuelTargetSummary'),
    maxWidth: '300px'
  },
  {
    id: 'value',
    label: t('report:summaryLabels.value'),
    align: 'center',
    width: '150px'
  }
]

export const nonComplianceColumns = (t, editable = false) => [
  {
    id: 'description',
    label: t('report:nonCompliancePenaltySummary'),
    maxWidth: '300px'
  },
  {
    id: 'totalValue',
    label: t('report:summaryLabels.totalValue'),
    align: 'center',
    width: '150px',
    editable: editable,
    editableCells: editable ? [0, 1] : []
  }
]

export const earlyIssuanceColumns = (t) => [
  {
    id: 'line',
    label: t('report:summaryLabels.line'),
    maxWidth: '150px',
    align: 'center'
  },
  {
    id: 'description',
    label: t('report:summaryLabels.earlyIssuanceSummary'),
    width: '300px'
  },
  {
    id: 'value',
    label: t('report:summaryLabels.value'),
    maxWidth: '150px',
    align: 'right'
  }
]

export const defaultSortModel = [
  { field: 'updateDate', direction: 'desc' }
]
