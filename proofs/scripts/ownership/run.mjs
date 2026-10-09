import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { createHash } from 'node:crypto'
import { cases } from './cases.mjs'
import { readers, names } from './readers.mjs'
import { pins, profile, cache } from './build.mjs'
import { partition, project } from './projection.mjs'

const { values } = parseArgs({ options: { output: { type: 'string' }, check: { type: 'string' } } })
const adapters = await readers()
const expanded = profile === 'current' ? JSON.parse(readFileSync(new URL('../../tests/fixtures/ownership-expanded.json', import.meta.url))) : []
if (profile === 'current') {
  const selected = readdirSync(cache + 'spec/tests/corpus').filter(file => /^(?:231|435|535|69)-.*\.crv$/.test(file)).sort()
  assert.deepEqual(expanded.map(row => row.specFixture).sort(), selected, 'Normative family inventory changed')
}
for (const row of expanded) {
  assert.equal(row.specFixture, row.id + '.crv', `${row.id}: fixture filename differs`)
  assert.equal(readFileSync(cache + 'spec/tests/corpus/' + row.specFixture, 'utf8'), row.source, `${row.id}: normative source changed`)
  assert.equal(readFileSync(cache + 'spec/tests/corpus/' + row.specFixture.replace(/\.crv$/, '.html'), 'utf8'), row.expectedHtml, `${row.id}: normative output changed`)
}
const inputs = [...cases(), ...expanded]
const rows = inputs.map(row => {
  const outputs = Object.fromEntries(names.map(name => {
    try { return [name, adapters[name](row.source)] }
    catch (error) { throw new Error(`${row.family}/${row.id}/${name}: ${error.message}`, { cause: error }) }
  }))
  if (profile === 'current') {
    assert.deepEqual(partition(outputs), [names], `${row.id}: current readers disagree`)
    if (row.expectedHtml !== undefined) for (const [reader, html] of Object.entries(outputs))
      assert.deepEqual(project(html), project(row.expectedHtml), `${row.id}/${reader}: normative output differs`)
  }
  return { ...row, outputs, groups: partition(outputs) }
})
const digest = createHash('sha256').update(JSON.stringify(inputs)).digest('hex')
const result = { pins, projectionVersion: 1, suiteSha256: digest, rows }
if (values.check) assert.deepEqual(result, JSON.parse(readFileSync(values.check)), 'Ownership evidence changed')
if (values.output) writeFileSync(values.output, JSON.stringify(result, null, 2) + '\n')
for (const family of new Set(rows.map(row => row.family))) {
  const selected = rows.filter(row => row.family === family)
  console.log(`${family}: ${selected.length} inputs, ${selected.filter(row => row.groups.length > 1).length} disagreements`)
}
