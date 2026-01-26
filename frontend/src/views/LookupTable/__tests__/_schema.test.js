import { describe, it, expect } from 'vitest'
import { lookupTableColumnDefs, DEFAULT_QUANTITY } from '../_schema'

describe('LookupTable schema', () => {
  it('defines expected columns in order', () => {
    const fields = lookupTableColumnDefs.map((col) => col.field)
    expect(fields).toEqual([
      'compliance_units',
      'quantity_supplied',
      'units',
      'fuelType',
      'fuelCategory',
      'endUse',
      'determiningCarbonIntensity',
      'targetCi',
      'ciOfFuel',
      'uci',
      'energyDensity',
      'eer',
      'energy_content'
    ])
  })

  it('computes compliance units', () => {
    const column = lookupTableColumnDefs.find(
      (col) => col.field === 'compliance_units'
    )
    const params = {
      data: {
        targetCi: 79.28,
        eer: 1.0,
        ciOfFuel: 94.38,
        uci: 0,
        energyDensity: 38.65
      }
    }
    const expected = Math.round(
      ((params.data.targetCi * params.data.eer -
        (params.data.ciOfFuel + params.data.uci)) *
        (DEFAULT_QUANTITY * params.data.energyDensity)) /
        1000000
    )
    expect(column.valueGetter(params)).toBe(expected)
  })

  it('returns N/A when compliance unit inputs are missing', () => {
    const column = lookupTableColumnDefs.find(
      (col) => col.field === 'compliance_units'
    )
    const params = {
      data: {
        targetCi: null,
        eer: 1.0,
        ciOfFuel: 94.38,
        uci: 0,
        energyDensity: 38.65
      }
    }
    expect(column.valueGetter(params)).toBe('N/A')
  })

  it('formats units and energy content', () => {
    const unitsColumn = lookupTableColumnDefs.find(
      (col) => col.field === 'units'
    )
    const energyContentColumn = lookupTableColumnDefs.find(
      (col) => col.field === 'energy_content'
    )
    const params = {
      data: {
        energyDensityUnit: 'MJ/L',
        energyDensity: 34.69
      }
    }
    expect(unitsColumn.valueGetter(params)).toBe('L')
    expect(energyContentColumn.valueGetter(params)).toBe(
      DEFAULT_QUANTITY * 34.69
    )
  })

  it('returns N/A for missing energy density', () => {
    const energyContentColumn = lookupTableColumnDefs.find(
      (col) => col.field === 'energy_content'
    )
    const unitsColumn = lookupTableColumnDefs.find(
      (col) => col.field === 'units'
    )
    const params = { data: {} }
    expect(unitsColumn.valueGetter(params)).toBe('N/A')
    expect(energyContentColumn.valueGetter(params)).toBe('N/A')
  })

  it('formats numeric columns with two decimals', () => {
    const targetCiColumn = lookupTableColumnDefs.find(
      (col) => col.field === 'targetCi'
    )
    const ciOfFuelColumn = lookupTableColumnDefs.find(
      (col) => col.field === 'ciOfFuel'
    )
    const uciColumn = lookupTableColumnDefs.find((col) => col.field === 'uci')
    const energyDensityColumn = lookupTableColumnDefs.find(
      (col) => col.field === 'energyDensity'
    )
    const eerColumn = lookupTableColumnDefs.find((col) => col.field === 'eer')

    expect(targetCiColumn.valueFormatter({ value: 78.681 })).toBe('78.68')
    expect(ciOfFuelColumn.valueFormatter({ value: 93.671 })).toBe('93.67')
    expect(uciColumn.valueFormatter({ value: 10.555 })).toBe('10.55')
    expect(
      energyDensityColumn.valueFormatter({ data: { energyDensity: 38.654 } })
    ).toBe('38.65')
    expect(eerColumn.valueFormatter({ value: 1 })).toBe('1.00')
  })
})
