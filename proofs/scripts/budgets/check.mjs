import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { calibrate } from './calibrate.mjs'
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const recorded = read('reports/regression-budgets.json')
const paths = recorded.metadata.evidence.map(row => row.path)
assert.deepEqual(calibrate(paths.slice(0, 2).map(read), paths.slice(2).map(read), paths), recorded)
assert.ok(recorded.rows.every(row => row.enforcement === 'observation-only'))
console.log(`Calibration evidence: ${recorded.rows.length} observed limits; held-out violations retained.`)
