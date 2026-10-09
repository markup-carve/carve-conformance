import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse } from 'carve-comparison'
import { scalingCases } from './comparison/scaling-cases.mjs'
import { comparisonEnvironment } from './comparison/environment.mjs'
import { regexWork } from './profiling/instrument.mjs'

const { layoutWork } = await import(new URL('./parse.js', import.meta.resolve('carve-comparison')))
export function assertLinearWork(rows) {
  for (const row of rows) {
    assert.equal(row.copies, row.characters, `${row.family}/${row.size}: normalization copy budget`)
    assert.ok(row.globalAdvance > 0 && row.globalAdvance <= 2 * row.characters,
      `${row.family}/${row.size}: global regex advance exceeds two input traversals`)
  }
}
export function collectScalingGuards() {
  const rows = []
  for (const [family, fixture] of Object.entries(scalingCases)) for (const size of fixture.sizes) {
    const source = fixture.make(size), expected = parse(source)
    layoutWork.reset(); layoutWork.on = true
    let actual, copies
    try { actual = parse(source); copies = layoutWork.total } finally { layoutWork.on = false; layoutWork.reset() }
    assert.deepEqual(actual, expected, `${family}/${size}: instrumented layout changes output`)
    const patterns = regexWork(() => { actual = parse(source) })
    assert.deepEqual(actual, expected, `${family}/${size}: regex instrumentation changes output`)
    rows.push({ family, size, characters: source.length, bytes: Buffer.byteLength(source),
      sourceSha256: createHash('sha256').update(source).digest('hex'), copies,
      globalAdvance: patterns.reduce((sum, row) => sum + row.globalAdvance, 0),
      matchedCharacters: patterns.reduce((sum, row) => sum + row.matchedChars, 0),
      regexInputCharacters: patterns.reduce((sum, row) => sum + row.inputChars, 0),
      regexCalls: patterns.reduce((sum, row) => sum + row.calls, 0) })
  }
  assertLinearWork(rows)
  return { metadata: comparisonEnvironment(),
    scope: 'Selected normalization/copy counters and completed global-regex advance, in UTF-16 characters. Regex input exposure counts arguments, not actual scans or work; nonglobal/sticky scan cost remains unbounded. This does not bound all parser work, regex complexity, allocation, or elapsed time.', rows }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = collectScalingGuards()
  if (process.argv[2] === '--check') assert.deepEqual(result, JSON.parse(readFileSync(process.argv[3], 'utf8')))
  else writeFileSync(process.argv[2] ?? 'reports/scaling-guards.json', JSON.stringify(result, null, 2) + '\n')
  console.log(`Deterministic scaling guards: ${Object.keys(scalingCases).length} families, ${result.rows.length} cases.`)
}
