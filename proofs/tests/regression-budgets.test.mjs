import test from 'node:test'
import assert from 'node:assert/strict'
import { envelope } from '../scripts/budgets/calibrate.mjs'

test('calibration retains holdout failures without widening the training limit', () => {
  const result = envelope([10, 12], [11, 20])
  assert.equal(result.limit, 12)
  assert.equal(result.holdoutExceeded, 1)
  assert.equal(result.nextWorkerCoverageUnderExchangeability, 2 / 3)
  assert.equal(result.enforcement, 'observation-only')
})
test('invalid calibration observations fail rather than producing a permissive budget', () => {
  for (const values of [[], [NaN], [-1], [Infinity]]) assert.throws(() => envelope(values, [1]))
})

const { readFileSync } = await import('node:fs')
const { calibrate } = await import('../scripts/budgets/calibrate.mjs')
const paths = [
  'reports/history/budget-training-36656234254/comparison-timings.json',
  'reports/history/budget-training-36656234254/current-costs.json',
  'reports/history/budget-holdout-36735323958/comparison-timings.json',
  'reports/history/budget-holdout-36735323958/current-costs.json',
]
const evidence = paths.map(path => {
  const data = JSON.parse(readFileSync(path, 'utf8'))
  return { ...data, groups: [data.groups[0]] }
})
test('calibration rejects changed populations and failed or missing worker rounds', () => {
  const mutations = [
    data => data[2].groups[0].rows.push({ ...data[2].groups[0].rows[0], size: 999 }),
    data => data[2].groups[0].rounds[0].rows.pop(),
    data => data[2].groups[0].rounds[0].rows.push(data[2].groups[0].rounds[0].rows[0]),
    data => { data[2].groups[0].rounds[0].completed = false },
    data => { data[2].groups[0].rounds[0].workerError = 'failure' },
    data => data[3].groups[0].rounds.pop(),
    data => { data[3].groups[0].rounds[0].completed = false },
    data => { data[3].groups[0].rounds[0].workerError = 'failure' },
    data => { data[1].metadata.cpu = 'different host' },
  ]
  assert.doesNotThrow(() => calibrate(evidence.slice(0, 2), evidence.slice(2), paths))
  for (const mutate of mutations) {
    const changed = structuredClone(evidence)
    mutate(changed)
    assert.throws(() => calibrate(changed.slice(0, 2), changed.slice(2), paths))
  }
})
