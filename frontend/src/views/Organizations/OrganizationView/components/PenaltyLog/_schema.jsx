import { actions, validation } from '@/components/BCDataGrid/columns'
import { RequiredHeader } from '@/components/BCDataGrid/components'
import i18n from '@/i18n'
import { currencyFormatter } from '@/utils/formatters'

const booleanValueFormatter = ({ value }) => {
  if (value === null || value === undefined) return ''
  return value ? 'Yes' : 'No'
}

export const penaltyLogColumnDefs = [
  {
    headerName: i18n.t('org:penaltyLog.columns.complianceYear'),
    field: 'complianceYear',
    filter: 'agTextColumnFilter',
    minWidth: 180
  },
  {
    headerName: i18n.t('org:penaltyLog.columns.contraventionType'),
    field: 'contraventionType',
    minWidth: 320
  },
  {
    headerName: i18n.t('org:penaltyLog.columns.offenceHistory'),
    field: 'offenceHistory',
    minWidth: 190,
    filter: 'agSetColumnFilter',
    valueFormatter: booleanValueFormatter
  },
  {
    headerName: i18n.t('org:penaltyLog.columns.deliberate'),
    field: 'deliberate',
    minWidth: 340,
    filter: 'agSetColumnFilter',
    valueFormatter: booleanValueFormatter
  },
  {
    headerName: i18n.t('org:penaltyLog.columns.effortsToCorrect'),
    field: 'effortsToCorrect',
    minWidth: 230,
    filter: 'agSetColumnFilter',
    valueFormatter: booleanValueFormatter
  },
  {
    headerName: i18n.t('org:penaltyLog.columns.economicBenefitDerived'),
    field: 'economicBenefitDerived',
    minWidth: 390,
    filter: 'agSetColumnFilter',
    valueFormatter: booleanValueFormatter
  },
  {
    headerName: i18n.t('org:penaltyLog.columns.effortsToPreventRecurrence'),
    field: 'effortsToPreventRecurrence',
    minWidth: 280,
    filter: 'agSetColumnFilter',
    valueFormatter: booleanValueFormatter
  },
  {
    headerName: i18n.t('org:penaltyLog.columns.notes'),
    field: 'notes',
    minWidth: 400
  },
  {
    headerName: i18n.t('org:penaltyLog.columns.penaltyAmount'),
    field: 'penaltyAmount',
    filter: 'agNumberColumnFilter',
    valueFormatter: ({ value }) =>
      value === null || value === undefined
        ? ''
        : currencyFormatter(value, { maximumFractionDigits: 0 }),
    minWidth: 260
  }
]
const PENALTY_TYPES = ['Single contravention', 'Continuous contravention']
const booleanValueSetter = (field) => (params) => {
  const { newValue } = params
  if (newValue === undefined || newValue === null || newValue === '') {
    params.data[field] = false
    return true
  }
  if (typeof newValue === 'boolean') {
    params.data[field] = newValue
    return true
  }
  params.data[field] =
    newValue === 'Yes' || newValue === 'true' || newValue === 'True'
  return true
}
export const penaltyLogEditorColDefs = (
  compliancePeriodLabelMap,
  complianceValues,
  t
) => [
  validation,
  actions((params) => ({
    enableDuplicate: false,
    enableUndo: false,
    enableStatus: false,
    enableDelete: !!params.data.penaltyLogId
  })),
  {
    field: 'id',
    hide: true
  },
  {
    field: 'penaltyLogId',
    hide: true
  },
  {
    field: 'compliancePeriodId',
    headerComponent: RequiredHeader,
    headerName: t('org:penaltyLog.columns.compliancePeriod', {
      defaultValue: 'Compliance period'
    }),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: {
      values: complianceValues
    },
    valueFormatter: ({ value }) =>
      value !== undefined && value !== null
        ? (compliancePeriodLabelMap.get(Number(value)) ?? '')
        : '',
    valueSetter: (params) => {
      if (params.newValue === undefined || params.newValue === null) {
        return false
      }
      const numericValue = Number(params.newValue)
      params.data.compliancePeriodId = numericValue
      params.data.complianceYear = compliancePeriodLabelMap.get(numericValue)
      return true
    },
    minWidth: 200
  },
  {
    field: 'penaltyType',
    headerComponent: RequiredHeader,
    headerName: t('org:penaltyLog.columns.penaltyType', {
      defaultValue: 'Contravention type'
    }),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: {
      values: PENALTY_TYPES
    },
    minWidth: 220
  },
  {
    field: 'penaltyAmount',
    headerComponent: RequiredHeader,
    headerName: t('org:penaltyLog.columns.penaltyAmount', {
      defaultValue: 'Penalty amount (CAD)'
    }),
    cellEditor: 'agNumberCellEditor',
    valueFormatter: ({ value }) =>
      value === null || value === undefined
        ? ''
        : Number(value).toLocaleString('en-CA', {
            style: 'currency',
            currency: 'CAD',
            maximumFractionDigits: 0
          }),
    minWidth: 200
  },
  {
    field: 'offenceHistory',
    headerName: t('org:penaltyLog.columns.offenceHistory', {
      defaultValue: 'History of offences'
    }),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: {
      values: ['Yes', 'No']
    },
    valueFormatter: ({ value }) => (value ? 'Yes' : 'No'),
    valueSetter: booleanValueSetter('offenceHistory'),
    minWidth: 190
  },
  {
    field: 'deliberate',
    headerName: t('org:penaltyLog.columns.deliberate', {
      defaultValue: 'Deliberate contravention'
    }),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: {
      values: ['Yes', 'No']
    },
    valueFormatter: ({ value }) => (value ? 'Yes' : 'No'),
    valueSetter: booleanValueSetter('deliberate'),
    minWidth: 210
  },
  {
    field: 'effortsToCorrect',
    headerName: t('org:penaltyLog.columns.effortsToCorrect', {
      defaultValue: 'Efforts to correct'
    }),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: {
      values: ['Yes', 'No']
    },
    valueFormatter: ({ value }) => (value ? 'Yes' : 'No'),
    valueSetter: booleanValueSetter('effortsToCorrect'),
    minWidth: 180
  },
  {
    field: 'economicBenefitDerived',
    headerName: t('org:penaltyLog.columns.economicBenefitDerived', {
      defaultValue: 'Economic benefit derived'
    }),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: {
      values: ['Yes', 'No']
    },
    valueFormatter: ({ value }) => (value ? 'Yes' : 'No'),
    valueSetter: booleanValueSetter('economicBenefitDerived'),
    minWidth: 220
  },
  {
    field: 'effortsToPreventRecurrence',
    headerName: t('org:penaltyLog.columns.effortsToPreventRecurrence', {
      defaultValue: 'Efforts to prevent recurrence'
    }),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: {
      values: ['Yes', 'No']
    },
    valueFormatter: ({ value }) => (value ? 'Yes' : 'No'),
    valueSetter: booleanValueSetter('effortsToPreventRecurrence'),
    minWidth: 240
  },
  {
    field: 'notes',
    headerName: t('org:penaltyLog.columns.notes', {
      defaultValue: 'Notes'
    }),
    cellEditor: 'agLargeTextCellEditor',
    minWidth: 260
  }
]
