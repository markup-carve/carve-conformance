import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { reportHeader, runCompat, runLosses } from './compat/check-0.2.mjs'
import { nativeTools, toolNames } from './compat/tools-0.2.mjs'

const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const tools = arg('tools')?.split(',') ?? (process.argv.includes('--javascript') ? toolNames.filter(t => !nativeTools.includes(t)) : toolNames)
const rows = [...await runCompat({ tools }), ...await runLosses({ tools })]
const report = reportHeader(rows, tools)
for (const row of rows.filter(r => !['passed', 'pending'].includes(r.status))) console.log(`${row.status.padEnd(8)} ${row.error}`)
console.log(`Carve 0.2 compatibility: ${report.passed} passed, ${report.declared} declared, ${report.pending} pending, ${report.failed} failed`)
const out = arg('report')
if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(report, null, 2) + '\n') }
if (report.failed) process.exitCode = 1
