import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import Ajv2020 from 'ajv/dist/2020.js'
import { AST_VERSION, context, fromHast, parseHtml, semantics, treeVersion } from './trees-0.2.mjs'
import { decode, engineMetadata, envelope, interchange, parseTree, renderHtml, writeSource } from './engines-0.2.mjs'
import { readForeign, toolNames } from './tools-0.2.mjs'
import { corpus, sourceFormats } from './check.mjs'

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
    if (entry.pending) assert.match(entry.pending.ticket, /^markup-carve\/carve-conformance#\d+$/, `${id}: a pending case names its ticket`)
    for (const [tool, declared] of Object.entries(entry.declared ?? {})) {
      assert.ok(tool === '*' || toolNames.includes(tool), `${id}: unknown tool ${tool}`)
      assert.match(declared.clause, /^C2-[A-Z]-\d{3}$/, `${id}/${tool}: a declared difference cites its clause`)
      assert.ok(declared.reason?.length > 0, `${id}/${tool}: a declared difference says why`)
    }
  }
}

export const carveSource = fixture => spellings.cases[fixture.id]?.carve ?? fixture.carve
export const declaredDifference = (tool, fixture) => spellings.cases[fixture.id]?.declared?.[tool] ?? spellings.cases[fixture.id]?.declared?.['*']

export function htmlView(html, tool, renderer, authored) {
  const ctx = context(tool)
  const tree = fromHast(parseHtml(html), ctx, { generated: renderer !== 'hast', renderer, normalizeListDelimiter: renderer === 'carve', ...authored })
  return { view: semantics(tree), diagnostics: ctx.diagnostics }
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

export async function checkCase(tool, fixture) {
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
    const foreign = htmlView(result.html, tool, tool, authored), carveView = htmlView(renderHtml(result.ast), 'carve', 'carve', authored)
    progress.diagnostics = [...progress.diagnostics, ...foreign.diagnostics, ...carveView.diagnostics]
    assert.deepEqual(foreign.view, carveView.view, `${tool}/${fixture.id}: independent HTML structure`)
    assert.deepEqual(lossy([...foreign.diagnostics, ...carveView.diagnostics]), [], `${tool}/${fixture.id}: HTML comparison lost structure`)
    progress.checks.push('html-structure')
    return { tool, case: fixture.id, status: 'passed', kind: 'supported', ...progress }
  } catch (error) { error.compatibilityEvidence = progress; throw error }
}

// A declaration covers only the mapping comparison; a crash, schema error or later check still fails.
export const coveredByDeclaration = (declared, checks = [], message = '') => !!declared && checks.join() === 'ast-schema' && message.includes(': foreign tree mapping')

export const cases02 = () => [...corpus.cases.filter(c => !c.ast), ...spellings.added]

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
