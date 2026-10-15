import { describe, it, expect } from 'vitest'
import {
  parseReleaseDates,
  serializeReleaseDates,
  parseReleaseDatesArg,
  applyReleaseDates
} from '../../../../scripts/releaseDates.mjs'

// `git log --first-parent` order: newest first
const LOG = [
  '2026-10-06\tMerge pull request #5195 from bcgov/release-v1.3.9',
  '2026-09-25\tchore(release): update release notes for v1.3.9',
  '2026-09-18\tMerge pull request #5105 from bcgov/release-v1.3.8+7',
  '2026-08-27\tProd Release v1.3.8 (#4975)',
  '2026-08-10\tMerge pull request #4854 from bcgov/release-v1.3.7',
  '2026-08-04\tMerge pull request #4816 from bcgov/release-v1.3.7',
  ''
]

describe('parseReleaseDates', () => {
  it('uses the merge date of each release PR into main', () => {
    expect(parseReleaseDates(LOG)).toEqual({
      'v1.3.9': '2026-10-06',
      'v1.3.8': '2026-08-27',
      'v1.3.7': '2026-08-04'
    })
  })

  it('ignores hotfix branches and release-notes commits', () => {
    const dates = parseReleaseDates(LOG)
    expect(Object.keys(dates)).not.toContain('v1.3.8+7')
    expect(dates['v1.3.9']).not.toBe('2026-09-25')
  })

  it('keeps the first merge when a release branch merged twice', () => {
    expect(parseReleaseDates(LOG)['v1.3.7']).toBe('2026-08-04')
  })
})

describe('release dates argument', () => {
  it('round-trips through the build-arg string', () => {
    const dates = parseReleaseDates(LOG)
    expect(parseReleaseDatesArg(serializeReleaseDates(dates))).toEqual(dates)
  })

  it('treats a missing or malformed value as empty', () => {
    expect(parseReleaseDatesArg(undefined)).toEqual({})
    expect(parseReleaseDatesArg('')).toEqual({})
    expect(parseReleaseDatesArg('v1.3.9=soon,junk')).toEqual({})
  })
})

describe('applyReleaseDates', () => {
  const entries = [
    { version: '1.3.9', tag: 'v1.3.9', date: '2026-09-25' },
    { version: '1.3.8', tag: 'v1.3.8', date: '2026-08-27' },
    { version: '1.2.0', tag: 'v1.2.0', date: '2025-01-01' }
  ]

  it('replaces generation dates with release dates', () => {
    const { entries: updated, changes } = applyReleaseDates(entries, {
      'v1.3.9': '2026-10-06',
      'v1.3.8': '2026-08-27'
    })
    expect(updated.map((e) => e.date)).toEqual([
      '2026-10-06',
      '2026-08-27',
      '2025-01-01'
    ])
    expect(changes).toEqual([
      { tag: 'v1.3.9', from: '2026-09-25', to: '2026-10-06' }
    ])
  })

  it('leaves an unreleased entry with its generated date', () => {
    const { entries: updated } = applyReleaseDates(entries, {})
    expect(updated).toEqual(entries)
  })
})
