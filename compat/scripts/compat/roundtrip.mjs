import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import remarkStringify from 'remark-stringify'
import * as commonmark from 'commonmark'
import * as djot from '@djot/djot'
import TurndownService from 'turndown'
import { carveToCarve, carveToHtml, carveToMarkdown, htmlToCarve, markdownToCarve, parse, toAstJson } from '@markup-carve/carve'
import { context, fromDjot, fromMdast, semantics } from './trees.mjs'
import { corpus } from './check.mjs'
import { engineMetadata } from './engines.mjs'

export const variantCases = JSON.parse(readFileSync(new URL('../../tests/roundtrip/cases.json', import.meta.url), 'utf8'))
export const languages = ['carve', 'markdown', 'djot']

const md = unified().use(remarkParse).use(remarkGfm)
const mdToHtml = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeStringify)
const htmlToMd = unified().use(rehypeParse, { fragment: true }).use(rehypeRemark).use(remarkGfm).use(remarkStringify)
const mdToMd = unified().use(remarkParse).use(remarkGfm).use(remarkStringify)
const phpBatch = mode => sources => JSON.parse(execFileSync(process.env.CARVE_PHP ?? 'php', [fileURLToPath(new URL('./php-roundtrip-driver.php', import.meta.url))], { input: JSON.stringify(sources.map(source => ({ chain: mode, source }))), encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 }))
const rust = (args, input) => execFileSync(engineMetadata('rust').binary, args, { input, encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] })
const engineChains = engine => {
  const name = { php: 'PHP', rust: 'Rust' }[engine], native = engine
  const run = engine === 'rust'
    ? { html: s => rust(['migrate', '--from', 'html'], rust(['--html'], s)), 'html-carriers': s => rust(['migrate', '--from', 'html'], rust(['--html', '--roundtrip'], s)), markdown: s => rust(['migrate', '--from', 'markdown'], rust(['--markdown'], s)), 'markdown-carriers': s => rust(['migrate', '--from', 'markdown'], rust(['--markdown', '--roundtrip'], s)), fmt: s => rust(['--carve'], s) }
    : null
  const chain = (mode, viaHtml, label) => ({ id: `${engine}-${mode}`, language: 'carve', engine, viaHtml, native, label: `Carve ${name}: ${label}`, ...(run ? { run: run[mode] } : { batch: phpBatch(mode) }) })
  return [
    chain('html', true, 'Carve -> HTML -> Carve'),
    chain('html-carriers', true, 'Carve -> HTML with roundtrip carriers -> Carve'),
    chain('markdown', false, 'Carve -> Markdown -> Carve'),
    chain('markdown-carriers', false, 'Carve -> Markdown with roundtrip carriers -> Carve'),
    chain('fmt', false, 'Carve canonical writer (no HTML)'),
  ]
}
const pandoc = (args, input) => execFileSync(process.env.CARVE_PANDOC ?? 'pandoc', args, { input, encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024 })

// Each chain takes source in its language and returns source in the same language.
export const chains = [
  { id: 'carve-html', language: 'carve', engine: 'javascript', viaHtml: true, label: 'Carve -> HTML -> Carve', run: s => htmlToCarve(carveToHtml(s)).value },
  { id: 'carve-html-carriers', language: 'carve', engine: 'javascript', viaHtml: true, label: 'Carve -> HTML with roundtrip carriers -> Carve', run: s => htmlToCarve(carveToHtml(s, { roundtrip: true })).value },
  { id: 'carve-markdown', language: 'carve', engine: 'javascript', viaHtml: false, label: 'Carve -> Markdown -> Carve', run: s => markdownToCarve(carveToMarkdown(s)) },
  { id: 'carve-markdown-carriers', language: 'carve', engine: 'javascript', viaHtml: false, label: 'Carve -> Markdown with roundtrip carriers -> Carve', run: s => markdownToCarve(carveToMarkdown(s, { roundtrip: true })) },
  { id: 'carve-fmt', language: 'carve', engine: 'javascript', viaHtml: false, label: 'Carve canonical writer (no HTML)', run: s => carveToCarve(s) },
  ...engineChains('php'),
  ...engineChains('rust'),
  { id: 'remark-html', language: 'markdown', viaHtml: true, label: 'remark -> rehype -> remark', run: async s => String(await htmlToMd.process(String(await mdToHtml.process(s)))) },
  { id: 'remark-md', language: 'markdown', viaHtml: false, label: 'remark -> remark (no HTML)', run: async s => String(await mdToMd.process(s)) },
  { id: 'turndown-html', language: 'markdown', viaHtml: true, label: 'commonmark.js -> turndown (defaults)', run: s => new TurndownService().turndown(new commonmark.HtmlRenderer().render(new commonmark.Parser().parse(s))) + '\n' },
  { id: 'pandoc-gfm-html', language: 'markdown', viaHtml: true, native: 'pandoc', label: 'pandoc gfm -> HTML -> gfm', run: s => pandoc(['--from=html', '--to=gfm'], pandoc(['--from=gfm', '--to=html5'], s)) },
  { id: 'pandoc-gfm', language: 'markdown', viaHtml: false, native: 'pandoc', label: 'pandoc gfm -> gfm (no HTML)', run: s => pandoc(['--from=gfm', '--to=gfm'], s) },
  { id: 'pandoc-djot-html', language: 'djot', viaHtml: true, native: 'pandoc', label: 'pandoc djot -> HTML -> djot', run: s => pandoc(['--from=html', '--to=djot'], pandoc(['--from=djot', '--to=html5'], s)) },
  { id: 'pandoc-djot', language: 'djot', viaHtml: false, native: 'pandoc', label: 'pandoc djot -> djot (no HTML)', run: s => pandoc(['--from=djot', '--to=djot'], s) },
]

const offsets = (node, source) => source.slice(node.position.start.offset, node.position.end.offset)
const walk = (node, visit) => { if (!node || typeof node !== 'object') return; visit(node); for (const value of Object.values(node)) if (value && typeof value === 'object') Array.isArray(value) ? value.forEach(v => walk(v, visit)) : walk(value, visit) }
const fence = char => char === '`' ? 'backtick' : char === '~' ? 'tilde' : 'indented'
const linkForm = raw => raw.endsWith('[]') ? 'collapsed' : /\]\[/.test(raw) ? 'full' : 'shortcut'

// Spellings a document holds, in document order, per distinction. Only what the language can spell two ways.
export function inventory(language, source) {
  const out = []
  const add = (distinction, spelling) => out.push({ distinction, spelling })
  if (language === 'carve') {
    walk(toAstJson(parse(source)), n => {
      if (n.type === 'list') add(n.ordered ? 'ordered-delimiter' : 'bullet', n.ordered ? n.delim ?? '.' : n.bulletChar ?? '-')
      else if (n.type === 'thematic_break') add('thematic-break', n.marker ?? '-')
      else if (n.type === 'link') add('link-form', n.ref === undefined ? 'inline' : linkForm(n.rawRef ?? ''))
      else if (n.type === 'autolink') add('link-form', 'autolink')
      else if (n.type === 'table') add('table-widths', n.separatorWidths ? n.separatorWidths.join(',') : 'none')
      else if (n.type === 'code_block') {
        add('code-fence', fence([...source][n.pos.startOffset]))
        add('code-label', n.label ?? 'none')
      }
    })
  } else if (language === 'markdown') {
    walk(md.parse(source), n => {
      if (!n.position) return
      const raw = offsets(n, source)
      if (n.type === 'list') add(n.ordered ? 'ordered-delimiter' : 'bullet', n.ordered ? raw.match(/^\d+([.)])/)[1] : raw[0])
      else if (n.type === 'thematicBreak') add('thematic-break', raw.trim()[0])
      else if (n.type === 'link') add('link-form', raw.startsWith('<') ? 'autolink' : raw.startsWith('[') ? 'inline' : 'literal')
      else if (n.type === 'linkReference') add('link-form', n.referenceType)
      else if (n.type === 'table') add('table-widths', raw.split('\n')[1].trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim().length).join(','))
      else if (n.type === 'code') add('code-fence', raw.startsWith('```') ? 'backtick' : raw.startsWith('~~~') ? 'tilde' : 'indented')
      else if (n.type === 'heading') add('heading-style', raw.startsWith('#') ? 'atx' : 'setext')
      else if (n.type === 'emphasis') add('emphasis-char', raw[0])
      else if (n.type === 'strong') add('strong-char', raw.slice(0, 2))
      else if (n.type === 'break') add('hard-break', raw.startsWith('\\') ? 'backslash' : 'spaces')
    })
  } else if (language === 'djot') {
    walk(djot.parse(source, { sourcePositions: true }), n => {
      if (n.tag === 'bullet_list') add('bullet', n.style)
      else if (n.tag === 'ordered_list') add('ordered-delimiter', n.style.startsWith('(') ? '()' : n.style.slice(-1))
      else if (n.tag === 'thematic_break') add('thematic-break', source.slice(n.pos.start.offset).trim()[0])
      else if (n.tag === 'code_block') add('code-fence', fence(source[n.pos.start.offset]))
      else if (n.tag === 'url') add('link-form', 'autolink')
      else if (n.tag === 'link') add('link-form', n.reference === undefined ? 'inline' : linkForm(source.slice(n.pos.start.offset, n.pos.end.offset + 1)))
    })
  } else throw new Error(`Unknown language ${language}`)
  return out
}

const carveSpelling = new Set(['marker', 'ref', 'rawRef', 'separatorWidths', 'label', 'tight'])
function carveMeaning(value) {
  if (Array.isArray(value)) return value.filter(node => node?.type !== 'link_reference_definition').map(carveMeaning)
  if (!value || typeof value !== 'object') return value
  // An autolink means a link whose text is its destination.
  if (value.type === 'autolink') return { type: 'link', href: value.href, children: [{ type: 'text', value: value.text }] }
  const out = {}
  for (const [key, field] of Object.entries(value)) if (!carveSpelling.has(key)) out[key] = carveMeaning(field)
  return out
}

// The meaning projection compat already compares; spelling fields stay out of it.
export function meaning(language, source) {
  if (language === 'carve') return semantics(carveMeaning(toAstJson(parse(source))))
  if (language === 'markdown') return semantics(fromMdast(md.parse(source), context('mdast')))
  if (language === 'djot') return semantics(fromDjot(djot.parse(source), context('djot')))
  throw new Error(`Unknown language ${language}`)
}

export function validateVariantCases(data = variantCases) {
  assert.equal(data.schemaVersion, 1)
  const ids = new Set()
  for (const item of data.cases) {
    assert.ok(!ids.has(item.id), `Duplicate case ${item.id}`); ids.add(item.id)
    assert.equal(item.id, `${item.distinction}/${item.spelling}`)
    const present = languages.filter(language => typeof item[language] === 'string')
    assert.ok(present.length, `${item.id} spells no language`)
    for (const language of present) {
      const spellings = inventory(language, item[language]).filter(entry => entry.distinction === item.distinction)
      assert.ok(spellings.length, `${item.id}: ${language} source holds no ${item.distinction}`)
      assert.ok(spellings.every(entry => entry.spelling === item.spelling), `${item.id}: ${language} source spells ${spellings.map(e => e.spelling).join(',')}`)
    }
  }
  return data
}

export function meaningInputs(language) {
  const tool = { markdown: 'mdast', djot: 'djot' }[language]
  const external = corpus.cases.filter(item => typeof item[language] === 'string' && (language === 'carve' || item.tools.includes(tool))).map(item => ({ id: `external/${item.id}`, source: item[language] }))
  return [...external, ...variantCases.cases.filter(item => typeof item[language] === 'string').map(item => ({ id: `variant/${item.id}`, source: item[language] }))]
}

async function attempt(fn) { try { return { value: await fn() } } catch (error) { return { error: error.message.split('\n')[0] } } }

export async function runRoundtrip(selected = chains.map(chain => chain.id)) {
  assert.ok(selected.length && selected.every(id => chains.some(chain => chain.id === id)), 'Unknown chain')
  const rows = [], summary = {}
  for (const chain of chains.filter(item => selected.includes(item.id))) {
    const result = summary[chain.id] = { meaning: { measured: 0, kept: 0, errors: 0 }, spelling: {} }
    let run = chain.run
    if (chain.batch) {
      const sources = [...meaningInputs(chain.language).map(input => input.source), ...variantCases.cases.filter(entry => typeof entry[chain.language] === 'string').map(entry => entry[chain.language])]
      const batch = await attempt(() => chain.batch(sources)), results = new Map(sources.map((source, i) => [source, batch.error ? { error: batch.error } : batch.value[i]]))
      run = source => { const value = results.get(source); if (value.error) throw new Error(value.error); return value.value }
    }
    for (const input of meaningInputs(chain.language)) {
      const back = await attempt(() => run(input.source))
      const kept = !back.error && (await attempt(() => isDeepStrictEqual(meaning(chain.language, input.source), meaning(chain.language, back.value)))).value === true
      result.meaning.measured++
      if (back.error) result.meaning.errors++
      else if (kept) result.meaning.kept++
      rows.push({ layer: 'meaning', chain: chain.id, id: input.id, kept, ...(back.error ? { error: back.error } : { returned: back.value }) })
    }
    for (const item of variantCases.cases.filter(entry => typeof entry[chain.language] === 'string')) {
      const back = await attempt(() => run(item[chain.language]))
      const before = inventory(chain.language, item[chain.language]).filter(entry => entry.distinction === item.distinction).map(entry => entry.spelling)
      const after = back.error ? null : (await attempt(() => inventory(chain.language, back.value).filter(entry => entry.distinction === item.distinction).map(entry => entry.spelling))).value ?? null
      const kept = isDeepStrictEqual(before, after)
      const cell = result.spelling[item.distinction] ??= { measured: 0, kept: 0, spellings: {} }
      cell.measured++
      if (kept) cell.kept++
      cell.spellings[item.spelling] = kept
      rows.push({ layer: 'spelling', chain: chain.id, id: item.id, distinction: item.distinction, spelling: item.spelling, kept, before, after, ...(back.error ? { error: back.error } : { returned: back.value }) })
    }
  }
  const versions = {
    carve: JSON.parse(readFileSync(new URL('../../node_modules/@markup-carve/carve/package.json', import.meta.url))).version,
    remarkParse: JSON.parse(readFileSync(new URL('../../node_modules/remark-parse/package.json', import.meta.url))).version,
    rehypeRemark: JSON.parse(readFileSync(new URL('../../node_modules/rehype-remark/package.json', import.meta.url))).version,
    turndown: JSON.parse(readFileSync(new URL('../../node_modules/turndown/package.json', import.meta.url))).version,
    commonmark: JSON.parse(readFileSync(new URL('../../node_modules/commonmark/package.json', import.meta.url))).version,
    djot: djot.version,
    ...(selected.some(id => chains.find(chain => chain.id === id).native === 'pandoc') ? { pandoc: pandoc(['--version'], '').split('\n')[0] } : {}),
    ...(selected.some(id => chains.find(chain => chain.id === id).native === 'php') ? { 'carve-php': engineMetadata('php').revision.slice(0, 8) } : {}),
    ...(selected.some(id => chains.find(chain => chain.id === id).native === 'rust') ? { 'carve-rs': engineMetadata('rust').revision.slice(0, 8) } : {}),
  }
  return {
    schemaVersion: 1,
    kind: 'roundtrip',
    generatedAt: new Date().toISOString(),
    versions,
    casesSha256: createHash('sha256').update(readFileSync(new URL('../../tests/roundtrip/cases.json', import.meta.url))).digest('hex'),
    externalCasesSha256: createHash('sha256').update(readFileSync(new URL('../../tests/external-compat/cases.json', import.meta.url))).digest('hex'),
    chains: chains.filter(chain => selected.includes(chain.id)).map(({ run, batch, ...chain }) => chain),
    scope: 'Meaning compares the compat semantic projection of the original and the returned source in the same language. Spelling compares, per authored variant case, the sequence of spellings for that case\'s distinction. A distinction is measured only for languages that can spell it two ways; elsewhere it is not applicable.',
    summary,
    rows,
  }
}

// One row per distinction, one column per chain; n/a where the chain's language cannot spell it two ways.
export function spellingTable(report) {
  const ids = report.chains.map(chain => chain.id)
  const distinctions = [...new Set(report.rows.filter(row => row.layer === 'spelling').map(row => row.distinction))]
  const cell = (id, distinction) => { const value = report.summary[id].spelling[distinction]; return value ? `${value.kept}/${value.measured}` : 'n/a' }
  const meaningCell = id => { const value = report.summary[id].meaning; return `${value.kept}/${value.measured}` }
  return [
    `| Distinction | ${ids.join(' | ')} |`,
    `| --- |${ids.map(() => ' ---: |').join('')}`,
    `| meaning | ${ids.map(meaningCell).join(' | ')} |`,
    ...distinctions.map(distinction => `| ${distinction} | ${ids.map(id => cell(id, distinction)).join(' | ')} |`),
  ].join('\n')
}

// A report the site may publish: current cases, and every summary count backed by its rows.
export function validateRoundtripReport(report) {
  assert.equal(report.schemaVersion, 1)
  assert.equal(report.kind, 'roundtrip')
  assert.equal(report.casesSha256, createHash('sha256').update(readFileSync(new URL('../../tests/roundtrip/cases.json', import.meta.url))).digest('hex'), 'Roundtrip cases changed after this report was measured')
  assert.equal(report.externalCasesSha256, createHash('sha256').update(readFileSync(new URL('../../tests/external-compat/cases.json', import.meta.url))).digest('hex'), 'External cases changed after this roundtrip report was measured')
  assert.ok(report.generatedAt && report.versions && report.chains.length, 'Incomplete roundtrip report')
  for (const chain of report.chains) {
    assert.ok(chains.some(known => known.id === chain.id && known.language === chain.language), `Unknown chain ${chain.id}`)
    const rows = report.rows.filter(row => row.chain === chain.id), summary = report.summary[chain.id]
    const meaningRows = rows.filter(row => row.layer === 'meaning')
    assert.deepEqual(meaningRows.map(row => row.id), meaningInputs(chain.language).map(input => input.id), `${chain.id}: meaning inputs differ from the fixtures`)
    assert.deepEqual(summary.meaning, { measured: meaningRows.length, kept: meaningRows.filter(row => row.kept).length, errors: meaningRows.filter(row => row.error).length }, `${chain.id}: meaning summary`)
    const spellingRows = rows.filter(row => row.layer === 'spelling')
    assert.deepEqual(spellingRows.map(row => row.id), variantCases.cases.filter(item => typeof item[chain.language] === 'string').map(item => item.id), `${chain.id}: variant cases differ from the fixtures`)
    const expected = {}
    for (const row of spellingRows) {
      const cell = expected[row.distinction] ??= { measured: 0, kept: 0, spellings: {} }
      cell.measured++; if (row.kept) cell.kept++; cell.spellings[row.spelling] = row.kept
    }
    assert.deepEqual(summary.spelling, expected, `${chain.id}: spelling summary`)
  }
  assert.equal(report.rows.length, report.rows.filter(row => report.chains.some(chain => chain.id === row.chain)).length, 'Rows for an unlisted chain')
  return report
}

// The source a row measured, so published evidence carries its input.
export function rowSource(language, row) {
  if (row.layer === 'spelling') return variantCases.cases.find(item => item.id === row.id)[language]
  return meaningInputs(language).find(input => input.id === row.id).source
}
