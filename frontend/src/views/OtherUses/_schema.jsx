import { actions, validation } from '@/components/BCDataGrid/columns'
import {
  AutocompleteCellEditor,
  RequiredHeader,
  NumberEditor
} from '@/components/BCDataGrid/components'
import i18n from '@/i18n'
import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import BCTypography from '@/components/BCTypography'
import { formatNumberWithCommas as valueFormatter } from '@/utils/formatters'
import { StandardCellErrors } from '@/utils/grid/errorRenderers.jsx'

export const PROVISION_APPROVED_FUEL_CODE = 'Fuel code - section 19 (b) (i)'

export const otherUsesColDefs = (optionsData, errors) => [
  validation,
  actions({
    enableDuplicate: false,
    enableDelete: true
  }),
  {
    field: 'id',
    hide: true
  },
  {
    field:'otherUsesId',
    hide: true
  },
  {
    field: 'fuelType',
    headerName: i18n.t('otherUses:otherUsesColLabels.fuelType'),
    headerComponent: RequiredHeader,
    cellEditor: AutocompleteCellEditor,
    minWidth: '280',
    cellEditorParams: {
      options: optionsData.fuelTypes.map((obj) => obj.fuelType),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    suppressKeyboardEvent,
    cellRenderer: (params) =>
      params.value || <BCTypography variant="body4">Select</BCTypography>,
    cellStyle: (params) => StandardCellErrors(params, errors)
  },
  {
    field: 'fuelCategory',
    headerName: i18n.t('otherUses:otherUsesColLabels.fuelCategory'),
    headerComponent: RequiredHeader,
    cellEditor: AutocompleteCellEditor,
    cellEditorParams: (params) => {
      const fuelType = optionsData?.fuelTypes?.find(
        (obj) => params.data.fuelType === obj.fuelType
      );
      return {
        options: fuelType ? fuelType.fuelCategories.map((item) => item.category) : [],
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true
      };
    },
    suppressKeyboardEvent,
    cellRenderer: (params) =>
      params.value || <BCTypography variant="body4">Select</BCTypography>,
    cellStyle: (params) => StandardCellErrors(params, errors),
    minWidth: 200
  },
  {
    field: 'provisionOfTheAct',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'otherUses:otherUsesColLabels.provisionOfTheAct'
    ),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: (params) => {
      const fuelType = optionsData?.fuelTypes?.find(
        (type) => type.fuelType === params.data.fuelType
      )

      const provisionsOfTheAct = fuelType
        ? fuelType.provisionOfTheAct.map((provision) => provision.name)
        : []

      return {
        values: provisionsOfTheAct.sort()
      }
    },
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <BCTypography variant="body4">Select</BCTypography>),
    cellStyle: (params) => StandardCellErrors(params, errors),
    suppressKeyboardEvent,
    valueSetter: (params) => {
      if (params.newValue !== params.oldValue) {
        params.data.provisionOfTheAct = params.newValue;
        params.data.fuelCode = ''; // Reset fuelCode when provisionOfTheAct changes
        return true;
      }
      return false;
    },
    minWidth: 300,
    editable: true,
    tooltipValueGetter: (p) =>
      'Select the method for determining carbon intensity'
  },
  {
    field: 'fuelCode',
    headerName: i18n.t('otherUses:otherUsesColLabels.fuelCode'),
    cellEditor: AutocompleteCellEditor,
    cellEditorParams: (params) => {
        const fuelType = optionsData?.fuelTypes?.find((obj) => params.data.fuelType === obj.fuelType);

        return {
            options: fuelType?.fuelCodes?.map((item) => item.fuelCode) || [], // Safely access fuelCodes
            multiple: false,
            disableCloseOnSelect: false,
            freeSolo: false,
            openOnFocus: true
        };
    },
    cellRenderer: (params) => {
      const fuelType = optionsData?.fuelTypes?.find((obj) => params.data.fuelType === obj.fuelType);
      if (
        params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE &&
        fuelType?.fuelCodes?.length > 0
      ) {
        return params.value || <BCTypography variant="body4">Select</BCTypography>;
      }
      return null;
    },
    cellStyle: (params) => {
        const style = StandardCellErrors(params, errors);
        const conditionalStyle =
            params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE &&
            optionsData?.fuelTypes
                ?.find((obj) => params.data.fuelType === obj.fuelType)
                ?.fuelCodes?.length > 0
                ? { backgroundColor: '#fff', borderColor: 'unset' }
                : { backgroundColor: '#f2f2f2' };
        return { ...style, ...conditionalStyle };
    },
    suppressKeyboardEvent,
    minWidth: 150,
    editable: (params) => {
      const fuelType = optionsData?.fuelTypes?.find((obj) => params.data.fuelType === obj.fuelType);
      return (
        params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE &&
        fuelType?.fuelCodes?.length > 0
      );
    },
    valueSetter: (params) => {
        if (params.newValue) {
            params.data.fuelCode = params.newValue;

            const fuelType = optionsData?.fuelTypes?.find((obj) => params.data.fuelType === obj.fuelType);
            if (params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE) {
                const matchingFuelCode = fuelType?.fuelCodes?.find(
                    (fuelCode) => params.data.fuelCode === fuelCode.fuelCode
                );
                if (matchingFuelCode) {
                    params.data.fuelCodeId = matchingFuelCode.fuelCodeId;
                }
            }
        }
        return true;
    },
    tooltipValueGetter: (p) => 'Select the approved fuel code'
  },
  {
    field: 'quantitySupplied',
    headerName: i18n.t('otherUses:otherUsesColLabels.quantitySupplied'),
    headerComponent: RequiredHeader,
    cellEditor: NumberEditor,
    valueFormatter,
    type: 'numericColumn',
    cellEditorParams: {
      precision: 0,
      min: 0,
      showStepperButtons: false
    },
    cellStyle: (params) => StandardCellErrors(params, errors),
    minWidth: 200
  },
  {
    field: 'units',
    headerName: i18n.t('otherUses:otherUsesColLabels.units'),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: (params) => {
      const fuelType = optionsData?.fuelTypes?.find(
        (obj) => params.data.fuelType === obj.fuelType
      );
      const values = fuelType ? [fuelType.units] : [];
      return {
        values: values
      };
    },
    cellRenderer: (params) => {
      return params.value ? params.value : <BCTypography variant="body4">Select</BCTypography>;
    },
    cellStyle: (params) => StandardCellErrors(params, errors),
    editable: true,
    minWidth: 100
  },
  {
    field: 'ciOfFuel',
    headerName: i18n.t('otherUses:otherUsesColLabels.ciOfFuel'),
    valueFormatter: (params) => parseFloat(params.value).toFixed(2),
    cellStyle: (params) => StandardCellErrors(params, errors),
    editable: false,
    valueGetter: (params) => {
      const fuelType = optionsData?.fuelTypes?.find(
        (obj) => params.data.fuelType === obj.fuelType
      );

      if (params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE) {
        return (
          fuelType?.fuelCodes?.find(
            (item) => item.fuelCode === params.data.fuelCode
          )?.carbonIntensity || 0
        );
      }
      if (fuelType) {
        if (params.data.fuelType === 'Other' && params.data.fuelCategory) {
          const categories = fuelType.fuelCategories;
          const defaultCI = categories?.find(
            (cat) => cat.category === params.data.fuelCategory
          )?.defaultAndPrescribedCi;

          return defaultCI || 0;
        }

        return fuelType.defaultCarbonIntensity || 0;
      }

      return 0;
    },
    minWidth: 150,
  },
  {
    field: 'expectedUse',
    headerName: i18n.t('otherUses:otherUsesColLabels.expectedUse'),
    headerComponent: RequiredHeader,
    cellEditor: AutocompleteCellEditor,
    flex: 1,
    cellEditorParams: {
      options: optionsData.expectedUses.map((obj) => obj.name),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    suppressKeyboardEvent,
    cellRenderer: (params) =>
      params.value || <BCTypography variant="body4">Select</BCTypography>,
    cellStyle: (params) => StandardCellErrors(params, errors),
    minWidth: 200
  },
  {
    field: 'rationale',
    flex: 1,
    headerName: i18n.t('otherUses:otherUsesColLabels.otherExpectedUse'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    editable: (params) => params.data.expectedUse === 'Other',
    minWidth: 300
  }
]

export const defaultColDef = {
  editable: true,
  resizable: true,
  filter: false,
  floatingFilter: false,
  sortable: false,
  singleClickEdit: true
}
