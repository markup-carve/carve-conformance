import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { collectContracts, contracts } from './contracts.mjs'
import { comparisonEnvironment, digest } from './environment.mjs'
const { values } = parseArgs({ options: { output: { type: 'string' }, check: { type: 'string' } } })
const data = { metadata: { ...comparisonEnvironment(), suiteSha256: digest(['scripts/comparison/check-contracts.mjs', 'scripts/comparison/environment.mjs', 'scripts/comparison/contracts.mjs', 'scripts/comparison/adapters.mjs', 'tests/comparison/fixtures.mjs']) }, contracts, rows: collectContracts() }
const failures = data.rows.filter(row => row.expected !== row.outcome)
assert.deepEqual(failures.map(({ reader, family, id }) => ({ reader, family, id })), [], 'A scoped contract changed')
if (values.check) assert.deepEqual(JSON.parse(JSON.stringify(data)), JSON.parse(readFileSync(values.check)), 'Contract evidence changed')
if (values.output) writeFileSync(values.output, JSON.stringify(data, null, 2) + '\n')
console.log(`${data.rows.length} scoped contract observations matched their expectations`)
