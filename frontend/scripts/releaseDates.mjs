#!/usr/bin/env node
/**
 * Stamps the real release date onto release-notes.json entries.
 *
 * Release notes are generated while the release branch is still open (see
 * .github/workflows/release-notes.yaml), so the `date` they carry is the day
 * the notes were generated — not the day the release reached production. The
 * true release date is the day the release-vX.Y.Z PR merged into `main`, which
 * only git history knows.
 *
 * The prod image is built by OpenShift from a clone without git history, so the
 * work is split in two:
 *
 *   collect  Runs in prod-ci, where the full history is checked out. Prints the
 *            release dates as `v1.3.9=2026-10-06,v1.3.8=2026-08-27`.
 *   apply    Runs in Dockerfile.openshift before `vite build`. Reads that string
 *            from RELEASE_DATES and rewrites the matching entries' dates. A
 *            missing or empty value is a no-op, so dev/test/PR builds keep the
 *            generated date.
 *
 * Usage:
 *   node scripts/releaseDates.mjs collect [git-ref]   (default ref: HEAD)
 *   RELEASE_DATES=... node scripts/releaseDates.mjs apply [path-to-json]
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// "Merge pull request #5195 from bcgov/release-v1.3.9"
const MERGE_RE = /from [^\s/]+\/release-(v?\d+\.\d+\.\d+)$/
// "Prod Release v1.3.8 (#4975)" — squash-merged release PRs
const SQUASH_RE = /^Prod Release (v?\d+\.\d+\.\d+) \(#\d+\)$/

const normalizeTag = (raw) => `v${raw.replace(/^v/, '')}`

/**
 * Maps each semantic release to the date its release PR first landed on main.
 *
 * Takes `git log --first-parent` output (newest first) as lines of
 * `YYYY-MM-DD<TAB>subject`. Hotfix branches (release-v1.3.8+4) are not semantic
 * releases and are ignored. When a release branch merged more than once, the
 * earliest merge is the release date; later merges are follow-up fixes.
 */
export function parseReleaseDates(logLines) {
  const dates = {}
  for (const line of logLines) {
    const [date, ...rest] = line.split('\t')
    const subject = rest.join('\t').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const match = subject.match(MERGE_RE) ?? subject.match(SQUASH_RE)
    // Newest first, so the last assignment wins with the earliest merge.
    if (match) dates[normalizeTag(match[1])] = date
  }
  return dates
}

export function serializeReleaseDates(dates) {
  return Object.entries(dates)
    .map(([tag, date]) => `${tag}=${date}`)
    .join(',')
}

export function parseReleaseDatesArg(value) {
  const dates = {}
  for (const pair of (value ?? '').split(',')) {
    const [tag, date] = pair.trim().split('=')
    if (tag && /^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
      dates[normalizeTag(tag)] = date
    }
  }
  return dates
}

/** Returns the entries with known release dates applied, plus what changed. */
export function applyReleaseDates(entries, dates) {
  const changes = []
  const updated = entries.map((entry) => {
    const date = dates[normalizeTag(entry.tag ?? entry.version ?? '')]
    if (!date || date === entry.date) return entry
    changes.push({ tag: entry.tag, from: entry.date, to: date })
    return { ...entry, date }
  })
  return { entries: updated, changes }
}

function collect(ref = 'HEAD') {
  const log = execFileSync(
    'git',
    [
      'log',
      '--first-parent',
      '--date=format-local:%Y-%m-%d',
      '--format=%cd%x09%s',
      ref
    ],
    // Release dates are reported in BC local time.
    { encoding: 'utf8', env: { ...process.env, TZ: 'America/Vancouver' } }
  )
  process.stdout.write(
    serializeReleaseDates(parseReleaseDates(log.split('\n')))
  )
}

function apply(path) {
  const dates = parseReleaseDatesArg(process.env.RELEASE_DATES)
  if (!Object.keys(dates).length) {
    console.log('RELEASE_DATES not set — keeping generated release note dates.')
    return
  }
  if (!existsSync(path)) {
    console.log(`${path} not found — nothing to stamp.`)
    return
  }
  const { entries, changes } = applyReleaseDates(
    JSON.parse(readFileSync(path, 'utf8')),
    dates
  )
  writeFileSync(path, JSON.stringify(entries, null, 2) + '\n')
  for (const { tag, from, to } of changes) {
    console.log(`Release date for ${tag}: ${from} → ${to}`)
  }
  console.log(`Stamped ${changes.length} release date(s).`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, arg] = process.argv.slice(2)
  if (command === 'collect') collect(arg)
  else if (command === 'apply') {
    apply(
      arg ??
        fileURLToPath(new URL('../public/release-notes.json', import.meta.url))
    )
  } else {
    console.error('Usage: releaseDates.mjs collect [ref] | apply [path]')
    process.exit(1)
  }
}
