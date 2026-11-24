// Importer honesty on the 0.2 lane: the report of `importDocument` checked against the rendered structure it produced.
import { execFileSync } from 'node:child_process'
import { isDeepStrictEqual } from 'node:util'
import { fileURLToPath } from 'node:url'
import { importDocument } from '@markup-carve/carve-next2/import'
import { renderSource } from './engines-0.2.mjs'
import { nativeMetadata } from './engines-native-0.2.mjs'
import { authoredAttributes, htmlView } from './check-0.2.mjs'

// mdast reads with remark-gfm; the other Markdown readers are CommonMark.
export const importFormats02 = { mdast: 'gfm', commonmark: 'markdown', cmark: 'markdown', md4c: 'markdown', djot: 'djot', hast: 'html' }
const allFormats = ['gfm', 'markdown', 'djot', 'html']
export const importerEngines02 = { javascript: allFormats, php: allFormats, rust: allFormats }
export const honestyOutcomes02 = ['ok', 'reported', 'silent-loss', 'false-loss', 'refused']

// C2-M-080, C2-M-083: every importer code is a render-loss entry; only `import-whitespace-normalized` (a hint) changes no visible text.
export const reportClass02 = diagnostics => diagnostics.some(d => d.severity !== 'hint') ? 'names-loss' : 'clean'

export function honesty02(kept, cls) {
  if (kept) return cls === 'names-loss' ? 'false-loss' : 'ok'
  return cls === 'names-loss' ? 'reported' : 'silent-loss'
}

const entry = d => ({ code: d.code, severity: d.severity, channel: d.channel, foreignType: d.foreignType ?? null })
const lossy = diagnostics => diagnostics.filter(d => ['degraded', 'dropped'].includes(d.fidelity))

// The supported rows whose reader has an importer: their source and the foreign rendering the import must match.
export function importInputs(rows) {
  return rows.filter(r => r.status === 'passed' && r.kind === 'supported' && importFormats02[r.tool] && r.evidence?.foreignHtml && !r.evidence.expectedAst)
    .map(r => ({ tool: r.tool, case: r.case, from: importFormats02[r.tool], source: r.evidence.source, foreignHtml: r.evidence.foreignHtml, ast: r.evidence.ast }))
}

const run = (command, args, input) => execFileSync(command, args, { input, encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 })

// One { ok: { source, diagnostics } } or { error } per request; a crash or a reply that is no response stops the lane.
export function importCalls(engine, requests) {
  if (engine === 'javascript') return requests.map(({ from, source }) => {
    try { const out = importDocument(source, { from }); return { ok: { source: out.source, diagnostics: out.diagnostics.map(entry) } } } catch (error) { return { error: `${error.name}: ${error.message}` } }
  })
  if (engine === 'php') {
    const calls = requests.map(({ from, source }) => ({ call: 'import', from, source }))
    return JSON.parse(run(process.env.CARVE_PHP ?? 'php', ['-d', 'memory_limit=1G', fileURLToPath(new URL('./php-next2-driver.php', import.meta.url))], JSON.stringify(calls)))
      .map(r => r.error ? r : { ok: { source: r.ok.source, diagnostics: r.ok.diagnostics.map(entry) } })
  }
  const { binary } = nativeMetadata('rust')
  return requests.map(({ from, source }) => {
    let response
    try { response = JSON.parse(run(binary, ['call'], JSON.stringify({ call: 'importDocument', from, source }))) } catch (error) {
      try { response = JSON.parse(error.stdout) } catch { throw error }
      if (!response?.error) throw error
    }
    if (response.error) return { error: `${response.error.name ?? 'error'}: ${response.error.message}` }
    return { ok: { source: response.ok.source, diagnostics: response.ok.diagnostics.map(entry) } }
  })
}

// The import is rendered by carve-js next2, so the check measures the importer and not a renderer.
export function checkImport(input, result) {
  if (result.error) return { outcome: 'refused', error: result.error }
  const authored = authoredAttributes(input.ast)
  const foreign = htmlView(input.foreignHtml, input.tool, input.tool, authored)
  const imported = htmlView(renderSource(result.ok.source), 'carve', 'carve', authored, input.tool)
  const kept = isDeepStrictEqual(foreign.view, imported.view) && !lossy([...foreign.diagnostics, ...imported.diagnostics]).length
  const cls = reportClass02(result.ok.diagnostics)
  return { outcome: honesty02(kept, cls), reportClass: cls, foreign: foreign.view, imported: imported.view }
}

export function compareImporters(rows, { engines = Object.keys(importerEngines02), call = importCalls } = {}) {
  const inputs = importInputs(rows)
  const out = {}
  for (const engine of engines) {
    const selected = inputs.filter(i => importerEngines02[engine].includes(i.from))
    const results = call(engine, selected.map(({ from, source }) => ({ from, source })))
    const byFormat = {}, contradictions = [], refused = []
    selected.forEach((input, i) => {
      const checked = checkImport(input, results[i])
      byFormat[input.from] ??= Object.fromEntries(honestyOutcomes02.map(o => [o, 0]))
      byFormat[input.from][checked.outcome]++
      const at = { tool: input.tool, case: input.case, from: input.from, input: input.source }
      if (checked.outcome === 'refused') refused.push({ ...at, error: checked.error })
      if (['silent-loss', 'false-loss'].includes(checked.outcome)) contradictions.push({ ...at, outcome: checked.outcome, report: results[i].ok.diagnostics, source: results[i].ok.source, structure: { foreign: checked.foreign, imported: checked.imported } })
    })
    out[engine] = { imports: selected.length, byFormat, contradictions, refused }
  }
  return out
}
