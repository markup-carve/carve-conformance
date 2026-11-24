import assert from 'node:assert/strict'
import test from 'node:test'
import { compareHtml02, inventory02, measurementCalls, meaning02, positionSummary02, runHtmlSuite02, runRoundtrip02, runSourceAgreement02, sameHtml } from '../scripts/compat/measurements-0.2.mjs'
import { parseTree } from '../scripts/compat/engines-0.2.mjs'

// carve-js answers for every engine, except where a test replaces one engine's answer.
const fakeCalls = replace => (engine, requests) => measurementCalls('javascript', requests).map((answer, i) => replace?.(engine, requests[i], answer) ?? answer)

test('the 0.2 HTML comparison ignores renderer whitespace and generated hooks, not structure', () => {
  assert.equal(compareHtml02('<p>a <em>b</em></p>\n', '<p>a\n  <em>b</em></p>').status, 'match')
  assert.equal(compareHtml02('<ol start="2">\n<li>x</li>\n</ol>\n', '<ol start="2" data-delim=")">\n  <li>x</li>\n</ol>').status, 'match')
  assert.equal(compareHtml02('<p>a <em>b</em></p>\n', '<p>a <strong>b</strong></p>').status, 'mismatch')
})

test('engines are compared on every attribute they write', () => {
  assert.equal(sameHtml('<p>a</p>', '<p>a</p>\n'), true)
  assert.equal(sameHtml('<ol data-delim=")"><li>x</li></ol>', '<ol><li>x</li></ol>'), false)
})

test('an HTML suite imports with carve-js and lists an engine disagreement with the input and all three renders', () => {
  const examples = [{ example: 1, section: 'S', markdown: 'A *b*\n', html: '<p>A <em>b</em></p>\n' }, { example: 2, section: 'S', markdown: 'C\n', html: '<p>C</p>\n' }]
  const call = fakeCalls((engine, request) => engine === 'rust' && request.call === 'renderSource' && request.source.startsWith('C') ? { ok: '<p>D</p>' } : undefined)
  const seen = []
  const result = runHtmlSuite02({ kind: 'commonmark-spec', examples, from: 'markdown', sourceKey: 'markdown', call: (engine, requests) => { seen.push([engine, requests.map(r => r.call)]); return call(engine, requests) } })
  assert.deepEqual(seen.map(([engine, calls]) => [engine, calls[0]]), [['javascript', 'import'], ['javascript', 'renderSource'], ['php', 'renderSource'], ['rust', 'renderSource'], ['php', 'import'], ['rust', 'import'], ['php', 'renderSource'], ['rust', 'renderSource']])
  assert.deepEqual(result.totals.javascript, { match: 2, mismatch: 0, notComparable: 0, failed: 0 })
  assert.deepEqual(result.totals.rust, { match: 1, mismatch: 1, notComparable: 0, failed: 0 })
  assert.deepEqual(result.honesty, { ok: 2, reported: 0, 'silent-loss': 0, 'false-loss': 0 })
  // The fake rust renders its own import of C the same way, so the import stage differs too.
  assert.deepEqual(result.disagreements.map(d => [d.example, d.stage]), [[2, 'render'], [2, 'import']])
  const [d, own] = result.disagreements
  assert.deepEqual([d.input, d.carve, d.outputs.rust, d.status.rust], ['C\n', 'C\n', '<p>D</p>', 'mismatch'])
  assert.deepEqual(Object.keys(d.outputs), ['javascript', 'php', 'rust'])
  assert.deepEqual(own.outputs.rust, { carve: 'C\n', html: '<p>D</p>' })
  assert.deepEqual(result.nativeTotals.php, { match: 2, mismatch: 0, notComparable: 0, failed: 0 })
})

test('an engine that cannot render is a failed row and a disagreement', () => {
  const examples = [{ example: 1, section: 'S', markdown: 'A\n', html: '<p>A</p>\n' }]
  const result = runHtmlSuite02({ kind: 'k', examples, from: 'markdown', sourceKey: 'markdown', call: fakeCalls((engine, request) => engine === 'php' && request.call === 'renderSource' ? { error: 'E: no' } : undefined) })
  assert.equal(result.rows[0].results.php.status, 'failed')
  assert.deepEqual(result.disagreements[0].outputs.php, { error: 'E: no' })
})

test('a refused import format is counted per message, not listed per example', () => {
  const examples = [1, 2].map(n => ({ example: n, section: 'S', source: `x${n}\n`, html: `<p>x${n}</p>\n` }))
  const result = runHtmlSuite02({ kind: 'djot-tests', examples, from: 'djot', sourceKey: 'source', call: fakeCalls((engine, request) => engine === 'php' && request.call === 'import' ? { error: 'ImportInputError: no djot' } : undefined) })
  assert.deepEqual(result.refused, { php: { 'ImportInputError: no djot': 2 } })
  assert.equal(result.nativeTotals.php.failed, 2)
  assert.equal(result.totals.php.match, 2)
  assert.deepEqual(result.disagreements, [])
})

test('0.2 positions count UTF-8 bytes', () => {
  const source = '🙂 é a\n'
  const summary = positionSummary02(parseTree(source), source)
  assert.deepEqual([summary.invalid, summary.sourceBytes, summary.sourceByteLengthMatches], [[], 10, true])
})

test('source agreement records a semantic difference with every engine output', () => {
  const call = fakeCalls((engine, request, answer) => engine === 'php' && request.call === 'parse' && request.source.startsWith('﻿a') ? { ok: parseTree('b\n') } : answer)
  const result = runSourceAgreement02({ call })
  const row = result.rows.find(r => r.id === 'normalization/bom')
  assert.equal(row.semanticAgreement, false)
  assert.ok(result.disagreements.some(d => d.id === 'normalization/bom' && d.outputs.php.tree && d.outputs.rust.tree))
  assert.equal(result.rows.filter(r => !r.semanticAgreement).length, 1)
})

test('the 0.2 spelling inventory reads the tree and source slices', () => {
  assert.deepEqual(inventory02('* a\n\n1) b\n'), [{ distinction: 'bullet', spelling: '*' }, { distinction: 'ordered-delimiter', spelling: ')' }])
  assert.deepEqual(inventory02('See [x][].\n\n[x]: /u\n').map(e => e.spelling), ['collapsed'])
  assert.deepEqual(inventory02('| a | b |\n|---|-----|\n| 1 | 2 |\n'), [{ distinction: 'table-widths', spelling: '3,5' }])
  assert.deepEqual(inventory02('```js [Example]\nlet x = 1\n```\n'), [{ distinction: 'code-fence', spelling: 'backtick' }, { distinction: 'code-label', spelling: 'Example' }])
  assert.deepEqual(meaning02('See <https://e.x/>.\n'), meaning02('See [https://e.x/](https://e.x/).\n'))
})

test('the roundtrip lists 0.2 readings without the spelling and a chain that differs across engines', () => {
  const call = fakeCalls((engine, request) => engine === 'rust' && request.call === 'format' ? { ok: 'Other.\n' } : undefined)
  const result = runRoundtrip02({ call })
  assert.deepEqual(result.chains.map(c => c.id), ['html', 'html-carriers', 'markdown', 'fmt'].flatMap(mode => ['javascript', 'php', 'rust'].map(engine => `${engine}-${mode}`)))
  assert.ok(result.summary['javascript-fmt'].notApplicable.includes('code-fence/tilde'))
  assert.equal(result.summary['javascript-fmt'].meaning.kept, result.summary['javascript-fmt'].meaning.measured)
  assert.equal(result.summary['rust-fmt'].meaning.kept, 0)
  const fmt = result.disagreements.filter(d => d.mode === 'fmt')
  assert.equal(fmt.length, result.summary['rust-fmt'].meaning.measured)
  assert.equal(fmt[0].outputs.rust, 'Other.\n')
  assert.equal(typeof fmt[0].input, 'string')
})
