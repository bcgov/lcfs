/* eslint-disable chai-friendly/no-unused-expressions */
import { BCColumnSetFilter } from '@/components/BCDataGrid/components'
import { SUMMARY } from '@/constants/common'
import { ReportsStatusRenderer } from '@/utils/grid/cellRenderers'
import { timezoneFormatter } from '@/utils/formatters'

export const reportsColDefs = (t, bceidRole) => [
  {
    field: 'compliancePeriod',
    headerName: t('report:reportColLabels.compliancePeriod'),
    width: 210,
    valueGetter: ({ data }) => data.compliancePeriod?.description || ''
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
    valueGetter: ({ data }) => data.type?.description || ''
  },
  {
    field: 'status',
    headerName: t('report:reportColLabels.status'),
    maxWidth: 300,
    valueGetter: ({ data }) => data.currentStatus?.status || '',
    cellRenderer: ReportsStatusRenderer,
    floatingFilterComponent: BCColumnSetFilter,
    suppressFloatingFilterButton: true,
    floatingFilterComponentParams: {
      // TODO: change this to api Query later
      apiQuery: () => ({
        data: bceidRole
          ? [
              { id: 1, name: 'Draft' },
              { id: 2, name: 'Submitted' },
              { id: 3, name: 'Assessed' },
              { id: 4, name: 'Reassessed' }
            ]
          : [
              { id: 2, name: 'Submitted' },
              { id: 5, name: 'Recommended by analyst' },
              { id: 6, name: 'Recommended by manager' },
              { id: 3, name: 'Assessed' },
              { id: 4, name: 'Reassessed' }
            ],
        isLoading: false
      }),
      key: 'report-status',
      label: t('report:reportColLabels.status'),
      disableCloseOnSelect: false,
      multiple: false
    }
  },
  {
    field: 'updateDate',
    cellDataType: 'dateString',
    headerName: t('report:reportColLabels.lastUpdated'),
    flex: 1,
    valueGetter: ({ data }) => data.updateDate || '',
    valueFormatter: timezoneFormatter
  }
]

export const renewableFuelColumns = (data, editable, compliancePeriodYear) => {
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
    gasolineEditableCells = [SUMMARY.LINE_6, SUMMARY.LINE_7]
  else if (
    data[SUMMARY.LINE_1].gasoline > 0 &&
    data[SUMMARY.LINE_2].gasoline - data[SUMMARY.LINE_4].gasoline > 0
  )
    gasolineEditableCells = [SUMMARY.LINE_8, SUMMARY.LINE_9]

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
    dieselEditableCells = [SUMMARY.LINE_6, SUMMARY.LINE_7]
  else if (
    data[SUMMARY.LINE_1].diesel > 0 &&
    data[SUMMARY.LINE_2].diesel - data[SUMMARY.LINE_4].diesel > 0
  )
    dieselEditableCells = [SUMMARY.LINE_8, SUMMARY.LINE_9]
  
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
    jetFuelEditableCells = [SUMMARY.LINE_6, SUMMARY.LINE_7]
  else if (
    data[SUMMARY.LINE_1].jetFuel > 0 &&
    data[SUMMARY.LINE_2].jetFuel - data[SUMMARY.LINE_4].jetFuel > 0
  )
    jetFuelEditableCells = [SUMMARY.LINE_8, SUMMARY.LINE_9]
  

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
    gasolineEditableCells = [...gasolineEditableCells, SUMMARY.LINE_7, SUMMARY.LINE_9]
    dieselEditableCells = [...dieselEditableCells, SUMMARY.LINE_7, SUMMARY.LINE_9]
  }
  if (parseInt(compliancePeriodYear) < 2029) {
    // The Jet Fuel cells for lines 7 and 9 should remain unavailable until 2029 (one year after the first renewable requirements come into effect for 2028).
    jetFuelEditableCells = []
  }

  return [
    { id: 'line', label: 'Line', align: 'center', width: '100px', bold: true },
    {
      id: 'description',
      label: 'Renewable fuel target summary',
      maxWidth: '300px'
    },
    {
      id: 'gasoline',
      label: 'Gasoline',
      align: 'right',
      width: '150px',
      editable,
      editableCells: gasolineEditableCells,
      cellConstraints: {
        5: { min: 0, max: 0.05 * data[SUMMARY.LINE_4].gasoline },
        7: { min: 0, max: 0.05 * data[SUMMARY.LINE_4].gasoline }
      }
    },
    {
      id: 'diesel',
      label: 'Diesel',
      align: 'right',
      width: '150px',
      editable,
      editableCells: dieselEditableCells,
      cellConstraints: {
        5: { min: 0, max: 0.05 * data[SUMMARY.LINE_4].diesel },
        7: { min: 0, max: 0.05 * data[SUMMARY.LINE_4].diesel }
      }
    },
    {
      id: 'jetFuel',
      label: 'Jet fuel',
      align: 'right',
      width: '150px',
      editable,
      editableCells: jetFuelEditableCells,
      cellConstraints: {
        5: { min: 0, max: 0.05 * data[SUMMARY.LINE_4].jetFuel },
        7: { min: 0, max: 0.05 * data[SUMMARY.LINE_4].jetFuel }
      }
    }
  ]
}

export const lowCarbonColumns = [
  { id: 'line', label: 'Line', align: 'center', width: '100px', bold: true },
  {
    id: 'description',
    label: 'Low carbon fuel target summary',
    maxWidth: '300px'
  },
  { id: 'value', label: 'Value', align: 'center', width: '150px' }
]

export const nonComplianceColumns = [
  {
    id: 'description',
    label: 'Non-compliance penalty payable summary',
    maxWidth: '300px'
  },
  { id: 'totalValue', label: 'Total Value', align: 'center', width: '150px' }
]

export const defaultSortModel = [
  { field: 'compliancePeriod', direction: 'desc' }
]
