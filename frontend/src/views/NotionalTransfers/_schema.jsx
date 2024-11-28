import { Typography } from '@mui/material'
import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import { actions, validation } from '@/components/BCDataGrid/columns'
import i18n from '@/i18n'
import {
  AsyncSuggestionEditor,
  AutocompleteCellEditor,
  RequiredHeader,
  NumberEditor
} from '@/components/BCDataGrid/components'
import { formatNumberWithCommas as valueFormatter } from '@/utils/formatters'
import { apiRoutes } from '@/constants/routes'
import { StandardCellErrors } from '@/utils/grid/errorRenderers'

export const notionalTransferColDefs = (optionsData, errors) => [
  validation,
  actions({
    enableDuplicate: false,
    enableDelete: true
  }),
  {
    field: 'id',
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    hide: true
  },
  {
    field: 'complianceReportId',
    headerName: i18n.t(
      'notionalTransfer:notionalTransferColLabels.complianceReportId'
    ),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    hide: true
  },
  {
    // This column displays the action type (CREATE, UPDATE, DELETE)
    field: 'actionType',
    headerName: i18n.t('notionalTransfer:notionalTransferColLabels.actionType'),
    minWidth: 125,
    maxWidth: 150,
    editable: false,
    cellStyle: (params) => {
      switch (params.data.actionType) {
        case 'CREATE':
          return {
            backgroundColor: '#e0f7df',
            color: '#388e3c',
            fontWeight: 'bold'
          }
        case 'UPDATE':
          return {
            backgroundColor: '#fff8e1',
            color: '#f57c00',
            fontWeight: 'bold'
          }
        case 'DELETE':
          return {
            backgroundColor: '#ffebee',
            color: '#d32f2f',
            fontWeight: 'bold'
          }
        default:
          return {}
      }
    },
    cellRenderer: (params) => {
      switch (params.data.actionType) {
        case 'CREATE':
          return 'Create'
        case 'UPDATE':
          return 'Edit'
        case 'DELETE':
          return 'Deleted'
        default:
          return ''
      }
    },
    tooltipValueGetter: (params) => {
      const actionMap = {
        CREATE: 'This record was created.',
        UPDATE: 'This record has been edited.',
        DELETE: 'This record was deleted.'
      }
      return actionMap[params.data.actionType] || ''
    }
  },
  {
    field: 'legalName',
    headerName: i18n.t('notionalTransfer:notionalTransferColLabels.legalName'),
    headerComponent: RequiredHeader,
    cellDataType: 'text',
    cellEditor: AsyncSuggestionEditor,
    cellEditorParams: (params) => ({
      queryKey: 'company-details-search',
      queryFn: async ({ queryKey, client }) => {
        let path = apiRoutes.organizationSearch
        path += 'org_name=' + queryKey[1]
        const response = await client.get(path)
        params.node.data.apiDataCache = response.data
        return response.data
      },
      title: 'legalName',
      api: params.api
    }),
    cellRenderer: (params) =>
      params.value ||
      (!params.value && (
        <Typography variant="body4">Enter or search a name</Typography>
      )),
    suppressKeyboardEvent,
    minWidth: 300,
    valueSetter: (params) => {
      const { newValue: selectedName, node, data } = params
      const apiData = node.data.apiDataCache || []
      // Attempt to find the selected company from the cached API data
      const selectedOption = apiData.find(
        (company) => company.name === selectedName
      )
      if (selectedOption) {
        // Only update related fields if a match is found in the API data
        data.legalName = selectedOption.name
        data.addressForService =
          selectedOption.address || data.addressForService
      } else {
        // If no match, only update the legalName field, leave others unchanged
        data.legalName = selectedName
      }
      return true
    },
    cellStyle: (params) => StandardCellErrors(params, errors)
  },
  {
    field: 'addressForService',
    headerName: i18n.t(
      'notionalTransfer:notionalTransferColLabels.addressForService'
    ),
    headerComponent: RequiredHeader,
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellStyle: (params) => StandardCellErrors(params, errors)
  },
  {
    field: 'fuelCategory',
    headerName: i18n.t(
      'notionalTransfer:notionalTransferColLabels.fuelCategory'
    ),
    headerComponent: RequiredHeader,
    cellEditor: AutocompleteCellEditor,
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellEditorParams: {
      options: optionsData?.fuelCategories?.map((obj) => obj.category),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    cellStyle: (params) => StandardCellErrors(params, errors),
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>)
  },
  {
    field: 'receivedOrTransferred',
    headerName: i18n.t(
      'notionalTransfer:notionalTransferColLabels.receivedOrTransferred'
    ),
    headerComponent: RequiredHeader,
    cellEditor: AutocompleteCellEditor,
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellEditorParams: {
      options: optionsData?.receivedOrTransferred || [],
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    cellStyle: (params) => StandardCellErrors(params, errors),
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>)
  },
  {
    field: 'quantity',
    headerName: i18n.t('notionalTransfer:notionalTransferColLabels.quantity'),
    headerComponent: RequiredHeader,
    cellEditor: NumberEditor,
    cellEditorParams: {
      precision: 0,
      min: 0,
      showStepperButtons: false
    },
    valueFormatter,
    cellStyle: (params) => StandardCellErrors(params, errors)
  }
]

export const defaultColDef = {
  editable: true,
  resizable: true,
  filter: false,
  floatingFilter: false,
  sortable: false,
  singleClickEdit: true,
  flex: 1
}
