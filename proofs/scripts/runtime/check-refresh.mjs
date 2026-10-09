import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { validateTimings } from '../comparison/validate-timings.mjs'
import { validateCostData } from '../profiling/cost-report.mjs'
import { fitExponent } from '../properties/benchmark-results.mjs'

const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const json = path => JSON.parse(read(path))
const median = values => [...values].sort((a, b) => a - b)[2]

export function checkRefresh(page = read('reports/performance-refresh.md')) {
  validateTimings(json('reports/comparison-timings.json'))
  validateCostData(json('reports/current-costs.json'))
  const runtime = json('reports/runtime-timings.json'), proof = json('reports/proof-refresh.json')
  assert.deepEqual(proof.readerPins, json('scripts/ownership/pins.json'))
  assert.equal(proof.comparisonEngine, json('package.json').devDependencies['carve-comparison'])
  for (const [path, hash] of Object.entries(proof.proofSources)) assert.equal(createHash('sha256').update(read(path)).digest('hex'), hash)
  for (const check of proof.checks) {
    assert.equal(createHash('sha256').update(check.transcript).digest('hex'), check.transcriptSha256)
    if (check.artifact) assert.equal(createHash('sha256').update(read(check.artifact)).digest('hex'), check.artifactSha256)
  }
  assert.equal(proof.ownership.inputs, json('reports/ownership-results.json').rows.length)
  assert.equal(proof.comparison.observations, json('reports/comparison-results.json').rows.length)
  assert.equal(proof.contracts.observations, json('reports/comparison-contracts.json').rows.length)
  assert.equal(proof.containers.cases, json('reports/container-regressions.json').rows.length)
  for (const [reader, family, mode] of [
    ['php', 'unmatched-brackets', 'parse'], ['php', 'nested-lists', 'parse'],
    ['php', 'nested-lists', 'render'], ['php', 'nested-quotes', 'parse'],
    ['php', 'nested-quotes', 'render'], ['rs', 'nested-lists', 'parse'], ['rs', 'nested-lists', 'render'],
  ]) {
    const group = runtime.groups.find(g => g.reader === reader && g.family === family && g.mode === mode)
    assert.ok(group?.completed)
    assert.ok(page.includes(`${median(group.rows.at(-1).samplesMs).toFixed(3)} ms`), `Stale ${reader}/${family}/${mode} claim`)
    if (family === 'unmatched-brackets') assert.ok(page.includes(fitExponent(group.rows.map(r => ({ ...r, medianMs: median(r.samplesMs) }))).toFixed(3)))
  }
  const quote = runtime.groups.find(g => g.reader === 'rs' && g.family === 'nested-quotes' && g.mode === 'render').rows.at(-1)
  for (const value of [quote.htmlBytes, median(quote.samplesAllocatedBytes), median(quote.samplesAllocationCalls)]) assert.ok(page.includes(value.toLocaleString('en-US')), `Stale Rust quote allocation claim: ${value}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) { checkRefresh(); console.log('Refresh claims match runtime evidence, proof records and controlled JS datasets') }
