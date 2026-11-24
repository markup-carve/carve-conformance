import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { reportHeader, runCompat, runLosses } from './compat/check-0.2.mjs'
import { nativeTools, toolNames } from './compat/tools-0.2.mjs'
import { compareEngines, nativeEngines02, nativeMetadata } from './compat/engines-native-0.2.mjs'

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
const out = arg('report')
if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(report, null, 2) + '\n') }
if (report.failed) process.exitCode = 1
