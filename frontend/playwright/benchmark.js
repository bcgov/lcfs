import 'dotenv/config'
import { spawn } from 'node:child_process'
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from 'node:fs'
import { cpus, totalmem } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(frontendDir)
const { values } = parseArgs({
  options: {
    repetitions: { type: 'string', default: '3' },
    'base-url': { type: 'string' },
    'output-dir': { type: 'string' }
  }
})
const repetitions = Number(values.repetitions)
if (!Number.isInteger(repetitions) || repetitions < 1) {
  throw new Error('--repetitions must be a positive integer')
}

let cypressEnv = {}
try {
  cypressEnv = JSON.parse(readFileSync('cypress.env.json', 'utf8'))
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
const credentialPairs = [
  ['PLAYWRIGHT_ADMIN_IDIR_USERNAME', 'PLAYWRIGHT_ADMIN_IDIR_PASSWORD'],
  ['PLAYWRIGHT_IDIR_TEST_USER', 'PLAYWRIGHT_IDIR_TEST_PASS'],
  ['CYPRESS_ADMIN_IDIR_USERNAME', 'CYPRESS_ADMIN_IDIR_PASSWORD'],
  ['CYPRESS_IDIR_TEST_USER', 'CYPRESS_IDIR_TEST_PASS'],
  ['ADMIN_IDIR_USERNAME', 'ADMIN_IDIR_PASSWORD'],
  ['IDIR_TEST_USER', 'IDIR_TEST_PASS']
]
const credentials = credentialPairs
  .map((keys) => keys.map((key) => process.env[key] || cypressEnv[key]))
  .find(([username, password]) => username && password)
if (!credentials) {
  throw new Error(
    'Configure a complete IDIR test credential pair before benchmarking'
  )
}

const baseURL =
  values['base-url'] ||
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.CYPRESS_BASE_URL ||
  'http://localhost:3000'
const runId = 'benchmark-' + new Date().toISOString().replace(/[.:]/g, '-')
const outputDir = resolve(
  values['output-dir'] || join('playwright/reports', runId)
)
mkdirSync(outputDir, { recursive: true })
const configurations = [
  { name: 'cypress', script: 'cypress:run:benchmark:sequential', count: 22 },
  ...[1, 2, 3, 4, 6].map((workers) => ({
    name: 'playwright-' + workers,
    script:
      'playwright:run:benchmark:' +
      ({ 1: 'sequential', 6: 'parallel' }[workers] || workers + 'workers'),
    workers,
    count: 22
  })),
  {
    name: 'playwright-webkit',
    script: 'playwright:run:benchmark:webkit',
    workers: 1,
    count: 11
  }
]
const results = {
  startedAt: new Date().toISOString(),
  baseURL,
  repetitions,
  machine: {
    platform: process.platform,
    arch: process.arch,
    logicalCPUs: cpus().length,
    memoryBytes: totalmem(),
    node: process.version
  },
  samples: []
}
const save = () =>
  writeFileSync(
    join(outputDir, 'results.json'),
    JSON.stringify(results, null, 2) + '\n'
  )
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const validateReports = (configuration, trialDir) => {
  if (configuration.name === 'cypress') {
    const totals = { tests: 0, passes: 0, failures: 0, pending: 0, skipped: 0 }
    for (const browser of ['chrome', 'firefox']) {
      const reportDir = join(trialDir, 'cypress', browser)
      for (const file of readdirSync(reportDir).filter((file) =>
        file.endsWith('.json')
      )) {
        const { stats } = readJson(join(reportDir, file))
        for (const key of Object.keys(totals)) totals[key] += stats[key] || 0
      }
    }
    return {
      ...totals,
      valid:
        totals.tests === configuration.count &&
        totals.passes === configuration.count &&
        totals.failures === 0 &&
        totals.pending === 0 &&
        totals.skipped === 0
    }
  }
  const stats = readJson(join(trialDir, 'playwright/results.json')).stats
  return {
    ...stats,
    valid:
      stats.expected === configuration.count &&
      stats.skipped === 0 &&
      stats.unexpected === 0 &&
      stats.flaky === 0
  }
}

console.log('Local benchmark output:', outputDir)
try {
  for (let round = 1; round <= repetitions; round++) {
    // Rotate the order so a configuration is not always measured first or last.
    const offset = ((round - 1) * 2) % configurations.length
    const order = [
      ...configurations.slice(offset),
      ...configurations.slice(0, offset)
    ]
    for (const configuration of order) {
      const trialDir = join(
        outputDir,
        'round-' + round + '-' + configuration.name
      )
      mkdirSync(trialDir, { recursive: true })
      const logFd = openSync(join(trialDir, 'run.log'), 'w')
      const started = performance.now()
      console.log(
        `[round ${round}/${repetitions}] ${configuration.name}: running`
      )
      let exitCode
      try {
        exitCode = await new Promise((resolve, reject) => {
          const child = spawn(
            process.platform === 'win32' ? 'npm.cmd' : 'npm',
            ['run', configuration.script],
            {
              cwd: frontendDir,
              stdio: ['ignore', logFd, logFd],
              env: {
                ...process.env,
                CI: '',
                E2E_BENCHMARK: 'true',
                CYPRESS_BASE_URL: baseURL,
                PLAYWRIGHT_BASE_URL: baseURL,
                CYPRESS_ADMIN_IDIR_USERNAME: credentials[0],
                CYPRESS_ADMIN_IDIR_PASSWORD: credentials[1],
                PLAYWRIGHT_ADMIN_IDIR_USERNAME: credentials[0],
                PLAYWRIGHT_ADMIN_IDIR_PASSWORD: credentials[1],
                E2E_REPORT_DIR: join(trialDir, 'cypress'),
                PLAYWRIGHT_REPORT_DIR: join(trialDir, 'playwright')
              }
            }
          )
          child.once('error', reject)
          child.once('close', resolve)
        })
      } finally {
        closeSync(logFd)
      }
      const sample = {
        round,
        name: configuration.name,
        workers: configuration.workers,
        wallSeconds: (performance.now() - started) / 1000,
        exitCode,
        trialDir
      }
      results.samples.push(sample)
      save()
      if (exitCode !== 0)
        throw new Error(
          `${configuration.name} failed; inspect ${trialDir}/run.log`
        )
      sample.report = validateReports(configuration, trialDir)
      save()
      if (!sample.report.valid)
        throw new Error(
          `${configuration.name} did not pass all ${configuration.count} executions without skips/retries; inspect ${trialDir}`
        )
      console.log(
        `[round ${round}/${repetitions}] ${configuration.name}: ${configuration.count}/${configuration.count} passed, ${sample.wallSeconds.toFixed(2)} s`
      )
    }
  }
  results.summary = configurations.map(({ name, workers }) => {
    const times = results.samples
      .filter((sample) => sample.name === name)
      .map((sample) => sample.wallSeconds)
      .sort((a, b) => a - b)
    const middle = Math.floor(times.length / 2)
    return {
      name,
      workers,
      medianSeconds:
        times.length % 2
          ? times[middle]
          : (times[middle - 1] + times[middle]) / 2,
      minSeconds: times[0],
      maxSeconds: times[times.length - 1]
    }
  })
  results.finishedAt = new Date().toISOString()
  save()
  console.table(results.summary)
} catch (error) {
  results.error = error.message
  save()
  console.error(error.message)
  process.exitCode = 1
}
