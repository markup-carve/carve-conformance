import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { reportHeader, runCompat, runLosses } from './compat/check-0.2.mjs'
import { nativeTools, toolNames } from './compat/tools-0.2.mjs'
import { compareEngines, nativeEngines02, nativeMetadata } from './compat/engines-native-0.2.mjs'
import { compareImporters } from './compat/importers-0.2.mjs'
import { measurements02, runMeasurements02 } from './compat/measurements-0.2.mjs'

const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const tools = arg('tools')?.split(',') ?? (process.argv.includes('--javascript') ? toolNames.filter(t => !nativeTools.includes(t)) : toolNames)
// carve-js is always measured; --engines=javascript leaves out carve-php and carve-rs next2.
const engines = (arg('engines')?.split(',') ?? ['javascript', ...nativeEngines02]).filter(e => e !== 'javascript')
for (const engine of engines) if (!nativeEngines02.includes(engine)) throw new Error(`Unknown engine ${engine}`)
const rows = [...await runCompat({ tools }), ...await runLosses({ tools })]
const report = reportHeader(rows, tools)
for (const row of rows.filter(r => !['passed', 'pending'].includes(r.status))) console.log(`${row.status.padEnd(8)} ${row.error}`)
console.log(`Carve 0.2 compatibility: ${report.passed} passed, ${report.declared} declared, ${report.pending} pending, ${report.failed} failed`)
if (engines.length) {
  const metadata = Object.fromEntries(engines.map(e => [e, nativeMetadata(e)]))
  const compared = compareEngines(rows, { engines })
  for (const engine of engines) {
    const result = compared.engines[engine]
    Object.assign(result, { metadata: metadata[engine] })
    for (const d of result.differences) console.log(`differs  ${engine}/${d.call}: ${d.cases.join(', ')}`)
    console.log(`${metadata[engine].name} against carve-js next2: ${result.agrees} agree, ${result.differs} differ (${compared.requests} calls)`)
  }
  report.engines = compared
}
// Importer honesty: a contradiction between report and rendered structure is a measurement and keeps the exit status.
report.importers = compareImporters(rows, { engines: ['javascript', ...engines] })
for (const [engine, result] of Object.entries(report.importers)) {
  for (const c of result.contradictions) console.log(`importer ${engine}/${c.from}: ${c.outcome} ${c.tool}/${c.case} (codes: ${c.report.map(d => d.code).join(', ') || 'none'})`)
  for (const r of result.refused) console.log(`importer ${engine}/${r.from}: refused ${r.tool}/${r.case}: ${r.error}`)
  console.log(`importDocument ${engine}: ${result.imports} imports, ${result.contradictions.length} contradict the rendered structure, ${result.refused.length} refused`)
}
// The suites of the 0.1 lane on 0.2; like an engine difference, a disagreement is a measurement and keeps the exit status.
const selected = arg('measurements') === 'none' ? [] : arg('measurements')?.split(',') ?? measurements02
report.measurements = runMeasurements02(selected, { engines: ['javascript', ...engines] })
for (const [name, m] of Object.entries(report.measurements)) {
  for (const d of m.disagreements) console.log(`${name} ${d.example ?? `${d.mode ?? ''}${d.mode ? ' ' : ''}${d.id}`}: engines disagree`)
  if (m.totals) for (const [engine, t] of Object.entries(m.totals)) console.log(`${name} ${engine}: ${t.match} match, ${t.mismatch} mismatch, ${t.notComparable} not comparable, ${t.failed} failed`)
  if (m.honesty) console.log(`${name} importDocument honesty: ${JSON.stringify(m.honesty)}`)
  if (m.kind === 'source-agreement') console.log(`${name}: ${m.rows.filter(r => r.semanticAgreement && r.htmlAgreement).length} of ${m.rows.length} generated sources agree`)
  if (m.kind === 'roundtrip') for (const c of m.chains) { const s = m.summary[c.id]; console.log(`${name} ${c.id}: meaning ${s.meaning.kept}/${s.meaning.measured} kept, ${s.meaning.errors} errors; spelling ${Object.entries(s.spelling).map(([d, v]) => `${d} ${v.kept}/${v.measured}`).join(', ')}; ${s.notApplicable.length} not applicable`) }
  console.log(`${name}: ${m.disagreements.length} engine disagreements`)
}
const out = arg('report')
if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(report, null, 2) + '\n') }
if (report.failed) process.exitCode = 1
