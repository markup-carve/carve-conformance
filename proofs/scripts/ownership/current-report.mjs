import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8')
export function currentReport() {
  const data = JSON.parse(read('reports/ownership-current-results.json'))
  const contracts = JSON.parse(read('reports/ownership-current-contracts.json'))
  const fixtures = JSON.parse(read('tests/fixtures/ownership-expanded.json'))
  assert.deepEqual(data.pins, contracts.pins)
  const family = name => fixtures.filter(row => row.family === name).length
  const numbers = { cases: data.rows.length, baseCases: data.rows.length - fixtures.length,
    expandedCases: fixtures.length, opaqueQuote: family('opaque-quote'), continuation: family('continuation'),
    opaqueSpan: family('opaque-span'), tabMarker: family('tab-marker'), edits: new Set(contracts.rows.map(row => row.id)).size }
  assert.equal(numbers.opaqueQuote + numbers.continuation + numbers.opaqueSpan + numbers.tabMarker, fixtures.length, 'Unknown normative fixture family')
  return read('scripts/ownership/current-report-template.md').replace(/\{\{(\w+)\}\}/g, (_, key) => {
    assert.ok(Number.isSafeInteger(numbers[key]), `Unknown or invalid report count: ${key}`)
    return numbers[key].toLocaleString('en-US')
  })
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--check'), 'Usage: node scripts/ownership/current-report.mjs [--check]')
  const report = currentReport()
  if (args[0] === '--check') assert.equal(read('reports/ownership-current.md'), report, 'Current report is stale')
  else writeFileSync(new URL('../../reports/ownership-current.md', import.meta.url), report)
}
