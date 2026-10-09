import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { collectProperties, checkFindings, unwrap, referenceParagraph } from '../scripts/property-check.mjs'
import { normalize, normalizeInlineHtml } from '../scripts/properties/normalize.mjs'

const findings = JSON.parse(readFileSync(new URL('../reports/property-findings.json', import.meta.url)))
const rows = collectProperties()
const key = row => `${row.family}/${row.id}/${row.reader}`

test('property population covers all four relations and both control families', () => {
  assert.equal(rows.length, 486)
  assert.equal(new Set(rows.map(key)).size, rows.length)
  assert.deepEqual([...new Set(rows.map(r => r.family))].sort(),
    ['containers', 'locality', 'lookahead-control', 'resolution-control', 'stability', 'wrapping'])
  checkFindings(rows, findings)
})

for (const row of rows) test(key(row), () => {
  const known = findings[key(row)]
  checkFindings([row], known ? { [key(row)]: known } : {})
})

test('normalization ignores positions and soft wraps while retaining meaningful differences', () => {
  const text = value => ({ type: 'text', value })
  assert.deepEqual(normalize([text('a '), text('b')]), normalize([{ ...text('a'), pos: { startLine: 1 } }, { type: 'soft_break' }, text('b')]))
  assert.notDeepEqual(normalize([{ type: 'code', value: 'a b' }]), normalize([{ type: 'code', value: 'a\nb' }]))
  assert.notDeepEqual(normalize([{ type: 'hard_break' }]), normalize([{ type: 'soft_break' }]))
  assert.notDeepEqual(normalize([{ type: 'link', href: '/a' }]), normalize([{ type: 'link', href: '/b' }]))
  assert.notDeepEqual(normalize({ type: 'paragraph', attrs: { pos: 'a', rawRef: 'a' } }), normalize({ type: 'paragraph', attrs: { pos: 'b', rawRef: 'a' } }))
  assert.equal(normalizeInlineHtml('a\nb <code>x\ny</code>'), 'a b <code>x\ny</code>')
})

test('reference projection keeps syntax identity while excluding resolved destinations', () => {
  const ref = { type: 'link', ref: 'r', href: '/one', children: [{ type: 'text', value: 'label' }] }
  assert.deepEqual(normalize(ref, { referenceSyntax: true }), normalize({ ...ref, href: '/two' }, { referenceSyntax: true }))
  assert.notDeepEqual(normalize({ ...ref, attrs: { class: 'a' } }, { referenceSyntax: true }), normalize({ ...ref, attrs: { class: 'b' } }, { referenceSyntax: true }))
  assert.notDeepEqual(normalize(ref, { referenceSyntax: true }), normalize({ type: 'text', value: '[label][r]' }, { referenceSyntax: true }))
})

test('wrapper extraction rejects a second visible block or a wrong container', () => {
  assert.throws(() => unwrap([{ type: 'block_quote', children: [] }, { type: 'paragraph', children: [] }], ['quote'], 'js'))
  assert.throws(() => unwrap([{ type: 'paragraph', children: [] }], ['quote'], 'js'))
})

test('findings cannot hide new failures, changed counterexamples or repaired exceptions', () => {
  const row = rows.find(r => r.outcome !== r.expected)
  const declaration = { [key(row)]: findings[key(row)] }
  assert.throws(() => checkFindings([row], {}), /undeclared/)
  assert.throws(() => checkFindings([{ ...row, rightHash: 'different' }], declaration), /changed after tree/)
  assert.throws(() => checkFindings([{ ...row, outcome: row.expected }], declaration), /stale finding/)
  assert.throws(() => checkFindings([], declaration), /empty|missing/)
})


test('changed definitions replace existing definitions and endnotes cannot satisfy reference controls', () => {
  const changed = rows.find(r => r.family === 'locality' && r.id === 'full/changed')
  assert.match(changed.before, /\[ref\]: \/target/)
  assert.match(changed.after, /\[ref\]: \/other/)
  assert.equal(referenceParagraph('<p>literal</p><section><p>note</p></section>'), '<p>literal</p>')
})
