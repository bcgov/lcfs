import { suppressKeyboardEvent } from '@/utils/eventHandlers'
import { FuelCodeActions } from './components/FuelCodeActions'
import { CommonArrayRenderer } from '@/utils/cellRenderers'
import { Typography } from '@mui/material'
import {
  useAddFuelCodes,
  useFuelCodeOptions,
  useSaveFuelCode
} from '@/hooks/useFuelCode'

export const defaultColDef = {
  editable: true,
  resizable: true,
  filter: true,
  floatingFilter: false,
  sortable: false,
  singleClickEdit: true
}

export const fuelCodeColDefs = (t, optionsData, api, onValidated) => [
  {
    colId: 'validation',
    cellRenderer: 'validationRenderer',
    pinned: 'left',
    maxWidth: 60,
    editable: false,
    suppressKeyboardEvent,
    filter: false
  },
  {
    colId: 'action',
    cellRenderer: FuelCodeActions,
    cellRendererParams: { api, onValidated },
    pinned: 'left',
    maxWidth: 110,
    editable: false,
    suppressKeyboardEvent,
    filter: false
  },
  {
    field: 'id',
    cellDataType: 'text',
    hide: true
  },
  {
    field: 'fuelCodeId',
    headerName: t('fuelCode:fuelCodeColLabels.fuelCodeId'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    hide: true
  },
  {
    field: 'prefix',
    headerComponent: 'headerComponent',
    headerName: t('fuelCode:fuelCodeColLabels.prefix'),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: {
      values: optionsData?.fuelCodePrefixes?.map((obj) => obj.prefix)
    },
    cellStyle: (params) => {
      if (params.data.modified && (!params.value || params.value === ''))
        return { borderColor: 'red' }
    },
    minWidth: 135,
    valueGetter: (params) => params.data.prefix || 'BCLCF'
  },
  {
    field: 'fuelCode',
    // headerName: t('fuelCode:fuelCodeColLabels.fuelCode'),
    cellEditor: 'autocompleteCellEditor',
    cellEditorParams: {
      onValueChange: (params) => {
        if (params.data.fuelCode !== params.value) {
          params.data.fuelCode = params.value
          onValidated?.(params.data)
        }
      },
      options: optionsData?.latestFuelCodes?.map((obj) => obj.fuelCode),
      optionLabel: 'fuelCode',
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: true, // whether to allow free text or restrict to only options selection
      openOnFocus: true,
    },
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
    cellStyle: (params) => {
      if (params.data.modified && (!params.value || params.value === ''))
        return { borderColor: 'red' }
    },
    valueGetter: (params) => {
      if (!params.data.fuelCode) {
        const prefix = params.data.prefix || 'BCLCF'
        return optionsData?.fuelCodePrefixes?.find((obj) => obj.prefix === prefix)?.nextFuelCode
      }
      return params.data.fuelCode
    },
    tooltipValueGetter: (p) => 'select the next fuel code version'
  }
]
