import { test } from 'node:test'
import assert from 'node:assert/strict'
import { settleHost } from '../scripts/comparison/settle-host.mjs'

test('installation load must settle for three observations before measurement', async () => {
  const loads = [5, 2, 4, 2, 2, 2]
  let reads = 0, clock = 0
  await settleHost({ cpus: 4, readLoad: () => loads[reads++], now: () => clock,
    sleep: async delay => { clock += delay }, log: () => {} })
  assert.equal(reads, loads.length)
})

test('persistent load aborts instead of allowing overloaded evidence', async () => {
  let clock = 0
  await assert.rejects(settleHost({ cpus: 4, readLoad: () => 5, now: () => clock,
    sleep: async delay => { clock += delay }, log: () => {}, timeoutMs: 25_000 }), /did not settle/)
  assert.equal(clock, 25_000)
})
