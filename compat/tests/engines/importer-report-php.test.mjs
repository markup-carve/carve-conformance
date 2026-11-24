// Runs after compat:provision: runImportBatch fails when carve-php is not provisioned at its pin.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runImportBatch } from '../../scripts/compat/importer-report.mjs'

test('PHP migration batch accepts legacy strings and format entries', () => {
  const results = runImportBatch('php', ['**Markdown**\n', {format:'djot',source:'*Djot*\n'}, {format:'html',source:'<p>HTML</p>'}, '**Fresh**\n'])
  assert.equal(results.length, 4)
  for (const result of results) {
    assert.equal(typeof result.value, 'string', result.error)
    assert.ok(Array.isArray(result.report.diagnostics))
  }
  assert.match(results[0].value, /Markdown/)
  assert.match(results[1].value, /Djot/)
  assert.match(results[2].value, /HTML/)
  assert.ok(!results[3].value.includes('Markdown'))
})
