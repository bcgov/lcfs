import type {
  ColDef,
  ICellEditorParams,
  ICellRendererParams,
  RowClassParams
} from 'ag-grid-community'
import type { GridErrors, GridWarnings, OptionsData } from '@/types/schema'
import { actions, validation } from '@/components/BCDataGrid/columns'
import { AsyncSuggestionEditor } from '@/components/BCDataGrid/components/Editors/AsyncSuggestionEditor'
import type { AsyncSuggestionEditorProps } from '@/components/BCDataGrid/components/Editors/AsyncSuggestionEditor'
import { AutocompleteCellEditor } from '@/components/BCDataGrid/components/Editors/AutocompleteCellEditor'
import { NumberEditor } from '@/components/BCDataGrid/components/Editors/NumberEditor'
import { RequiredHeader } from '@/components/BCDataGrid/components/Renderers/RequiredHeader'
import BCTypography from '@/components/BCTypography'
import { apiRoutes } from '@/constants/routes'
import { ACTION_STATUS_MAP } from '@/constants/schemaConstants'
import i18n from '@/i18n'
import colors from '@/themes/base/colors'
import { formatNumberWithCommas as valueFormatter } from '@/utils/formatters'
import { SelectRenderer } from '@/utils/grid/cellRenderers'
import { changelogCellStyle } from '@/utils/grid/changelogCellStyle'
import { StandardCellWarningAndErrors } from '@/utils/grid/errorRenderers'
import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import { isQuarterEditable } from '@/utils/grid/cellEditables'
import { NEW_REGULATION_YEAR } from '@/constants/common'
import { isNotionalTransferRenewableClaimEditable } from '@/utils/renewableClaimUtils'

const numberCellFormatter = (params: {
  value: string | number | null | undefined
}) => String(valueFormatter(params))

export const notionalTransferColDefs = (
  optionsData: OptionsData,
  orgName: string,
  errors: GridErrors,
  warnings: GridWarnings,
  isSupplemental: boolean,
  compliancePeriod: string | number,
  isEarlyIssuance: boolean = false
): ColDef[] => {
  const baseColumns: ColDef[] = [
    validation,
    actions(
      (params: {
        data: {
          isNewSupplementalEntry?: boolean
          actionType?: keyof typeof ACTION_STATUS_MAP
        }
      }) => {
        return {
          enableDuplicate: false,
          enableDelete: !params.data.isNewSupplementalEntry,
          enableUndo: isSupplemental && params.data.isNewSupplementalEntry,
          enableStatus:
            isSupplemental &&
            params.data.isNewSupplementalEntry &&
            params.data.actionType
              ? ACTION_STATUS_MAP[params.data.actionType]
              : false
        }
      }
    ),
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
      headerName: i18n.t(
        'notionalTransfer:notionalTransferColLabels.legalName'
      ),
      headerComponent: RequiredHeader,
      cellDataType: 'object',
      cellEditor: AsyncSuggestionEditor,
      cellEditorParams: (params: ICellEditorParams) => ({
        queryKey: 'company-details-search',
        queryFn: async ({
          queryKey,
          client
        }: Parameters<AsyncSuggestionEditorProps['queryFn']>[0]) => {
          let path = apiRoutes.organizationSearch
          path += 'org_name=' + String(queryKey[1] ?? '')
          const response = await client.get(path)
          const filteredData = response.data.filter(
            (org: { name?: string }) => org.name !== orgName
          )
          params.node.data.apiDataCache = filteredData
          return filteredData
        },
        title: 'legalName',
        api: params.api
      }),
      cellRenderer: (params: ICellRendererParams) =>
        params.value ||
        (!params.value && (
          <BCTypography variant="body4">Enter or search a name</BCTypography>
        )),
      suppressKeyboardEvent,
      minWidth: 320,
      valueSetter: (params) => {
        const { newValue: selectedName, data } = params
        if (typeof selectedName === 'object') {
          // If selectedName is an object, set the legalName directly
          data.legalName = selectedName.name
          data.addressForService = selectedName.address
        } else {
          // If no match, only update the legalName field, leave others unchanged
          data.legalName = selectedName
        }
        return true
      },
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental)
    },
    {
      field: 'addressForService',
      headerName: i18n.t(
        'notionalTransfer:notionalTransferColLabels.addressForService'
      ),
      minWidth: 280,
      headerComponent: RequiredHeader,
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental)
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
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),
      cellRenderer: SelectRenderer,
      valueSetter: (params) => {
        if (params.newValue) {
          params.data.fuelCategory = params.newValue
        }
        return true
      },
      minWidth: 160
    },
    {
      field: 'isCanadaProduced',
      headerComponent: RequiredHeader,
      headerName: i18n.t(
        'notionalTransfer:notionalTransferColLabels.isCanadaProduced'
      ),
      cellEditor: AutocompleteCellEditor,
      cellRenderer: SelectRenderer,
      cellEditorParams: {
        options: ['Yes', 'No'],
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true
      },
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),
      editable: (params) =>
        isNotionalTransferRenewableClaimEditable(params.data, compliancePeriod),
      valueGetter: (params) =>
        !isNotionalTransferRenewableClaimEditable(params.data, compliancePeriod)
          ? ''
          : params.data.isCanadaProduced
            ? 'Yes'
            : 'No',
      valueSetter: (params) => {
        if (params.newValue) {
          params.data.isCanadaProduced = params.newValue === 'Yes'
          if (params.data.isCanadaProduced) {
            params.data.isQ1Supplied = false
          }
        }
        return true
      },
      hide: true,
      minWidth: 250
    },
    {
      field: 'isQ1Supplied',
      headerComponent: RequiredHeader,
      headerName: i18n.t(
        'notionalTransfer:notionalTransferColLabels.isQ1Supplied'
      ),
      cellEditor: AutocompleteCellEditor,
      cellRenderer: SelectRenderer,
      cellEditorParams: {
        options: ['Yes', 'No'],
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true
      },
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),
      editable: (params) =>
        isNotionalTransferRenewableClaimEditable(params.data, compliancePeriod),
      valueGetter: (params) =>
        !isNotionalTransferRenewableClaimEditable(params.data, compliancePeriod)
          ? ''
          : params.data.isQ1Supplied
            ? 'Yes'
            : 'No',
      valueSetter: (params) => {
        if (params.newValue) {
          params.data.isQ1Supplied = params.newValue === 'Yes'
        }
        return true
      },
      minWidth: 170,
      hide: true
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
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),
      cellRenderer: SelectRenderer,
      minWidth: 250
    },
    {
      field: 'quantity',
      headerName: i18n.t('notionalTransfer:notionalTransferColLabels.quantity'),
      headerComponent: RequiredHeader,
      cellEditor: NumberEditor,
      minWidth: 180,
      cellEditorParams: {
        precision: 0,
        min: 0,
        showStepperButtons: false
      },
      valueFormatter: numberCellFormatter,
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental)
    }
  ]

  // Swap in Quarterly Columns if it's an early issuance report
  if (isEarlyIssuance) {
    return baseColumns.flatMap((item) => {
      if (item.field === 'quantity') {
        return [
          {
            field: 'q1Quantity',
            headerComponent: RequiredHeader,
            headerName: i18n.t(
              'notionalTransfer:notionalTransferColLabels.q1Quantity'
            ),
            valueFormatter: numberCellFormatter,
            cellEditor: NumberEditor,
            cellEditorParams: {
              precision: 0,
              min: 0,
              showStepperButtons: false
            },
            cellStyle: (params) =>
              StandardCellWarningAndErrors(
                params,
                errors,
                warnings,
                isSupplemental
              ),
            editable: () => {
              return isQuarterEditable(1, compliancePeriod)
            },
            minWidth: 130
          },
          {
            field: 'q2Quantity',
            headerComponent: RequiredHeader,
            headerName: i18n.t(
              'notionalTransfer:notionalTransferColLabels.q2Quantity'
            ),
            valueFormatter: numberCellFormatter,
            cellEditor: NumberEditor,
            cellEditorParams: {
              precision: 0,
              min: 0,
              showStepperButtons: false
            },
            cellStyle: (params) =>
              StandardCellWarningAndErrors(
                params,
                errors,
                warnings,
                isSupplemental
              ),
            editable: () => {
              return isQuarterEditable(2, compliancePeriod)
            },
            minWidth: 130
          },
          {
            field: 'q3Quantity',
            headerComponent: RequiredHeader,
            headerName: i18n.t(
              'notionalTransfer:notionalTransferColLabels.q3Quantity'
            ),
            valueFormatter: numberCellFormatter,
            cellEditor: NumberEditor,
            cellEditorParams: {
              precision: 0,
              min: 0,
              showStepperButtons: false
            },
            cellStyle: (params) =>
              StandardCellWarningAndErrors(
                params,
                errors,
                warnings,
                isSupplemental
              ),
            editable: () => {
              return isQuarterEditable(3, compliancePeriod)
            },
            minWidth: 130
          },
          {
            field: 'q4Quantity',
            headerComponent: RequiredHeader,
            headerName: i18n.t(
              'notionalTransfer:notionalTransferColLabels.q4Quantity'
            ),
            valueFormatter: numberCellFormatter,
            cellEditor: NumberEditor,
            cellEditorParams: {
              precision: 0,
              min: 0,
              showStepperButtons: false
            },
            cellStyle: (params) =>
              StandardCellWarningAndErrors(
                params,
                errors,
                warnings,
                isSupplemental
              ),
            editable: () => {
              return isQuarterEditable(4, compliancePeriod)
            },
            minWidth: 130
          },
          {
            field: 'totalQuantity',
            headerName: i18n.t(
              'notionalTransfer:notionalTransferColLabels.totalQuantity'
            ),
            valueFormatter: numberCellFormatter,
            cellStyle: (params) =>
              StandardCellWarningAndErrors(
                params,
                errors,
                warnings,
                isSupplemental
              ),
            valueGetter: (params) => {
              const data = params.data
              return (
                (data.q1Quantity || 0) +
                (data.q2Quantity || 0) +
                (data.q3Quantity || 0) +
                (data.q4Quantity || 0)
              )
            },
            editable: false,
            minWidth: 150
          }
        ]
      }

      return [item]
    })
  }

  return baseColumns
}

export const notionalTransferSummaryColDefs = (
  isEarlyIssuance: boolean = false,
  complianceYear: string | number
): ColDef[] => {
  const baseColumns: ColDef[] = [
    {
      headerName: i18n.t(
        'notionalTransfer:notionalTransferColLabels.legalName'
      ),
      flex: 1,
      field: 'legalName',
      minWidth: 320
    },
    {
      headerName: i18n.t(
        'notionalTransfer:notionalTransferColLabels.addressForService'
      ),
      field: 'addressForService',
      flex: 1,
      minWidth: 280
    },
    {
      headerName: i18n.t(
        'notionalTransfer:notionalTransferColLabels.fuelCategory'
      ),
      field: 'fuelCategory',
      flex: 1,
      minWidth: 160
    },
    {
      headerName: i18n.t(
        'notionalTransfer:notionalTransferColLabels.isCanadaProduced'
      ),
      field: 'isCanadaProduced',
      minWidth: 250,
      hide: Number(complianceYear) < NEW_REGULATION_YEAR,
      valueGetter: (params) => (params.data.isCanadaProduced ? 'Yes' : '')
    },
    {
      headerName: i18n.t(
        'notionalTransfer:notionalTransferColLabels.isQ1Supplied'
      ),
      field: 'isQ1Supplied',
      hide: complianceYear !== NEW_REGULATION_YEAR,
      minWidth: 170,
      valueGetter: (params) => (params.data.isQ1Supplied ? 'Yes' : '')
    },
    {
      headerName: i18n.t(
        'notionalTransfer:notionalTransferColLabels.receivedOrTransferred'
      ),
      field: 'receivedOrTransferred',
      flex: 1,
      minWidth: 250
    },
    {
      headerName: i18n.t('notionalTransfer:notionalTransferColLabels.quantity'),
      field: 'quantity',
      valueFormatter: numberCellFormatter,
      minWidth: 180
    }
  ]

  if (isEarlyIssuance) {
    return baseColumns.flatMap((item) => {
      if (item.field === 'quantity') {
        return [
          {
            field: 'q1Quantity',
            headerName: i18n.t(
              'notionalTransfer:notionalTransferColLabels.q1Quantity'
            ),
            valueFormatter: numberCellFormatter,
            minWidth: 130
          },
          {
            field: 'q2Quantity',
            headerName: i18n.t(
              'notionalTransfer:notionalTransferColLabels.q2Quantity'
            ),
            valueFormatter: numberCellFormatter,
            minWidth: 130
          },
          {
            field: 'q3Quantity',
            headerName: i18n.t(
              'notionalTransfer:notionalTransferColLabels.q3Quantity'
            ),
            valueFormatter: numberCellFormatter,
            minWidth: 130
          },
          {
            field: 'q4Quantity',
            headerName: i18n.t(
              'notionalTransfer:notionalTransferColLabels.q4Quantity'
            ),
            valueFormatter: numberCellFormatter,
            minWidth: 130
          },
          {
            field: 'totalQuantity',
            headerName: i18n.t(
              'notionalTransfer:notionalTransferColLabels.totalQuantity'
            ),
            valueFormatter: numberCellFormatter,
            minWidth: 150,
            valueGetter: (params) => {
              const data = params.data
              return (
                (data.q1Quantity || 0) +
                (data.q2Quantity || 0) +
                (data.q3Quantity || 0) +
                (data.q4Quantity || 0)
              )
            }
          }
        ]
      }

      return [item]
    })
  }
  return baseColumns
}

export const defaultColDef = {
  editable: true,
  resizable: true,
  filter: false,
  floatingFilter: false,
  sortable: false,
  singleClickEdit: true,
  wrapHeaderText: true,
  autoHeaderHeight: true
}

export const changelogCommonColDefs = (
  highlight: boolean = true,
  complianceYear: string | number,
  isEarlyIssuance: boolean
): ColDef[] => {
  const baseColumns: ColDef[] = [
    {
      headerName: i18n.t(
        'notionalTransfer:notionalTransferColLabels.legalName'
      ),
      field: 'legalName',
      flex: 1,
      minWidth: 280,
      cellStyle: (params) =>
        highlight ? changelogCellStyle(params, 'legalName') : undefined
    },
    {
      headerName: i18n.t(
        'notionalTransfer:notionalTransferColLabels.addressForService'
      ),
      field: 'addressForService',
      flex: 1,
      minWidth: 360,
      cellStyle: (params) =>
        highlight ? changelogCellStyle(params, 'addressForService') : undefined
    },
    {
      headerName: i18n.t(
        'notionalTransfer:notionalTransferColLabels.fuelCategory'
      ),
      field: 'fuelCategory.category',
      minWidth: 150,
      cellStyle: (params) =>
        highlight ? changelogCellStyle(params, 'fuelCategory') : undefined
    },
    {
      headerName: i18n.t(
        'notionalTransfer:notionalTransferColLabels.isCanadaProduced'
      ),
      field: 'isCanadaProduced',
      minWidth: 240,
      hide: Number(complianceYear) < NEW_REGULATION_YEAR,
      valueGetter: (params) => (params.data.isCanadaProduced ? 'Yes' : 'No'),
      cellStyle: (params) =>
        highlight ? changelogCellStyle(params, 'isCanadaProduced') : undefined
    },
    {
      headerName: i18n.t(
        'notionalTransfer:notionalTransferColLabels.isQ1Supplied'
      ),
      field: 'isQ1Supplied',
      hide: complianceYear !== NEW_REGULATION_YEAR,
      minWidth: 165,
      valueGetter: (params) => (params.data.isQ1Supplied ? 'Yes' : 'No'),
      cellStyle: (params) =>
        highlight ? changelogCellStyle(params, 'isQ1Supplied') : undefined
    },
    {
      headerName: i18n.t(
        'notionalTransfer:notionalTransferColLabels.receivedOrTransferred'
      ),
      field: 'receivedOrTransferred',
      minWidth: 240,
      cellStyle: (params) =>
        highlight
          ? changelogCellStyle(params, 'receivedOrTransferred')
          : undefined
    },
    {
      headerName: i18n.t('notionalTransfer:notionalTransferColLabels.quantity'),
      field: 'quantity',
      valueFormatter: numberCellFormatter,
      cellStyle: (params) =>
        highlight ? changelogCellStyle(params, 'quantity') : undefined
    }
  ]
  if (isEarlyIssuance) {
    return baseColumns.flatMap((item) => {
      if (item.field === 'quantity') {
        return [
          {
            field: 'q1Quantity',
            minWidth: 150,
            headerName: i18n.t(
              'notionalTransfer:notionalTransferColLabels.q1Quantity'
            ),
            valueFormatter: numberCellFormatter,
            cellStyle: (params) =>
              highlight ? changelogCellStyle(params, 'q1Quantity') : undefined
          },
          {
            field: 'q2Quantity',
            minWidth: 150,
            headerName: i18n.t(
              'notionalTransfer:notionalTransferColLabels.q2Quantity'
            ),
            valueFormatter: numberCellFormatter,
            cellStyle: (params) =>
              highlight ? changelogCellStyle(params, 'q2Quantity') : undefined
          },
          {
            field: 'q3Quantity',
            minWidth: 150,
            headerName: i18n.t(
              'notionalTransfer:notionalTransferColLabels.q3Quantity'
            ),
            valueFormatter: numberCellFormatter,
            cellStyle: (params) =>
              highlight ? changelogCellStyle(params, 'q3Quantity') : undefined
          },
          {
            field: 'q4Quantity',
            minWidth: 150,
            headerName: i18n.t(
              'notionalTransfer:notionalTransferColLabels.q4Quantity'
            ),
            valueFormatter: numberCellFormatter,
            cellStyle: (params) =>
              highlight ? changelogCellStyle(params, 'q4Quantity') : undefined
          },
          {
            field: 'totalQuantity',
            minWidth: 160,
            headerName: i18n.t(
              'notionalTransfer:notionalTransferColLabels.totalQuantity'
            ),
            valueFormatter: numberCellFormatter,
            cellStyle: (params) =>
              highlight
                ? changelogCellStyle(params, 'totalQuantity')
                : undefined,
            valueGetter: (params) => {
              const data = params.data
              return (
                data.q1Quantity +
                data.q2Quantity +
                data.q3Quantity +
                data.q4Quantity
              )
            }
          }
        ]
      }

      return [item]
    })
  }
  return baseColumns
}

export const changelogColDefs = (
  highlight: boolean = true,
  complianceYear: string | number,
  isEarlyIssuance: boolean
): ColDef[] => [
  {
    field: 'groupUuid',
    hide: true,
    sort: 'desc',
    sortIndex: 3
  },
  { field: 'createDate', hide: true, sort: 'asc', sortIndex: 1 },
  { field: 'version', hide: true, sort: 'desc', sortIndex: 2 },
  {
    field: 'actionType',
    minWidth: 140,
    valueGetter: (params) => {
      if (params.data.actionType === 'UPDATE') {
        if (params.data.updated) {
          return 'Edited old'
        } else {
          return 'Edited new'
        }
      }
      if (params.data.actionType === 'DELETE') {
        return 'Deleted'
      }
      if (params.data.actionType === 'CREATE') {
        return 'Added'
      }
    },
    cellStyle: (params) => {
      if (highlight && params.data.actionType === 'UPDATE') {
        return { backgroundColor: colors.alerts.warning.background }
      }
    }
  },
  ...changelogCommonColDefs(highlight, complianceYear, isEarlyIssuance)
]

export const changelogDefaultColDefs = {
  floatingFilter: false,
  filter: false
}

export const changelogCommonGridOptions = {
  overlayNoRowsTemplate: i18n.t('notionalTransfer:noNotionalTransfersFound'),
  autoSizeStrategy: {
    type: 'fitCellContents',
    defaultMinWidth: 50,
    defaultMaxWidth: 600
  },
  enableCellTextSelection: true, // enables text selection on the grid
  ensureDomOrder: true
}

export const changelogGridOptions = {
  ...changelogCommonGridOptions,
  getRowStyle: (params: RowClassParams) => {
    if (params.data.actionType === 'DELETE') {
      return {
        backgroundColor: colors.alerts.error.background
      }
    }
    if (params.data.actionType === 'CREATE') {
      return {
        backgroundColor: colors.alerts.success.background
      }
    }
  }
}
