import test from 'node:test'
import assert from 'node:assert/strict'
import { assertLinearWork, collectScalingGuards } from '../scripts/scaling-guards.mjs'

test('all shared scaling families retain bounded copy and global-regex progress', () => {
  const result = collectScalingGuards()
  assert.equal(new Set(result.rows.map(row => row.family)).size, 14)
  assert.ok(result.rows.some(row => row.characters < row.bytes))
})
test('deterministic budgets reject quadratic copying, rescanning, and missing instrumentation', () => {
  for (const row of [
    { copies: 1024 ** 2, globalAdvance: 1024 },
    { copies: 1024, globalAdvance: 1024 ** 2 },
    { copies: 0, globalAdvance: 0 },
  ]) assert.throws(() => assertLinearWork([{ family: 'synthetic', size: 1024, characters: 1024, ...row }]))
})
