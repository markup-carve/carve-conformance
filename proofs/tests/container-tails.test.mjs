import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { collectTailWork, tailReport } from '../scripts/profiling/container-tails.mjs'

test('remaining container paths preserve trees and bound recorded tail work', () => {
  const data = collectTailWork()
  assert.equal(data.groups.length, 60)
  assert.equal(data.copies.length, 9)
  assert.deepEqual(data, JSON.parse(readFileSync(new URL('../reports/container-tail-work.json', import.meta.url))))
  assert.equal(tailReport(data), readFileSync(new URL('../reports/container-tail-work.md', import.meta.url), 'utf8'))
})
