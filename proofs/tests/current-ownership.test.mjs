import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { cases } from '../scripts/ownership/cases.mjs'
import { project } from '../scripts/ownership/projection.mjs'
import { referenceShape, flattenHeadingSections, observeContracts, contractCases } from '../scripts/ownership/contracts.mjs'
const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)))

test('current ownership retains the full historical population and normative additions', () => {
  const data = read('reports/ownership-current-results.json'), old = read('reports/ownership-results.json')
  const expanded = read('tests/fixtures/ownership-expanded.json')
  assert.deepEqual(data.pins, read('scripts/ownership/current-pins.json'))
  assert.equal(expanded.length, 63)
  for (const row of expanded) assert.equal(row.specFixture, row.id + '.crv')
  assert.equal(data.rows.length, old.rows.length + expanded.length)
  assert.equal(data.suiteSha256, createHash('sha256').update(JSON.stringify([...cases(), ...expanded])).digest('hex'))
  assert.deepEqual(data.rows.slice(0, old.rows.length).map(row => row.outputs), old.rows.map(row => row.outputs))
  assert.equal(new Set(data.rows.map(row => row.id)).size, data.rows.length)
  for (const row of data.rows) {
    assert.deepEqual(row.groups, [['spec', 'js', 'php', 'rs']], row.id)
    if (row.expectedHtml !== undefined) for (const html of Object.values(row.outputs))
      assert.deepEqual(project(html), project(row.expectedHtml), row.id)
  }
})

test('reference projection preserves label, element kind and authored attributes', () => {
  assert.deepEqual(referenceShape(project('<a class="x" href="/one">label</a>')), referenceShape(project('<a class="x" href="/two">label</a>')))
  assert.notDeepEqual(referenceShape(project('<a href="/one">label</a>')), referenceShape(project('<a href="/two">changed</a>')))
  assert.notDeepEqual(referenceShape(project('<a class="x" href="/one">label</a>')), referenceShape(project('<a class="y" href="/two">label</a>')))
  assert.notDeepEqual(referenceShape(project('<a href="/one">label</a>')), referenceShape(project('<span>label</span>')))
})

test('prefix projection removes heading section growth but retains endnotes and block content', () => {
  const before = flattenHeadingSections(project('<section id="h"><h1>H</h1></section>'))
  const after = flattenHeadingSections(project('<section id="h"><h1>H</h1><p>later</p></section>'))
  assert.deepEqual(before, after.slice(0, before.length))
  assert.equal(flattenHeadingSections(project('<section id="n" role="doc-endnotes"><p>note</p></section>'))[0].tag, 'section')
  assert.notDeepEqual(before, flattenHeadingSections(project('<section id="h"><h1>Changed</h1></section>')))
  assert.notDeepEqual(before, flattenHeadingSections(project('<section id="changed"><h1>H</h1></section>')))
})

test('contract checker rejects a changed excluded case rather than absorbing it into the baseline', () => {
  assert.throws(() => observeContracts({ fake: () => '<p>same</p>' }, [contractCases.find(row => row.id === 'wrap-heading')]), /scoped contract changed/)
})

test('recorded contracts include all four readers and both outcomes at the current pins', () => {
  const data = read('reports/ownership-current-contracts.json')
  assert.deepEqual(data.pins, read('scripts/ownership/current-pins.json'))
  assert.equal(data.version, '0.1')
  assert.equal(data.rows.length, contractCases.length * 4)
  assert.equal(data.suiteSha256, createHash('sha256').update(JSON.stringify(contractCases)).digest('hex'))
  for (const row of data.rows) assert.equal(row.outcome, row.expected, `${row.reader}/${row.id}`)
  assert.deepEqual(new Set(data.rows.map(row => row.reader)), new Set(['spec', 'js', 'php', 'rs']))
  assert.deepEqual(new Set(data.rows.map(row => row.outcome)), new Set(['equal', 'different']))
})

test('closed prefix requires the appended block to survive', () => {
  const row = contractCases.find(row => row.id === 'append-after-heading')
  assert.throws(() => observeContracts({ fake: () => '<p>same</p>' }, [row]), /appended block disappeared/)
})

test('definition replacement must resolve the changed destination', () => {
  const row = contractCases.find(row => row.id === 'replace-link-definition')
  assert.throws(() => observeContracts({ fake: () => '<p><a href="/one">label</a></p>' }, [row]), /changed destination missing/)
})

test('an arbitrary extra node cannot stand in for the appended block', () => {
  const row = contractCases.find(row => row.id === 'append-after-heading')
  const fake = source => source === row.before ? '<p>same</p>' : '<p>same</p><div></div>'
  assert.throws(() => observeContracts({ fake }, [row]), /appended block differs/)
})
