import assert from 'node:assert/strict'
import { readFileSync,writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import { buildExtensions } from './extensions-build.mjs'
import { pin } from './environment.mjs'
import { digest } from '../comparison/environment.mjs'
const {values}=parseArgs({options:{output:{type:'string'},check:{type:'string'}}})
const fixturePath=new URL('../../tests/djot-extensions/cases.json',import.meta.url)
const suite=JSON.parse(readFileSync(fixturePath))
assert.equal(suite.schemaVersion,1)
assert.deepEqual(Object.keys(suite.configurations),['djot','list-interruption'])
assert.equal(new Set(suite.cases.map(c=>c.id)).size,suite.cases.length)
const {binary,ocaml}=buildExtensions(), rows=[]
for(const fixture of suite.cases) for(const config of Object.keys(suite.configurations)) {
  const observed={}
  for(const side of ['before','after']) {
    observed[side]=JSON.parse(execFileSync(binary,[config],{input:fixture[side],encoding:'utf8',timeout:10000,maxBuffer:1024*1024}))
    assert.deepEqual(observed[side],fixture.expected[config][side],`${fixture.id}/${config}/${side}`)
  }
  const changed=JSON.stringify(observed.before)!==JSON.stringify(observed.after)
  rows.push({id:fixture.id,config,changed,...observed})
  console.log(`${fixture.id}/${config}: ${changed?'structure changes':'same structure'} (expected)`)
}
const files=['tests/djot-extensions/cases.json','scripts/djot-v/extensions.ml','scripts/djot-v/extensions.mjs','scripts/djot-v/extensions-build.mjs']
const data={pin,ocaml,suiteSha256:digest(files),projection:suite.projection,rows}
if(values.check) assert.deepEqual(data,JSON.parse(readFileSync(values.check)))
if(values.output) writeFileSync(values.output,JSON.stringify(data,null,2)+'\n')
console.log(`${rows.length*2} parser outputs match the portable expectations`)
