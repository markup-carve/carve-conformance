import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { compareEngines, compareResult, engineInputs, javascriptCall, stable } from '../scripts/compat/engines-native-0.2.mjs'
import { parseTree } from '../scripts/compat/engines-0.2.mjs'

const tree = parseTree('A *b*.\n')
const rows = [
  { tool: 'mdast', case: 'one', evidence: { carve: 'A *b*.\n', ast: tree } },
  { tool: 'djot', case: 'one', evidence: { carve: 'A *b*.\n', ast: structuredClone(tree) } },
  { tool: 'hast', case: 'two', evidence: { expectedAst: tree, ast: tree } },
  { tool: 'pandoc', case: 'loss', kind: 'loss', evidence: { sourceFormat: 'carve', source: 'C.\n', ast: parseTree('C.\n') } },
]

test('next2 pins name a full revision on the next2 branch', () => {
  const pins = JSON.parse(readFileSync('resources/engines.json'))
  for (const engine of ['php-next2', 'rust-next2']) {
    assert.match(pins[engine].revision, /^[0-9a-f]{40}$/)
    assert.equal(pins[engine].branch, 'next2')
  }
})

test('each distinct tree and Carve source is called once and keeps every case that uses it', () => {
  const requests = engineInputs(rows)
  assert.deepEqual(requests.filter(r => r.call === 'parse').map(r => [r.source, r.cases]), [['A *b*.\n', ['djot/one', 'mdast/one']], ['C.\n', ['pandoc/loss']]])
  const trees = requests.filter(r => r.call === 'render')
  assert.equal(trees.length, 2)
  assert.deepEqual(trees[0].cases, ['djot/one', 'hast/two', 'mdast/one'])
  assert.deepEqual(requests.filter(r => r.call !== 'parse').map(r => r.call).slice(0, 3), ['decodeTree', 'write', 'render'])
})

test('key order is not a difference, a value is', () => {
  assert.equal(stable({ b: 1, a: { d: 2, c: 3 } }), stable({ a: { c: 3, d: 2 }, b: 1 }))
  assert.deepEqual(compareResult({ call: 'render' }, { ok: '<p>a</p>' }, { ok: '<p>a</p>' }), { status: 'agrees' })
  assert.deepEqual(compareResult({ call: 'render' }, { ok: '<p>a</p>' }, { error: 'boom' }), { status: 'differs', javascript: '<p>a</p>', engine: 'boom', error: true })
})

test('a parse difference says whether the compared structure still agrees', () => {
  const withPos = parseTree('A.\n'), without = structuredClone(withPos)
  delete without.children[0].pos
  assert.equal(compareResult({ call: 'parse' }, { ok: withPos }, { ok: without }).sameSemantics, true)
  assert.equal(compareResult({ call: 'parse' }, { ok: withPos }, { ok: parseTree('B.\n') }).sameSemantics, false)
})

test('a write difference separates the source from the diagnostics and their order', () => {
  const a = { code: 'x', path: '/a' }, b = { code: 'y', path: '/b' }
  const reordered = compareResult({ call: 'write' }, { ok: { source: 's', diagnostics: [a, b] } }, { ok: { source: 's', diagnostics: [b, a] } })
  assert.deepEqual([reordered.status, reordered.sameSource, reordered.sameDiagnosticSet], ['differs', true, true])
  const missing = compareResult({ call: 'write' }, { ok: { source: 's', diagnostics: [a, b] } }, { ok: { source: 't', diagnostics: [a] } })
  assert.deepEqual([missing.sameSource, missing.sameDiagnosticSet], [false, false])
})

test('an engine that differs is reported per call with both outputs, and the oracle is carve-js', () => {
  const fake = (engine, requests) => requests.map(r => r.call === 'render' && engine === 'rust' ? { ok: '<p>changed</p>' } : javascriptCall(r))
  const result = compareEngines(rows, { engines: ['php', 'rust'], call: fake })
  assert.equal(result.engines.php.differs, 0)
  assert.equal(result.engines.rust.differs, 2)
  assert.deepEqual(result.engines.rust.byCall.render, { agrees: 0, differs: 2 })
  const [first] = result.engines.rust.differences
  assert.equal(first.call, 'render')
  assert.equal(first.engine, '<p>changed</p>')
  assert.equal(first.javascript, javascriptCall({ call: 'render', tree }).ok)
  assert.deepEqual(first.input, tree)
})
