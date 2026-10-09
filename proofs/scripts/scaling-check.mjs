import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync, renameSync } from 'node:fs'
import { cpus, platform, release, arch, loadavg } from 'node:os'
import { fileURLToPath } from 'node:url'
import { scalingCases } from './properties/scaling-cases.mjs'
import { evidenceEnvironment } from './evidence-environment.mjs'
import { decodeWorker, expectedRefusal, runnerDigest, fitExponent } from './properties/benchmark-results.mjs'

const environment = evidenceEnvironment()
assert.equal(environment.specDirty, false, 'Benchmark requires a clean pinned specification')
const root = fileURLToPath(new URL('..', import.meta.url))
const output = process.argv[2] ?? 'reports/scaling-results.json'
const families = process.argv[3]?.split(',') ?? Object.keys(scalingCases)
for (const family of families) assert.ok(scalingCases[family], `Unknown family: ${family}`)
const groups = []
for (const reader of ['js', 'spec']) for (const mode of ['parse', 'html']) for (const family of families) {
  const result = spawnSync(process.execPath, ['--expose-gc', fileURLToPath(new URL('./scaling-worker.mjs', import.meta.url)), reader, mode, family],
    { encoding: 'utf8', timeout: 60_000, maxBuffer: 2_000_000, cwd: root })
  const { rows, workerError } = decodeWorker(result)
  let previous
  for (const row of rows) if (row.status === 'ok') {
    if (previous) { row.byteRatio = row.bytes / previous.bytes; row.timeRatio = row.medianMs / previous.medianMs; row.exponent = Math.log(row.timeRatio) / Math.log(row.byteRatio) }
    previous = row
  }
  const skippedSizes = scalingCases[family].sizes.filter(size => !rows.some(row => row.size === size))
  const group = { reader, mode, family, rows, skippedSizes, exitCode: result.status, signal: result.signal, workerError, fittedExponent: fitExponent(rows), completed: !workerError && result.status === 0 && rows.length === scalingCases[family].sizes.length && rows.every(r => r.status === 'ok'), stderr: (result.stderr ?? '').trim() }
  groups.push(group)
  console.log(`${reader}/${mode}/${family}: ${rows.map(r => `${r.size}:${r.status === 'ok' ? r.medianMs.toFixed(2) + 'ms' : r.status}`).join(' ')}`)
  const metadata = { generatedAt: new Date().toISOString(), node: process.version, platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model,
    logicalCpus: cpus().length, loadAverage: loadavg(), ...environment,
    runnerSha256: runnerDigest(),
    method: 'Serial worker processes; source generation and startup excluded. Two warmups, five batches, 1–32 parses per batch; GC before each batch. 60s deadline per reader/mode/family, including startup. RSS is cumulative process peak. Counters instrument selected JS/spec layout work only; their fields are not directly comparable.' }
  writeFileSync(output + '.partial', JSON.stringify({ metadata, groups }, null, 2) + '\n')
}

renameSync(output + '.partial', output)
const unexpected = groups.filter(g => !g.completed && !expectedRefusal(g))
if (unexpected.length) { console.error('Unexpected incomplete benchmark groups:', unexpected.map(g => `${g.reader}/${g.mode}/${g.family}`).join(', ')); process.exitCode = 1 }
