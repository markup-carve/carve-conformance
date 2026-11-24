import assert from 'node:assert/strict'
import test from 'node:test'
import { cases02, checkCase, coveredByDeclaration, declaredDifference, runCompat, runLosses, spellings, validateSpellings, validateTree } from '../scripts/compat/check-0.2.mjs'
import { envelope, parseTree } from '../scripts/compat/engines-0.2.mjs'
import { document, fromMdast, semantics } from '../scripts/compat/trees-0.2.mjs'
import { readForeign } from '../scripts/compat/tools-0.2.mjs'
import { exportForeign } from '../scripts/compat/exporters-0.2.mjs'

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

test('an inline Docutils image stays inline, and the first of two definitions wins', async () => {
  const { fromDocutils } = await import('../scripts/compat/trees-0.2.mjs')
  const tree = fromDocutils({ type: 'document', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'Before ' }, { type: 'image', attributes: { uri: 'a.png', alt: 'a' } }, { type: 'text', value: ' after.' }] }, { type: 'image', attributes: { uri: 'b.png', alt: 'b' } }] })
  validateTree(tree)
  assert.deepEqual(tree.children.map(c => c.role), [undefined, 'image'])
  const { ast } = await readForeign('mdast', '[x][r]\n\n[r]: /one\n[r]: /two\n')
  assert.equal(ast.children[0].children[0].href, '/one')
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

test('a declaration does not cover a failure outside the mapping comparison', () => {
  const declared = { clause: 'C2-B-062', reason: 'test' }
  assert.equal(coveredByDeclaration(declared, ['ast-schema'], 'mdast/x: foreign tree mapping'), true)
  assert.equal(coveredByDeclaration(declared, [], 'reader crashed'), false)
  assert.equal(coveredByDeclaration(declared, [], 'mdast/x: foreign tree mapping'), false)
  assert.equal(coveredByDeclaration(declared, ['ast-schema', 'ast-mapping'], 'mdast/x: JSON interchange round trip'), false)
  assert.equal(coveredByDeclaration(undefined, ['ast-schema'], 'mdast/x: foreign tree mapping'), false)
  const html = { ...declared, check: 'html-structure' }
  assert.equal(coveredByDeclaration(html, ['ast-schema', 'ast-mapping', 'json-roundtrip'], 'hast/x: independent HTML structure'), true)
  assert.equal(coveredByDeclaration(html, ['ast-schema'], 'hast/x: foreign tree mapping'), false)
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

test('losses name their path and keep a valid fallback; retired losses keep the structure', async () => {
  const rows = await runLosses({ tools: javascriptTools })
  assert.deepEqual(rows.filter(r => r.status !== 'passed').map(r => r.error), [])
  assert.ok(rows.some(r => r.kind === 'retired-loss' && r.case === 'html-block-caption'))
  const fixture = { id: 'html-block-caption', tools: ['hast'], source: '<table><caption>Cap Second</caption><tr><td>x</td></tr></table>', retained: 'Cap Second', expected: {} }
  const [flattened] = await runLosses({ tools: ['hast'], cases: [fixture] })
  assert.equal(flattened.status, 'failed')
})

test('a table maps to its groups, cell paragraphs and columns, and a covered cell is never a header', async () => {
  const { ast } = await readForeign('hast', '<table><thead><tr><th colspan="2">A</th></tr></thead><tbody><tr><td>x</td><td>y</td></tr></tbody></table>')
  validateTree(ast)
  const [head, body] = ast.children[0].children
  assert.deepEqual([head.type, body.type, ast.children[0].columns.length], ['table_head', 'table_body', 2])
  assert.deepEqual(head.children[0].children[1], { type: 'table_cell', header: false, span: 'colspan', children: [] })
  assert.deepEqual(body.children[0].children[0].children, [{ type: 'cell_paragraph', children: [{ type: 'text', value: 'x' }] }])
})

test('a continuation row leaves no field: the cell holds its fragments joined by a space', async () => {
  const fixture = cases02().find(c => c.id === 'continuation-row')
  assert.equal((await checkCase('hast', fixture)).status, 'passed')
  assert.ok(!JSON.stringify(parseTree(fixture.carve)).includes('cellWraps'))
})

test('the exporters write 0.2 trees back and report what a format cannot hold', async () => {
  const tree = parseTree('A {_marked_} and [link](/u "t").\n\n- [x] done\n')
  const md = exportForeign('mdast', tree)
  assert.deepEqual(md.diagnostics.filter(d => d.fidelity !== 'normalized').map(d => d.path), ['/children/0/children/1'])
  assert.match(md.source, /\[link\]\(\/u "t"\)/)
  assert.match(exportForeign('djot', parseTree('- [x] done\n')).source, /\[[xX]\] done/)
  const html = exportForeign('hast', parseTree('|= a |\n| b |\n')).source
  assert.match(html, /<thead><tr><th>a<\/th><\/tr><\/thead><tbody><tr><td>b<\/td><\/tr><\/tbody>/)
})

test('table exports report a headerless GFM table and cells with several blocks', () => {
  const cell = children => ({ type: 'table_cell', header: false, children })
  const para = value => ({ type: 'paragraph', children: [{ type: 'text', value }] })
  const tree = { type: 'document', astVersion: '2.0', children: [{ type: 'table', columns: [{ type: 'table_column' }], children: [{ type: 'table_body', children: [{ type: 'table_row', children: [cell([para('one'), para('two')])] }, { type: 'table_row', children: [cell([{ type: 'cell_paragraph', children: [] }])] }] }] }] }
  validateTree(tree)
  for (const tool of ['mdast', 'djot']) {
    const out = exportForeign(tool, tree)
    assert.ok(out.diagnostics.some(d => d.fidelity === 'degraded' && d.path === '/children/0/children/0/children/0/children/0/children'), tool)
    assert.match(out.source, /one two/, tool)
  }
  assert.ok(exportForeign('mdast', tree).diagnostics.some(d => d.path === '/children/0/children' && d.fidelity === 'degraded'))
})

test('a Djot block caption keeps its text, and hast reports column attributes it cannot write', () => {
  const body = [{ type: 'table_body', children: [{ type: 'table_row', children: [{ type: 'table_cell', header: false, children: [{ type: 'cell_paragraph', children: [{ type: 'text', value: 'x' }] }] }] }] }]
  const para = value => ({ type: 'paragraph', children: [{ type: 'text', value }] })
  const captioned = { type: 'document', astVersion: '2.0', children: [{ type: 'table', columns: [{ type: 'table_column' }], caption: { type: 'caption', children: [para('First'), para('Second')] }, children: body }] }
  validateTree(captioned)
  assert.match(exportForeign('djot', captioned).source, /First Second/)
  const columnAttrs = { type: 'document', astVersion: '2.0', children: [{ type: 'table', columns: [{ type: 'table_column', attrs: { id: 'c' } }], children: body }] }
  validateTree(columnAttrs)
  assert.ok(exportForeign('hast', columnAttrs).diagnostics.some(d => d.path === '/children/0/columns/0/attrs' && d.fidelity === 'dropped'))
})
