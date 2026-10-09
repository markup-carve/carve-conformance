import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {root,extractionEnvironment,output} from '../djot-v/environment.mjs'
export const jsPin=JSON.parse(readFileSync(new URL('./pin.json',import.meta.url)))
export const binary=root+'.cache/differential-html'
export const jsModule=root+'.cache/djot-js-build/lib/index.js'
export const suiteFiles=['tests/differential/corpus.mjs','tests/differential/cases.json','tests/differential/footnote-lazy.test','scripts/differential/run.mjs','scripts/differential/batch.mjs','scripts/differential/reduce.mjs','scripts/differential/html.ml','scripts/differential/environment.mjs','scripts/differential/build.mjs','scripts/differential/pin.json','scripts/differential/single.mjs']
export function environment() {
 const native=extractionEnvironment(),built=JSON.parse(readFileSync(root+'.cache/differential-build.json'))
 const hash=paths=>createHash('sha256').update(Buffer.concat(paths.map(p=>readFileSync(p)))).digest('hex')
 assert.deepEqual(built.pin,jsPin);assert.deepEqual(built.native,native)
 assert.equal(output('git',['-C',root+'.cache/djot-js-current','rev-parse','HEAD']),jsPin.commit)
 assert.equal(output('git',['-C',root+'.cache/djot-js-current','status','--porcelain','--untracked-files=no']),'')
 assert.equal(built.jsSha256,hash(built.modules.map(p=>root+'.cache/djot-js-build/lib/'+p)))
 assert.equal(built.binarySha256,hash([binary]));assert.equal(built.driverSha256,hash([root+'scripts/differential/html.ml']))
 return built
}
export function render(parser,source) {
 parser.parse('{"');parser.parse("'}")
 return parser.renderHTML(parser.parse(source))
}
