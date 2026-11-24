// carve-php and carve-rs next2 on the reference trees of the 0.2 lane, compared with carve-js next2.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { interchange, parseTree, renderHtml, writeReport } from './engines-0.2.mjs'
import { semantics } from './trees-0.2.mjs'

export const nativeEngines02 = ['php', 'rust']
export const engineCalls = ['parse', 'decodeTree', 'write', 'render']
const pins = JSON.parse(readFileSync(new URL('../../resources/engines.json', import.meta.url)))
const run = (command, args, input, cwd) => execFileSync(command, args, { input, cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 })
const rootOf = engine => process.env[engine === 'php' ? 'CARVE_PHP_NEXT2_ROOT' : 'CARVE_RUST_NEXT2_ROOT'] ?? fileURLToPath(new URL(`../../.cache/engines/${engine}-next2`, import.meta.url))

export function nativeMetadata(engine) {
  const root = rootOf(engine), pin = pins[`${engine}-next2`]
  const revision = run('git', ['rev-parse', 'HEAD'], '', root).trim()
  if (run('git', ['status', '--porcelain', '--untracked-files=no', '--ignore-submodules=all'], '', root).trim()) throw new Error(`${engine} next2 source has modified tracked files`)
  if (revision !== pin.revision) throw new Error(`${engine} next2 source revision differs from resources/engines.json`)
  if (engine === 'php') return { name: 'Carve PHP (next2)', revision, repository: pin.repository, runtime: run(process.env.CARVE_PHP ?? 'php', ['--version'], '').split('\n')[0], root }
  const binary = `${root}/bin/carve`, build = JSON.parse(readFileSync(`${root}/bin/build.json`))
  const sha = createHash('sha256').update(readFileSync(binary)).digest('hex')
  if (build.revision !== revision || build.binarySha256 !== sha) throw new Error('Rust next2 binary does not match its pinned build manifest')
  return { name: 'Carve Rust (next2)', revision, repository: pin.repository, version: readFileSync(`${root}/Cargo.toml`, 'utf8').match(/^version\s*=\s*"([^"]+)"/m)[1], binarySha256: sha, root, binary }
}

const diagnosticPairs = list => (list ?? []).map(d => ({ code: d.code, path: d.path ?? null }))

// One result per request: { ok } with the call's value, or { error } with the engine's message.
export function nativeCalls(engine, requests) {
  if (engine === 'php') return JSON.parse(run(process.env.CARVE_PHP ?? 'php', ['-d', 'memory_limit=1G', fileURLToPath(new URL('./php-next2-driver.php', import.meta.url))], JSON.stringify(requests)))
  const { binary } = nativeMetadata('rust')
  return requests.map(request => {
    const call = { parse: { call: 'parse', source: request.source }, decodeTree: { call: 'decodeTree', json: JSON.stringify(request.tree) }, write: { call: 'writeWithDiagnostics', tree: request.tree }, render: { call: 'render', tree: request.tree } }[request.call]
    let response
    try { response = JSON.parse(run(binary, ['call'], JSON.stringify(call))) } catch (error) { response = JSON.parse(error.stdout || 'null') ?? { error: { message: error.message.split('\n')[0] } } }
    if (response.error) return { error: `${response.error.name ?? 'error'}: ${response.error.message}` }
    const ok = response.ok
    return { ok: { parse: ok.tree, decodeTree: ok.tree, write: { source: ok.output, diagnostics: diagnosticPairs(ok.diagnostics) }, render: ok.html }[request.call] }
  })
}

export function javascriptCall(request) {
  try {
    if (request.call === 'parse') return { ok: parseTree(request.source) }
    if (request.call === 'decodeTree') return { ok: interchange(request.tree) }
    if (request.call === 'write') { const out = writeReport(request.tree); return { ok: { source: out.source, diagnostics: diagnosticPairs(out.diagnostics) } } }
    return { ok: renderHtml(request.tree) }
  } catch (error) { return { error: `${error.name}: ${error.message}` } }
}

// Key order carries no meaning in the JSON boundary.
export const stable = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : v)

// The inputs of the lane: every reference tree a reader produced and every Carve source a case parses, with the rows that use them.
export function engineInputs(rows) {
  const trees = new Map(), sources = new Map()
  const add = (map, key, value, row) => {
    if (!map.has(key)) map.set(key, { value, cases: new Set() })
    map.get(key).cases.add(`${row.tool}/${row.case}`)
  }
  for (const row of rows) {
    const e = row.evidence
    if (!e) continue
    if (e.ast) add(trees, stable(e.ast), e.ast, row)
    if (e.expectedAst) add(trees, stable(e.expectedAst), e.expectedAst, row)
    const carve = e.carve ?? (e.sourceFormat === 'carve' ? e.source : undefined)
    if (typeof carve === 'string') add(sources, carve, carve, row)
  }
  const requests = []
  for (const { value, cases } of sources.values()) requests.push({ call: 'parse', source: value, cases: [...cases].sort() })
  for (const { value, cases } of trees.values()) for (const call of ['decodeTree', 'write', 'render']) requests.push({ call, tree: value, cases: [...cases].sort() })
  return requests
}

// A difference is reported, never declared away: carve-js is the oracle, and the row shows both outputs.
export function compareResult(request, expected, actual) {
  if (stable(expected) === stable(actual)) return { status: 'agrees' }
  const out = { status: 'differs', javascript: expected.error ?? expected.ok, engine: actual.error ?? actual.ok }
  if (expected.error || actual.error) out.error = true
  else if (['parse', 'decodeTree'].includes(request.call)) out.sameSemantics = stable(semantics(expected.ok)) === stable(semantics(actual.ok))
  else if (request.call === 'write') {
    const sorted = list => list.map(stable).sort().join()
    out.sameSource = expected.ok.source === actual.ok.source
    out.sameDiagnosticSet = sorted(expected.ok.diagnostics) === sorted(actual.ok.diagnostics)
  }
  return out
}

export function compareEngines(rows, { engines = nativeEngines02, call = nativeCalls, oracle = javascriptCall } = {}) {
  const requests = engineInputs(rows)
  const expected = requests.map(r => oracle(r))
  const out = { requests: requests.length, engines: {} }
  for (const engine of engines) {
    const results = call(engine, requests.map(({ cases, ...r }) => r))
    const compared = requests.map((request, i) => ({ request, ...compareResult(request, expected[i], results[i]) }))
    const differs = compared.filter(r => r.status === 'differs')
    out.engines[engine] = {
      agrees: compared.length - differs.length,
      differs: differs.length,
      byCall: Object.fromEntries(engineCalls.map(c => [c, { agrees: compared.filter(r => r.request.call === c && r.status === 'agrees').length, differs: differs.filter(r => r.request.call === c).length }])),
      differences: differs.map(({ request, status, ...rest }) => ({ call: request.call, cases: request.cases, input: request.source ?? request.tree, ...rest })),
    }
  }
  return out
}
