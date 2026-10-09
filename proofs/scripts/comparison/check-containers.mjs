import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { comparisonEnvironment, digest } from './environment.mjs'
import { collectContainerRegressions } from './container-regressions.mjs'
const { values } = parseArgs({ options: { output: { type: 'string' }, check: { type: 'string' } } })
const data = { metadata: { ...comparisonEnvironment(), suiteSha256: digest(['scripts/comparison/check-containers.mjs', 'scripts/comparison/environment.mjs', 'scripts/profiling/summary.mjs', 'scripts/comparison/container-regressions.mjs', 'scripts/profiling/instrument.mjs', 'tests/comparison/fixtures.mjs']) }, rows: collectContainerRegressions() }
if (values.check) {
  const recorded = JSON.parse(readFileSync(values.check))
  assert.deepEqual(data.metadata, recorded.metadata, 'Container provenance or suite changed')
  assert.deepEqual(data.rows.map(r => r.id), recorded.rows.map(r => r.id), 'Container population changed')
  for (const [i, row] of data.rows.entries()) for (const field of Object.keys(row)) assert.deepEqual(row[field], recorded.rows[i][field], `${row.id}: ${field} changed`)
}
if (values.output) writeFileSync(values.output, JSON.stringify(data, null, 2) + '\n')
console.log(`${data.rows.length} container cases checked with full AST, HTML, source positions and regex counts`)
