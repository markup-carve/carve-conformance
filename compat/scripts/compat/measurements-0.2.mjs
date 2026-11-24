// CommonMark spec, djot.js tests, source agreement and the source roundtrip on the 0.2 lane.
// carve-js next2 is the oracle; carve-php and carve-rs next2 run every call their surface has.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import Ajv2020 from 'ajv/dist/2020.js'
import { formatWithDiagnostics, parse, render } from '@markup-carve/carve-next2'
import { toMarkdown } from '@markup-carve/carve-next2/export'
import { importDocument } from '@markup-carve/carve-next2/import'
import { coalesce, context, fromHast, parseHtml, semantics, text } from './trees-0.2.mjs'
import { parseTree } from './engines-0.2.mjs'
import { nativeMetadata } from './engines-native-0.2.mjs'
import { reportClass02, honesty02 } from './importers-0.2.mjs'
import { carveSource, spellings } from './check-0.2.mjs'
import { corpus } from './check.mjs'
import { layout, validateSpec } from './commonmark-spec.mjs'
import { validateDjotTests } from './djot-tests.mjs'
import { generatedSources } from './source-agreement.mjs'
import { variantCases } from './roundtrip.mjs'
import { structuralDiff } from '../../../site/shared/evidence-tools.js'

export const measurements02 = ['commonmark', 'djot', 'source-agreement', 'roundtrip']
export const measuredEngines02 = ['javascript', 'php', 'rust']
const outputOf = value => typeof value === 'string' ? value : value.value ?? value.html ?? value.output
const entry = d => ({ code: d.code, severity: d.severity, channel: d.channel, foreignType: d.foreignType ?? null })
const run = (command, args, input) => execFileSync(command, args, { input, encoding: 'utf8', timeout: 120000, maxBuffer: 256 * 1024 * 1024 })

// One request: parse, renderSource (with options), format, import (from) or exportMarkdown. One { ok } or { error } each.
function javascriptCall(request) {
  try {
    if (request.call === 'parse') return { ok: parseTree(request.source) }
    if (request.call === 'renderSource') return { ok: outputOf(render(request.source, request.options ?? {})) }
    if (request.call === 'format') return { ok: formatWithDiagnostics(request.source).source }
    if (request.call === 'import') { const out = importDocument(request.source, { from: request.from }); return { ok: { source: out.source, diagnostics: out.diagnostics.map(entry) } } }
    if (request.call === 'exportMarkdown') return { ok: toMarkdown(parse(request.source)).output }
    throw new Error(`Unknown call ${request.call}`)
  } catch (error) { return { error: `${error.name}: ${error.message}` } }
}

function rustCall(binary, request) {
  const call = { parse: { call: 'parse', source: request.source }, renderSource: { call: 'render', source: request.source, ...(request.options ? { options: request.options } : {}) }, format: { call: 'formatWithDiagnostics', source: request.source }, import: { call: 'importDocument', from: request.from, source: request.source } }[request.call]
  if (request.call === 'exportMarkdown') {
    const tree = rustCall(binary, { call: 'parse', source: request.source })
    return tree.error ? tree : rustResponse(binary, { call: 'writeWithDiagnostics', target: 'markdown', tree: tree.ok }, ok => ok.output)
  }
  if (!call) throw new Error(`Unknown call ${request.call}`)
  return rustResponse(binary, call, ok => ({ parse: ok.tree, renderSource: ok.html, format: ok.source, import: { source: ok.source, diagnostics: (ok.diagnostics ?? []).map(entry) } }[request.call]))
}

function rustResponse(binary, call, value) {
  let response
  // An error response exits non-zero; a crash, timeout or anything but a response stops the lane.
  try { response = JSON.parse(run(binary, ['call'], JSON.stringify(call))) } catch (error) {
    try { response = JSON.parse(error.stdout) } catch { throw error }
    if (!response?.error) throw error
  }
  if (response.error) return { error: `${response.error.name ?? 'error'}: ${response.error.message}` }
  return { ok: value(response.ok) }
}

export function measurementCalls(engine, requests) {
  if (!requests.length) return []
  if (engine === 'javascript') return requests.map(javascriptCall)
  if (engine === 'php') {
    nativeMetadata('php')
    const answers = JSON.parse(run(process.env.CARVE_PHP ?? 'php', ['-d', 'memory_limit=2G', fileURLToPath(new URL('./php-next2-driver.php', import.meta.url))], JSON.stringify(requests)))
    return requests.map((r, i) => answers[i].ok && r.call === 'import' ? { ok: { source: answers[i].ok.source, diagnostics: answers[i].ok.diagnostics.map(entry) } } : answers[i])
  }
  const { binary } = nativeMetadata('rust')
  return requests.map(r => rustCall(binary, r))
}

const loss = d => ['degraded', 'dropped'].includes(d.fidelity)

// Whitespace HTML does not render: collapsed outside code, trimmed at the inline edges of a block.
export function renderedWhitespace(tree) {
  if (Array.isArray(tree)) return coalesce(tree.map(renderedWhitespace))
  if (!tree || typeof tree !== 'object') return tree
  if (['code', 'code_block', 'verbatim', 'raw_block', 'raw_inline'].includes(tree.type)) return structuredClone(tree)
  if (tree.type === 'text') return { ...tree, value: tree.value.replace(/[ \t\n\r\f]+/g, ' ') }
  const out = Object.fromEntries(Object.entries(tree).map(([key, value]) => [key, key === 'attrs' ? value : renderedWhitespace(value)]))
  if (['paragraph', 'heading', 'cell_paragraph', 'definition_term', 'caption'].includes(tree.type) && out.children) {
    if (out.children[0]?.type === 'text') out.children[0] = { ...out.children[0], value: out.children[0].value.replace(/^ +/, '') }
    if (out.children.at(-1)?.type === 'text') out.children[out.children.length - 1] = { ...out.children.at(-1), value: out.children.at(-1).value.replace(/ +$/, '') }
    out.children = coalesce(out.children.filter(c => c.type !== 'text' || c.value !== ''))
  }
  return out
}

// The spec's HTML against a Carve render, through the 0.2 HTML reader. Generated Carve hooks are omitted.
export function compareHtml02(expectedHtml, carveHtml, { expectedGenerated = false } = {}) {
  const expectedContext = context('commonmark-spec')
  const expected = renderedWhitespace(semantics(fromHast(parseHtml(layout(expectedHtml)), expectedContext, expectedGenerated ? { generated: true, renderer: 'djot', keepDivs: true } : {})))
  const actual = renderedWhitespace(semantics(fromHast(parseHtml(layout(carveHtml)), context('carve'), { generated: true, renderer: 'carve', normalizeListDelimiter: true, ...(expectedGenerated ? { keepDivs: true } : {}) })))
  return { status: expectedContext.diagnostics.some(loss) ? 'not-comparable' : isDeepStrictEqual(expected, actual) ? 'match' : 'mismatch', expected, actual }
}

// Engines are compared on every element and attribute they write; only renderer indentation is removed.
export const engineView = html => renderedWhitespace(semantics(fromHast(parseHtml(layout(html)), context('carve'))))
export const sameHtml = (a, b) => isDeepStrictEqual(engineView(a), engineView(b))

const counts = () => ({ match: 0, mismatch: 0, notComparable: 0, failed: 0 })
const countKey = status => status === 'not-comparable' ? 'notComparable' : status

// carve-js imports each example and every engine renders that Carve source (`results`). Each engine also imports and
// renders the example itself (`native`). Every render is compared with the suite's HTML.
export function runHtmlSuite02({ kind, examples, from, sourceKey, expectedGenerated = false, engines = measuredEngines02, call = measurementCalls }) {
  const imports = call('javascript', examples.map(e => ({ call: 'import', from, source: e[sourceKey] })))
  const imported = imports.map((r, i) => r.ok ? i : -1).filter(i => i >= 0)
  const renders = Object.fromEntries(engines.map(engine => {
    const answers = call(engine, imported.map(i => ({ call: 'renderSource', source: imports[i].ok.source })))
    const byExample = new Map(imported.map((i, k) => [i, answers[k]]))
    return [engine, byExample]
  }))
  const nativeImports = Object.fromEntries(engines.map(engine => [engine, engine === 'javascript' ? imports : call(engine, examples.map(e => ({ call: 'import', from, source: e[sourceKey] })))]))
  const nativeRenders = Object.fromEntries(engines.map(engine => {
    if (engine === 'javascript') return [engine, renders.javascript]
    const done = nativeImports[engine].map((r, i) => r.ok ? i : -1).filter(i => i >= 0)
    const answers = call(engine, done.map(i => ({ call: 'renderSource', source: nativeImports[engine][i].ok.source })))
    return [engine, new Map(done.map((i, k) => [i, answers[k]]))]
  }))
  // An engine that refuses an import format is counted once per message, not listed per example.
  const refused = {}
  const totals = Object.fromEntries(engines.map(engine => [engine, counts()]))
  const nativeTotals = Object.fromEntries(engines.map(engine => [engine, counts()]))
  const honesty = { ok: 0, reported: 0, 'silent-loss': 0, 'false-loss': 0 }
  const sections = new Map()
  const rows = [], disagreements = []
  examples.forEach((e, i) => {
    const imp = imports[i]
    const row = { example: e.example, section: e.section, ...(e.link ? { link: e.link } : {}), input: e[sourceKey], expectedHtml: e.html, results: {} }
    if (imp.error) row.importError = imp.error
    else { row.carve = imp.ok.source; row.diagnostics = imp.ok.diagnostics; row.reportClass = reportClass02(imp.ok.diagnostics) }
    const section = sections.get(e.section) ?? sections.set(e.section, { section: e.section, examples: 0, results: Object.fromEntries(engines.map(engine => [engine, counts()])) }).get(e.section)
    section.examples++
    for (const engine of engines) {
      const rendered = imp.error ? { error: imp.error } : renders[engine].get(i)
      const result = rendered.error ? { status: 'failed', error: rendered.error } : { status: compareHtml02(e.html, rendered.ok, { expectedGenerated }).status, html: rendered.ok }
      row.results[engine] = result
      totals[engine][countKey(result.status)]++
      section.results[engine][countKey(result.status)]++
      const own = nativeImports[engine][i]
      if (own.error) {
        row.native = { ...row.native, [engine]: { status: 'failed', error: own.error } }
        ;(refused[engine] ??= {})[own.error] = (refused[engine][own.error] ?? 0) + 1
      } else {
        const html = nativeRenders[engine].get(i)
        row.native = { ...row.native, [engine]: html.error ? { status: 'failed', carve: own.ok.source, error: html.error } : { status: compareHtml02(e.html, html.ok, { expectedGenerated }).status, carve: own.ok.source, diagnostics: own.ok.diagnostics, html: html.ok } }
      }
      nativeTotals[engine][countKey(row.native[engine].status)]++
    }
    const js = row.results.javascript
    if (js && ['match', 'mismatch'].includes(js.status)) { row.honesty = honesty02(js.status === 'match', row.reportClass); honesty[row.honesty]++ }
    const others = engines.filter(engine => engine !== 'javascript')
    const differs = engine => row.results[engine].html === undefined || !sameHtml(js.html, row.results[engine].html)
    const ownJs = row.native.javascript
    // Refused imports are counted under `refused`; an import that ran is compared on its source and its render.
    const ownDiffers = engine => !nativeImports[engine][i].error && (row.native[engine].carve !== ownJs.carve || row.native[engine].html === undefined || ownJs.html === undefined || !sameHtml(ownJs.html, row.native[engine].html))
    if (js?.html !== undefined && others.some(differs)) {
      disagreements.push({ example: e.example, section: e.section, stage: 'render', input: row.input, carve: row.carve, outputs: Object.fromEntries(engines.map(engine => [engine, row.results[engine].html ?? { error: row.results[engine].error }])), status: Object.fromEntries(engines.map(engine => [engine, row.results[engine].status])) })
    }
    if (ownJs && others.some(ownDiffers)) {
      disagreements.push({ example: e.example, section: e.section, stage: 'import', input: row.input, outputs: Object.fromEntries(engines.map(engine => [engine, row.native[engine].error ? { error: row.native[engine].error } : { carve: row.native[engine].carve, html: row.native[engine].html ?? { error: row.native[engine].error } }])), status: Object.fromEntries(engines.map(engine => [engine, row.native[engine].status])) })
    }
    rows.push(row)
  })
  return { kind, importer: { engine: 'javascript', from }, engines, totals, nativeTotals, refused, honesty, sections: [...sections.values()], disagreements, rows }
}

export function runCommonmark02(options = {}) {
  const examples = validateSpec()
  return { spec: { version: '0.31.2', examples: examples.length }, ...runHtmlSuite02({ kind: 'commonmark-spec', examples, from: 'markdown', sourceKey: 'markdown', ...options }) }
}

export function runDjot02(options = {}) {
  const { examples, excluded } = validateDjotTests()
  return { suite: { name: 'djot.js', examples: examples.length, excluded }, ...runHtmlSuite02({ kind: 'djot-tests', examples, from: 'djot', sourceKey: 'source', expectedGenerated: true, ...options }) }
}

const schema02 = new Ajv2020({ strict: false }).compile(JSON.parse(readFileSync(new URL('../../resources/ast-schema-0.2.json', import.meta.url))))
export const semanticTree = value => Array.isArray(value) ? value.map(semanticTree) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => !['pos', 'srcByteLength'].includes(key)).map(([key, child]) => [key, semanticTree(child)])) : value

// 0.2 offsets count UTF-8 bytes of the source.
export function positionSummary02(tree, source) {
  let positioned = 0, nodes = 0
  const invalid = [], length = Buffer.byteLength(source)
  const visit = (value, path = '') => {
    if (!value || typeof value !== 'object') return
    if (value.type) nodes++
    if (value.pos) {
      positioned++
      const p = value.pos
      if (!Number.isInteger(p.startOffset) || !Number.isInteger(p.endOffset) || p.startOffset < 0 || p.endOffset < p.startOffset || p.endOffset > length) invalid.push(path + '/pos')
    }
    for (const [key, child] of Object.entries(value)) if (key !== 'pos') visit(child, `${path}/${key}`)
  }
  visit(tree)
  return { nodes, positioned, invalid, coordinateUnit: 'UTF-8 bytes; offsets checked against raw-source bounds', sourceBytes: length, reportedBytes: tree.srcByteLength ?? null, sourceByteLengthMatches: tree.srcByteLength === length }
}

// The generated sources of the 0.1 lane, parsed and rendered by every engine; carve-js is the reference.
export function runSourceAgreement02({ engines = measuredEngines02, call = measurementCalls } = {}) {
  const inputs = generatedSources()
  const outputs = Object.fromEntries(engines.map(engine => [engine, {
    trees: call(engine, inputs.map(row => ({ call: 'parse', source: row.source }))),
    html: call(engine, inputs.map(row => ({ call: 'renderSource', source: row.source }))),
  }]))
  const disagreements = []
  const rows = inputs.map((input, i) => {
    const results = Object.fromEntries(engines.map(engine => {
      const tree = outputs[engine].trees[i], html = outputs[engine].html[i]
      if (tree.error || html.error) return [engine, { error: tree.error ?? html.error }]
      const schemaValid = schema02(tree.ok)
      return [engine, { ast: tree.ok, html: html.ok, schemaValid, schemaErrors: schemaValid ? [] : structuredClone(schema02.errors), positions: positionSummary02(tree.ok, input.source) }]
    }))
    const reference = results.javascript, differences = {}
    for (const engine of engines.filter(e => e !== 'javascript')) {
      const actual = results[engine]
      if (reference.error || actual.error) { differences[engine] = { error: true }; continue }
      differences[engine] = { semantic: structuralDiff(semanticTree(reference.ast), semanticTree(actual.ast)), positioned: structuralDiff(reference.ast, actual.ast), html: sameHtml(reference.html, actual.html) ? 'match' : 'mismatch' }
    }
    const semanticAgreement = engines.every(engine => results[engine].ast && isDeepStrictEqual(semanticTree(reference.ast), semanticTree(results[engine].ast)))
    const htmlAgreement = engines.every(engine => results[engine].html !== undefined && sameHtml(reference.html ?? '', results[engine].html))
    if (!semanticAgreement || !htmlAgreement) disagreements.push({ id: input.id, input: input.source, semanticAgreement, htmlAgreement, outputs: Object.fromEntries(engines.map(engine => [engine, results[engine].error ? { error: results[engine].error } : { tree: semanticTree(results[engine].ast), html: results[engine].html }])) })
    return { ...input, results, differences, semanticAgreement, htmlAgreement }
  })
  return { kind: 'source-agreement', referenceEngine: 'javascript', engines, suiteSha256: createHash('sha256').update(JSON.stringify(inputs)).digest('hex'), scope: 'Generated observations without a normative oracle. The semantic comparison removes positions and source byte length; HTML is compared on every element and attribute.', disagreements, rows }
}

// Roundtrip chains, each run on every engine.
export const roundtripModes = ['html', 'html-carriers', 'markdown', 'fmt']

function chainRun(engine, mode, sources, call) {
  const fail = (answers) => answers.map(a => a.error ? { error: a.error } : null)
  if (mode === 'fmt') return call(engine, sources.map(source => ({ call: 'format', source })))
  const first = mode === 'markdown'
    ? call(engine, sources.map(source => ({ call: 'exportMarkdown', source })))
    : call(engine, sources.map(source => ({ call: 'renderSource', source, ...(mode === 'html-carriers' ? { options: { roundtrip: true } } : {}) })))
  const failed = fail(first), passed = first.map((a, i) => a.ok === undefined ? -1 : i).filter(i => i >= 0)
  const back = call(engine, passed.map(i => ({ call: 'import', from: mode === 'markdown' ? 'gfm' : 'html', source: first[i].ok })))
  const byIndex = new Map(passed.map((i, k) => [i, back[k]]))
  return sources.map((_, i) => failed[i] ?? (byIndex.get(i).error ? { error: byIndex.get(i).error } : { ok: byIndex.get(i).ok.source }))
}

// Meaning: the 0.2 semantic projection without the fields that only record spelling.
function meaningTree(value) {
  if (Array.isArray(value)) return coalesce(value.map(meaningTree))
  if (!value || typeof value !== 'object') return value
  if (value.type === 'autolink') return { type: 'link', href: value.href, children: [text(value.href.replace(/^mailto:/, ''))] }
  const out = {}
  for (const [key, field] of Object.entries(value)) if (!['groupLabel', 'spacing'].includes(key)) out[key] = meaningTree(field)
  return out
}
export const meaning02 = source => meaningTree(semantics(parseTree(source)))

const slice = (source, pos) => Buffer.from(source).subarray(pos.startOffset, pos.endOffset).toString()
const fence = c => c === '`' ? 'backtick' : c === '~' ? 'tilde' : 'indented'
const walk = (node, visit) => { if (!node || typeof node !== 'object') return; if (node.type) visit(node); for (const value of Object.values(node)) if (value && typeof value === 'object') walk(value, visit) }

// The spellings a 0.2 tree holds, in document order. Source slices give what the tree does not record.
export function inventory02(source) {
  const out = []
  const add = (distinction, spelling) => out.push({ distinction, spelling })
  walk(parseTree(source), n => {
    if (n.type === 'list') add(n.marker.kind === 'ordered' ? 'ordered-delimiter' : 'bullet', n.marker.kind === 'ordered' ? n.marker.delimiter : n.marker.char)
    else if (n.type === 'thematic_break') add('thematic-break', slice(source, n.pos).trim()[0])
    else if (n.type === 'autolink') add('link-form', 'autolink')
    else if (n.type === 'link') add('link-form', n.refForm ?? (n.key === undefined ? 'inline' : 'shortcut'))
    else if (n.type === 'table') {
      const separator = slice(source, n.pos).split(/\r?\n/).find(line => /^\s*\|?(\s*:?-+:?\s*\|)*\s*:?-+:?\s*\|?\s*$/.test(line))
      add('table-widths', separator ? separator.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim().length).join(',') : 'none')
    } else if (n.type === 'code_block') {
      add('code-fence', fence(slice(source, n.pos).trimStart()[0]))
      add('code-label', n.groupLabel ?? 'none')
    }
  })
  return out
}

export function roundtripInputs02() {
  const external = [...corpus.cases.filter(c => typeof carveSource(c) === 'string').map(c => ({ id: `external/${c.id}`, source: carveSource(c) })), ...spellings.added.map(c => ({ id: `external/${c.id}`, source: c.carve }))]
  return [...external, ...variantCases.cases.filter(c => typeof c.carve === 'string').map(c => ({ id: `variant/${c.id}`, source: c.carve }))]
}

const attempt = fn => { try { return { value: fn() } } catch (error) { return { error: error.message.split('\n')[0] } } }
const spellingOf = (source, distinction) => inventory02(source).filter(e => e.distinction === distinction).map(e => e.spelling)

export function runRoundtrip02({ engines = measuredEngines02, call = measurementCalls } = {}) {
  const inputs = roundtripInputs02(), variants = variantCases.cases.filter(c => typeof c.carve === 'string')
  // A variant whose source reads differently in 0.2 does not hold its spelling: it is listed, not measured.
  const applicable = variants.map(item => { const before = spellingOf(item.carve, item.distinction); return { item, before, applicable: before.length > 0 && before.every(s => s === item.spelling) } })
  const chains = [], summary = {}, rows = [], returned = {}
  for (const mode of roundtripModes) for (const engine of engines) {
    const id = `${engine}-${mode}`
    chains.push({ id, engine, mode, viaHtml: mode.startsWith('html') })
    const sources = [...inputs.map(i => i.source), ...variants.map(v => v.carve)]
    const answers = chainRun(engine, mode, sources, call)
    const result = summary[id] = { meaning: { measured: 0, kept: 0, errors: 0 }, spelling: {}, notApplicable: [] }
    inputs.forEach((input, i) => {
      const back = answers[i]
      const kept = back.ok !== undefined && attempt(() => isDeepStrictEqual(meaning02(input.source), meaning02(back.ok))).value === true
      result.meaning.measured++
      if (back.error) result.meaning.errors++
      else if (kept) result.meaning.kept++
      rows.push({ layer: 'meaning', chain: id, id: input.id, kept, ...(back.error ? { error: back.error } : { returned: back.ok }) })
      ;(returned[`${mode}\0${input.id}`] ??= { mode, id: input.id, input: input.source, outputs: {}, kept: {} }).outputs[engine] = back.error ? { error: back.error } : back.ok
      returned[`${mode}\0${input.id}`].kept[engine] = kept
    })
    applicable.forEach(({ item, before, applicable: measured }, k) => {
      const back = answers[inputs.length + k]
      if (!measured) { result.notApplicable.push(item.id); rows.push({ layer: 'spelling', chain: id, id: item.id, distinction: item.distinction, spelling: item.spelling, applicable: false, before }); return }
      const after = back.error ? null : attempt(() => spellingOf(back.ok, item.distinction)).value ?? null
      const kept = isDeepStrictEqual(before, after)
      const cell = result.spelling[item.distinction] ??= { measured: 0, kept: 0, spellings: {} }
      cell.measured++
      if (kept) cell.kept++
      cell.spellings[item.spelling] = kept
      rows.push({ layer: 'spelling', chain: id, id: item.id, distinction: item.distinction, spelling: item.spelling, kept, before, after, ...(back.error ? { error: back.error } : { returned: back.ok }) })
    })
  }
  // The same chain on different engines returns different sources: the input and every engine's output.
  // A refusal is counted in the chain's meaning errors and its message in `refused`, not listed per input.
  const disagreements = Object.values(returned).filter(r => new Set(Object.values(r.outputs).filter(o => typeof o === 'string')).size > 1)
  const refused = {}
  for (const row of rows) if (row.error) (refused[row.chain] ??= {})[row.error] = (refused[row.chain][row.error] ?? 0) + 1
  return { kind: 'roundtrip', chains, scope: 'Meaning compares the 0.2 semantic projection of the original and the returned Carve source, both read by carve-js next2; list spacing, code group labels and reference spelling stay out of it. Spelling compares, per variant case, the spellings of its distinction. A variant whose source no longer holds its spelling in 0.2 is listed as not applicable.', summary, refused, disagreements, rows }
}

export function runMeasurements02(selected = measurements02, options = {}) {
  for (const m of selected) if (!measurements02.includes(m)) throw new Error(`Unknown measurement ${m}`)
  const run = { commonmark: runCommonmark02, djot: runDjot02, 'source-agreement': runSourceAgreement02, roundtrip: runRoundtrip02 }
  return Object.fromEntries(selected.map(m => [m, run[m](options)]))
}
