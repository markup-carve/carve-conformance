// Runs after compat:provision: a missing or unpinned engine fails here instead of skipping.
import assert from 'node:assert/strict'
import test from 'node:test'
import { measurementCalls, sameHtml } from '../../scripts/compat/measurements-0.2.mjs'

for (const engine of ['php', 'rust']) {
  test(`carve-${engine === 'rust' ? 'rs' : engine} next2 answers the calls of the 0.2 measurements`, () => {
    const [tree, html, carriers, formatted, imported, markdown] = measurementCalls(engine, [
      { call: 'parse', source: 'A *b*\n' },
      { call: 'renderSource', source: 'A *b*\n' },
      { call: 'renderSource', source: '* a\n', options: { roundtrip: true } },
      { call: 'format', source: 'A *b*\n' },
      { call: 'import', from: 'html', source: '<p>A <strong>b</strong></p>' },
      { call: 'exportMarkdown', source: 'A\n' },
    ])
    assert.equal(tree.ok.astVersion, '2.0')
    assert.ok(sameHtml(html.ok, '<p>A <strong>b</strong></p>'))
    assert.equal(typeof carriers.ok, 'string')
    assert.equal(formatted.ok, 'A *b*\n')
    assert.equal(imported.ok.source, 'A *b*\n')
    assert.equal(markdown.ok, 'A\n')
  })
}
