import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { chains, runRoundtrip, spellingTable } from './compat/roundtrip.mjs'
let selected = chains.map(chain => chain.id), output = 'reports/roundtrip.json'
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--chains=')) selected = arg.slice(9).split(',')
  else if (arg.startsWith('--report=')) output = arg.slice(9)
  else throw new Error(`Unknown argument: ${arg}`)
}
const report = await runRoundtrip(selected)
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, JSON.stringify(report, null, 2) + '\n')
console.log(spellingTable(report))
const errors = report.rows.filter(row => row.error)
if (errors.length) console.log(`${errors.length} conversions failed; see the report rows.`)
