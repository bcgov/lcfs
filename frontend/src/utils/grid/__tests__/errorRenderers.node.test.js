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
})

describe('StandardCellStyle', () => {
  const params = { data: { id: 4 }, colDef: { field: 'bar', editable: false } }
  it('merges conditional styles', () => {
    const conditional = () => ({ color: 'blue' })
    const style = StandardCellStyle(params, {}, {}, conditional)
    expect(style.color).toBe('blue')
  })
})
