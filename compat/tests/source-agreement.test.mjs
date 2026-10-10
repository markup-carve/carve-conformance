import test from 'node:test'
import assert from 'node:assert/strict'
import {generatedSources,semanticAst,positionSummary,runSourceAgreement,validateSourceAgreement} from '../scripts/compat/source-agreement.mjs'
import {structuralDiff} from '../../site/shared/evidence-tools.js'

test('generated sources cover deep containers and each line ending reproducibly',()=>{
  const rows=generatedSources();assert.deepEqual(rows,generatedSources());assert.equal(new Set(rows.map(r=>r.id)).size,109)
  assert.equal(Math.max(...rows.map(r=>r.depth)),16)
  for(const row of rows){if(row.eol==='crlf'){assert.ok(row.source.includes('\r\n'));assert.doesNotMatch(row.source,/(?<!\r)\n/)}if(row.eol==='eof')assert.ok(!row.source.endsWith('\n'))}
  assert.ok(rows.some(r=>r.source.includes('%%%')&&r.source.includes('+ tail')))
  assert.deepEqual(rows.filter(r=>r.family==='input-normalization').map(r=>r.id),['normalization/bom','normalization/nul','normalization/lone-cr','normalization/combined'])
  assert.ok(rows.some(r=>r.source.startsWith('\ufeff')&&r.source.includes('\0')&&r.source.includes('\r\n')))
})
test('semantic comparison removes coordinates while retaining invisible AST fields',()=>{
  assert.deepEqual(semanticAst({type:'text',value:'a',pos:{startOffset:0}}),{type:'text',value:'a'})
  assert.notDeepEqual(semanticAst({type:'table',bodies:[]}),semanticAst({type:'table',bodies:[{rows:[]}]}))
  assert.deepEqual(structuralDiff({'a/b':1},{'a/b':2}),[{path:'/a~1b',expected:1,actual:2}])
  assert.deepEqual(structuralDiff({a:1},{}),[{path:'/a',expected:1,actual:undefined}])
})
test('position observations distinguish codepoints, bytes and omitted coordinates',()=>{
  const result=positionSummary({type:'text',srcByteLength:4,pos:{startOffset:0,endOffset:1}},'🙂')
  assert.equal(result.sourceBytes,4);assert.equal(result.sourceByteLengthMatches,true);assert.deepEqual(result.invalid,[])
  assert.deepEqual(positionSummary({type:'text',pos:{startOffset:0,endOffset:2}},'🙂').invalid,['/pos'])
  assert.equal(positionSummary({type:'text',srcByteLength:3},'a\r\n').positioned,0)
  assert.equal(positionSummary({type:'text',srcByteLength:2},'a\r\n').sourceByteLengthMatches,false)
  assert.equal(positionSummary({type:'document',children:[]},'').reportedBytes,null)
})

test('site rejects altered generated sources, position assessments and engine pins',()=>{
  const report = JSON.parse(JSON.stringify(runSourceAgreement(['javascript'])))
  const adapter = {engines:report.engines}
  validateSourceAgreement(report, adapter)
  for (const alter of [
    value => { value.rows[0].source += 'changed' },
    value => { value.rows[0].results.javascript.positions.positioned++ },
    value => { value.rows[0].semanticAgreement = false },
    value => { value.engines.javascript.revision = 'stale' }
  ]) {
    const changed = structuredClone(report)
    alter(changed)
    assert.throws(() => validateSourceAgreement(changed, adapter))
  }
  const paired = structuredClone(report)
  paired.selectedEngines.push('php')
  paired.engines.php = {...paired.engines.javascript}
  for(const row of paired.rows) {
    row.results.php = structuredClone(row.results.javascript)
    row.differences.php = {semantic:[],positioned:[],html:'match'}
  }
  validateSourceAgreement(paired, {engines:paired.engines})
  paired.rows[0].differences.php.semantic.push({path:'/children',expected:[],actual:[]})
  assert.throws(() => validateSourceAgreement(paired, {engines:paired.engines}), /Incorrect generated source differences/)
})
