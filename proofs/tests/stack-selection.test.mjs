import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { validateProofSource } from '../scripts/proof-validation.mjs'
import { exampleSource, stackExamples } from '../scripts/stack-proof-check.mjs'

test('stack evidence names every theorem and hashes every checked source', () => {
  const root = new URL('../', import.meta.url)
  const read = path => readFileSync(new URL(path, root))
  const record = JSON.parse(read('reports/stack-selection-proofs.json'))
  const names = validateProofSource(read('proofs/layout/StackSelection.v').toString())
  assert.deepEqual(record.theorems, names)
  assert.equal(record.theoremCount, 15)
  assert.equal(record.closedUnderGlobalContext, names.length)
  assert.equal(record.extractedOutput, 'ancestor:0 visits:2; claim:0; sibling:none')
  assert.equal(record.examples, stackExamples.length)
  assert.deepEqual(Object.keys(record.sourceHashes).sort(), ['proofs/layout/Ownership.v', 'proofs/layout/StackSelection.v', 'scripts/stack-proof-check.mjs', 'scripts/proof-validation.mjs'].sort())
  for (const [path, hash] of Object.entries(record.sourceHashes))
    assert.equal(createHash('sha256').update(read(path)).digest('hex'), hash, path)
})

test('concrete stack controls include rejection and acceptance without claiming source parsing', () => {
  assert.equal(new Set(stackExamples.map(row => row.id)).size, stackExamples.length)
  assert.ok(stackExamples.some(row => row.expected === 'None'))
  assert.ok(stackExamples.some(row => row.visits === 1))
  assert.ok(stackExamples.some(row => row.visits === 2))
  const source = exampleSource()
  assert.match(source, /Example empty_stack/)
  assert.match(source, /Example empty_visits/)
  assert.equal((source.match(/^Example owner_/gm) ?? []).length, stackExamples.length)
})

test('model-local extraction replacements cannot bypass the executable boundary', () => {
  assert.throws(() => validateProofSource('Theorem t : True. Proof. exact I. Qed. Extract Constant t => "false".'), /forbidden/)
})
