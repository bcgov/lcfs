import { BCColumnSetFilter } from '@/components/BCDataGrid/components'
import { ReportsStatusRenderer, LinkRenderer } from '@/utils/cellRenderers'
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
