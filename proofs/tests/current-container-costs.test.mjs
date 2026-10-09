import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateContainerEvidence } from '../scripts/runtime/container-evidence.mjs'
import { renderContainerReport } from '../scripts/runtime/container-report.mjs'

const report = JSON.parse(readFileSync(new URL('../reports/current-container-costs.json', import.meta.url)))
const pins = JSON.parse(readFileSync(new URL('../scripts/ownership/pins.json', import.meta.url)))

test('the current container profile measures both readers, variants and reversed rounds', () => {
  validateContainerEvidence(report)
  for (const reader of ['rs', 'php']) assert.equal(report.sources[reader].baseline.commit, pins[reader].commit)
  assert.equal(report.phpRuntime.length, 24)
  for (const runtime of report.phpRuntime) assert.equal(runtime.opcache, false)
  assert.equal(readFileSync(new URL('../reports/current-container-costs.md', import.meta.url), 'utf8'), renderContainerReport(report))
})

test('a short, repeated or changed-output profile cannot pass', () => {
  const missing = structuredClone(report)
  missing.observations.pop()
  assert.throws(() => validateContainerEvidence(missing), /144|72/)
  const repeated = structuredClone(report)
  repeated.observations[1] = repeated.observations[0]
  assert.throws(() => validateContainerEvidence(repeated), /Duplicate/)
  const drift = structuredClone(report)
  drift.observations[1].htmlSha256 = '0'.repeat(64)
  assert.throws(() => validateContainerEvidence(drift), /Output drift/)
  const source = structuredClone(report)
  source.observations[0].inputSha256 = '0'.repeat(64)
  assert.throws(() => validateContainerEvidence(source))
  const order = structuredClone(report)
  order.roundOrder[1] = ['baseline', 'current']
  assert.throws(() => validateContainerEvidence(order))
  const jit = structuredClone(report)
  jit.phpRuntime[0].jit = 'tracing'
  assert.throws(() => validateContainerEvidence(jit))
  const duplicateRuntime = structuredClone(report)
  duplicateRuntime.phpRuntime[1] = duplicateRuntime.phpRuntime[0]
  assert.throws(() => validateContainerEvidence(duplicateRuntime), /Duplicate PHP runtime/)
  const runner = structuredClone(report)
  runner.runnerSha256 = '0'.repeat(64)
  assert.throws(() => validateContainerEvidence(runner))
})
