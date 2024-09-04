/* eslint-disable chai-friendly/no-unused-expressions */
import { BCColumnSetFilter } from '@/components/BCDataGrid/components'
import { SUMMARY } from '@/constants/common'
import { ReportsStatusRenderer } from '@/utils/cellRenderers'
import { timezoneFormatter } from '@/utils/formatters'

export const reportsColDefs = (t, bceidRole) => [
  {
    field: 'compliancePeriod',
    headerName: t('report:reportColLabels.compliancePeriod'),
    width: 210,
    valueGetter: ({ data }) => data.compliancePeriod?.description || '',
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
    valueGetter: ({ data }) => data.type?.description || '',
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
    valueFormatter: timezoneFormatter,
  }
]

export const renewableFuelColumns = (data, editable) => {
  // Line 6 & 7: only visible if cells G2, D2, and J2 do not show a balance of zero and there is a surplus above the renewable requirement.
  // Line 8 & 9: When I am short of my renewable obligation and in a penalty situation, 
  //         then the free text fields in cells G8, D8, and J8 are available for input and I see the fields only if there is a deficiency.
  let gasolineEditableCells = []
  if (data[SUMMARY.LINE_2].gasoline > 0 && data[SUMMARY.LINE_2].gasoline - data[SUMMARY.LINE_4].gasoline > 0) 
    gasolineEditableCells = [SUMMARY.LINE_6, SUMMARY.LINE_7]
  else if (data[SUMMARY.LINE_1].gasoline > 0 && data[SUMMARY.LINE_2].gasoline - data[SUMMARY.LINE_4].gasoline > 0)
    gasolineEditableCells = [SUMMARY.LINE_8, SUMMARY.LINE_9]
  let dieselEditableCells = []
  if (data[SUMMARY.LINE_2].diesel > 0 && data[SUMMARY.LINE_2].diesel - data[SUMMARY.LINE_4].diesel > 0) 
    dieselEditableCells = [SUMMARY.LINE_6, SUMMARY.LINE_7]
  else if (data[SUMMARY.LINE_1].diesel > 0 && data[SUMMARY.LINE_2].diesel - data[SUMMARY.LINE_4].diesel > 0)
    dieselEditableCells = [SUMMARY.LINE_8, SUMMARY.LINE_9]
  let jetFuelEditableCells = []
  if (data[SUMMARY.LINE_2].jetFuel > 0 && data[SUMMARY.LINE_2].jetFuel - data[SUMMARY.LINE_4].jetFuel > 0) 
    jetFuelEditableCells = [SUMMARY.LINE_6, SUMMARY.LINE_7]
  else if (data[SUMMARY.LINE_1].jetFuel > 0 && data[SUMMARY.LINE_2].jetFuel - data[SUMMARY.LINE_4].jetFuel > 0)
    jetFuelEditableCells = [SUMMARY.LINE_8, SUMMARY.LINE_9]

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
  ]}

export const lowCarbonColumns = [
  { id: 'line', label: 'Line', align: 'center', width: '100px', bold: true },
  { id: 'description', label: 'Low carbon fuel target summary', maxWidth: '300px' },
  { id: 'value', label: 'Value', align: 'center', width: '150px' },
]

export const nonComplianceColumns = [
  { id: 'description', label: 'Non-compliance penalty payable summary', maxWidth: '300px' },
  { id: 'totalValue', label: 'Total Value', align: 'center', width: '150px' },
]

export const defaultSortModel = [{ field: 'compliancePeriod', direction: 'desc' }]
