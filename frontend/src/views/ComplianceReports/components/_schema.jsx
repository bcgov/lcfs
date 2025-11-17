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
import {
  useGetComplianceReportStatuses,
  useGetAvailableAnalysts
} from '@/hooks/useComplianceReports'
import { AssignedAnalystCell } from './AssignedAnalystCell'

export const reportsColDefs = (t, isSupplier, onRefresh) => [
  {
    field: 'status',
    headerName: t('report:reportColLabels.status'),
    minWidth: 220,
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
    minWidth: 180,
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
    minWidth: 160,
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
    minWidth: 190,
    valueGetter: ({ data }) => data.compliancePeriod || '',
    filterParams: {
      buttons: ['clear']
    }
  },
  {
    field: 'organization',
    headerName: t('report:reportColLabels.organization'),
    minWidth: 250,
    hide: isSupplier,
    valueGetter: ({ data }) => data.organizationName || ''
  },
  {
    field: 'type',
    headerName: t('report:reportColLabels.type'),
    minWidth: 300,
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
    minWidth: 225,
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

  const safeRound = (value = 0) => Math.round(value || 0)

  const toRoundedOrUndefined = (value) => {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) {
      return undefined
    }
    return Math.round(numericValue)
  }

  const buildLineSevenConstraint = (maxValue, currentValue) => {
    const constraint = { min: 0 }
    const roundedMax = toRoundedOrUndefined(maxValue)
    const roundedCurrent = toRoundedOrUndefined(currentValue) ?? 0

    if (roundedMax !== undefined && roundedMax > 0) {
      constraint.max = Math.max(roundedMax, roundedCurrent)
    }

    return constraint
  }

  const line7Constraints = {
    gasoline: buildLineSevenConstraint(
      data[SUMMARY.LINE_7]?.maxGasoline,
      data[SUMMARY.LINE_7]?.gasoline
    ),
    diesel: buildLineSevenConstraint(
      data[SUMMARY.LINE_7]?.maxDiesel,
      data[SUMMARY.LINE_7]?.diesel
    ),
    jetFuel: buildLineSevenConstraint(
      data[SUMMARY.LINE_7]?.maxJetFuel,
      data[SUMMARY.LINE_7]?.jetFuel
    )
  }

  const line9Constraints = {
    gasoline: buildLineSevenConstraint(
      data[SUMMARY.LINE_9]?.maxGasoline,
      data[SUMMARY.LINE_9]?.gasoline
    ),
    diesel: buildLineSevenConstraint(
      data[SUMMARY.LINE_9]?.maxDiesel,
      data[SUMMARY.LINE_9]?.diesel
    ),
    jetFuel: buildLineSevenConstraint(
      data[SUMMARY.LINE_9]?.maxJetFuel,
      data[SUMMARY.LINE_9]?.jetFuel
    )
  }

  const unlockedLineSevenConstraint = (constraint) =>
    lines7And9Locked ? constraint ?? { min: 0 } : { min: 0 }

  const unlockedLineNineConstraint = (constraint) =>
    lines7And9Locked ? constraint ?? { min: 0 } : { min: 0 }

  // Line 6 (Retention) caps - LCFA s.10(2): Lesser of excess and 5% of Line 4
  const line6Caps = {
    gasoline: safeRound(
      Math.min(
        Math.max(0, (data[SUMMARY.LINE_2]?.gasoline || 0) - (data[SUMMARY.LINE_4]?.gasoline || 0)), // excess
        0.05 * (data[SUMMARY.LINE_4]?.gasoline || 0) // prescribed portion
      )
    ),
    diesel: safeRound(
      Math.min(
        Math.max(0, (data[SUMMARY.LINE_2]?.diesel || 0) - (data[SUMMARY.LINE_4]?.diesel || 0)),
        0.05 * (data[SUMMARY.LINE_4]?.diesel || 0)
      )
    ),
    jetFuel: safeRound(
      Math.min(
        Math.max(0, (data[SUMMARY.LINE_2]?.jetFuel || 0) - (data[SUMMARY.LINE_4]?.jetFuel || 0)),
        0.05 * (data[SUMMARY.LINE_4]?.jetFuel || 0)
      )
    )
  }

  // Line 8 (Deferral) caps - LCFA s.10(3): Lesser of deficiency and 5% of Line 4
  const line8Caps = {
    gasoline: safeRound(
      Math.min(
        Math.max(0, (data[SUMMARY.LINE_4]?.gasoline || 0) - (data[SUMMARY.LINE_2]?.gasoline || 0)), // deficiency
        0.05 * (data[SUMMARY.LINE_4]?.gasoline || 0) // prescribed portion
      )
    ),
    diesel: safeRound(
      Math.min(
        Math.max(0, (data[SUMMARY.LINE_4]?.diesel || 0) - (data[SUMMARY.LINE_2]?.diesel || 0)),
        0.05 * (data[SUMMARY.LINE_4]?.diesel || 0)
      )
    ),
    jetFuel: safeRound(
      Math.min(
        Math.max(0, (data[SUMMARY.LINE_4]?.jetFuel || 0) - (data[SUMMARY.LINE_2]?.jetFuel || 0)),
        0.05 * (data[SUMMARY.LINE_4]?.jetFuel || 0)
      )
    )
  }

  // ========= Gasoline Logic ============
  // Line 6 is editable when there is a surplus (Line 2 > Line 4)
  // Line 8 is editable when there is a deficiency (Line 2 < Line 4)
  // Only one should be editable at a time
  if (data[SUMMARY.LINE_2].gasoline > data[SUMMARY.LINE_4].gasoline) {
    // Surplus: Line 6 editable, Line 8 not editable
    gasolineEditableCells = [SUMMARY.LINE_6]
  } else if (data[SUMMARY.LINE_2].gasoline < data[SUMMARY.LINE_4].gasoline) {
    // Deficiency: Line 8 editable, Line 6 not editable
    gasolineEditableCells = [SUMMARY.LINE_8]
  }

  // ============ Diesel Logic ============
  // Line 6 is editable when there is a surplus (Line 2 > Line 4)
  // Line 8 is editable when there is a deficiency (Line 2 < Line 4)
  // Only one should be editable at a time
  if (data[SUMMARY.LINE_2].diesel > data[SUMMARY.LINE_4].diesel) {
    // Surplus: Line 6 editable, Line 8 not editable
    dieselEditableCells = [SUMMARY.LINE_6]
  } else if (data[SUMMARY.LINE_2].diesel < data[SUMMARY.LINE_4].diesel) {
    // Deficiency: Line 8 editable, Line 6 not editable
    dieselEditableCells = [SUMMARY.LINE_8]
  }

  // ============ Jet Fuel Logic ============
  // Line 6 is editable when there is a surplus (Line 2 > Line 4)
  // Line 8 is editable when there is a deficiency (Line 2 < Line 4)
  // Only one should be editable at a time
  // Line 8 is only available for Jet Fuel from 2028 onward
  if (data[SUMMARY.LINE_2].jetFuel > data[SUMMARY.LINE_4].jetFuel) {
    // Surplus: Line 6 editable, Line 8 not editable
    jetFuelEditableCells = [SUMMARY.LINE_6]
  } else if (
    data[SUMMARY.LINE_2].jetFuel < data[SUMMARY.LINE_4].jetFuel &&
    parseInt(compliancePeriodYear) >= 2028
  ) {
    // Deficiency: Line 8 editable (only from 2028 onward), Line 6 not editable
    jetFuelEditableCells = [SUMMARY.LINE_8]
  }

  if (parseInt(compliancePeriodYear) === 2024) {
    // by default enable in editing mode for compliance period 2024, but respect locks for Lines 7 & 9
    if (!lines7And9Locked) {
      // Line 7 should only be editable if there are NO previous year values
      // Line 7 represents "Volume of eligible renewable fuel previously retained (from Line 6 of previous compliance period)"
      const hasGasolinePreviousRetained = data[SUMMARY.LINE_7]?.gasoline > 0
      const hasDieselPreviousRetained = data[SUMMARY.LINE_7]?.diesel > 0

      if (!hasGasolinePreviousRetained) {
        gasolineEditableCells = [...gasolineEditableCells, SUMMARY.LINE_7]
      }
      if (!hasDieselPreviousRetained) {
        dieselEditableCells = [...dieselEditableCells, SUMMARY.LINE_7]
      }
      // Line 9 can always be editable when not locked
      gasolineEditableCells = [...gasolineEditableCells, SUMMARY.LINE_9]
      dieselEditableCells = [...dieselEditableCells, SUMMARY.LINE_9]
    }
  } else if (parseInt(compliancePeriodYear) >= 2025) {
    // For 2025+ reports, only allow editing Lines 7 & 9 if not locked
    if (!lines7And9Locked) {
      // Line 7 should only be editable if there are NO previous year values
      const hasGasolinePreviousRetained = data[SUMMARY.LINE_7]?.gasoline > 0
      const hasDieselPreviousRetained = data[SUMMARY.LINE_7]?.diesel > 0

      if (!hasGasolinePreviousRetained) {
        gasolineEditableCells = [...gasolineEditableCells, SUMMARY.LINE_7]
      }
      if (!hasDieselPreviousRetained) {
        dieselEditableCells = [...dieselEditableCells, SUMMARY.LINE_7]
      }
      // Line 9 can always be editable when not locked
      gasolineEditableCells = [...gasolineEditableCells, SUMMARY.LINE_9]
      dieselEditableCells = [...dieselEditableCells, SUMMARY.LINE_9]
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
        [SUMMARY.LINE_6]: { min: 0, max: line6Caps.gasoline },
        [SUMMARY.LINE_7]: unlockedLineSevenConstraint(line7Constraints.gasoline),
        [SUMMARY.LINE_8]: { min: 0, max: line8Caps.gasoline },
        [SUMMARY.LINE_9]: unlockedLineNineConstraint(line9Constraints.gasoline)
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
        [SUMMARY.LINE_6]: { min: 0, max: line6Caps.diesel },
        [SUMMARY.LINE_7]: unlockedLineSevenConstraint(line7Constraints.diesel),
        [SUMMARY.LINE_8]: { min: 0, max: line8Caps.diesel },
        [SUMMARY.LINE_9]: unlockedLineNineConstraint(line9Constraints.diesel)
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
        [SUMMARY.LINE_6]: { min: 0, max: line6Caps.jetFuel },
        [SUMMARY.LINE_7]: unlockedLineSevenConstraint(line7Constraints.jetFuel),
        [SUMMARY.LINE_8]: { min: 0, max: line8Caps.jetFuel },
        [SUMMARY.LINE_9]: unlockedLineNineConstraint(line9Constraints.jetFuel)
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

export const defaultSortModel = [{ field: 'updateDate', direction: 'desc' }]
