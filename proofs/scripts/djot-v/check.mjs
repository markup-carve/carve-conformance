import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { adapters } from '../comparison/adapters.mjs'
import { collectComparison } from '../comparison/collect.mjs'
import { comparisonEnvironment, comparisonFiles, digest } from '../comparison/environment.mjs'
import { extractedAdapter, invoke } from './adapter.mjs'
import { extractionEnvironment } from './environment.mjs'
import { scalingCases } from '../properties/scaling-cases.mjs'
import { prefixes, suffixes } from '../../tests/comparison/fixtures.mjs'
const { values } = parseArgs({ options: { output: { type: 'string' }, check: { type: 'string' } } })
const pin = JSON.parse(readFileSync(new URL('./pin.json', import.meta.url)))
const built = extractionEnvironment()
const previous = adapters.djot
const rows = []
try {
  for (const view of ['kernel', 'document']) {
    adapters.djot = extractedAdapter(view)
    rows.push(...collectComparison().filter(r => r.reader === 'djot').map(r => ({ ...r, reader: 'djot-v', view })))
  }
} finally { adapters.djot = previous }
const streaming = []
for (const [prefix, before] of Object.entries(prefixes)) for (const [suffix, after] of Object.entries(suffixes)) {
  assert.ok(before.endsWith('\n') && after.endsWith('\n'),'Streaming fixtures must end at line boundaries')
  const observation = invoke('stream', before, [after])
  assert.deepEqual(observation.whole, invoke('observe',before+after).kernel.children, 'Line composition differs from source concatenation')
  assert.deepEqual(observation.whole, observation.resumed, 'Streaming composition failed')
  assert.deepEqual(observation.whole.slice(0, observation.committed.length), observation.committed, 'Committed blocks changed')
  streaming.push({ id: `${prefix}/${suffix}`, before, after, ...observation })
}
const depths = []
for (const family of ['nested-quotes','nested-lists']) for(const size of scalingCases[family].sizes) {
  const tree = invoke('observe',scalingCases[family].make(size)).document
  const tag = family === 'nested-quotes' ? 'blockquote' : 'bullet_list'
  const depth = node => (node.tag === tag ? 1 : 0) + Math.max(0,...(node.children??[]).map(depth))
  assert.equal(depth(tree),size,`${family} did not produce the requested nesting`)
  depths.push({family,size,observed:depth(tree)})
}
const data = { metadata: { ...comparisonEnvironment(), extraction: pin, build: built, suiteSha256: digest([...comparisonFiles, 'scripts/djot-v/driver.ml', 'scripts/djot-v/check.mjs', 'scripts/djot-v/adapter.mjs']) }, rows, streaming, depths }
if (values.check) {
  const stored = JSON.parse(readFileSync(values.check))
  assert.deepEqual(data.depths,stored.depths); assert.deepEqual(data.rows,stored.rows); assert.deepEqual(data.streaming,stored.streaming)
  for (const key of ['extraction','suiteSha256','parsers']) assert.deepEqual(data.metadata[key],stored.metadata[key])
}
assert.equal(rows.filter(r => r.outcome === 'error').length,0)
if (values.output) writeFileSync(values.output,JSON.stringify(data,null,2)+'\n')
console.log(rows.filter(r => r.outcome === 'error').map(r => ({ id: r.id, view: r.view, error: r.error })))
const counts = {}
for (const r of rows) { const c = counts[`${r.view}/${r.family}`] ??= {}; const key = r.outcome ?? 'observed'; c[key] = (c[key] ?? 0) + 1 }
console.log(counts)
assert.equal(rows.filter(r => r.outcome === 'error').length,0)
