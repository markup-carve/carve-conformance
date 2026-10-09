import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkControls } from '../scripts/comparison/controls.mjs'
import { validateTimings } from '../scripts/comparison/validate-timings.mjs'

test('shared-syntax controls preserve outputs and record reference representation differences', () => {
  const rows = checkControls()
  assert.equal(rows.length,28)
  assert.ok(rows.every(r => r.sourceSha256.length === 64 && r.outputSha256.length === 64))
  assert.deepEqual(rows.filter(r => !r.treeCompared).map(r => r.family),Array(4).fill('dense-definitions'))
})
test('paired timing evidence rejects missing rounds, corrupted input and inconsistent medians', () => {
  const data = JSON.parse(readFileSync(new URL('../reports/comparison-timings.json',import.meta.url)))
  validateTimings(data)
  for (const alter of [
    d => d.groups[0].rounds.pop(),
    d => { d.groups[0].rounds[1].rows[0].sourceSha256 = '0'.repeat(64) },
    d => { d.groups[0].rounds[1].rows[0].medianMs += 1 },
    d => d.groups.pop(),
    d => d.groups[0].rounds[0].order.reverse(),
    d => d.metadata.controls.pop(),
    d => { delete d.metadata.execution },
    d => { d.metadata.execution.controlled = false },
  ]) {
    const altered = structuredClone(data); alter(altered)
    assert.throws(() => validateTimings(altered))
  }
})
