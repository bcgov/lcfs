import {
  BCDateFloatingFilter,
  BCSelectFloatingFilter
} from '@/components/BCDataGrid/components'
import { SUMMARY } from '@/constants/common'
import { ReportsStatusRenderer } from '@/utils/grid/cellRenderers'
import { timezoneFormatter } from '@/utils/formatters'

export const reportsColDefs = (t, bceidRole) => [
  {
    field: 'compliancePeriod',
    headerName: t('report:reportColLabels.compliancePeriod'),
    width: 210,
    valueGetter: ({ data }) => data.compliancePeriod?.description || '',
    filterParams: {
      buttons: ['clear']
    }
  },
  {
    field: 'organization',
    headerName: t('report:reportColLabels.organization'),
    flex: 2,
    hide: bceidRole,
    valueGetter: ({ data }) => data.organization?.name || ''
  },
  {
    field: 'type',
    headerName: t('report:reportColLabels.type'),
    flex: 2,
    valueGetter: ({ data }) => {
      const typeLabel = t('report:complianceReport')
      const nickname = data.nickname ? ` - ${data.nickname}` : ''
      return `${typeLabel}${nickname}`
    },
    filter: 'agTextColumnFilter', // Enable text filtering
    filterParams: {
      textFormatter: (value) => value.replace(/\s+/g, '').toLowerCase(),
      textCustomComparator: (filter, value, filterText) => {
        const cleanFilterText = filterText.replace(/\s+/g, '').toLowerCase()
        const cleanValue = value.replace(/\s+/g, '').toLowerCase()
        return cleanValue.includes(cleanFilterText)
      },
      buttons: ['clear']
    }
  },
  {
    field: 'status',
    headerName: t('report:reportColLabels.status'),
    width: 300,
    valueGetter: ({ data }) => data.currentStatus?.status || '',
    cellRenderer: ReportsStatusRenderer,
    cellRendererParams: {
      url: ({ data }) =>
        `${data.compliancePeriod?.description}/${data.complianceReportId}`
    },
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      // TODO: change this to api Query later
      optionsQuery: () => ({
        data: bceidRole
          ? [
              { id: 1, name: 'Draft' },
              { id: 2, name: 'Submitted' },
              { id: 3, name: 'Assessed' },
              { id: 4, name: 'Reassessed' },
              { id: 7, name: 'Rejected' }
            ]
          : [
              { id: 2, name: 'Submitted' },
              { id: 5, name: 'Recommended by analyst' },
              { id: 6, name: 'Recommended by manager' },
              { id: 3, name: 'Assessed' },
              { id: 4, name: 'Reassessed' },
              { id: 7, name: 'Rejected' }
            ],
        isLoading: false
      }),
      valueKey: 'name',
      labelKey: 'name'
    },
    suppressFloatingFilterButton: true
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
  compliancePeriodYear
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
    // by default enable in editing mode for compliance period 2024
    gasolineEditableCells = [
      ...gasolineEditableCells,
      SUMMARY.LINE_7,
      SUMMARY.LINE_9
    ]
    dieselEditableCells = [
      ...dieselEditableCells,
      SUMMARY.LINE_7,
      SUMMARY.LINE_9
    ]
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

export const nonComplianceColumns = (t) => [
  {
    id: 'description',
    label: t('report:nonCompliancePenaltySummary'),
    maxWidth: '300px'
  },
  {
    id: 'totalValue',
    label: t('report:summaryLabels.totalValue'),
    align: 'center',
    width: '150px'
  }
]

export const defaultSortModel = [
  { field: 'compliancePeriod', direction: 'desc' }
]
