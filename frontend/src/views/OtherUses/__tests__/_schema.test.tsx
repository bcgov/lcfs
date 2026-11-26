import { describe, expect, it, vi } from 'vite-plus/test'
import { DEFAULT_CI_FUEL_CODE, NEW_REGULATION_YEAR } from '@/constants/common'
import { otherUsesColDefs } from '../_schema'
import type { OptionsData } from '@/types/schema'
import type {
  EditableCallbackParams,
  ICellEditorParams,
  ValueGetterParams
} from 'ag-grid-community'

vi.mock('@/i18n', () => ({
  default: { t: (key: string) => key }
}))

describe('Other Uses Q1 supplied column', () => {
  const optionsData: OptionsData = {
    fuelTypes: [
      {
        fuelType: 'Biodiesel',
        fuelTypeId: 1,
        unit: 'L',
        defaultCarbonIntensity: 0,
        fuelCategories: [],
        fuelCodes: [],
        provisions: [],
        eerRatios: [],
        renewable: true
      }
    ],
    expectedUses: []
  }
  const column = otherUsesColDefs(
    optionsData,
    {},
    {},
    false,
    NEW_REGULATION_YEAR
  ).find(({ field }) => field === 'isQ1Supplied')
  if (!column) throw new Error('Expected Q1 supplied column definition')
  const row = {
    fuelType: 'Biodiesel',
    fuelCategory: 'Diesel',
    provisionOfTheAct: DEFAULT_CI_FUEL_CODE,
    isCanadaProduced: false,
    isQ1Supplied: false
  }
  const optionalNodes: Array<ICellEditorParams['node'] | null> = [
    null,
    {} as ICellEditorParams['node']
  ]

  it.each(optionalNodes)(
    'displays No for an editable row with node %j',
    (node: ICellEditorParams['node'] | null) => {
      const params = { data: row, node, colDef: column }
      const editable = column.editable
      const valueGetter = column.valueGetter
      if (typeof editable !== 'function' || typeof valueGetter !== 'function') {
        throw new Error(
          'Expected Q1 supplied editable and value getter callbacks'
        )
      }

      expect(editable(params as EditableCallbackParams)).toBe(true)
      expect(valueGetter(params as ValueGetterParams)).toBe('No')
    }
  )

  it.each(optionalNodes)(
    'leaves an ineligible row blank with node %j',
    (node: ICellEditorParams['node'] | null) => {
      const params = {
        data: { ...row, isCanadaProduced: true },
        node,
        colDef: column
      }

      const editable = column.editable
      const valueGetter = column.valueGetter
      if (typeof editable !== 'function' || typeof valueGetter !== 'function') {
        throw new Error(
          'Expected Q1 supplied editable and value getter callbacks'
        )
      }
      expect(editable(params as EditableCallbackParams)).toBe(false)
      expect(valueGetter(params as ValueGetterParams)).toBe('')
    }
  )

  it('preserves Yes for a supplied row regardless of editability', () => {
    expect(
      (column.valueGetter as (params: ValueGetterParams) => unknown)({
        data: { ...row, isCanadaProduced: true, isQ1Supplied: true },
        node: null,
        colDef: column
      } as ValueGetterParams)
    ).toBe('Yes')
  })
})
