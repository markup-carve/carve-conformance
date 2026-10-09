import assert from 'node:assert/strict'
import { readFileSync,writeFileSync,copyFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import { root,pin,opamArgs,output,extractionEnvironment } from './environment.mjs'
import { digest } from '../comparison/environment.mjs'
const {values}=parseArgs({options:{output:{type:'string'},check:{type:'string'}}})
extractionEnvironment()
const vendor=root+'.cache/djot-v'
execFileSync('opam',[...opamArgs,'dune','build','--root',vendor,'-j','2','theories/Invariants.vo'],{cwd:root,stdio:'inherit'})
const source=root+'.cache/ExtensionWitness.v'
copyFileSync(new URL('./ExtensionWitness.v',import.meta.url),source)
const transcript=output('opam',[...opamArgs,'rocq','compile','-R',vendor+'/_build/default/theories','DjotV',source])
assert.equal((transcript.match(/Closed under the global context/g)??[]).length,8)
assert.ok(!transcript.includes('Axioms:'))
extractionEnvironment()
const data={pin,sourceSha256:digest(['scripts/djot-v/ExtensionWitness.v','scripts/djot-v/extensions-proof.mjs']),rocq:output('opam',[...opamArgs,'rocq','--version']),closedUnderGlobalContext:8,transcript}
if(values.check) assert.deepEqual(data,JSON.parse(readFileSync(values.check)))
if(values.output) writeFileSync(values.output,JSON.stringify(data,null,2)+'\n')
console.log('Eight extension witnesses checked without axioms')
