import { Typography } from '@mui/material'
import { suppressKeyboardEvent } from '@/utils/eventHandlers'
import { actions, validation } from '@/components/BCDataGrid/columns'
import i18n from '@/i18n'
import {
  AsyncSuggestionEditor,
  AutocompleteEditor,
  NumberEditor
} from '@/components/BCDataGrid/components'
import { formatNumberWithCommas as valueFormatter } from '@/utils/formatters'
import { apiRoutes } from '@/constants/routes'

const cellErrorStyle = (params, errors) => {
  let style = {}
  if (
    errors[params.data.id] &&
    errors[params.data.id].includes(params.colDef.field)
  ) {
    style = { ...style, borderColor: 'red' }
  } else {
    style = { ...style, borderColor: 'unset' }
  }
  if (
    params.colDef.editable ||
    (typeof params.colDef.editable === 'function' &&
      params.colDef.editable(params))
  ) {
    style = { ...style, backgroundColor: '#fff' }
  } else {
    style = {
      ...style,
      backgroundColor: '#f2f2f2',
      border: '0.5px solid #adb5bd'
    }
  }
  return style
}

export const notionalTransferColDefs = (optionsData, errors) => [
  validation,
  actions({
    enableDuplicate: true,
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
    field: 'legalName',
    headerName: i18n.t('notionalTransfer:notionalTransferColLabels.legalName'),
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
      api: params.api,
    }),
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Enter or search a name</Typography>),
    suppressKeyboardEvent,
    minWidth: 300,
    cellStyle: (params) => cellErrorStyle(params, errors),
    valueSetter: (params) => {
      const { newValue: selectedName, node, data } = params
      const apiData = node.data.apiDataCache || []
      // Attempt to find the selected company from the cached API data
      const selectedOption = apiData.find(company => company.name === selectedName)
      if (selectedOption) {
        // Only update related fields if a match is found in the API data
        data.legalName = selectedOption.name
        data.addressForService = selectedOption.address || data.addressForService
      } else {
        // If no match, only update the legalName field, leave others unchanged
        data.legalName = selectedName
      }
      return true
    },
  },
  {
    field: 'addressForService',
    headerName: i18n.t(
      'notionalTransfer:notionalTransferColLabels.addressForService'
    ),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellStyle: (params) => cellErrorStyle(params, errors)
  },
  {
    field: 'fuelCategory',
    headerName: i18n.t(
      'notionalTransfer:notionalTransferColLabels.fuelCategory'
    ),
    cellEditor: AutocompleteEditor,
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellEditorParams: {
      options: optionsData?.fuelCategories?.map((obj) => obj.category),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    cellStyle: (params) => cellErrorStyle(params, errors),
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>)
  },
  {
    field: 'receivedOrTransferred',
    headerName: i18n.t(
      'notionalTransfer:notionalTransferColLabels.receivedOrTransferred'
    ),
    cellEditor: AutocompleteEditor,
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellEditorParams: {
      options: optionsData?.receivedOrTransferred || [],
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    cellStyle: (params) => cellErrorStyle(params, errors),
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>)
  },
  {
    field: 'quantity',
    headerName: i18n.t('notionalTransfer:notionalTransferColLabels.quantity'),
    cellEditor: NumberEditor,
    cellEditorParams: {
      precision: 0,
      min: 0,
      showStepperButtons: false
    },
    valueFormatter,
    cellStyle: (params) => cellErrorStyle(params, errors)
  }
]

export const defaultColDef = {
  editable: true,
  resizable: true,
  filter: true,
  floatingFilter: false,
  sortable: false,
  singleClickEdit: true
}
