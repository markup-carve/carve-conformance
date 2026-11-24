import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cases } from '../proofs/layout/cases-0.2.mjs'
import { classify, compareEngine, generateChecks } from '../scripts/layout-0.2-check.mjs'

test('0.2 readings agree with carve-js next2', () => {
  assert.deepEqual(compareEngine(), [
    'post-blank-between-base-and-content',
    'interrupter-rejects-claim',
    'unmatched-comment-fence-is-line-comment',
    'comment-does-not-retain-interrupter',
    'content-comment-does-not-retain-base-follower',
    'consecutive-comments-end-at-content',
    'outside-comment-cannot-reopen-item',
  ])
})

test('a changed engine result cannot pass as the old reading', () => {
  const changed = structuredClone(cases)
  changed.find(c => c.name === 'ordinary-claim-at-base').owner = 'outside'
  assert.throws(() => compareEngine(changed), /carve-js next2 changed/)
})

test('a missing target is a failed comparison, not an unowned line', () => {
  const changed = structuredClone(cases)
  changed[0].target = 'absent'
  assert.throws(() => compareEngine(changed), /found in 0 places/)
})

test('every reading cites a 0.2 block clause', () => {
  const changed = structuredClone(cases)
  changed[0].clauses = ['CARVE-P0-003']
  assert.throws(() => compareEngine(changed), /cite C2-B clauses/)
})

test('lines classify into the model alphabet', () => {
  assert.equal(classify(''), 'Blank')
  assert.equal(classify('  %% c'), '(Comment 2)')
  assert.equal(classify('%%%'), '(CommentFence 0)')
  assert.equal(classify('- next'), 'SiblingMarker')
  assert.equal(classify('***'), '(Interrupter 0)')
  assert.equal(classify(' > q'), '(Text 1)')
  assert.equal(classify('# h'), '(Text 0)')
})

test('generated Rocq examples cover every trace', () => {
  const checks = generateChecks()
  assert.equal((checks.match(/^Example trace02_/gm) ?? []).length, 17)
  assert.match(checks, /owner 0 \(run 0 initial \[\(CommentFence 0\)\]\) \(Text 0\) = InComment\./)
  assert.match(checks, /owner 0 \(run 0 initial \[\]\) \(Text 0\) = InItem\./)
})
