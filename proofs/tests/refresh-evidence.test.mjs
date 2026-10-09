import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkRefresh } from '../scripts/runtime/check-refresh.mjs'

test('refresh claims require matching evidence and reject a stale phase timing', () => {
  checkRefresh()
  const page = readFileSync(new URL('../reports/performance-refresh.md', import.meta.url), 'utf8')
  const runtime = JSON.parse(readFileSync(new URL('../reports/runtime-timings.json', import.meta.url)))
  const row = runtime.groups.find(g => g.reader === 'php' && g.family === 'nested-lists' && g.mode === 'parse').rows.at(-1)
  const timing = [...row.samplesMs].sort((a, b) => a - b)[2].toFixed(3)
  assert.throws(() => checkRefresh(page.replace(`${timing} ms`, 'missing phase timing')), /Stale php\/nested-lists\/parse claim/)
})
