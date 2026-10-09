import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync, renameSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { cpus, platform, release, arch, loadavg } from 'node:os'
import { comparisonEnvironment, digest, comparisonTimingFiles } from './environment.mjs'
import { scalingCases } from './scaling-cases.mjs'
import { decodeWorker } from '../properties/benchmark-results.mjs'
import { checkControls } from './controls.mjs'
import { measurementHost, checkHostLoad } from './measurement-host.mjs'
const output = process.argv[2] ?? 'reports/comparison-timings.json', families = process.argv[3]?.split(',') ?? Object.keys(scalingCases)
for (const family of families) assert.ok(scalingCases[family])
const metadata = { ...comparisonEnvironment(), runnerSha256: digest(comparisonTimingFiles), generatedAt: new Date().toISOString(), node: process.version, platform: platform(), release: release(), arch: arch(), cpu: cpus()[0].model, logicalCpus: cpus().length, loadStart: loadavg(), execution: measurementHost(), controls: checkControls(), method: 'Two fresh-worker rounds per family and API, Carve-Djot-CommonMark then CommonMark-Djot-Carve. Serial workers; 60s group deadline including startup; 200ms warmup per size, five batches of at least 20ms with 16-call time checks, GC before batches. Each round remains in the raw data. Render reuses a prebuilt AST. CPU includes all process threads. RSS is cumulative peak.' }
const groups = []
for (const family of families) for (const mode of ['parse', 'render', 'html']) {
  const readers = ['carve', 'djot', 'commonmark'], rounds = new Map(readers.map(r => [r, []]))
  for (const [round, order] of [readers, [...readers].reverse()].entries()) for (const reader of order) {
    const loadStart = checkHostLoad()
    const result = spawnSync(process.execPath, ['--expose-gc', fileURLToPath(new URL('./worker.mjs', import.meta.url)), reader, mode, family], { encoding: 'utf8', timeout: 60_000, maxBuffer: 2_000_000 })
    const { rows, workerError } = decodeWorker(result)
    const completed = !workerError && result.status === 0 && rows.length === scalingCases[family].sizes.length && rows.every(r => r.status === 'ok')
    const observation = { round, order, loadStart, loadEnd: checkHostLoad(), completed, workerError, exitCode: result.status, signal: result.signal, rows }
    rounds.get(reader).push(observation)
    console.log(`${reader}/${mode}/${family}/round-${round}: ${completed ? 'recorded' : workerError ?? 'failed'}`)
    const pending = readers.filter(name => rounds.get(name).length).map(name => ({ reader: name, mode, family, completed: rounds.get(name).length === 2 && rounds.get(name).every(r => r.completed), rounds: rounds.get(name), rows: rounds.get(name)[0].rows }))
    writeFileSync(output + '.partial', JSON.stringify({ metadata: { ...metadata, loadEnd: loadavg() }, groups: [...groups, ...pending] }, null, 2) + '\n')
    assert.ok(completed, JSON.stringify(observation))
  }
  for (const reader of readers) {
    const observations = rounds.get(reader)
    // Summary rows retain the first round for older consumers; reports/charts use every round.
    groups.push({ reader, mode, family, completed: true, workerError: null, exitCode: 0, signal: null, rows: observations[0].rows, rounds: observations })
  }
  writeFileSync(output + '.partial', JSON.stringify({ metadata: { ...metadata, loadEnd: loadavg() }, groups }, null, 2) + '\n')
}
renameSync(output + '.partial', output)
