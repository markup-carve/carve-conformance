import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { classify, controlFor } from '../scripts/differential/triage.mjs'
import { performanceFixtures } from '../scripts/differential/performance-fixtures.mjs'
const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

test('triage covers every current disagreement exactly once and retains provenance', () => {
  const record = JSON.parse(read('reports/djot-difference-triage.json'))
  const baselineBytes = read('reports/djot-differential.json'), baseline = JSON.parse(baselineBytes)
  const differences = baseline.differences.filter(row => row.jsCurrent !== row.ocaml)
  assert.equal(record.metadata.baselineSha256, hash(baselineBytes))
  assert.deepEqual(record.metadata.native, baseline.metadata.native)
  assert.deepEqual(record.metadata.jsCurrent, baseline.metadata.jsCurrent)
  assert.deepEqual(record.rows.map(row => row.id), differences.map(row => row.id))
  const counts = {}
  record.rows.forEach((row, i) => {
    const original = differences[i]
    assert.equal(row.originalSha256, hash(original.source))
    assert.equal(row.family, classify(original.source, original.jsCurrent, original.ocaml))
    assert.equal(row.family, classify(row.source, row.jsCurrent, row.ocaml))
    assert.equal(row.control.sourceSha256, hash(controlFor(original.source, row.family)))
    assert.equal(row.control.agreement, true)
    assert.match(row.control.htmlSha256, /^[a-f0-9]{64}$/)
    assert.ok(row.source.length <= original.source.length)
    counts[row.family] = (counts[row.family] ?? 0) + 1
  })
  assert.deepEqual(record.counts.families, counts)
  assert.deepEqual(counts, { 'unresolved-image-alt': 223, 'block-attribute-recovery': 24, 'escaped-reference-close': 41, 'smart-punctuation-id': 7 })
  assert.equal(record.counts.differences, differences.length)
  assert.equal(record.counts.agreeingControls, differences.length)
  assert.equal(record.counts.distinctReducedSources, new Set(record.rows.map(row => row.source)).size)
  for (const [path, digest] of Object.entries(record.metadata.sourceHashes)) assert.equal(hash(read(path)), digest, path)
})

test('focused cases distinguish escapes, recovery and deliberate identifier policy', () => {
  const cases = JSON.parse(read('tests/differential/triage-cases.json'))
  const record = JSON.parse(read('reports/djot-difference-triage.json'))
  assert.deepEqual(record.focused, cases)
  assert.equal(new Set(cases.map(row => row.id)).size, cases.length)
  for (const row of cases) assert.equal(classify(row.source, row.jsCurrent, row.ocaml), row.family, row.id)
  assert.equal(classify('x', '<p>x</p>\n', '<p>y</p>\n'), 'unclassified')
  assert.equal(classify('![x][r]', '<p><img></p>\n', '<p><img alt="x"></p>\n<p>extra</p>\n'), 'unclassified')
  assert.equal(classify('![x][r]', '<p><img></p>\n', '<p><img alt=""></p>\n'), 'unclassified')
  assert.throws(() => controlFor('x', 'other'), /Unknown/)
})

test('performance record retains failures, exact sources and separate phase observations', () => {
  const record = JSON.parse(read('reports/djot-triage-performance.json'))
  assert.equal(record.groups.length, Object.keys(performanceFixtures).length * 3)
  for (const [path, digest] of Object.entries(record.metadata.sourceHashes)) assert.equal(hash(read(path)), digest, path)
  for (const group of record.groups) {
    const fixture = performanceFixtures[group.family]
    assert.deepEqual(group.rows.map(row => row.size), fixture.sizes)
    for (const row of group.rows) {
      const source = fixture.make(row.size)
      assert.equal(row.bytes, Buffer.byteLength(source))
      assert.equal(row.sourceSha256, hash(source))
      for (const engine of ['djot.js', 'djot.v']) {
        const result = row.engines[engine]
        if (result.status === 'error') { assert.ok(result.error); continue }
        assert.equal(result.phase, group.phase)
        assert.equal(result.samples.length, 5)
        assert.ok(result.samples.every(sample => sample.iterations > 0 && sample.wallMs >= 0 && sample.cpuMs >= 0))
      }
    }
  }
  const lists = record.groups.find(group => group.family === 'nested-lists' && group.phase === 'render')
  assert.equal(lists.rows.find(row => row.size === 512).engines['djot.js'].status, 'ok')
  const failure = lists.rows.find(row => row.size === 1024)
  assert.equal(failure.htmlAgreement, null)
  assert.match(failure.engines['djot.js'].error, /Maximum call stack size exceeded/)
  assert.equal(failure.engines['djot.v'].status, 'ok')
})
