import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { collectComparison } from './collect.mjs'
import { comparisonEnvironment, comparisonFiles, digest } from './environment.mjs'
const { values } = parseArgs({ options: { output: { type: 'string' }, check: { type: 'string' } } })
const data = { metadata: { ...comparisonEnvironment(), suiteSha256: digest(comparisonFiles) }, rows: collectComparison() }
assert.ok(data.rows.length > 0)
assert.equal(data.rows.filter(r => r.outcome === 'error').length, 0, 'Comparison contains parser or adapter errors')
if (values.check) assert.deepEqual(JSON.parse(JSON.stringify(data)), JSON.parse(readFileSync(values.check)), 'Comparison snapshot changed; review language behavior and adapters')
if (values.output) writeFileSync(values.output, JSON.stringify(data, null, 2) + '\n')
const counts = {}
for (const r of data.rows) { const c = counts[`${r.reader}/${r.family}`] ??= {}; const key = r.outcome ?? 'observed'; c[key] = (c[key] ?? 0) + 1 }
console.log(JSON.stringify(counts, null, 2))
