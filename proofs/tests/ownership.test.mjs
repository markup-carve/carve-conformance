import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { finding } from '../scripts/ownership/findings.mjs'
import { cases } from '../scripts/ownership/cases.mjs'
import { project, partition } from '../scripts/ownership/projection.mjs'

test('HTML comparison keeps ownership, tightness, code bytes and attributes', () => {
  assert.deepEqual(project('<ul>\n<li>a</li>\n</ul>'), project('<ul><li>a</li></ul>'))
  for (const [left, right] of [
    ['<ul><li>a<p>b</p></li></ul>', '<ul><li>a</li></ul><p>b</p>'],
    ['<ul><li>a</li></ul>', '<ul><li><p>a</p></li></ul>'],
    ['<pre><code>a\n</code></pre>', '<pre><code>a</code></pre>'],
    ['<p><code>a  b</code></p>', '<p><code>a b</code></p>'],
    ['<h1 id="a">a</h1>', '<h1>a</h1>'],
  ]) assert.notDeepEqual(project(left), project(right))
  assert.deepEqual(partition({ spec: '<p>a</p>', js: '<p>a</p>\n', php: '<p>b</p>', rs: '<p>b</p>' }), [['spec', 'js'], ['php', 'rs']])
})

test('matrix covers both issue seeds and has unique case identifiers', () => {
  const rows = cases()
  assert.equal(rows.length, 472)
  assert.equal(new Set(rows.map(row => `${row.family}/${row.id}`)).size, rows.length)
  assert.equal(rows.find(row => row.id === 'footnote-quote/3/code').source, 'x[^1]\n\n[^1]: > q\n\n   ```js\n   c\n   ```\n')
  assert.equal(rows.find(row => row.id === 'list/comment/end').source, '- a\n\n  %% n\n')
})

test('recorded matrix includes all generated sources and valid reader partitions', () => {
  const result = JSON.parse(readFileSync(new URL('../reports/ownership-results.json', import.meta.url)))
  assert.deepEqual(result.pins, JSON.parse(readFileSync(new URL('../scripts/ownership/pins.json', import.meta.url))))
  assert.deepEqual(result.rows.map(({ family, id, source, parameters }) => ({ family, id, source, parameters })), cases())
  for (const row of result.rows) {
    assert.deepEqual(Object.keys(row.outputs), ['spec', 'js', 'php', 'rs'])
    assert.deepEqual(row.groups, partition(row.outputs))
  }
})

test('every disagreement has a triage family and a matching representative', async () => {
  const { finding, representatives } = await import('../scripts/ownership/findings.mjs')
  const { rows } = JSON.parse(readFileSync(new URL('../reports/ownership-results.json', import.meta.url)))
  const observed = new Set(rows.map(finding).filter(Boolean))
  assert.deepEqual([...observed].sort(), Object.keys(representatives).sort())
  for (const [name, id] of Object.entries(representatives)) assert.equal(finding(rows.find(row => row.id === id)), name)
})

test('reduction rechecks earlier positions after each deletion', async () => {
  const { reduce } = await import('../scripts/ownership/reduce.mjs')
  const accepted = new Set(['abc', 'ac', 'c'])
  assert.equal(reduce('abc', source => accepted.has(source)), 'c')
  assert.throws(() => reduce('x', () => { throw new Error('reader failed') }), /reader failed/)
})

test('reduced witnesses preserve geometry and their original reader split', async () => {
  const { skeleton } = await import('../scripts/ownership/reduce.mjs')
  const { representatives } = await import('../scripts/ownership/findings.mjs')
  const evidence = JSON.parse(readFileSync(new URL('../reports/ownership-results.json', import.meta.url)))
  const reduced = JSON.parse(readFileSync(new URL('../reports/ownership-reductions.json', import.meta.url)))
  assert.deepEqual(reduced.pins, evidence.pins)
  assert.deepEqual(reduced.rows.map(row => row.id), Object.keys(representatives))
  for (const row of reduced.rows) {
    const original = evidence.rows.find(candidate => candidate.id === representatives[row.id])
    assert.equal(row.original, original.source)
    assert.equal(skeleton(row.source), skeleton(row.original))
    assert.ok(row.source.length <= row.original.length)
    assert.deepEqual(row.groups, original.groups)
    assert.deepEqual(row.groups, partition(row.outputs))
  }
})

test('all 472 ownership cases agree at the recorded pins', () => {
  const { rows } = JSON.parse(readFileSync(new URL('../reports/ownership-results.json', import.meta.url)))
  assert.equal(rows.length, 472)
  for (const row of rows) assert.deepEqual(row.groups, [['spec', 'js', 'php', 'rs']], row.id)
})

test('projection ignores block-edge formatting while preserving inline word separation', () => {
  assert.deepEqual(project('<li>intro\n  tail\n</li>'), project('<li>intro tail</li>'))
  assert.notDeepEqual(project('<p>a <em>b</em></p>'), project('<p>a<em>b</em></p>'))
})

test('footnote fences and control hosts keep their block interpretation', () => {
  const { rows } = JSON.parse(readFileSync(new URL('../reports/ownership-results.json', import.meta.url)))
  const fences = rows.filter(row => row.family === 'fences')
  assert.equal(fences.length, 42)
  for (const row of fences) {
    assert.deepEqual(row.groups, [['spec', 'js', 'php', 'rs']], row.id)
    const expected = row.parameters.fence === 'code'
      ? '<pre><code class="language-js">c\n</code></pre>' : '<b>c</b>'
    for (const [reader, html] of Object.entries(row.outputs)) {
      assert.ok(html.includes(expected), `${row.id}/${reader}: expected rendered block payload`)
    }
  }
})

test('resolved and consensus-change cases retain their reviewed HTML structure', () => {
  const expected = JSON.parse(readFileSync(new URL('./fixtures/ownership-resolved.json', import.meta.url)))
  const { rows } = JSON.parse(readFileSync(new URL('../reports/ownership-results.json', import.meta.url)))
  const previous = JSON.parse(readFileSync(new URL('../site/history/ownership-before-container-fixes.json', import.meta.url)))
  const oldRows = new Map(previous.rows.map(row => [row.id, row]))
  const changed = rows.filter(row => JSON.stringify(row.outputs) !== JSON.stringify(oldRows.get(row.id).outputs))
  assert.equal(expected.length, 49)
  assert.equal(changed.filter(row => oldRows.get(row.id).groups.length > 1).length, 43)
  assert.deepEqual(expected.map(row => row.id), changed.map(row => row.id))
  for (const fixture of expected) {
    const row = rows.find(row => row.id === fixture.id)
    for (const [reader, html] of Object.entries(row.outputs)) {
      assert.deepEqual(project(html), project(fixture.html), `${row.id}/${reader}`)
    }
  }
})

test('current ownership findings retain disagreements outside historical families', () => {
  for (const row of [{id:'new-tab',family:'tab-marker',groups:[['js'],['php']]},{id:'new-shape',family:'unknown',parameters:{},groups:[['js'],['rs']]}]) {
    assert.equal(finding(row,{allowUnknown:true}),`unclassified/${row.family}`)
    assert.throws(()=>finding(row), /Unclassified disagreement/)
  }
})
