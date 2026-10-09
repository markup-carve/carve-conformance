import {writeFileSync,mkdirSync} from 'node:fs'
import {dirname} from 'node:path'
import {runSourceAgreement} from './compat/source-agreement.mjs'
let engines, output='reports/source-agreement.json'
for(const arg of process.argv.slice(2)) {
  if(arg.startsWith('--engines=')) engines=arg.slice(10).split(',')
  else if(arg.startsWith('--report=')) output=arg.slice(9)
  else throw new Error(`Unknown argument: ${arg}`)
}
const report=runSourceAgreement(engines)
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n')
console.log(`${report.rows.length} generated sources: ${report.rows.filter(r=>r.semanticAgreement).length} agree on semantic ASTs.`)
const errors=report.rows.flatMap(row=>Object.entries(row.results).filter(([,r])=>r.error || !r.schemaValid || r.positions.invalid.length).map(([engine])=>`${engine}/${row.id}`))
console.log(`${report.rows.flatMap(row=>Object.values(row.results)).filter(r=>r.positions && !r.positions.sourceByteLengthMatches).length} source byte-length differences recorded.`)
if(errors.length) {console.error(`Schema, position-bound or execution failures: ${errors.join(', ')}`);process.exitCode=1}
