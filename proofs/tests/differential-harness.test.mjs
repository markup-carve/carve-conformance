import {test} from 'node:test'
import assert from 'node:assert/strict'
import {reduce} from '../scripts/differential/reduce.mjs'
import {expandedCorpus} from './differential/corpus.mjs'
test('reduction preserves the selected input family',()=>{
 const result=reduce('abc',sources=>sources.map(s=>s.includes('b')),s=>s.startsWith('a'))
 assert.equal(result.source,'ab')
})
test('reduction deletes Unicode code points without splitting surrogate pairs',()=>{
 const result=reduce('a😀b',sources=>sources.map(s=>s.includes('😀')))
 assert.equal(result.source,'😀')
})
test('differential corpus has reproducible IDs and no duplicated sources',()=>{
 const first=expandedCorpus()
 assert.deepEqual(expandedCorpus(),first)
 assert.equal(new Set(first.map(r=>r.source)).size,first.length)
 assert.equal(new Set(first.map(r=>r.id)).size,first.length)
})
