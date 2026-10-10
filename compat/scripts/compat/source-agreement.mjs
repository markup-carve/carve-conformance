import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import Ajv from 'ajv/dist/2020.js'
import {engineNames, engineMetadata, renderSourceBatch} from './engines.mjs'
import {compareHtml} from './commonmark-spec.mjs'
import {structuralDiff} from '../../../site/shared/evidence-tools.js'

export const seed = 20261010
export function generatedSources() {
  let state = seed
  const next = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return state >>> 0 }
  const words = ['café', '日本語', '🙂', 'e\u0301', 'alpha'], rows = []
  const add = (family, depth, source) => {
    for(const eol of ['lf','crlf','eof']) rows.push({id:`${family}/${depth}/${eol}`,family,depth,eol,source:eol==='crlf'?source.replaceAll('\n','\r\n'):eol==='eof'?source.replace(/\n$/,''):source})
  }
  for(const depth of [1,2,4,8,16]) {
    const payload = Array.from({length:3},()=>words[next()%words.length]).join(' ')
    add('nested-quotes',depth,`${'> '.repeat(depth)}${payload}\n`)
    add('nested-lists',depth,`${'- '.repeat(depth)}${payload}\n\n${'  '.repeat(depth)}tail\n`)
    add('tabs-after-prefix',depth,`${'> '.repeat(depth-1)}>\t${payload}\n`)
    add('comment-continuation',depth,`${'- '.repeat(depth)}${payload}\n\n${'  '.repeat(depth)}%%%\n${'  '.repeat(depth)}hidden\n${'  '.repeat(depth)}%%%\n\n${'  '.repeat(depth)}+ tail\n`)
    add('incomplete-fence',depth,`${'> '.repeat(depth)}\`\`\`\n${'> '.repeat(depth)}${payload}\n`)
    add('unicode-inline',depth,`${payload} /${payload}/ [${payload}](/target)\n`)
    add('empty-slots',depth,`${'- '.repeat(depth)}${payload}\n\n${'  '.repeat(depth)}%% hidden\n`)
  }
  for (const [name, eol, source] of [
    ['bom', 'lf', '\ufeffa\n'],
    ['nul', 'lf', 'a\0b\n'],
    ['lone-cr', 'cr', 'a\rb\r'],
    ['combined', 'crlf', '\ufeff🙂\0\r\n'],
  ]) rows.push({id:`normalization/${name}`,family:'input-normalization',depth:0,eol,source})
  return rows
}
export function semanticAst(value) {
  if(Array.isArray(value)) return value.map(semanticAst)
  if(!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([key])=>!['pos','srcByteLength'].includes(key)).map(([key,child])=>[key,semanticAst(child)]))
}
export function positionSummary(ast, source) {
  let positioned = 0, nodes = 0
  const invalid = [], length = [...source].length
  const visit = (value,path='') => {
    if(!value || typeof value !== 'object') return
    if(value.type) nodes++
    if(value.pos) {
      positioned++
      const p = value.pos
      if(!Number.isInteger(p.startOffset) || !Number.isInteger(p.endOffset) || p.startOffset<0 || p.endOffset<p.startOffset || p.endOffset>length) invalid.push(path+'/pos')
    }
    for(const [key,child] of Object.entries(value)) if(key!=='pos') visit(child,`${path}/${key}`)
  }
  visit(ast)
  return {nodes,positioned,invalid,coordinateUnit:'Unicode codepoints; offsets checked against raw-source bounds',sourceBytes:Buffer.byteLength(source),reportedBytes:ast.srcByteLength ?? null,sourceByteLengthMatches:ast.srcByteLength===Buffer.byteLength(source)}
}
export function runSourceAgreement(selectedEngines=engineNames) {
  assert.ok(selectedEngines.length && selectedEngines.every(e=>engineNames.includes(e)))
  assert.equal(new Set(selectedEngines).size,selectedEngines.length)
  const inputs=generatedSources(), schema=JSON.parse(readFileSync(new URL('../../resources/ast-schema.json',import.meta.url))), validate=new Ajv({strict:false,allErrors:true}).compile(schema)
  const engines=Object.fromEntries(selectedEngines.map(engine=>{const {root,binary,...meta}=engineMetadata(engine);return [engine,meta]}))
  const outputs=Object.fromEntries(selectedEngines.map(engine=>[engine,renderSourceBatch(engine,inputs.map(row=>row.source),{ast:true})]))
  const rows=inputs.map((input,index)=>{
    const results=Object.fromEntries(selectedEngines.map(engine=>{
      const result=outputs[engine][index]
      if(result.error) return [engine,result]
      const schemaValid=validate(result.ast), positions=positionSummary(result.ast,input.source)
      return [engine,{...result,schemaValid,schemaErrors:schemaValid?[]:structuredClone(validate.errors),positions}]
    }))
    const reference=results[selectedEngines[0]], differences={}
    for(const engine of selectedEngines.slice(1)) {
      const actual=results[engine]
      if(reference.error || actual.error) continue
      differences[engine]={semantic:structuralDiff(semanticAst(reference.ast),semanticAst(actual.ast)),positioned:structuralDiff(reference.ast,actual.ast),html:isDeepStrictEqual(compareHtml('',reference.html,{preserveCarveMarkers:true}).actual,compareHtml('',actual.html,{preserveCarveMarkers:true}).actual)?'match':'mismatch'}
    }
    return {...input,results,differences,semanticAgreement:selectedEngines.every(engine=>results[engine].ast && isDeepStrictEqual(semanticAst(reference.ast),semanticAst(results[engine].ast)))}
  })
  return {schemaVersion:1,kind:'source-agreement',generatedAt:new Date().toISOString(),seed,engines,selectedEngines,referenceEngine:selectedEngines[0],suiteSha256:createHash('sha256').update(JSON.stringify(inputs)).digest('hex'),scope:'Generated observations at the adapter pins, without a normative oracle. Semantic AST comparison removes only positions and source byte length. Full AST differences and position availability remain visible. Position bounds do not prove exact source attribution.',rows}
}

export function validateSourceAgreement(report, adapterReport) {
  assert.equal(report.schemaVersion, 1)
  assert.equal(report.kind, 'source-agreement')
  assert.ok(report.generatedAt && !Number.isNaN(Date.parse(report.generatedAt)))
  assert.equal(report.seed, seed)
  const inputs = generatedSources()
  assert.equal(report.suiteSha256, createHash('sha256').update(JSON.stringify(inputs)).digest('hex'), 'Generated source suite changed')
  assert.equal(report.rows.length, inputs.length)
  assert.ok(report.selectedEngines.length && report.selectedEngines.every(engine => engineNames.includes(engine)))
  assert.equal(new Set(report.selectedEngines).size, report.selectedEngines.length)
  assert.equal(report.referenceEngine, report.selectedEngines[0])
  for (const engine of report.selectedEngines) assert.equal(report.engines[engine].revision, adapterReport.engines[engine].revision, 'Generated sources use different engine pins')
  const schema = JSON.parse(readFileSync(new URL('../../resources/ast-schema.json', import.meta.url)))
  const validate = new Ajv({strict:false, allErrors:true}).compile(schema)
  for (const [index, row] of report.rows.entries()) {
    for (const [key, value] of Object.entries(inputs[index])) assert.equal(row[key], value, `Generated source identity changed: ${key}`)
    assert.deepEqual(Object.keys(row.results).sort(), [...report.selectedEngines].sort())
    const reference = row.results[report.referenceEngine]
    for (const engine of report.selectedEngines) {
      const result = row.results[engine]
      if (result.error) { assert.equal(typeof result.error, 'string'); continue }
      assert.equal(typeof result.html, 'string')
      assert.equal(result.schemaValid, validate(result.ast), 'Incorrect AST schema assessment')
      assert.deepEqual(result.schemaErrors, result.schemaValid ? [] : validate.errors)
      assert.deepEqual(result.positions, JSON.parse(JSON.stringify(positionSummary(result.ast, row.source))), 'Incorrect position assessment')
      if (engine === report.referenceEngine || reference.error) continue
      assert.deepEqual(row.differences[engine], JSON.parse(JSON.stringify({
        semantic: structuralDiff(semanticAst(reference.ast), semanticAst(result.ast)),
        positioned: structuralDiff(reference.ast, result.ast),
        html: isDeepStrictEqual(compareHtml('', reference.html,{preserveCarveMarkers:true}).actual, compareHtml('', result.html,{preserveCarveMarkers:true}).actual) ? 'match' : 'mismatch'
      })), 'Incorrect generated source differences')
    }
    assert.equal(row.semanticAgreement, report.selectedEngines.every(engine => row.results[engine].ast && isDeepStrictEqual(semanticAst(reference.ast), semanticAst(row.results[engine].ast))), 'Incorrect semantic agreement')
  }
}
