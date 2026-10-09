import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {pathToFileURL,fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import {parseArgs} from 'node:util'
import * as released from '@djot/djot'
import {expandedCorpus} from '../../tests/differential/corpus.mjs'
import {comparisonEnvironment,digest} from '../comparison/environment.mjs'
import {invoke} from '../djot-v/adapter.mjs'
import {pin as nativePin} from '../djot-v/environment.mjs'
import {environment,binary,jsModule,jsPin,render,suiteFiles} from './environment.mjs'
import {nativeBatch} from './batch.mjs'
import {reduce} from './reduce.mjs'
const {values}=parseArgs({options:{output:{type:'string'},check:{type:'string'},'diagnostic-output':{type:'string'}}})
const built=environment(),current=(await import(pathToFileURL(jsModule))).default
const inputs=expandedCorpus(),native=nativeBatch(binary,inputs.map(r=>r.source)),differences=[]
let currentDifferences=0,releasedDifferences=0,releaseDrift=0
for(const [i,row]of inputs.entries()) {
 const jsCurrent=render(current,row.source),jsReleased=render(released,row.source),ocaml=native[i]
 if(jsCurrent!==ocaml)currentDifferences++
 if(jsReleased!==ocaml)releasedDifferences++
 if(jsCurrent!==jsReleased)releaseDrift++
 if(jsCurrent!==ocaml||jsReleased!==ocaml)differences.push({...row,jsCurrent,jsReleased,ocaml})
}
const cases=JSON.parse(readFileSync(new URL('../../tests/differential/cases.json',import.meta.url)))
const focused=nativeBatch(binary,cases.map(r=>r.source))
const reproducers=cases.map((row,i)=>{
 const jsCurrent=render(current,row.source),jsReleased=render(released,row.source),ocaml=focused[i]
 assert.equal(jsCurrent===ocaml,row.expectedAgreement,row.id)
 assert.equal(execFileSync(process.execPath,[fileURLToPath(new URL('./single.mjs',import.meta.url))],{input:row.source,encoding:'utf8',timeout:10000}),jsCurrent,'JS batch state differs from fresh process')
 assert.equal(execFileSync(process.execPath,[fileURLToPath(new URL('./single.mjs',import.meta.url)),'released'],{input:row.source,encoding:'utf8',timeout:10000}),jsReleased,'Released JS batch differs from fresh process')
 assert.equal(invoke('html',row.source).html,ocaml,'Native batch differs from fresh process')
 return {...row,jsCurrent,jsReleased,ocaml}
})
const upstreamFixture = reproducers.filter(r=>['footnote-lazy','footnote-indented-control','footnote-blank-control','footnote-unreferenced'].includes(r.id)).map(r=>'```\n'+r.source+'.\n'+r.jsCurrent+'```\n').join('\n')
assert.equal(readFileSync(new URL('../../tests/differential/footnote-lazy.test',import.meta.url),'utf8'),upstreamFixture,'Portable fixture differs from verified current JS output')
assert.equal(reproducers.find(r=>r.id==='footnote-lazy').ocaml,reproducers.find(r=>r.id==='footnote-lazy').jsCurrent)
assert.equal(reproducers.find(r=>r.id==='footnote-unreferenced').ocaml,'')
assert.equal(reproducers.find(r=>r.id==='footnote-unreferenced').jsCurrent,'')
assert.equal(reproducers.find(r=>r.id==='image-unresolved').jsCurrent,'<p><img></p>\n')
assert.equal(reproducers.find(r=>r.id==='image-unresolved').ocaml,'<p><img alt="x"></p>\n')
const reductions=[]
for(const [id,original,accept] of [
 ['image-unresolved','![alpha][missing]\n',s=>/^!\[[a-z]+\]\[[a-z]+\]\n?$/.test(s)]
]) {
 const evaluate=sources=>nativeBatch(binary,sources).map((html,i)=>render(current,sources[i])!==html)
 assert.equal(evaluate([original])[0],true)
 const reduced=reduce(original,evaluate,accept)
 reductions.push({id,original,...reduced,jsCurrent:render(current,reduced.source),ocaml:nativeBatch(binary,[reduced.source])[0]})
}
const data={metadata:{jsCurrent:jsPin,native:nativePin,released:comparisonEnvironment().parsers['@djot/djot'],typescript:built.typescript,ocaml:built.native.ocaml,suiteSha256:digest(suiteFiles),specification:'https://github.com/jgm/djot/blob/d77f8a0cbea6785c42b3e2b03463195b5ca6f7c7/doc/syntax.md'},counts:{inputs:inputs.length,currentDifferences,releasedDifferences,releaseDrift},reproducers,reductions,differences}
if(values['diagnostic-output']) {
 for(const baseline of [values.check,values.output].filter(Boolean))assert.notEqual(resolve(values['diagnostic-output']),resolve(baseline),'Diagnostic output must not overwrite a baseline or result path')
 writeFileSync(values['diagnostic-output'],JSON.stringify(data,null,2)+'\n')
}
if(values.check)assert.deepEqual(data,JSON.parse(readFileSync(values.check)))
if(values.output)writeFileSync(values.output,JSON.stringify(data,null,2)+'\n')
console.log(data.counts);console.log(reductions)
