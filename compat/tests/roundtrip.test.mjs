import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { chains, inventory, meaning, meaningInputs, runRoundtrip, spellingTable, validateVariantCases, variantCases } from '../scripts/compat/roundtrip.mjs'

const spellings = (language, source, distinction) => inventory(language, source).filter(entry => entry.distinction === distinction).map(entry => entry.spelling)

test('every variant case spells the distinction it names, in every language it carries', () => {
  validateVariantCases()
  const broken = structuredClone(variantCases)
  broken.cases.find(item => item.id === 'bullet/*').markdown = '- one\n- two\n'
  assert.throws(() => validateVariantCases(broken), /bullet\/\*: markdown source spells -/)
})

test('inventories read spelling the meaning projection ignores', () => {
  assert.deepEqual(spellings('markdown', 'Title\n-----\n\n## Next\n', 'heading-style'), ['setext', 'atx'])
  assert.deepEqual(spellings('markdown', 'A [a](/u), [b][r], [r][], [r] and <https://x.y>.\n\n[r]: /u\n', 'link-form'), ['inline', 'full', 'collapsed', 'shortcut', 'autolink'])
  assert.deepEqual(spellings('markdown', '| a | b |\n|:--|----:|\n| 1 | 2 |\n', 'table-widths'), ['3,5'])
  assert.deepEqual(spellings('carve', 'See [t][r] and [r][].\n\n[r]: /u\n', 'link-form'), ['full', 'collapsed'])
  assert.deepEqual(spellings('carve', '1) a\n\n***\n', 'thematic-break'), ['*'])
  assert.deepEqual(spellings('djot', '(1) a\n', 'ordered-delimiter'), ['()'])
  assert.deepEqual(meaning('markdown', '* a\n'), meaning('markdown', '- a\n'))
  assert.deepEqual(meaning('carve', 'See <https://x.y>.\n'), meaning('carve', 'See [https://x.y](https://x.y).\n'))
  assert.deepEqual(meaning('carve', 'See [t][r].\n\n[r]: /u\n'), meaning('carve', 'See [t](/u).\n'))
  assert.notDeepEqual(meaning('carve', 'See [t](/u).\n'), meaning('carve', 'See [t](/v).\n'))
})

test('meaning inputs reuse the paired external cases a language reader covers', () => {
  const ids = language => meaningInputs(language).map(input => input.id)
  assert.ok(ids('carve').includes('external/definition-list'))
  assert.ok(!ids('markdown').includes('external/definition-list'))
  assert.ok(ids('djot').includes('variant/bullet/+'))
})

test('the roundtrip export keeps every distinction PART 10 §13 carries over HTML, and the plain export does not', async () => {
  const report = await runRoundtrip(['carve-html', 'carve-html-carriers', 'carve-fmt'])
  const carriers = report.summary['carve-html-carriers']
  assert.equal(carriers.meaning.kept, carriers.meaning.measured)
  // The fence character has no carrier: the tree does not record it (CARVE-P11-013).
  assert.deepEqual(carriers.spelling['code-fence'], { measured: 2, kept: 1, spellings: { backtick: true, tilde: false } })
  for (const [distinction, cell] of Object.entries(carriers.spelling)) if (distinction !== 'code-fence') assert.equal(cell.kept, cell.measured, distinction)
  const plain = report.summary['carve-html'].spelling
  assert.ok(Object.values(plain).some(cell => cell.kept < cell.measured))
  assert.equal(report.rows.filter(row => row.error).length, 0)
  assert.match(spellingTable(report), /\| bullet \| 1\/2 \| 2\/2 \| 2\/2 \|/)
})

test('chain identifiers are unique and every chain names its language', () => {
  assert.equal(new Set(chains.map(chain => chain.id)).size, chains.length)
  for (const chain of chains) assert.ok(['carve', 'markdown', 'djot'].includes(chain.language), chain.id)
})

test('each engine runs the same five Carve chains, and a native engine keeps meaning over its own HTML', async t => {
  const modes = ['html', 'html-carriers', 'markdown', 'markdown-carriers', 'fmt']
  for (const engine of ['php', 'rust']) assert.deepEqual(chains.filter(chain => chain.engine === engine).map(chain => chain.id), modes.map(mode => `${engine}-${mode}`))
  assert.deepEqual(chains.filter(chain => chain.engine === 'javascript').map(chain => chain.id), modes.map(mode => `carve-${mode}`))
  for (const engine of ['php', 'rust']) {
    if (!existsSync(engine === 'php' ? '.cache/engines/php' : '.cache/engines/rust/bin/carve')) { t.diagnostic(`${engine} engine absent`); continue }
    const report = await runRoundtrip([`${engine}-html-carriers`])
    assert.equal(report.rows.filter(row => row.error).length, 0, engine)
    assert.equal(report.summary[`${engine}-html-carriers`].spelling['thematic-break'].kept, 3, engine)
    assert.match(report.versions[engine === 'php' ? 'carve-php' : 'carve-rs'], /^[0-9a-f]{8}$/)
  }
})
