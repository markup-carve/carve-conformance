import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { scalingCases } from '../scripts/properties/scaling-cases.mjs'
import { cache, pins, verifyBuild, runnerDigest } from '../scripts/runtime/build.mjs'
import { runWorker } from '../scripts/runtime/bench.mjs'
import { decodeWorker } from '../scripts/properties/benchmark-results.mjs'

const fields = reader => ['samplesMs', 'samplesCpuMs', ...(reader === 'rs' ? ['samplesAllocatedBytes', 'samplesAllocationCalls'] : ['samplesPeakManagedBytes'])]

test('runtime evidence covers all shared families, phases and sizes with distinct memory units', () => {
  const report = JSON.parse(readFileSync(new URL('../reports/runtime-timings.json', import.meta.url)))
  assert.deepEqual(report.metadata.pins, pins)
  assert.equal(report.metadata.build.runnerSha256, runnerDigest())
  assert.equal(report.groups.length, 42)
  for (const reader of ['rs', 'php']) for (const mode of ['parse', 'render', 'html']) for (const [family, fixture] of Object.entries(scalingCases)) {
    const matches = report.groups.filter(g => g.reader === reader && g.mode === mode && g.family === family)
    assert.equal(matches.length, 1)
    const group = matches[0]
    assert.equal(group.completed, true)
    assert.deepEqual(group.rows.map(r => r.size), fixture.sizes)
    if (reader === 'php') {
      assert.equal(group.runtime.opcache, false)
      assert.equal(group.runtime.assertions, '-1')
      assert.ok(!group.runtime.extensions.includes('xdebug'))
      assert.ok(!group.runtime.extensions.includes('pcov'))
    }
    for (const row of group.rows) {
      assert.equal(row.status, 'ok')
      assert.equal(row.bytes, Buffer.byteLength(fixture.make(row.size)))
      if (family.startsWith('nested-')) assert.equal(row.depth, row.size)
      for (const field of fields(reader)) {
        assert.equal(row[field].length, 5)
        assert.ok(row[field].every(v => Number.isFinite(v) && v >= 0))
      }
      assert.ok(row.samplesMs.every(v => v > 0))
      assert.ok(row.batchIterations.every(n => Number.isInteger(n) && n > 0))
      assert.equal(reader === 'php' ? row.samplesAllocatedBytes : row.samplesPeakManagedBytes, undefined)
    }
  }
})

for (const reader of ['rs', 'php']) test(`${reader} workers check depth and exercise all API phases`, { skip: !existsSync(cache + 'build.json') }, () => {
  verifyBuild()
  for (const mode of ['parse', 'render', 'html']) {
    const result = runWorker(reader, { mode, family: 'nested-quotes', cases: [{ size: 8, source: scalingCases['nested-quotes'].make(8) }, { size: 8, source: '> end\n' }] })
    assert.equal(result.status, 0, result.stderr)
    const { rows, workerError } = decodeWorker(result)
    assert.equal(workerError, null)
    assert.equal(rows.length, 2)
    assert.equal(rows[0].status, 'ok')
    assert.equal(rows[0].depth, 8)
    for (const field of fields(reader)) assert.equal(rows[0][field].length, 5)
    assert.equal(rows[1].status, 'error')
    assert.match(rows[1].error, /Requested depth 8, parsed 1/)
  }
})
