import { KEY_ENTER, KEY_TAB } from '@/constants/common'
import {
  CommonArrayRenderer,
  FuelCodeStatusTextRenderer,
  TextRenderer
} from '@/utils/grid/cellRenderers'
import { numberFormatter, timezoneFormatter } from '@/utils/formatters'
import { Typography } from '@mui/material'
import { v4 as uuid } from 'uuid'
import * as yup from 'yup'
import {
  AutocompleteCellEditor,
  RequiredHeader
} from '@/components/BCDataGrid/components'

export const fuelCodeColDefs = (t) => [
  {
    field: 'status',
    headerName: t('fuelCode:fuelCodeColLabels.status'),
    valueGetter: (params) => params.data.fuelCodeStatus.status,
    cellRenderer: FuelCodeStatusTextRenderer
  },
  {
    field: 'prefix',
    headerName: t('fuelCode:fuelCodeColLabels.prefix'),
    valueGetter: (params) => params.data.fuelCodePrefix.prefix,
    cellRenderer: TextRenderer
  },
  {
    field: 'fuelSuffix',
    headerName: t('fuelCode:fuelCodeColLabels.fuelSuffix'),
    cellRenderer: TextRenderer
  },
  {
    field: 'carbonIntensity',
    headerName: t('fuelCode:fuelCodeColLabels.carbonIntensity'),
    cellRenderer: TextRenderer,
    type: 'numericColumn'
  },
  {
    field: 'edrms',
    headerName: t('fuelCode:fuelCodeColLabels.edrms'),
    cellRenderer: TextRenderer
  },
  {
    field: 'company',
    headerName: t('fuelCode:fuelCodeColLabels.company'),
    cellRenderer: TextRenderer,
    minWidth: 300
  },
  {
    field: 'contactName',
    headerName: t('fuelCode:fuelCodeColLabels.contactName'),
    cellRenderer: TextRenderer,
    minWidth: 300
  },
  {
    field: 'contactEmail',
    headerName: t('fuelCode:fuelCodeColLabels.contactEmail'),
    cellRenderer: TextRenderer,
    minWidth: 300
  },
  {
    field: 'applicationDate',
    headerName: t('fuelCode:fuelCodeColLabels.applicationDate'),
    cellRenderer: TextRenderer
  },
  {
    field: 'approvalDate',
    headerName: t('fuelCode:fuelCodeColLabels.approvalDate'),
    cellRenderer: TextRenderer
  },
  {
    field: 'effectiveDate',
    headerName: t('fuelCode:fuelCodeColLabels.effectiveDate'),
    cellRenderer: TextRenderer
  },
  {
    field: 'expirationDate',
    headerName: t('fuelCode:fuelCodeColLabels.expiryDate'),
    cellRenderer: TextRenderer
  },
  {
    field: 'fuel',
    headerName: t('fuelCode:fuelCodeColLabels.fuel'),
    cellRenderer: TextRenderer,
    valueGetter: (params) => params.data.fuelCodeType.fuelType
  },
  {
    field: 'feedstock',
    headerName: t('fuelCode:fuelCodeColLabels.feedstock'),
    cellRenderer: TextRenderer
  },
  {
    field: 'feedstockLocation',
    headerName: t('fuelCode:fuelCodeColLabels.feedstockLocation'),
    cellRenderer: TextRenderer,
    minWidth: 300
  },
  {
    field: 'feedstockMisc',
    headerName: t('fuelCode:fuelCodeColLabels.misc'),
    cellRenderer: TextRenderer,
    minWidth: 495
  },
  {
    field: 'fuelProductionFacilityCity',
    headerName: t('fuelCode:fuelCodeColLabels.fuelProductionFacilityCity'),
    cellRenderer: TextRenderer,
    minWidth: 325
  },
  {
    field: 'fuelProductionFacilityProvinceState',
    headerName: t(
      'fuelCode:fuelCodeColLabels.fuelProductionFacilityProvinceState'
    ),
    cellRenderer: TextRenderer,
    minWidth: 325
  },
  {
    field: 'fuelProductionFacilityCountry',
    headerName: t('fuelCode:fuelCodeColLabels.fuelProductionFacilityCountry'),
    cellRenderer: TextRenderer,
    minWidth: 325
  },
  {
    field: 'facilityNameplateCapacity',
    headerName: t('fuelCode:fuelCodeColLabels.facilityNameplateCapacity'),
    valueFormatter: numberFormatter,
    cellRenderer: TextRenderer,
    minWidth: 290,
    type: 'numericColumn'
  },
  {
    field: 'facilityNameplateCapacityUnit',
    headerName: t('fuelCode:fuelCodeColLabels.facilityNameplateCapacityUnit'),
    cellRenderer: TextRenderer,
    minWidth: 290
  },
  {
    field: 'feedstockFuelTransportMode',
    headerName: t('fuelCode:fuelCodeColLabels.feedstockFuelTransportMode'),
    minWidth: 335,
    valueGetter: (params) =>
      params.data.feedstockFuelTransportModes.map(
        (item) => item.feedstockFuelTransportMode.transportMode
      ),
    cellRenderer: (props) => <CommonArrayRenderer disableLink {...props} />
  },
  {
    field: 'finishedFuelTransportMode',
    headerName: t('fuelCode:fuelCodeColLabels.finishedFuelTransportMode'),
    minWidth: 335,
    valueGetter: (params) =>
      params.data.finishedFuelTransportModes.map(
        (item) => item.finishedFuelTransportMode.transportMode
      ),
    cellRenderer: (props) => <CommonArrayRenderer disableLink {...props} />
  },
  {
    field: 'formerCompany',
    headerName: t('fuelCode:fuelCodeColLabels.formerCompany'),
    cellRenderer: TextRenderer,
    minWidth: 300
  },
  {
    field: 'lastUpdated',
    headerName: t('fuelCode:fuelCodeColLabels.lastUpdated'),
    cellRenderer: (params) => (
      <Typography variant="body4">
        {params.value
          ? timezoneFormatter({ value: params.value })
          : 'YYYY-MM-DD'}
      </Typography>
    ),
    minWidth: 300
  },
  {
    field: 'notes',
    headerName: t('fuelCode:fuelCodeColLabels.notes'),
    cellRenderer: TextRenderer,
    minWidth: 600
  }
]

export const addEditSchema = {
  duplicateRow: (props) => {
    const newRow = {
      ...props.data,
      id: uuid(),
      modified: true,
      fuelSuffix: '100' + '.' + `${props.node?.rowIndex + 1}`
    }
    props.api.applyTransaction({
      add: [newRow],
      addIndex: props.node?.rowIndex + 1
    })
    props.api.stopEditing()
  },

  fuelCodeSchema: (t, optionsData) =>
    yup.object().shape({
      prefix: yup
        .string()
        .oneOf(
          optionsData.fuelCodePrefixes.map((obj) => obj.prefix),
          t('fuelCode:validateMsg.prefix')
        )
        .required(
          t('fuelCode:validateMsg.isRequired', {
            field: t('fuelCode:fuelCodeColLabels.prefix')
          })
        ),
      fuelSuffix: yup.number().required(
        t('fuelCode:validateMsg.isRequired', {
          field: t('fuelCode:fuelCodeColLabels.fuelSuffix')
        })
      ),
      company: yup.string().required(
        t('fuelCode:validateMsg.isRequired', {
          field: t('fuelCode:fuelCodeColLabels.company')
        })
      ),
      carbonIntensity: yup.number().required(
        t('fuelCode:validateMsg.isRequired', {
          field: t('fuelCode:fuelCodeColLabels.carbonIntensity')
        })
      ),
      edrms: yup.string().required(
        t('fuelCode:validateMsg.isRequired', {
          field: t('fuelCode:fuelCodeColLabels.edrms')
        })
      ),
      applicationDate: yup.date().required(
        t('fuelCode:validateMsg.isRequired', {
          field: t('fuelCode:fuelCodeColLabels.applicationDate')
        })
      ),
      fuel: yup
        .string()
        .oneOf(
          optionsData.fuelTypes
            .filter((fuel) => !fuel.fossilDerived)
            .map((obj) => obj.fuelType),
          t('fuelCode:validateMsg.fuel')
        )
        .required(
          t('fuelCode:validateMsg.isRequired', {
            field: t('fuelCode:fuelCodeColLabels.fuel')
          })
        ),
      feedstock: yup.string().required(
        t('fuelCode:validateMsg.isRequired', {
          field: t('fuelCode:fuelCodeColLabels.feedstock')
        })
      ),
      feedstockLocation: yup.string().required(
        t('fuelCode:validateMsg.isRequired', {
          field: t('fuelCode:fuelCodeColLabels.feedstockLocation')
        })
      ),
      fuelProductionFacilityCity: yup.string().required(
        t('fuelCode:validateMsg.isRequired', {
          field: t('fuelCode:fuelCodeColLabels.fuelProductionFacilityCity')
        })
      ),
      fuelProductionFacilityProvinceState: yup.string().required(
        t('fuelCode:validateMsg.isRequired', {
          field: t(
            'fuelCode:fuelCodeColLabels.fuelProductionFacilityProvinceState'
          )
        })
      ),
      fuelProductionFacilityCountry: yup.string().required(
        t('fuelCode:validateMsg.isRequired', {
          field: t('fuelCode:fuelCodeColLabels.fuelProductionFacilityCountry')
        })
      )
    }),
  fuelCodeColDefs: (t, optionsData, isDraftOrNew = true) => [
    {
      colId: 'action',
      cellRenderer: 'actionsRenderer',
      cellRendererParams: {
        enableDuplicate: true,
        enableEdit: false,
        enableDelete: true,
        onDuplicate: addEditSchema.duplicateRow
      },
      pinned: 'left',
      maxWidth: 100,
      editable: false,
      suppressKeyboardEvent: (params) =>
        params.event.key === KEY_ENTER || params.event.key === KEY_TAB,
      filter: false,
      hide: !isDraftOrNew
    },
    {
      field: 'id',
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      hide: true
    },
    {
      field: 'prefix',
      headerComponent: isDraftOrNew ? RequiredHeader : undefined,
      headerName: t('fuelCode:fuelCodeColLabels.prefix'),
      cellEditor: AutocompleteCellEditor,
      cellRenderer: (params) =>
        params.value ||
        (!params.value && <Typography variant="body4">Select</Typography>),
      cellEditorParams: {
        options: optionsData.fuelCodePrefixes.map((obj) => obj.prefix),
        multiple: false, // ability to select multiple values from dropdown
        disableCloseOnSelect: false, // if multiple is true, this will prevent closing dropdown on selecting an option
        freeSolo: false, // this will allow user to type in the input box or choose from the dropdown
        openOnFocus: true // this will open the dropdown on input focus
      },
      suppressKeyboardEvent: (params) => {
        // return true (to suppress) if editing and user hit Enter key
        return params.editing && params.event.key === KEY_ENTER
      },
      cellStyle: (params) => {
        if (params.data.modified && (!params.value || params.value === ''))
          return { borderColor: 'red' }
      },
      cellDataType: 'text',
      minWidth: 135,
      editable: isDraftOrNew
    },
    {
      field: 'fuelSuffix',
      headerComponent: isDraftOrNew ? RequiredHeader : undefined,
      headerName: t('fuelCode:fuelCodeColLabels.fuelSuffix'),
      cellDataType: 'text',
      editable: false
    },
    {
      field: 'carbonIntensity',
      headerComponent: isDraftOrNew ? RequiredHeader : undefined,
      headerName: t('fuelCode:fuelCodeColLabels.carbonIntensity'),
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: {
        precision: 2,
        showStepperButtons: false
      },
      cellStyle: (params) => {
        if (params.data.modified && !params.value) return { borderColor: 'red' }
      },
      type: 'numericColumn',
      editable: isDraftOrNew
    },
    {
      field: 'edrms',
      headerComponent: isDraftOrNew ? RequiredHeader : undefined,
      headerName: t('fuelCode:fuelCodeColLabels.edrms'),
      cellEditor: 'agTextCellEditor',
      cellStyle: (params) => {
        if (params.data.modified && (!params.value || params.value === ''))
          return { borderColor: 'red' }
      },
      cellDataType: 'text',
      editable: isDraftOrNew
    },
    {
      field: 'company',
      headerComponent: isDraftOrNew ? RequiredHeader : undefined,
      headerName: t('fuelCode:fuelCodeColLabels.company'),
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      cellStyle: (params) => {
        if (params.data.modified && (!params.value || params.value === ''))
          return { borderColor: 'red' }
      },
      minWidth: 300,
      editable: isDraftOrNew
    },
    {
      field: 'contactName',
      headerName: t('fuelCode:fuelCodeColLabels.contactName'),
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      minWidth: 300,
      editable: isDraftOrNew
    },
    {
      field: 'contactEmail',
      headerName: t('fuelCode:fuelCodeColLabels.contactEmail'),
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      minWidth: 300,
      editable: isDraftOrNew
    },

    {
      field: 'lastUpdated',
      headerName: t('fuelCode:fuelCodeColLabels.lastUpdated'),
      maxWidth: 180,
      minWidth: 180,
      cellRenderer: (params) => (
        <Typography variant="body4">
          {params.value ? `${params.value} PDT` : 'YYYY-MM-DD'}
        </Typography>
      ),
      editable: false, // TODO: change as per #516
      cellDataType: 'text',
      // valueGetter: (params) => {
      //   return new Date().toLocaleDateString()
      // },
      hide: isDraftOrNew
    },
    {
      field: 'applicationDate',
      headerComponent: isDraftOrNew ? RequiredHeader : undefined,
      headerName: t('fuelCode:fuelCodeColLabels.applicationDate'),
      maxWidth: 180,
      minWidth: 180,
      cellRenderer: (params) => (
        <Typography variant="body4">
          {params.value ? params.value : 'YYYY-MM-DD'}
        </Typography>
      ),
      suppressKeyboardEvent: (params) =>
        params.editing &&
        (params.event.key === KEY_ENTER || params.event.key === KEY_TAB),
      cellStyle: (params) => {
        if (params.data.modified && (!params.value || params.value === ''))
          return { borderColor: 'red' }
      },
      cellEditor: 'dateEditor',
      editable: isDraftOrNew
    },
    {
      field: 'approvalDate',
      headerName: t('fuelCode:fuelCodeColLabels.approvalDate'),
      maxWidth: 180,
      minWidth: 180,
      cellRenderer: (params) => (
        <Typography variant="body4">
          {params.value ? params.value : 'YYYY-MM-DD'}
        </Typography>
      ),
      suppressKeyboardEvent: (params) => params.editing,
      cellEditor: 'dateEditor'
    },
    {
      field: 'effectiveDate',
      headerName: t('fuelCode:fuelCodeColLabels.effectiveDate'),
      maxWidth: 180,
      minWidth: 180,
      cellRenderer: (params) => (
        <Typography variant="body4">
          {params.value ? params.value : 'YYYY-MM-DD'}
        </Typography>
      ),
      suppressKeyboardEvent: (params) => params.editing,
      cellEditor: 'dateEditor',
      editable: isDraftOrNew
    },
    {
      field: 'expirationDate',
      headerName: t('fuelCode:fuelCodeColLabels.expiryDate'),
      maxWidth: 180,
      minWidth: 180,
      cellRenderer: (params) => (
        <Typography variant="body4">
          {params.value ? params.value : 'YYYY-MM-DD'}
        </Typography>
      ),
      suppressKeyboardEvent: (params) => params.editing,
      cellEditor: 'dateEditor',
      editable: isDraftOrNew
    },
    {
      field: 'fuel',
      headerComponent: isDraftOrNew ? RequiredHeader : undefined,
      headerName: t('fuelCode:fuelCodeColLabels.fuel'),
      cellEditor: AutocompleteCellEditor,
      cellRenderer: (params) =>
        params.value ||
        (!params.value && <Typography variant="body4">Select</Typography>),
      cellEditorParams: {
        options: optionsData.fuelTypes
          .filter((fuel) => !fuel.fossilDerived)
          .map((obj) => obj.fuelType),
        multiple: false, // ability to select multiple values from dropdown
        disableCloseOnSelect: false, // if multiple is true, this will prevent closing dropdown on selecting an option
        freeSolo: false, // this will allow user to type in the input box or choose from the dropdown
        openOnFocus: true // this will open the dropdown on input focus
      },
      suppressKeyboardEvent: (params) => {
        // return true (to suppress) if editing and user hit Enter key
        return params.editing && params.event.key === KEY_ENTER
      },
      cellStyle: (params) => {
        if (params.data.modified && (!params.value || params.value === ''))
          return { borderColor: 'red' }
      },
      minWidth: 300,
      editable: isDraftOrNew
    },
    {
      field: 'feedstock',
      headerComponent: isDraftOrNew ? RequiredHeader : undefined,
      headerName: t('fuelCode:fuelCodeColLabels.feedstock'),
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      cellStyle: (params) => {
        if (params.data.modified && (!params.value || params.value === ''))
          return { borderColor: 'red' }
      },
      minWidth: 300,
      editable: isDraftOrNew
    },
    {
      field: 'feedstockLocation',
      headerComponent: isDraftOrNew ? RequiredHeader : undefined,
      headerName: t('fuelCode:fuelCodeColLabels.feedstockLocation'),
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      cellStyle: (params) => {
        if (params.data.modified && (!params.value || params.value === ''))
          return { borderColor: 'red' }
      },
      minWidth: 300,
      editable: isDraftOrNew
    },
    {
      field: 'feedstockMisc',
      headerName: t('fuelCode:fuelCodeColLabels.misc'),
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      minWidth: 495,
      editable: isDraftOrNew
    },
    {
      field: 'fuelProductionFacilityCity',
      headerComponent: isDraftOrNew ? RequiredHeader : undefined,
      headerName: t('fuelCode:fuelCodeColLabels.fuelProductionFacilityCity'),
      cellEditor: AutocompleteCellEditor,
      cellDataType: 'text',
      cellStyle: (params) => {
        if (params.data.modified && (!params.value || params.value === ''))
          return { borderColor: 'red' }
      },
      cellRenderer: (params) =>
        params.value ||
        (!params.value && <Typography variant="body4">Select</Typography>),
      cellEditorParams: {
        onDynamicUpdate: (val, params) => params.api.stopEditing(),
        noLabel: true,
        options: [
          ...new Map(
            optionsData.fpLocations.map((location) => [
              location.fuelProductionFacilityCity,
              location.fuelProductionFacilityCity
            ])
          ).values()
        ],
        multiple: false, // ability to select multiple values from dropdown
        disableCloseOnSelect: false, // if multiple is true, this will prevent closing dropdown on selecting an option
        freeSolo: true, // this will allow user to type in the input box or choose from the dropdown
        openOnFocus: true // this will open the dropdown on input focus
      },
      minWidth: 325 // TODO: handle in #486
    },
    {
      field: 'fuelProductionFacilityProvinceState',
      headerComponent: isDraftOrNew ? RequiredHeader : undefined,
      headerName: t(
        'fuelCode:fuelCodeColLabels.fuelProductionFacilityProvinceState'
      ),
      cellEditor: AutocompleteCellEditor,
      cellDataType: 'text',
      cellStyle: (params) => {
        if (params.data.modified && (!params.value || params.value === ''))
          return { borderColor: 'red' }
      },
      cellRenderer: (params) =>
        params.value ||
        (!params.value && <Typography variant="body4">Select</Typography>),
      cellEditorParams: {
        onDynamicUpdate: (val, params) => params.api.stopEditing(),
        noLabel: true,
        options: [
          ...new Map(
            optionsData.fpLocations.map((location) => [
              location.fuelProductionFacilityProvinceState,
              location.fuelProductionFacilityProvinceState
            ])
          ).values()
        ],
        multiple: false, // ability to select multiple values from dropdown
        disableCloseOnSelect: false, // if multiple is true, this will prevent closing dropdown on selecting an option
        freeSolo: true, // this will allow user to type in the input box or choose from the dropdown
        openOnFocus: true // this will open the dropdown on input focus
      },
      minWidth: 325 // TODO: handle in #486
    },
    {
      field: 'fuelProductionFacilityCountry',
      headerComponent: isDraftOrNew ? RequiredHeader : undefined,
      headerName: t('fuelCode:fuelCodeColLabels.fuelProductionFacilityCountry'),
      cellEditor: AutocompleteCellEditor,
      cellDataType: 'text',
      cellStyle: (params) => {
        if (params.data.modified && (!params.value || params.value === ''))
          return { borderColor: 'red' }
      },
      cellRenderer: (params) =>
        params.value ||
        (!params.value && <Typography variant="body4">Select</Typography>),
      cellEditorParams: {
        noLabel: true,
        options: [
          ...new Map(
            optionsData.fpLocations.map((location) => [
              location.fuelProductionFacilityCountry,
              location.fuelProductionFacilityCountry
            ])
          ).values()
        ],
        multiple: false, // ability to select multiple values from dropdown
        disableCloseOnSelect: false, // if multiple is true, this will prevent closing dropdown on selecting an option
        freeSolo: true, // this will allow user to type in the input box or choose from the dropdown
        openOnFocus: true // this will open the dropdown on input focus
      },
      minWidth: 325 // TODO: handle in #486
    },
    {
      field: 'facilityNameplateCapacity',
      headerName: t('fuelCode:fuelCodeColLabels.facilityNameplateCapacity'),
      cellEditor: 'agNumberCellEditor',
      type: 'numericColumn',
      valueFormatter: numberFormatter,
      cellEditorParams: {
        precision: 0,
        min: 0,
        showStepperButtons: false
      },
      minWidth: 290,
      editable: isDraftOrNew
    },
    {
      field: 'facilityNameplateCapacityUnit',
      headerName: t('fuelCode:fuelCodeColLabels.facilityNameplateCapacityUnit'),
      cellEditor: AutocompleteCellEditor,
      cellRenderer: (params) =>
        params.value ||
        (!params.value && <Typography variant="body4">Select</Typography>),
      cellEditorParams: {
        options: optionsData.facilityNameplateCapacityUnits,
        multiple: false, // ability to select multiple values from dropdown
        disableCloseOnSelect: false, // if multiple is true, this will prevent closing dropdown on selecting an option
        freeSolo: false, // this will allow user to type in the input box or choose from the dropdown
        openOnFocus: true // this will open the dropdown on input focus
      },
      suppressKeyboardEvent: (params) => {
        // return true (to suppress) if editing and user hit Enter key
        return params.editing && params.event.key === KEY_ENTER
      },
      cellStyle: (params) => {
        if (params.data.modified && (!params.value || params.value === ''))
          return { borderColor: 'red' }
      },
      minWidth: 300,
      editable: isDraftOrNew
    },
    {
      field: 'feedstockFuelTransportMode',
      headerName: t('fuelCode:fuelCodeColLabels.feedstockFuelTransportMode'),
      cellEditor: AutocompleteCellEditor,
      cellRenderer: (params) =>
        params.value ? (
          <CommonArrayRenderer {...params} />
        ) : (
          <Typography variant="body4">Select</Typography>
        ),
      cellRendererParams: {
        disableLink: true
      },
      cellEditorParams: {
        options: optionsData.transportModes.map((obj) => obj.transportMode),
        multiple: true,
        openOnFocus: true,
        disableCloseOnSelect: true
      },
      suppressKeyboardEvent: (params) => params.editing,
      minWidth: 325,
      editable: isDraftOrNew
    },
    {
      field: 'finishedFuelTransportMode',
      headerName: t('fuelCode:fuelCodeColLabels.finishedFuelTransportMode'),
      cellEditor: AutocompleteCellEditor,
      cellRenderer: (params) =>
        params.value ? (
          <CommonArrayRenderer {...params} />
        ) : (
          <Typography variant="body4">Select</Typography>
        ),
      cellRendererParams: {
        disableLink: true
      },
      cellEditorParams: {
        options: optionsData.transportModes.map((obj) => obj.transportMode),
        multiple: true,
        openOnFocus: true,
        disableCloseOnSelect: true
      },
      suppressKeyboardEvent: (params) => params.editing,
      minWidth: 325,
      editable: isDraftOrNew
    },
    {
      field: 'formerCompany',
      headerName: t('fuelCode:fuelCodeColLabels.formerCompany'),
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      minWidth: 300,
      editable: isDraftOrNew
    },
    {
      field: 'notes',
      headerName: t('fuelCode:fuelCodeColLabels.notes'),
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      minWidth: 600,
      editable: isDraftOrNew
    }
  ],

  defaultColDef: {
    editable: true,
    resizable: true,
    filter: true,
    floatingFilter: false,
    sortable: false,
    singleClickEdit: true
  }
}
