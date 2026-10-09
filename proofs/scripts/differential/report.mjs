import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {digest} from '../comparison/environment.mjs'
import {suiteFiles,jsPin} from './environment.mjs'
import {pin} from '../djot-v/environment.mjs'
const root=new URL('../../',import.meta.url)
const results=JSON.parse(readFileSync(new URL('reports/djot-differential.json',root)))
const proofs=JSON.parse(readFileSync(new URL('reports/djot-differential-proofs.json',root)))
const triage=JSON.parse(readFileSync(new URL('reports/djot-difference-triage.json',root)))
assert.deepEqual(triage.metadata.native,results.metadata.native,'Refresh triage for the native pin')
assert.deepEqual(triage.metadata.jsCurrent,results.metadata.jsCurrent,'Refresh triage for the JavaScript pin')
assert.equal(triage.metadata.baselineSha256,digest(['reports/djot-differential.json']),'Refresh triage for the comparison record')
assert.equal(triage.counts.differences,results.counts.currentDifferences,'Triage count differs from the comparison')
assert.equal(triage.counts.inputs,results.counts.inputs)
assert.equal(results.metadata.suiteSha256,digest(suiteFiles))
assert.deepEqual(results.metadata.jsCurrent,jsPin);assert.deepEqual(results.metadata.native,pin);assert.deepEqual(proofs.pin,pin)
assert.equal(proofs.sourceSha256,digest(['scripts/differential/FootnoteWitness.v','scripts/differential/proof.mjs']))
assert.equal(proofs.closedUnderGlobalContext,4)
assert.equal(results.reproducers.length,12)
assert.equal(results.metadata.typescript,'4.9.4')
assert.equal(results.metadata.ocaml,'4.14.2')
assert.equal(results.metadata.released.version,'0.3.2')
assert.deepEqual(results.reductions.map(r=>r.source),['![a][g]'])
const upstream=readFileSync(new URL('reports/djot-differential-upstream.txt',root),'utf8')
assert.match(upstream,/4 cases run, 0 skipped/)
assert.match(upstream,/match\s+4\s+mismatch\s+0\s+error\s+0/)
const numbers={...results.counts,matches:results.counts.inputs-results.counts.currentDifferences}
const template=readFileSync(new URL('./report-template.md',import.meta.url),'utf8')
const report=template.replaceAll('{{nativeCommit}}',pin.commit).replaceAll('{{nativeShort}}',pin.commit.slice(0,7)).replace(/\{\{(\w+)\}\}/g,(_,key)=>{assert.ok(Number.isInteger(numbers[key]));return numbers[key].toLocaleString('en-US')})
writeFileSync(new URL('reports/djot-differential.md',root),report)
