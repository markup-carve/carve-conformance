import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export const runnerFiles = ['scripts/runtime/refresh-containers.mjs', 'scripts/runtime/container-evidence.mjs',
  'scripts/runtime/container-allocation.rs', 'scripts/runtime/container-worker.php']
export function containerRunnerDigest() {
  const sha = data => createHash('sha256').update(data).digest('hex')
  return sha(JSON.stringify(runnerFiles.map(file => [file,
    sha(readFileSync(new URL(`../../${file}`, import.meta.url)))])))
}

export const depths = [48, 96, 192]
export const families = ['quote', 'list']
export const phases = ['parse', 'render', 'html']
export const variants = ['baseline', 'current']
export const readers = ['rs', 'php']
export const source = (family, depth) => (family === 'quote' ? '> ' : '- ').repeat(depth) + 'end\n'

export function validateContainerEvidence(report) {
  assert.equal(report.schema, 1)
  assert.equal(report.observations.length, 144, 'Two rounds of all 72 reader/variant/fixture/phase combinations required')
  assert.deepEqual(report.roundOrder, [['baseline', 'current'], ['current', 'baseline']])
  const segments = report.observations.map(row => `${row.round}/${row.variant}`)
    .filter((value, index, values) => index === 0 || value !== values[index - 1])
  assert.deepEqual(segments, ['0/baseline', '0/current', '1/current', '1/baseline'])
  assert.equal(report.runnerSha256, containerRunnerDigest(), 'Benchmark sources changed; refresh the observations')
  assert.ok(report.host.logicalCpus > 0)
  for (const key of ['loadStart', 'loadEnd']) {
    assert.equal(report.host[key].length, 3)
    assert.ok(report.host[key].every(value => Number.isFinite(value) && value >= 0))
  }
  assert.equal(report.phpRuntime.length, 24)
  const runtimeKeys = new Set()
  for (const runtime of report.phpRuntime) {
    assert.ok(variants.includes(runtime.variant) && [0, 1].includes(runtime.round))
    assert.ok(families.includes(runtime.family) && phases.includes(runtime.phase))
    const key = [runtime.variant, runtime.round, runtime.family, runtime.phase].join('/')
    assert.ok(!runtimeKeys.has(key), `Duplicate PHP runtime: ${key}`)
    runtimeKeys.add(key)
    assert.equal(runtime.opcache, false)
    assert.ok(['', '0', 'disable', 'off'].includes(runtime.jit), 'PHP JIT must be disabled')
  }
  const pins = JSON.parse(readFileSync(new URL('../ownership/pins.json', import.meta.url)))
  const keys = new Set()
  const html = new Map()
  for (const row of report.observations) {
    assert.ok(readers.includes(row.reader))
    assert.ok(variants.includes(row.variant))
    assert.ok(families.includes(row.family))
    assert.ok(depths.includes(row.depth))
    assert.ok(phases.includes(row.phase))
    assert.ok([0, 1].includes(row.round))
    const key = [row.reader, row.variant, row.family, row.depth, row.phase, row.round].join('/')
    assert.ok(!keys.has(key), `Duplicate observation: ${key}`)
    keys.add(key)
    assert.equal(row.inputBytes, Buffer.byteLength(source(row.family, row.depth)))
    assert.equal(row.inputSha256, createHash('sha256').update(source(row.family, row.depth)).digest('hex'))
    assert.match(row.htmlSha256, /^[a-f0-9]{64}$/)
    assert.ok(row.htmlBytes > 0)
    for (const name of ['samplesMs', 'batchIterations', ...(row.reader === 'rs'
      ? ['samplesAllocatedBytes', 'samplesAllocationCalls']
      : ['samplesCpuMs', 'samplesPeakManagedBytes'])]) {
      assert.equal(row[name].length, 5, `${key}/${name}: five samples required`)
      assert.ok(row[name].every(value => Number.isFinite(value) && value >= 0), `${key}/${name}`)
    }
    assert.ok(row.batchIterations.every(value => Number.isInteger(value) && value > 0))
    if (row.reader === 'rs') for (const key of ['samplesAllocatedBytes', 'samplesAllocationCalls']) {
      assert.ok(row[key].every(value => Number.isSafeInteger(value) && value > 0))
    }
    const fixture = [row.reader, row.family, row.depth].join('/')
    const fingerprint = [row.htmlBytes, row.htmlSha256, row.inputSha256]
    if (html.has(fixture)) assert.deepEqual(fingerprint, html.get(fixture), `Output drift: ${fixture}`)
    else html.set(fixture, fingerprint)
  }
  for (const reader of readers) for (const variant of variants) {
    assert.match(report.sources[reader][variant].commit, /^[a-f0-9]{40}$/)
    assert.match(report.sources[reader][variant].sourceSha256, /^[a-f0-9]{64}$/)
    assert.ok(report.sources[reader][variant].sourceFiles > 10)
    if (variant === 'baseline') assert.equal(report.sources[reader][variant].commit, pins[reader].commit)
    else assert.notEqual(report.sources[reader].baseline.commit, report.sources[reader][variant].commit)
  }
  for (const variant of variants) assert.match(report.build.binarySha256[variant], /^[a-f0-9]{64}$/)
  return report
}
