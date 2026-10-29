import { describe, expect, it, vi } from 'vite-plus/test'
import { DEFAULT_CI_FUEL_CODE, NEW_REGULATION_YEAR } from '@/constants/common'
import { otherUsesColDefs } from '../_schema'

vi.mock('@/i18n', () => ({
  default: { t: (key) => key }
}))

describe('Other Uses Q1 supplied column', () => {
  const optionsData = {
    fuelTypes: [{ fuelType: 'Biodiesel', renewable: true }],
    expectedUses: []
  }
  const column = otherUsesColDefs(
    optionsData,
    {},
    {},
    false,
    NEW_REGULATION_YEAR
  ).find(({ field }) => field === 'isQ1Supplied')
  const row = {
    fuelType: 'Biodiesel',
    fuelCategory: 'Diesel',
    provisionOfTheAct: DEFAULT_CI_FUEL_CODE,
    isCanadaProduced: false,
    isQ1Supplied: false
  }

  it.each([null, {}])(
    'displays No for an editable row with node %j',
    (node) => {
      const params = { data: row, node, colDef: column }

      expect(column.editable(params)).toBe(true)
      expect(column.valueGetter(params)).toBe('No')
    }
  )

  it.each([null, {}])('leaves an ineligible row blank with node %j', (node) => {
    const params = {
      data: { ...row, isCanadaProduced: true },
      node,
      colDef: column
    }

    expect(column.editable(params)).toBe(false)
    expect(column.valueGetter(params)).toBe('')
  })

  it('preserves Yes for a supplied row regardless of editability', () => {
    expect(
      column.valueGetter({
        data: { ...row, isCanadaProduced: true, isQ1Supplied: true },
        node: null,
        colDef: column
      })
    ).toBe('Yes')
  })
})
