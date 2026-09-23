import { describe, it, expect } from 'vitest'
import {
  StandardCellErrors,
  StandardCellWarningAndErrors,
  StandardCellStyle
} from '../errorRenderers'

describe('StandardCellErrors', () => {
  const baseParams = {
    data: { id: 1 },
    colDef: { field: 'name', editable: false }
  }

  it('adds error border when field has error', () => {
    const errors = { 1: ['name'] }
    const style = StandardCellErrors(baseParams, errors)
    expect(style).toMatchObject({ border: '2px solid red', borderColor: 'red' })
  })

  it('removes error border when no error', () => {
    const errors = {}
    const style = StandardCellErrors(baseParams, errors)
    expect(style.borderColor).toBe('unset')
  })

  it('sets background white when editable', () => {
    const params = {
      ...baseParams,
      colDef: { field: 'name', editable: true }
    }
    const style = StandardCellErrors(params, {})
    expect(style.backgroundColor).toBe('#fff')
  })

  it('sets background grey when not editable', () => {
    const style = StandardCellErrors(baseParams, {})
    expect(style.backgroundColor).toBe('#f2f2f2')
  })

  it('evaluates editable when it is a function', () => {
    const editableParams = {
      ...baseParams,
      colDef: { field: 'name', editable: () => true }
    }
    expect(StandardCellErrors(editableParams, {}).backgroundColor).toBe('#fff')

    const readOnlyParams = {
      ...baseParams,
      colDef: { field: 'name', editable: () => false }
    }
    expect(StandardCellErrors(readOnlyParams, {}).backgroundColor).toBe(
      '#f2f2f2'
    )
  })

  it('does not treat other fields on the same row as errors', () => {
    const errors = { 1: ['quantity'] }
    const style = StandardCellErrors(baseParams, errors)
    expect(style.borderColor).toBe('unset')
  })
})

describe('StandardCellWarningAndErrors', () => {
  const params = {
    data: { id: 2, actionType: 'UPDATE' },
    colDef: { field: 'foo', editable: false }
  }
  it('adds warning border when warning present', () => {
    const warnings = { 2: ['foo'] }
    const style = StandardCellWarningAndErrors(params, {}, warnings)
    expect(style.border).toBe('2px solid #fcba19')
  })

  it('prioritizes CREATE action for warnings (no background override)', () => {
    const createParams = { ...params, data: { id: 3, actionType: 'CREATE' } }
    const warnings = { 3: ['foo'] }
    const style = StandardCellWarningAndErrors(createParams, {}, warnings)
    expect(style.border).toBe('2px solid #fcba19')
    // Ensure background not overridden by StandardCellErrors for readonly rows
    expect(style.backgroundColor).toBe('#f2f2f2')
  })

  it('keeps error styling for CREATE rows without warnings', () => {
    const createParams = { ...params, data: { id: 3, actionType: 'CREATE' } }
    const errors = { 3: ['foo'] }
    const style = StandardCellWarningAndErrors(createParams, errors, null)
    expect(style.border).toBe('2px solid red')
  })

  it('overwrites an error border with a warning border', () => {
    const errors = { 2: ['foo'] }
    const warnings = { 2: ['foo'] }
    const style = StandardCellWarningAndErrors(params, errors, warnings)
    expect(style.border).toBe('2px solid #fcba19')
  })

  it('does not apply a warning when the field is not listed', () => {
    const warnings = { 2: ['other'] }
    const style = StandardCellWarningAndErrors(params, {}, warnings)
    expect(style.borderColor).toBe('unset')
  })
})

describe('StandardCellStyle', () => {
  const params = { data: { id: 4 }, colDef: { field: 'bar', editable: false } }
  it('merges conditional styles', () => {
    const conditional = () => ({ color: 'blue' })
    const style = StandardCellStyle(params, {}, {}, conditional)
    expect(style.color).toBe('blue')
  })

  it('returns the warning/error style when no conditional function is given', () => {
    const style = StandardCellStyle(params, {}, {})
    expect(style.backgroundColor).toBe('#f2f2f2')
    expect(style.color).toBeUndefined()
  })

  it('ignores a non-function conditional style argument', () => {
    const style = StandardCellStyle(params, {}, {}, { color: 'red' })
    expect(style.color).toBeUndefined()
  })
})
