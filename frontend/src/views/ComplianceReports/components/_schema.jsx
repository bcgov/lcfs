import { BCColumnSetFilter } from '@/components/BCDataGrid/components'
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
    valueGetter: ({ data }) => data.status?.status || '',
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

export const renewableFuelColumns = [
  { id: 'line', label: 'Line', align: 'center', width: '100px', bold: true },
  { id: 'description', label: 'Renewable fuel target summary', maxWidth: '300px' },
  { id: 'gasoline', label: 'Gasoline', align: 'right', width: '150px' },
  { id: 'diesel', label: 'Diesel', align: 'right', width: '150px' },
  { id: 'jetFuel', label: 'Jet Fuel', align: 'right', width: '150px' },
]

export const lowCarbonColumns = [
  { id: 'line', label: 'Line', align: 'center', width: '100px', bold: true },
  { id: 'description', label: 'Low carbon fuel target summary', maxWidth: '300px' },
  { id: 'value', label: 'Value', align: 'center', width: '150px' },
]

export const nonComplianceColumns = [
  { id: 'line', label: 'Line', align: 'center', width: '100px', bold: true },
  { id: 'description', label: 'Non-compliance penalty payable summary', maxWidth: '300px' },
  { id: 'gasoline', label: 'Gasoline', align: 'right', width: '150px' },
  { id: 'diesel', label: 'Diesel', align: 'right', width: '150px' },
  { id: 'jetFuel', label: 'Jet Fuel', align: 'right', width: '150px' },
  { id: 'totalValue', label: 'Total Value', align: 'center', width: '150px' },
]