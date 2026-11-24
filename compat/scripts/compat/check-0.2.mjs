import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import Ajv2020 from 'ajv/dist/2020.js'
import { AST_VERSION, context, fromHast, parseHtml, plain, semantics, treeVersion } from './trees-0.2.mjs'
import { decode, engineMetadata, envelope, interchange, parseTree, renderHtml, writeReport, writeSource } from './engines-0.2.mjs'
import { readForeign, toolNames } from './tools-0.2.mjs'
import { corpus, lossCorpus, sourceChanges, sourceFormats } from './check.mjs'

const schemaUrl = new URL('../../resources/ast-schema-0.2.json', import.meta.url)
const validate = new Ajv2020({ strict: false }).compile(JSON.parse(readFileSync(schemaUrl)))
export const spellings = JSON.parse(readFileSync(new URL('../../tests/external-compat/cases-0.2.json', import.meta.url)))
const lossy = diagnostics => diagnostics.filter(d => ['degraded', 'dropped'].includes(d.fidelity))

// C2-A-008, C2-A-012 to C2-A-018: a 2.x tree validates, and its root says which version it was written against.
export function validateTree(tree) {
  assert.equal(validate(tree), true, JSON.stringify(validate.errors))
  assert.equal(treeVersion(tree), AST_VERSION, 'The tree root does not carry astVersion 2.0')
}

export function validateSpellings(data = spellings) {
  assert.equal(data.schemaVersion, 1)
  const ids = new Set(corpus.cases.map(c => c.id))
  const lossIds = new Set(lossCorpus.cases.map(c => c.id))
  for (const [id, entry] of Object.entries(data.losses ?? {})) {
    assert.ok(lossIds.has(id), `${id}: no such loss case`)
    if (entry.retired) {
      assert.match(entry.retired.clause, /^C2-[A-Z]-\d{3}$/, `${id}: a retired loss cites its clause`)
      assert.ok(entry.retired.keeps?.path && entry.retired.keeps.type && Array.isArray(entry.retired.keeps.children), `${id}: a retired loss names the structure it keeps`)
    }
  }
  for (const c of data.added) {
    assert.match(c.id, /^[a-z0-9-]+$/)
    assert.ok(!ids.has(c.id), `${c.id}: an added case reuses a 0.1 case identifier`)
    assert.equal(typeof c.carve, 'string', `${c.id}: missing Carve 0.2 source`)
    assert.ok(c.tools.length > 0 && c.tools.every(t => toolNames.includes(t) && typeof c[sourceFormats[t]] === 'string'), `${c.id}: every tool needs its source`)
    assert.match(c.clause, /^C2-[A-Z]-\d{3}$/, `${c.id}: an added case names the clause it measures`)
    ids.add(c.id)
  }
  for (const [id, entry] of Object.entries(data.cases)) {
    assert.ok(ids.has(id), `${id}: no such compatibility case`)
    assert.ok(entry.carve === undefined || typeof entry.carve === 'string', `${id}: invalid 0.2 spelling`)
    const authored = corpus.cases.find(c => c.id === id)?.ast
    assert.equal(!!entry.ast, !!authored, `${id}: an authored 0.1 tree needs its authored 0.2 tree`)
    if (entry.ast) {
      validateTree(entry.ast)
      assert.ok(Array.isArray(entry.sourceDiagnostics) && Array.isArray(entry.sourceChanges), `${id}: missing source conversion expectation`)
    }
    if (entry.pending) assert.match(entry.pending.ticket, /^markup-carve\/carve-conformance#\d+$/, `${id}: a pending case names its ticket`)
    for (const [tool, declared] of Object.entries(entry.declared ?? {})) {
      assert.ok(tool === '*' || toolNames.includes(tool), `${id}: unknown tool ${tool}`)
      assert.match(declared.clause, /^C2-[A-Z]-\d{3}$/, `${id}/${tool}: a declared difference cites its clause`)
      assert.ok(declared.check === undefined || Object.hasOwn(checkLabels, declared.check), `${id}/${tool}: unknown declared check`)
      assert.ok(declared.reason?.length > 0, `${id}/${tool}: a declared difference says why`)
    }
  }
}

export const carveSource = fixture => spellings.cases[fixture.id]?.carve ?? fixture.carve
export const declaredDifference = (tool, fixture) => spellings.cases[fixture.id]?.declared?.[tool] ?? spellings.cases[fixture.id]?.declared?.['*']

// Column widths compare at the precision the foreign renderer writes: Pandoc truncates to whole percents.
function widthPrecision(tree, compared, ctx) {
  const walk = node => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    if (node.type === 'table_column' && node.width) {
      const precision = compared === 'pandoc' ? 100 : 1e12
      const rounded = (compared === 'pandoc' ? Math.floor(node.width * precision + 1e-10) : Math.round(node.width * precision)) / precision
      if (rounded !== node.width) ctx.note('', 'html-width-precision', 'normalized', compared === 'pandoc' ? 'Compared column widths at the truncated whole-percentage precision emitted by Pandoc HTML.' : 'Ignored decimal formatting noise in rendered HTML widths; tree widths remain exact.')
      node.width = rounded
    }
    for (const [key, value] of Object.entries(node)) if (key !== 'attrs' && typeof value === 'object') walk(value)
  }
  walk(tree)
  return tree
}

export function htmlView(html, tool, renderer, authored, compared = tool) {
  const ctx = context(tool)
  const tree = fromHast(parseHtml(html), ctx, { generated: renderer !== 'hast', renderer, normalizeListDelimiter: renderer === 'carve', ...authored })
  return { view: semantics(widthPrecision(tree, compared, ctx)), diagnostics: ctx.diagnostics }
}

export function authoredAttributes(tree) {
  const authoredIds = new Set(), authoredClasses = new Set(), authoredKeyValues = new Set()
  const walk = node => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    if (node.attrs?.id) authoredIds.add(node.attrs.id)
    node.attrs?.classes?.forEach(c => authoredClasses.add(c))
    for (const [key, value] of node.attrs?.keyValues ?? []) authoredKeyValues.add(`${key}=${value}`)
    for (const [key, value] of Object.entries(node)) if (key !== 'attrs' && typeof value === 'object') walk(value)
  }
  walk(tree)
  return { authoredIds, authoredClasses, authoredKeyValues }
}

// Cases with an authored tree: the reference is that tree, and the writer's account of what it cannot spell is pinned.
export async function checkInterchangeCase(tool, fixture) {
  const pinned = spellings.cases[fixture.id], format = fixture.formats?.[tool], source = fixture[sourceFormats[tool]]
  const progress = { checks: [], diagnostics: [], evidence: { sourceFormat: format ?? sourceFormats[tool], source, expectedAst: pinned.ast } }
  try {
    const expected = semantics(pinned.ast)
    validateTree(pinned.ast)
    const result = await readForeign(tool, source, format)
    Object.assign(progress, { version: result.version, diagnostics: result.diagnostics })
    progress.evidence.ast = result.ast
    validateTree(result.ast)
    progress.checks.push('ast-schema')
    assert.deepEqual(semantics(result.ast), expected, `${tool}/${fixture.id}: authored interchange expectation`)
    assert.deepEqual(lossy(result.diagnostics), [], `${tool}/${fixture.id}: interchange import lost fields`)
    progress.checks.push('ast-mapping')
    const decoded = interchange(result.ast)
    validateTree(decoded)
    assert.deepEqual(semantics(decoded), expected, `${tool}/${fixture.id}: JSON interchange`)
    progress.checks.push('json-roundtrip')
    const written = writeReport(result.ast)
    progress.evidence.carveConversion = written
    assert.deepEqual(written.diagnostics.map(d => ({ code: d.code, path: d.path })), pinned.sourceDiagnostics, `${tool}/${fixture.id}: source conversion boundary`)
    progress.checks.push('source-conversion-diagnostics')
    const reparsed = parseTree(written.source)
    validateTree(reparsed)
    const changes = sourceChanges(expected, semantics(reparsed))
    progress.evidence.sourceChanges = changes
    assert.deepEqual(changes, pinned.sourceChanges, `${tool}/${fixture.id}: declared source conversion changes`)
    if (changes.length) assert.ok(written.diagnostics.length, `${tool}/${fixture.id}: source changes without a writer diagnostic`)
    progress.checks.push('source-conversion-changes')
    const authored = authoredAttributes(result.ast)
    const foreign = htmlView(result.html, tool, tool, authored), carveView = htmlView(renderHtml(result.ast), 'carve', 'carve', authored, tool)
    progress.diagnostics = [...progress.diagnostics, ...foreign.diagnostics, ...carveView.diagnostics]
    assert.deepEqual(foreign.view, carveView.view, `${tool}/${fixture.id}: independent HTML structure`)
    assert.deepEqual(lossy([...foreign.diagnostics, ...carveView.diagnostics]), [], `${tool}/${fixture.id}: HTML comparison lost fields`)
    progress.checks.push('html-structure')
    return { tool, case: fixture.id, status: 'passed', kind: 'supported', ...progress }
  } catch (error) { error.compatibilityEvidence = progress; throw error }
}

export async function checkCase(tool, fixture) {
  if (fixture.ast) return checkInterchangeCase(tool, fixture)
  const source = fixture[sourceFormats[tool]], carve = carveSource(fixture)
  const progress = { checks: [], diagnostics: [], evidence: { sourceFormat: sourceFormats[tool], source, carve } }
  try {
    const expected = semantics(parseTree(carve))
    const result = await readForeign(tool, source)
    Object.assign(progress, { version: result.version, diagnostics: result.diagnostics })
    Object.assign(progress.evidence, { ast: result.ast, foreignHtml: result.html })
    validateTree(result.ast)
    progress.checks.push('ast-schema')
    assert.deepEqual(semantics(result.ast), expected, `${tool}/${fixture.id}: foreign tree mapping`)
    assert.deepEqual(lossy(result.diagnostics), [], `${tool}/${fixture.id}: unreported subset loss`)
    progress.checks.push('ast-mapping')
    const decoded = interchange(result.ast)
    validateTree(decoded)
    assert.deepEqual(semantics(decoded), expected, `${tool}/${fixture.id}: JSON interchange round trip`)
    const wrapped = envelope(result.ast)
    assert.equal(wrapped.astVersion, AST_VERSION, `${tool}/${fixture.id}: envelope version`)
    validateTree(wrapped)
    progress.checks.push('json-roundtrip')
    const canonical = writeSource(result.ast)
    progress.evidence.canonical = canonical
    const reparsed = parseTree(canonical)
    validateTree(reparsed)
    assert.deepEqual(semantics(reparsed), expected, `${tool}/${fixture.id}: Carve source round trip`)
    progress.checks.push('carve-source-roundtrip')
    const authored = authoredAttributes(result.ast)
    const foreign = htmlView(result.html, tool, tool, authored), carveView = htmlView(renderHtml(result.ast), 'carve', 'carve', authored, tool)
    progress.diagnostics = [...progress.diagnostics, ...foreign.diagnostics, ...carveView.diagnostics]
    assert.deepEqual(foreign.view, carveView.view, `${tool}/${fixture.id}: independent HTML structure`)
    assert.deepEqual(lossy([...foreign.diagnostics, ...carveView.diagnostics]), [], `${tool}/${fixture.id}: HTML comparison lost structure`)
    progress.checks.push('html-structure')
    return { tool, case: fixture.id, status: 'passed', kind: 'supported', ...progress }
  } catch (error) { error.compatibilityEvidence = progress; throw error }
}

const checkLabels = { 'ast-mapping': [': foreign tree mapping', ': authored interchange expectation'], 'html-structure': [': independent HTML structure'] }
const checkOrder = { 'ast-mapping': ['ast-schema'], 'html-structure': null }

// A declaration covers only the comparison it names; a crash, schema error or any other check still fails.
export function coveredByDeclaration(declared, checks = [], message = '') {
  if (!declared) return false
  const check = declared.check ?? 'ast-mapping'
  const before = checkOrder[check]
  if (before ? checks.join() !== before.join() : checks.includes(check) || !checks.includes('ast-mapping')) return false
  return checkLabels[check].some(label => message.includes(label))
}

export const cases02 = () => [...corpus.cases, ...spellings.added]

// Import losses: the reader names the loss at its foreign path and keeps a valid 0.2 fallback with the readable text.
export async function checkImportLoss(tool, fixture) {
  const expectedPath = spellings.losses?.[fixture.id]?.pathsByTool?.[tool] ?? fixture.expected.pathsByTool?.[tool] ?? fixture.expected.path
  const progress = { checks: [], diagnostics: [], evidence: { direction: 'import', sourceFormat: sourceFormats[tool], source: fixture.source, expected: { ...fixture.expected, path: expectedPath }, retained: fixture.retained } }
  try {
    const result = await readForeign(tool, fixture.source, fixture.formats?.[tool])
    Object.assign(progress, { version: result.version, diagnostics: result.diagnostics })
    progress.evidence.ast = result.ast
    validateTree(result.ast)
    progress.checks.push('fallback-schema')
    assert.ok(result.diagnostics.some(d => d.code === fixture.expected.code && d.fidelity === fixture.expected.fidelity && d.path === expectedPath), `${tool}/${fixture.id}: expected loss at ${expectedPath} was not reported`)
    progress.checks.push('loss-diagnostic')
    assert.ok(plain(result.ast).includes(fixture.retained), `${tool}/${fixture.id}: fallback lost readable content`)
    progress.checks.push('retained-content')
    return { tool, case: fixture.id, status: 'passed', kind: 'loss', ...progress }
  } catch (error) { error.compatibilityEvidence = progress; throw error }
}

// A 0.1 loss the 0.2 tree can hold: the reader keeps the structure and reports no loss.
export async function checkRetiredLoss(tool, fixture, retired) {
  const result = await readForeign(tool, fixture.source, fixture.formats?.[tool])
  validateTree(result.ast)
  assert.deepEqual(lossy(result.diagnostics), [], `${tool}/${fixture.id}: a retired loss is still reported (${retired.clause})`)
  const node = retired.keeps.path.split('/').slice(1).reduce((at, key) => at?.[key], result.ast)
  assert.equal(node?.type, retired.keeps.type, `${tool}/${fixture.id}: no ${retired.keeps.type} at ${retired.keeps.path}`)
  assert.deepEqual(node.children.map(c => c.type), retired.keeps.children, `${tool}/${fixture.id}: the kept ${retired.keeps.type} lost its blocks`)
  const kept = plain(node)
  assert.ok(fixture.retained.split(/\s+/).every(word => kept.includes(word)), `${tool}/${fixture.id}: the kept structure lost readable content`)
  return { tool, case: fixture.id, status: 'passed', kind: 'retired-loss', retired, checks: ['ast-schema', 'no-loss', 'retained-content'], diagnostics: result.diagnostics, evidence: { direction: 'import', source: fixture.source, ast: result.ast } }
}

export async function runLosses({ tools = toolNames, cases = lossCorpus.cases.filter(c => c.direction === 'import') } = {}) {
  const rows = []
  for (const fixture of cases) for (const tool of fixture.tools) {
    if (!tools.includes(tool)) continue
    const retired = spellings.losses?.[fixture.id]?.retired
    try { rows.push(retired ? await checkRetiredLoss(tool, fixture, retired) : await checkImportLoss(tool, fixture)) }
    catch (error) { rows.push({ tool, case: fixture.id, kind: 'loss', status: 'failed', error: error.message.split('\n')[0], checks: error.compatibilityEvidence?.checks ?? [], evidence: error.compatibilityEvidence?.evidence }) }
  }
  return rows
}

export async function runCompat({ tools = toolNames, cases = cases02() } = {}) {
  validateSpellings()
  const rows = []
  for (const fixture of cases) for (const tool of fixture.tools ?? toolNames) {
    if (!tools.includes(tool)) continue
    const pending = spellings.cases[fixture.id]?.pending
    if (pending) { rows.push({ tool, case: fixture.id, kind: 'supported', status: 'pending', pending }); continue }
    const declared = declaredDifference(tool, fixture)
    try {
      const row = await checkCase(tool, fixture)
      rows.push(declared ? { ...row, status: 'failed', error: `${tool}/${fixture.id}: declared difference no longer reproduces (${declared.clause})` } : row)
    } catch (error) {
      const evidence = error.compatibilityEvidence ?? {}
      const expected = coveredByDeclaration(declared, evidence.checks, error.message)
      rows.push({ tool, case: fixture.id, kind: 'supported', status: expected ? 'declared' : 'failed', ...(expected ? { declared } : {}), error: `${tool}/${fixture.id}: ${error.message.split('\n')[0].replace(`${tool}/${fixture.id}: `, '')}`, checks: evidence.checks ?? [], evidence: evidence.evidence })
    }
  }
  return rows
}

export function reportHeader(rows, selected) {
  return {
    schemaVersion: 1,
    astVersion: AST_VERSION,
    engine: engineMetadata(),
    schema: { ...JSON.parse(readFileSync(new URL('../../resources/provenance-0.2.json', import.meta.url))), sha256: createHash('sha256').update(readFileSync(schemaUrl)).digest('hex') },
    selected,
    passed: rows.filter(r => r.status === 'passed').length,
    declared: rows.filter(r => r.status === 'declared').length,
    pending: rows.filter(r => r.status === 'pending').length,
    failed: rows.filter(r => r.status === 'failed').length,
    rows,
  }
}

export { decode }
