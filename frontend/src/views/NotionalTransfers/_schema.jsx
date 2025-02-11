import BCTypography from '@/components/BCTypography'
import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import { actions, validation } from '@/components/BCDataGrid/columns'
import i18n from '@/i18n'
import {
  AsyncSuggestionEditor,
  AutocompleteCellEditor,
  NumberEditor,
  RequiredHeader
} from '@/components/BCDataGrid/components'
import { formatNumberWithCommas as valueFormatter } from '@/utils/formatters'
import { apiRoutes } from '@/constants/routes'
import { StandardCellWarningAndErrors } from '@/utils/grid/errorRenderers'

export const notionalTransferColDefs = (
  optionsData,
  currentUser,
  errors,
  warnings
) => [
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
    field: 'notionalTransferId',
    hide: true
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
        const filteredData = response.data.filter(
          (org) => org.name !== currentUser.organization.name
        )
        params.node.data.apiDataCache = filteredData
        return filteredData
      },
      title: 'legalName',
      api: params.api
    }),
    cellRenderer: (params) =>
      params.value ||
      (!params.value && (
        <BCTypography variant="body4">Enter or search a name</BCTypography>
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
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings)
  },
  {
    field: 'addressForService',
    headerName: i18n.t(
      'notionalTransfer:notionalTransferColLabels.addressForService'
    ),
    headerComponent: RequiredHeader,
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings)
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
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <BCTypography variant="body4">Select</BCTypography>)
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
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <BCTypography variant="body4">Select</BCTypography>)
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
    valueFormatter: (params) => valueFormatter({ value: params.value }),
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings)
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
