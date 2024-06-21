import { KEY_ENTER, KEY_TAB } from '@/constants/common'
import { CommonArrayRenderer } from '@/utils/cellRenderers'
import { Typography } from '@mui/material'
import { v4 as uuid } from 'uuid'
import * as yup from 'yup'

// copy the desired columns to new row
const duplicateRow = (props) => {
  const newRow = {
    ...props.data,
    id: uuid(),
    modified: true,
    fuelCode: 1000 + (props.node?.rowIndex + 1) / 10
  }

  if (props.api) {
    props.api.applyTransaction({
      add: [newRow],
      addIndex: props.node?.rowIndex + 1
    })
    props.api.stopEditing()
  } else {
    console.error('API is undefined')
  }
}

export const fuelCodeSchema = (t, optionsData) =>
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
    fuelCode: yup.number().required(
      t('fuelCode:validateMsg.isRequired', {
        field: t('fuelCode:fuelCodeColLabels.fuelCode')
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
  })

export const fuelCodeColDefs = (t, optionsData, api) => [
  {
    colId: 'action',
    cellRenderer: 'actionsRenderer',
    cellRendererParams: {
      enableDuplicate: true,
      enableEdit: false,
      enableDelete: true,
      onDuplicate: (props) => duplicateRow({ ...props, api })
    },
    // checkboxSelection: true,
    // headerCheckboxSelection: true,
    // field: 'checkobxBtn',
    pinned: 'left',
    maxWidth: 100,
    editable: false,
    suppressKeyboardEvent: (params) =>
      params.event.key === KEY_ENTER || params.event.key === KEY_TAB,
    filter: false
  },
  {
    field: 'id',
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    hide: true
  },
  {
    field: 'prefix',
    headerName: t('fuelCode:fuelCodeColLabels.prefix'),
    cellEditor: 'autocompleteEditor',
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
    cellEditorParams: {
      // onDynamicUpdate: onPrefixUpdate, // to alter any other column based on the value selected.
      // (ensure valueGetter is not added to the column which you want to update dynamically)
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
    minWidth: 135
  },
  {
    field: 'fuelCode',
    headerName: t('fuelCode:fuelCodeColLabels.fuelCode'),
    cellDataType: 'text',
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
    cellEditor: 'autocompleteEditor',
    cellEditorParams: {
      onDynamicUpdate: (val, params) => params.api.stopEditing(),
      options: optionsData.latestFuelCodes.map((obj) => obj.fuelCode),
      optionLabel: 'fuelCode',
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: true, // whether to allow free text or restrict to only options selection
      openOnFocus: true,
      onKeyDownCapture: (e) => {
        const allowedKeys = [
          'Backspace',
          'ArrowLeft',
          'ArrowRight',
          'Delete',
          'Tab',
          'Escape',
          'Enter',
          'Home',
          'End',
          'Control',
          'Meta',
          'Shift',
          'Alt'
        ]

        if (
          (e.ctrlKey || e.metaKey) &&
          ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())
        ) {
          return
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
          return
        }

        if (allowedKeys.includes(e.key)) {
          return
        }

        const charCode = e.which ? e.which : e.keyCode
        if (e.key === '.' || charCode < 48 || charCode > 57) {
          e.preventDefault()
        }
      },
      onPaste: (e, onChange) => {
        e.preventDefault()
        const paste = (e.clipboardData || window.clipboardData).getData('text')
        const cleaned = paste.split('.')[0].replace(/[^0-9]/g, '')

        onChange(cleaned)
      },
      onBlur: (e, onChange) => {
        if (!e.target.value) {
          return
        }

        if (
          optionsData.latestFuelCodes.find(
            (item) => item.fuelCode === e.target.value
          )
        ) {
          return
        }

        const match = optionsData.latestFuelCodes.find(
          (item) => item.fuelCode.split('.')[0] === e.target.value
        )

        const newValue = match ? match.fuelCode : `${e.target.value}.0`

        onChange(newValue)
      }
    },
    suppressKeyboardEvent: (params) => {
      // return true (to suppress) if editing and user hit Enter key
      return params.editing && params.event.key === KEY_ENTER
    },
    cellStyle: (params) => {
      if (params.data.modified && (!params.value || params.value === ''))
        return { borderColor: 'red' }
    },
    tooltipValueGetter: (p) => 'select the next fuel code version'
  },
  {
    field: 'company',
    headerName: t('fuelCode:fuelCodeColLabels.company'),
    cellEditor: 'autocompleteEditor',
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
      options: optionsData.fieldOptions.company,
      multiple: false, // ability to select multiple values from dropdown
      disableCloseOnSelect: false, // if multiple is true, this will prevent closing dropdown on selecting an option
      freeSolo: true, // this will allow user to type in the input box or choose from the dropdown
      openOnFocus: true // this will open the dropdown on input focus
    },
    suppressKeyboardEvent: (params) => {
      // return true (to suppress) if editing and user hit Enter key
      return params.editing && params.event.key === KEY_ENTER
    },
    minWidth: 300
  },
  {
    field: 'contactName',
    headerName: t('fuelCode:fuelCodeColLabels.contactName'),
    cellEditor: 'autocompleteEditor',
    cellDataType: 'text',
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
    cellEditorParams: {
      noLabel: true,
      options: optionsData.fieldOptions.contactName,
      multiple: false, // ability to select multiple values from dropdown
      disableCloseOnSelect: false, // if multiple is true, this will prevent closing dropdown on selecting an option
      freeSolo: true, // this will allow user to type in the input box or choose from the dropdown
      openOnFocus: true // this will open the dropdown on input focus
    },
    suppressKeyboardEvent: (params) => {
      // return true (to suppress) if editing and user hit Enter key
      return params.editing && params.event.key === KEY_ENTER
    },
    minWidth: 300
  },
  {
    field: 'contactEmail',
    headerName: t('fuelCode:fuelCodeColLabels.contactEmail'),
    cellEditor: 'autocompleteEditor',
    cellDataType: 'text',
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
    cellEditorParams: {
      noLabel: true,
      options: optionsData.fieldOptions.contactEmail,
      multiple: false, // ability to select multiple values from dropdown
      disableCloseOnSelect: false, // if multiple is true, this will prevent closing dropdown on selecting an option
      freeSolo: true, // this will allow user to type in the input box or choose from the dropdown
      openOnFocus: true // this will open the dropdown on input focus
    },
    suppressKeyboardEvent: (params) => {
      // return true (to suppress) if editing and user hit Enter key
      return params.editing && params.event.key === KEY_ENTER
    },
    minWidth: 300
  },
  {
    field: 'carbonIntensity',
    headerName: t('fuelCode:fuelCodeColLabels.carbonIntensity'),
    cellEditor: 'agNumberCellEditor',
    cellEditorParams: {
      precision: 2,
      showStepperButtons: false
    },
    cellStyle: (params) => {
      if (params.data.modified && !params.value) return { borderColor: 'red' }
    },
    type: 'numericColumn'
  },
  {
    field: 'edrms',
    headerName: t('fuelCode:fuelCodeColLabels.edrms'),
    cellEditor: 'agTextCellEditor',
    cellStyle: (params) => {
      if (params.data.modified && (!params.value || params.value === ''))
        return { borderColor: 'red' }
    },
    cellDataType: 'text'
  },
  {
    field: 'applicationDate',
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
    cellEditor: 'dateEditor'
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
    cellEditor: 'dateEditor'
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
    cellEditor: 'dateEditor'
  },
  {
    field: 'fuel',
    headerName: t('fuelCode:fuelCodeColLabels.fuel'),
    cellEditor: 'autocompleteEditor',
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
    minWidth: 300
  },
  {
    field: 'feedstock',
    headerName: t('fuelCode:fuelCodeColLabels.feedstock'),
    cellEditor: 'autocompleteEditor',
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
      options: optionsData.fieldOptions.feedstock,
      multiple: false, // ability to select multiple values from dropdown
      disableCloseOnSelect: false, // if multiple is true, this will prevent closing dropdown on selecting an option
      freeSolo: true, // this will allow user to type in the input box or choose from the dropdown
      openOnFocus: true // this will open the dropdown on input focus
    },
    minWidth: 300
  },
  {
    field: 'feedstockLocation',
    headerName: t('fuelCode:fuelCodeColLabels.feedstockLocation'),
    cellEditor: 'autocompleteEditor',
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
      options: optionsData.fieldOptions.feedstockLocation,
      multiple: false, // ability to select multiple values from dropdown
      disableCloseOnSelect: false, // if multiple is true, this will prevent closing dropdown on selecting an option
      freeSolo: true, // this will allow user to type in the input box or choose from the dropdown
      openOnFocus: true // this will open the dropdown on input focus
    },
    minWidth: 300
  },
  {
    field: 'feedstockMisc',
    headerName: t('fuelCode:fuelCodeColLabels.misc'),
    cellEditor: 'autocompleteEditor',
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
      options: optionsData.fieldOptions.feedstockMisc,
      multiple: false, // ability to select multiple values from dropdown
      disableCloseOnSelect: false, // if multiple is true, this will prevent closing dropdown on selecting an option
      freeSolo: true, // this will allow user to type in the input box or choose from the dropdown
      openOnFocus: true // this will open the dropdown on input focus
    },
    minWidth: 495
  },
  {
    field: 'fuelProductionFacilityCity',
    headerName: t('fuelCode:fuelCodeColLabels.fuelProductionFacilityCity'),
    cellEditor: 'autocompleteEditor',
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
    headerName: t(
      'fuelCode:fuelCodeColLabels.fuelProductionFacilityProvinceState'
    ),
    cellEditor: 'autocompleteEditor',
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
    headerName: t('fuelCode:fuelCodeColLabels.fuelProductionFacilityCountry'),
    cellEditor: 'autocompleteEditor',
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
    cellEditorParams: {
      precision: 0,
      min: 0,
      showStepperButtons: false
    },
    minWidth: 290
  },
  {
    field: 'feedstockTransportMode',
    headerName: t('fuelCode:fuelCodeColLabels.feedstockTransportMode'),
    cellEditor: 'autocompleteEditor',
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
    minWidth: 325
  },
  {
    field: 'finishedFuelTransportMode',
    headerName: t('fuelCode:fuelCodeColLabels.finishedFuelTransportMode'),
    cellEditor: 'autocompleteEditor',
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
    minWidth: 325
  },
  {
    field: 'formerCompany',
    headerName: t('fuelCode:fuelCodeColLabels.formerCompany'),
    cellEditor: 'autocompleteEditor',
    cellDataType: 'text',
    cellEditorParams: {
      noLabel: true,
      options: optionsData.fieldOptions.formerCompany,
      multiple: false, // ability to select multiple values from dropdown
      disableCloseOnSelect: false, // if multiple is true, this will prevent closing dropdown on selecting an option
      freeSolo: true, // this will allow user to type in the input box or choose from the dropdown
      openOnFocus: true // this will open the dropdown on input focus
    },
    minWidth: 300
  },
  {
    field: 'notes',
    headerName: t('fuelCode:fuelCodeColLabels.notes'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    minWidth: 600
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
