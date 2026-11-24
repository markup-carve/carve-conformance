// Runs after compat:provision: a missing or unpinned engine fails here instead of skipping.
import assert from 'node:assert/strict'
import test from 'node:test'
import { importCalls } from '../../scripts/compat/importers-0.2.mjs'
import { nativeMetadata } from '../../scripts/compat/engines-native-0.2.mjs'

for (const engine of ['php', 'rust']) {
  test(`carve-${engine === 'rust' ? 'rs' : engine} next2 answers importDocument for HTML`, t => {
    nativeMetadata(engine)
    const cases = [{ from: 'html', source: '<p>A <strong>b</strong>.</p>' }, { from: 'html', source: '<p><marquee>m</marquee></p>' }]
    const results = importCalls(engine, cases)
    assert.equal(results.length, cases.length)
    const [ok, mapped] = results
    assert.equal(ok.ok.source, 'A *b*.\n')
    assert.ok(mapped.ok.diagnostics.some(d => d.code === 'import-element-mapped' && d.foreignType === 'marquee'))
    t.diagnostic(`${engine} next2: ${results.length} import cases`)
  })
}
