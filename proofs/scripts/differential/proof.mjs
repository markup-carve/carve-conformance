import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,copyFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {parseArgs} from 'node:util'
import {root,pin,opamArgs,output,extractionEnvironment} from '../djot-v/environment.mjs'
import {digest} from '../comparison/environment.mjs'
const {values}=parseArgs({options:{output:{type:'string'},check:{type:'string'}}})
extractionEnvironment()
const vendor=root+'.cache/djot-v'
execFileSync('opam',[...opamArgs,'dune','build','--root',vendor,'-j','2','theories/Inline.vo','theories/Step.vo'],{cwd:root,stdio:'inherit'})
const source=root+'.cache/FootnoteWitness.v'
copyFileSync(new URL('./FootnoteWitness.v',import.meta.url),source)
const transcript=output('opam',[...opamArgs,'rocq','compile','-R',vendor+'/_build/default/theories','DjotV',source])
assert.equal((transcript.match(/Closed under the global context/g)??[]).length,4)
assert.ok(!transcript.includes('Axioms:'))
extractionEnvironment()
const data={pin,sourceSha256:digest(['scripts/differential/FootnoteWitness.v','scripts/differential/proof.mjs']),rocq:output('opam',[...opamArgs,'rocq','--version']),closedUnderGlobalContext:4,transcript}
if(values.check)assert.deepEqual(data,JSON.parse(readFileSync(values.check)))
if(values.output)writeFileSync(values.output,JSON.stringify(data,null,2)+'\n')
console.log('Footnote lazy continuation, indentation equivalence and blank control checked in the Rocq source model without axioms')
