import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { costReport, validateCostData } from '../scripts/profiling/cost-report.mjs'

const data = JSON.parse(readFileSync(new URL('../reports/current-costs.json', import.meta.url)))
test('cost investigation retains every phase and position variant at the installed pins', () => {
  validateCostData(data)
  assert.equal(costReport(data), readFileSync(new URL('../reports/current-costs.md', import.meta.url), 'utf8'))
})
test('cost evidence rejects missing observations and mismatched readers', () => {
  const missing = structuredClone(data); missing.groups.pop()
  assert.throws(() => validateCostData(missing))
  const altered = structuredClone(data); altered.groups[0].rounds[0].samples[0].wallMs += 1
  assert.throws(() => validateCostData(altered))
  const stale = structuredClone(data); stale.metadata.engine = 'github:markup-carve/carve-js#' + '0'.repeat(40)
  assert.throws(() => validateCostData(stale))
})

test('cost evidence rejects missing probes, corrupt hashes and unverified execution', () => {
  for (const alter of [
    d => { d.groups = d.groups.filter(g => g.phase !== 'direct-html-probe') },
    d => { d.groups[0].rounds[0].sourceSha256 = '0'.repeat(64) },
    d => d.groups[0].rounds[0].order.reverse(),
    d => { d.groups.find(g => g.phase === 'direct-html-probe').htmlPath = 'other' },
    d => { delete d.metadata.execution },
    d => { d.metadata.execution.controlled = false },
  ]) {
    const altered = structuredClone(data); alter(altered)
    assert.throws(() => validateCostData(altered))
  }
})
