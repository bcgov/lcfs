import { describe, it, expect } from 'vitest'
import { changelogCellStyle, changelogRowStyle } from '../changelogCellStyle'
import colors from '@/themes/base/colors'

describe('changelogCellStyle', () => {
  it('returns warning background for UPDATE diff and no strike-through', () => {
    const params = {
      data: {
        actionType: 'UPDATE',
        diff: ['foo'],
        updated: false
      }
    }
    const style = changelogCellStyle(params, 'foo')
    expect(style).toEqual({ backgroundColor: colors.alerts.warning.background })
  })

  it('adds textDecoration line-through when updated flag is true', () => {
    const params = {
      data: {
        actionType: 'UPDATE',
        diff: ['bar'],
        updated: true
      }
    }

    const style = changelogCellStyle(params, 'bar')
    expect(style).toEqual({
      backgroundColor: colors.alerts.warning.background,
      textDecoration: 'line-through'
    })
  })

  it('returns strike-through for DELETE action', () => {
    const params = {
      data: {
        actionType: 'DELETE'
      }
    }
    expect(changelogCellStyle(params, 'any')).toEqual({
      textDecoration: 'line-through'
    })
  })

  it('returns undefined when no styling applies', () => {
    const params = {
      data: {
        actionType: 'UPDATE',
        diff: ['other']
      }
    }
    expect(changelogCellStyle(params, 'foo')).toBeUndefined()
  })
})

describe('changelogRowStyle', () => {
  const makeParams = (actionType) => ({
    data: { actionType, isNewSupplementalEntry: true }
  })

  it('returns green background for CREATE in supplemental mode', () => {
    const style = changelogRowStyle(makeParams('CREATE'), true)
    expect(style).toEqual({ backgroundColor: colors.alerts.success.background })
  })

  it('returns yellow background for UPDATE in supplemental mode', () => {
    const style = changelogRowStyle(makeParams('UPDATE'), true)
    expect(style).toEqual({ backgroundColor: colors.alerts.warning.background })
  })

  it('returns red background for DELETE in supplemental mode', () => {
    const style = changelogRowStyle(makeParams('DELETE'), true)
    expect(style).toEqual({ backgroundColor: colors.alerts.error.background })
  })

  it('returns empty object when not supplemental', () => {
    const style = changelogRowStyle(makeParams('CREATE'), false)
    expect(style).toEqual({})
  })
})
