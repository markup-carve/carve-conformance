import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { writeFileSync, renameSync } from 'node:fs'
import { cpus, platform, release, arch, loadavg } from 'node:os'
import { cache, root, pins, output, verifyBuild } from './build.mjs'
import { scalingCases } from '../properties/scaling-cases.mjs'
import { decodeWorker } from '../properties/benchmark-results.mjs'

let cachedPhpArgs
export function phpArguments() {
  if (!cachedPhpArgs) {
    const probe = JSON.parse(output('php', ['-n', '-r', 'echo json_encode([PHP_VERSION_ID, get_loaded_extensions()]);']))
    assert.ok(probe[0] >= 80200, 'PHP 8.2+ is required for resettable peak memory')
    cachedPhpArgs = ['-n', ...['mbstring', 'ctype'].filter(ext => !probe[1].includes(ext)).flatMap(ext => ['-d', `extension=${ext}`]), '-d', 'memory_limit=512M', '-d', 'zend.assertions=-1']
  }
  return cachedPhpArgs
}
export function runWorker(reader, task) {
  return spawnSync(reader === 'rs' ? cache + 'carve-runtime' : 'php', reader === 'rs' ? [] : [...phpArguments(), root + 'scripts/runtime/php.php', cache + 'php'], { input: JSON.stringify(task), encoding: 'utf8', timeout: 60_000, maxBuffer: 2_000_000 })
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const build = verifyBuild()
  const phpArgs = phpArguments()
  const destination = process.argv[2] ?? 'reports/runtime-timings.json'
  const families = process.argv[3]?.split(',') ?? Object.keys(scalingCases)
  for (const family of families) assert.ok(scalingCases[family], `Unknown family ${family}`)
  const metadata = { generatedAt: new Date().toISOString(), pins, build, php: output('php', [...phpArgs, '-r', 'echo PHP_VERSION;']), phpArgs, platform: platform(), release: release(), arch: arch(), cpu: cpus()[0].model, logicalCpus: cpus().length, loadStart: loadavg(),
    method: 'Serial release Rust and clean-INI PHP workers; One fresh process per size, with a 60s deadline including startup. Per size: 200ms warmup, five batches of at least 20ms, checked after every call. Timings exclude startup, input decoding, depth and output checks. Render reuses a parsed AST. Combined HTML uses the default API, including eligible fast paths. Rust drops each result within timing; PHP includes automatic cycle collection and collects cycles before batches. Memory is measured in five separate warmed calls, outside timing. These runs do not establish a cross-runtime ranking.',
    memory: { rs: 'Successful global allocator requests, counting the full new size on realloc; includes result disposal, excludes fixture setup, prebuilt render AST and reporting. Atomic counters enabled only during memory calls; the allocator flag check remains in timed calls. Requested bytes are allocation churn, not peak or retained memory.', php: 'Peak managed bytes above the pre-call memory_get_usage(false) baseline after cycle collection and memory_reset_peak_usage. Includes the live result; excludes prebuilt render AST, input and reporting. This is peak growth, not total allocated bytes or RSS. Clean INI disables opcache/JIT and profiling extensions.' } }
  const groups = []
  for (const reader of ['rs', 'php']) for (const mode of ['parse', 'render', 'html']) for (const family of families) {
    const fixture = scalingCases[family]
    const cases = fixture.sizes.map(size => ({ size, source: fixture.make(size) }))
    const group = { reader, mode, family, completed: false, runs: [], rows: [] }
    groups.push(group)
    for (const c of cases) {
      const result = runWorker(reader, { mode, family, cases: [c] })
      const decoded = decodeWorker(result)
      const row = decoded.rows.filter(r => r.size === c.size).at(-1) ?? { size: c.size, bytes: Buffer.byteLength(c.source), status: 'not-measured', error: decoded.workerError || result.stderr?.trim() || 'Worker stopped before this size' }
      const runtime = result.stdout?.split('\n').filter(Boolean).flatMap(line => { try { const value = JSON.parse(line); return value.event === 'runtime' ? [value] : [] } catch { return [] } })[0]
      if (runtime) {
        if (group.runtime) assert.deepEqual(runtime, group.runtime, 'PHP runtime changed within group')
        group.runtime = runtime
      }
      group.runs.push({ size: c.size, workerError: decoded.workerError, exitCode: result.status, signal: result.signal, stderr: result.stderr })
      group.rows.push(row)
      group.completed = group.rows.length === cases.length && group.runs.every(r => r.exitCode === 0 && !r.workerError) && group.rows.every(r => r.status === 'ok')
      writeFileSync(destination + '.partial', JSON.stringify({ metadata: { ...metadata, loadEnd: loadavg() }, groups }, null, 2) + '\n')
    }
    console.log(`${reader}/${mode}/${family}: ${group.rows.map(r => `${r.size}:${r.status}`).join(' ')}`)
  }
  assert.deepEqual(verifyBuild(), build, 'Build changed during measurement')
  assert.ok(groups.every(g => g.completed), 'Incomplete runtime measurements; inspect the .partial report')
  renameSync(destination + '.partial', destination)
}
