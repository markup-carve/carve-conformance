import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync, renameSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { cpus, loadavg, platform, arch } from 'node:os'
import { comparisonEnvironment, digest } from '../comparison/environment.mjs'
import { measurementHost, checkHostLoad } from '../comparison/measurement-host.mjs'
const output = process.argv[2] ?? 'reports/nesting-profile.json'
const metadata = { ...comparisonEnvironment(), node: process.version, cpu: cpus()[0].model, logicalCpus: cpus().length, platform: platform(), arch: arch(), loadStart: loadavg(), generatedAt: new Date().toISOString(), execution: measurementHost(), runnerSha256: digest(['scripts/profiling/run.mjs', 'scripts/profiling/worker.mjs', 'scripts/profiling/instrument.mjs', 'scripts/profiling/summary.mjs', 'scripts/comparison/measurement-host.mjs']), method: 'Serial workers. At least 200ms warmup, then five uninstrumented batches of at least 20ms with 16-call time checks and no iteration cap; GC before each batch. Separate one-call regex and suffix instrumentation (UTF-16 lengths; string inputs only), 300ms CPU profile at 100us sampling, and 20-call heap sampling at 4096 bytes including collected objects. CPU and heap profiles are statistical estimates; regex input lengths are exposure counts, not engine step counts.' }
const groups = []
for (const reader of ['js', 'spec']) for (const phase of ['parse', 'render']) for (const family of ['quotes', 'lists']) for (const size of [32, 64, 128, 192]) {
  checkHostLoad()
  const result = spawnSync(process.execPath, ['--expose-gc', fileURLToPath(new URL('./worker.mjs', import.meta.url)), reader, phase, family, String(size)], { encoding: 'utf8', timeout: 60_000, maxBuffer: 8_000_000 })
  checkHostLoad()
  let group
  try { assert.equal(result.status, 0, result.error?.message ?? result.stderr); group = JSON.parse(result.stdout) }
  catch (error) { group = { reader, phase, family, size, error: error.message } }
  groups.push(group)
  console.log(`${reader}/${phase}/${family}/${size}: ${group.error ?? 'recorded'}`)
  writeFileSync(output + '.partial', JSON.stringify({ metadata: { ...metadata, loadEnd: loadavg() }, groups }, null, 2) + '\n')
}
renameSync(output + '.partial', output)
assert.ok(groups.every(g => !g.error), 'Profile worker failed; inspect output')
