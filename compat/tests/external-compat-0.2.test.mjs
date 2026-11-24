import assert from 'node:assert/strict'
import test from 'node:test'
import { cases02, checkCase, declaredDifference, runCompat, spellings, validateSpellings, validateTree } from '../scripts/compat/check-0.2.mjs'
import { envelope, parseTree } from '../scripts/compat/engines-0.2.mjs'
import { document, fromMdast, semantics } from '../scripts/compat/trees-0.2.mjs'
import { readForeign } from '../scripts/compat/tools-0.2.mjs'

const javascriptTools = ['mdast', 'hast', 'commonmark', 'djot', 'asciidoctor']

test('0.2 spellings and declared differences are well formed', () => validateSpellings())

test('the root carries astVersion 2.0 and the envelope holds only its four fields', () => {
  const tree = parseTree('A paragraph.\n')
  validateTree(tree)
  assert.equal(document([]).astVersion, '2.0')
  const wrapped = envelope(tree)
  assert.deepEqual(Object.keys(wrapped).filter(k => !['astVersion', 'document', 'vocabulary', 'extensions'].includes(k)), [])
  assert.equal(wrapped.astVersion, '2.0')
  validateTree(wrapped)
  assert.throws(() => validateTree({ type: 'document', children: [] }))
  assert.throws(() => validateTree({ astVersion: '2.0', document: tree, stray: true }))
})

test('0.1 fields are refused by the 0.2 schema', () => {
  const paragraph = children => ({ type: 'paragraph', children })
  const img = { type: 'image', src: 'a.png', alt: 'a' }
  assert.throws(() => validateTree(document([{ ...paragraph([img]), blockImage: true }])))
  assert.throws(() => validateTree(document([paragraph([{ type: 'link', href: '', resolved: true, children: [] }])])))
  validateTree(document([{ ...paragraph([img]), role: 'image' }]))
})

test('a block image is the image role of a paragraph', async () => {
  const { ast } = await readForeign('mdast', '![alt](a.png)\n')
  assert.deepEqual(semantics(ast).children, [{ type: 'paragraph', role: 'image', children: [{ type: 'image', src: 'a.png', alt: 'alt' }] }])
})

test('an empty destination is the empty string, and a resolved reference drops its spelling', async () => {
  assert.equal((await readForeign('mdast', '[x]()\n')).ast.children[0].children[0].href, '')
  const ref = fromMdast({ type: 'root', children: [{ type: 'paragraph', children: [{ type: 'linkReference', identifier: 'r', children: [{ type: 'text', value: 'x' }] }] }, { type: 'definition', identifier: 'r', url: '/u' }] })
  assert.deepEqual(semantics(ref), semantics(parseTree('[x][r]\n\n[r]: /u\n')))
})

test('every case passes, is declared or is pending for the JavaScript readers', async () => {
  const rows = await runCompat({ tools: javascriptTools })
  assert.deepEqual(rows.filter(r => r.status === 'failed').map(r => r.error), [])
  assert.ok(rows.filter(r => r.status === 'passed').length > 100)
  for (const row of rows.filter(r => r.status === 'declared')) assert.ok(declaredDifference(row.tool, cases02().find(c => c.id === row.case)))
})

test('a declared difference fails once it stops reproducing', async () => {
  const fixture = cases02().find(c => c.id === 'heading-and-unicode')
  const saved = spellings.cases[fixture.id]
  spellings.cases[fixture.id] = { declared: { mdast: { clause: 'C2-A-008', reason: 'test' } } }
  try {
    const [row] = await runCompat({ tools: ['mdast'], cases: [fixture] })
    assert.equal(row.status, 'failed')
  } finally {
    if (saved) spellings.cases[fixture.id] = saved
    else delete spellings.cases[fixture.id]
  }
  assert.equal((await checkCase('mdast', fixture)).status, 'passed')
})
