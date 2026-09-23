import { describe, it, expect } from 'vitest'
import {
  fuelTypeOtherConditionalStyle,
  isFuelTypeOther,
  FUEL_TYPE_OTHER
} from '../fuelTypeOther'

const makeParams = (actionType = 'UPDATE', fuelType = FUEL_TYPE_OTHER) => ({
  data: {
    actionType,
    fuelType
  }
})

describe('fuelTypeOtherConditionalStyle', () => {
  it('returns white background when fuel type is Other on UPDATE', () => {
    const style = fuelTypeOtherConditionalStyle(
      makeParams('UPDATE', FUEL_TYPE_OTHER)
    )
    expect(style.backgroundColor).toBe('#fff')
  })

  it('returns grey background when fuel type not Other', () => {
    const style = fuelTypeOtherConditionalStyle(makeParams('UPDATE', 'Diesel'))
    expect(style.backgroundColor).toBe('#f2f2f2')
  })

  it('does not override background for CREATE', () => {
    const style = fuelTypeOtherConditionalStyle(
      makeParams('CREATE', FUEL_TYPE_OTHER)
    )
    // backgroundColor should be undefined
    expect(style.backgroundColor).toBeUndefined()
    expect(style.borderColor).toBe('unset')
  })
})

describe('isFuelTypeOther', () => {
  it('detects Other fuel type', () => {
    expect(isFuelTypeOther(makeParams('UPDATE', FUEL_TYPE_OTHER))).toBe(true)
    expect(isFuelTypeOther(makeParams('UPDATE', 'Gasoline'))).toBe(false)
  })
})
