import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { readers, names } from './readers.mjs'
import { partition } from './projection.mjs'
import { representatives } from './findings.mjs'
import { pins } from './build.mjs'

export const skeleton = source => source.replace(/[a-z]+/g, 'X')

export function reduce(source, accepts) {
  let changed = true
  while (changed) {
    changed = false
    for (let i = 0; i < source.length; i++) {
      const candidate = source.slice(0, i) + source.slice(i + 1)
      if (accepts(candidate)) { source = candidate; changed = true; break }
    }
  }
  return source
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { output: { type: 'string' }, check: { type: 'string' } } })
  const adapters = await readers()
  const evidence = JSON.parse(readFileSync(new URL('../../reports/ownership-results.json', import.meta.url)))
  assert.deepEqual(evidence.pins, pins)
  const memo = new Map()
  const observe = source => {
    if (!memo.has(source)) {
      const outputs = Object.fromEntries(names.map(name => [name, adapters[name](source)]))
      memo.set(source, { outputs, groups: partition(outputs) })
    }
    return memo.get(source)
  }
  const rows = []
  for (const [id, caseId] of Object.entries(representatives)) {
    const original = evidence.rows.find(row => row.id === caseId)
    assert.deepEqual(observe(original.source).groups, original.groups)
    const target = JSON.stringify(original.groups)
    const shape = skeleton(original.source)
    const accepts = source => skeleton(source) === shape && JSON.stringify(observe(source).groups) === target
    const source = reduce(original.source, accepts)
    rows.push({ id, caseId, original: original.source, source, ...observe(source) })
    console.log(`${id}: ${original.source.length} -> ${source.length} characters`)
  }
  const result = { pins, method: 'fixed-point single-character deletion preserving the nonempty word skeleton, layout and exact reader partition; errors abort', rows }
  if (values.check) assert.deepEqual(result, JSON.parse(readFileSync(values.check)), 'Reductions changed')
  if (values.output) writeFileSync(values.output, JSON.stringify(result, null, 2) + '\n')
}
