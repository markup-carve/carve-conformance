import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { spanCaseIds } from '../scripts/spans-0.2.mjs'

const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))
const record = read('resources/spans-0.2.json')

test('every span case has a 0.2 measurement', () => {
  const ids = [...spanCaseIds(read('tests/external-compat/cases.json').cases),
    ...spanCaseIds(read('tests/external-compat/losses.json').cases)]
  assert.deepEqual(Object.keys(record.measured).sort(), ids.sort())
})

test('no case spells a span mark in Carve source', () => {
  for (const file of ['cases', 'losses']) {
    for (const entry of read(`tests/external-compat/${file}.json`).cases) {
      for (const [key, value] of Object.entries(entry)) {
        if (typeof value === 'string' && key !== 'html') assert.doesNotMatch(value, /\|\s*[<^]\s*\|/, `${entry.id}.${key}`)
      }
    }
  }
})

test('a refused round trip names its diagnostics', () => {
  for (const [id, routes] of Object.entries(record.measured)) {
    for (const route of Object.values(routes)) {
      assert.ok(['same spans', 'refused'].includes(route.result), id)
      assert.equal(route.result === 'refused', (route.diagnostics?.length ?? 0) > 0, id)
    }
  }
})
