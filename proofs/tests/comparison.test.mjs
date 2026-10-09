import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { collectComparison } from '../scripts/comparison/collect.mjs'
import { adapters, blocks, project, nestingDepth } from '../scripts/comparison/adapters.mjs'
import { fragments, wrappers } from './comparison/fixtures.mjs'

const rows = collectComparison()
test('comparison covers three readers and matches reviewed observations', () => {
  assert.equal(rows.length, 420)
  assert.equal(new Set(rows.map(r => `${r.reader}/${r.family}/${r.id}`)).size, rows.length)
  assert.ok(rows.every(r => r.outcome !== 'error'))
  const stored = JSON.parse(readFileSync(new URL('../reports/comparison-results.json', import.meta.url)))
  assert.deepEqual(JSON.parse(JSON.stringify(rows)), stored.rows)
})
for (const reader of Object.keys(adapters)) {
  test(`${reader}: dialect fixtures express the same strong and emphasis intent`, () => {
    for (const [name, type] of [['strong', 'strong'], ['emphasis', 'emphasis']]) assert.equal(blocks(reader, fragments[name][reader])[0].children[0].type, type)
  })
  test(`${reader}: normalization preserves code, hard breaks, URLs and list tightness`, () => {
    assert.notDeepEqual(blocks(reader, '[a](/one)\n'), blocks(reader, '[a](/two)\n'))
    assert.notDeepEqual(blocks(reader, 'alpha\nbeta\n'), blocks(reader, 'alpha\\\nbeta\n'))
    assert.notDeepEqual(blocks(reader, '`one`\n'), blocks(reader, '`two`\n'))
    assert.notDeepEqual(blocks(reader, '- a\n- b\n'), blocks(reader, '- a\n\n- b\n'))
    assert.throws(() => project({ type: 'unknown' }, reader), /Unsupported/)
  })
  test(`${reader}: container references resolve to the original target`, () => {
    for (const wrapper of Object.values(wrappers)) assert.match(adapters[reader].html(wrapper.wrap(fragments.reference[reader])), /href="\/target"[^>]*>label<\/a>/)
  })
  test(`${reader}: reference rendering controls inspect destinations`, () => {
    for (const id of ['full', 'collapsed']) {
      const defined = rows.find(r => r.reader === reader && r.family === 'resolution' && r.id === `${id}/defined`)
      const changed = rows.find(r => r.reader === reader && r.family === 'resolution' && r.id === `${id}/changed`)
      assert.match(defined.right, /href="\/target"/); assert.doesNotMatch(defined.left, /href="\/target"/)
      assert.match(changed.left, /href="\/target"/); assert.match(changed.right, /href="\/other"/)
    }
  })
  test(`${reader}: nesting benchmarks parse the requested depth without degradation`, () => {
    for (const n of [8, 64, 128, 192]) for (const [marker, kind] of [['> ', 'quote'], ['- ', 'list']]) assert.equal(nestingDepth(reader, marker.repeat(n) + 'end\n', kind), n)
  })
}
