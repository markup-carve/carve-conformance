import assert from 'node:assert/strict'
import test from 'node:test'
import { checkImport, compareImporters, honesty02, importCalls, importInputs, reportClass02 } from '../scripts/compat/importers-0.2.mjs'
import { parseTree } from '../scripts/compat/engines-0.2.mjs'

const row = (tool, id, source, foreignHtml, extra = {}) => ({ tool, case: id, kind: 'supported', status: 'passed', evidence: { source, foreignHtml, ast: parseTree('A *b*.\n'), ...extra } })
const rows = [
  row('mdast', 'one', 'A **b**.\n', '<p>A <strong>b</strong>.</p>'),
  row('hast', 'one', '<p>A <strong>b</strong>.</p>', '<p>A <strong>b</strong>.</p>'),
  row('djot', 'one', 'A *b*.\n', '<p>A <strong>b</strong>.</p>'),
  row('pandoc', 'one', 'A **b**.\n', '<p>A <strong>b</strong>.</p>'),
  row('hast', 'authored', '<p>x</p>', '<p>x</p>', { expectedAst: parseTree('x\n') }),
  { ...row('hast', 'declared', '<p>y</p>', '<p>y</p>'), status: 'declared' },
]

test('only passed supported rows of a reader with an importer are imported, with the 0.2 format', () => {
  assert.deepEqual(importInputs(rows).map(i => [i.tool, i.case, i.from]), [['mdast', 'one', 'gfm'], ['hast', 'one', 'html'], ['djot', 'one', 'djot']])
})

test('a hint names no loss; every other importer entry does', () => {
  assert.equal(reportClass02([]), 'clean')
  assert.equal(reportClass02([{ code: 'import-whitespace-normalized', severity: 'hint' }]), 'clean')
  assert.equal(reportClass02([{ code: 'import-whitespace-normalized', severity: 'hint' }, { code: 'import-element-mapped', severity: 'warning' }]), 'names-loss')
})

test('honesty covers every structure and report combination', () => {
  for (const [kept, cls, outcome] of [[true, 'clean', 'ok'], [true, 'names-loss', 'false-loss'], [false, 'names-loss', 'reported'], [false, 'clean', 'silent-loss']]) assert.equal(honesty02(kept, cls), outcome)
})

test('carve-js imports every format and its rendering is compared with the foreign one', () => {
  const [input] = importInputs([row('hast', 'one', '<p>A <strong>b</strong>.</p>', '<p>A <strong>b</strong>.</p>')])
  const [result] = importCalls('javascript', [input])
  assert.equal(checkImport(input, result).outcome, 'ok')
  for (const from of ['markdown', 'gfm', 'djot']) assert.equal(typeof importCalls('javascript', [{ from, source: 'One\n' }])[0].ok.source, 'string')
  assert.equal(checkImport(input, { ok: { source: 'Other.\n', diagnostics: [] } }).outcome, 'silent-loss')
  assert.equal(checkImport(input, { ok: { source: 'Other.\n', diagnostics: [{ code: 'import-element-dropped', severity: 'warning' }] } }).outcome, 'reported')
  assert.equal(checkImport(input, { ok: { source: 'A *b*.\n', diagnostics: [{ code: 'import-element-dropped', severity: 'warning' }] } }).outcome, 'false-loss')
  assert.equal(checkImport(input, { error: 'ImportInputError: no' }).outcome, 'refused')
})

test('carve-php and carve-rs import HTML only; a contradiction keeps input, report and both structures', () => {
  const seen = {}
  const fake = (engine, requests) => { seen[engine] = requests.map(r => r.from); return requests.map(() => engine === 'rust' ? { ok: { source: 'Lost.\n', diagnostics: [] } } : { ok: { source: 'A *b*.\n', diagnostics: [] } }) }
  const result = compareImporters(rows, { engines: ['javascript', 'php', 'rust'], call: fake })
  assert.deepEqual(seen, { javascript: ['gfm', 'html', 'djot'], php: ['html'], rust: ['html'] })
  assert.equal(result.php.contradictions.length, 0)
  assert.deepEqual(result.php.byFormat.html, { ok: 1, reported: 0, 'silent-loss': 0, 'false-loss': 0, refused: 0 })
  const [c] = result.rust.contradictions
  assert.deepEqual([c.tool, c.case, c.from, c.outcome, c.input, c.source, c.report], ['hast', 'one', 'html', 'silent-loss', '<p>A <strong>b</strong>.</p>', 'Lost.\n', []])
  assert.notDeepEqual(c.structure.foreign, c.structure.imported)
})
