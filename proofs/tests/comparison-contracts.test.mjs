import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'carve-comparison'
import { blocks, adapters } from '../scripts/comparison/adapters.mjs'
import { collectContracts } from '../scripts/comparison/contracts.mjs'
import { collectContainerRegressions, checkPositions, payloadProjection } from '../scripts/comparison/container-regressions.mjs'

const read = name => JSON.parse(readFileSync(new URL(`../reports/${name}.json`, import.meta.url)))
test('scoped contracts match explicit expectations and recorded trees', () => {
  const rows = collectContracts()
  assert.equal(rows.length, 525)
  assert.deepEqual(JSON.parse(JSON.stringify(rows)), read('comparison-contracts').rows)
  assert.ok(rows.every(row => row.outcome === row.expected))
  assert.equal(rows.filter(row => row.expected === 'different').length, 2)
})
test('excluded edits remain counterexamples to broader claims', () => {
  assert.notDeepEqual(blocks('carve', 'alpha # heading\n'), blocks('carve', 'alpha\n# heading\n'))
  assert.notDeepEqual(blocks('carve', '`alpha beta`\n'), blocks('carve', '`alpha\nbeta`\n'))
  for (const reader of Object.keys(adapters)) {
    assert.notDeepEqual(blocks(reader, '- alpha\n\n'), blocks(reader, '- alpha\n\n- beta\n').slice(0, 1))
    assert.match(adapters[reader].html('[label][ref]\n\n[ref]: /one\n'), /href="\/one"/)
    assert.match(adapters[reader].html('[label][ref]\n\n[ref]: /two\n'), /href="\/two"/)
  }
})
test('expanded containers retain full trees, HTML, positions and work counts', () => {
  const rows = collectContainerRegressions()
  assert.equal(rows.length, 112)
  assert.deepEqual(rows, read('container-regressions').rows)
  assert.deepEqual([...new Set(rows.map(r => r.family))].sort(), ['comment', 'definition', 'fence', 'heading', 'lazy', 'table', 'tabs', 'unicode'])
})
test('position checks use codepoints and reject a shifted Unicode leaf', () => {
  const source = '> café 日本語 😀\n>\n> sentinel\n', ast = parse(source)
  checkPositions(ast, source)
  function shift(value) {
    if (!value || typeof value !== 'object') return
    if (value.type === 'text' && value.value === 'sentinel') { value.pos.startOffset++; value.pos.endOffset++ }
    for (const child of Object.values(value)) if (typeof child === 'object') Array.isArray(child) ? child.forEach(shift) : shift(child)
  }
  shift(ast)
  assert.throws(() => checkPositions(ast, source), /original source text/)
})

test('payload comparison detects lost block structure beyond the terminal leaf', () => {
  const plain = parse('| one | two |\n| a | b |\n\nsentinel\n')
  const wrapped = parse('> | one | two |\n> | a | b |\n>\n> sentinel\n')
  assert.deepEqual(payloadProjection(wrapped, ['quote']), payloadProjection(plain, []))
  wrapped.children[0].children[0].type = 'paragraph'
  assert.notDeepEqual(payloadProjection(wrapped, ['quote']), payloadProjection(plain, []))
})
