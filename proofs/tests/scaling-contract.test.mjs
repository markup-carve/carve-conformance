import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parse, carveToHtml } from '@markup-carve/carve'
import { parse as parseSpec, layoutWork, resetLayoutWork, Refuse } from '../spec/scripts/spec/layout.mjs'
import { renderDoc } from '../spec/scripts/spec/html.mjs'
import { scalingCases } from '../scripts/properties/scaling-cases.mjs'

const { layoutWork: jsWork } = await import(new URL('./parse.js', import.meta.resolve('@markup-carve/carve')))

for (const family of ['nested-quotes', 'nested-lists']) test(`${family}: instrumented layout work stays within a linear byte budget`, () => {
  for (const n of [16, 32, 64, 128]) {
    const source = scalingCases[family].make(n)
    const bytes = Buffer.byteLength(source)
    jsWork.reset(); jsWork.on = true
    try {
      let blocks = parse(source).children
      for (let level = 0; level < n; level++) {
        assert.equal(blocks.length, 1)
        assert.equal(blocks[0].type, family === 'nested-quotes' ? 'block_quote' : 'list')
        blocks = family === 'nested-quotes' ? blocks[0].children : blocks[0].items[0].children
      }
      assert.equal(blocks[0].type, 'paragraph')
      assert.ok(jsWork.total > 0 && jsWork.total <= 8 * bytes, `JS ${n}: ${jsWork.total} counted operations for ${bytes} bytes`)
    } finally { jsWork.on = false }
    resetLayoutWork(); parseSpec(source)
    const total = Object.values(layoutWork).reduce((a, b) => a + b, 0)
    assert.ok(total > 0 && total <= 8 * bytes, `spec ${n}: ${total} counted operations for ${bytes} bytes`)
  }
})

test('the specification renderer refuses excessive bracket depth explicitly; JS preserves literal input', () => {
  const source = scalingCases['unmatched-brackets'].make(256)
  assert.throws(() => renderDoc(parseSpec(source)), error => error instanceof Refuse && error.message === 'inline nesting exceeds MAX_NESTING_DEPTH')
  for (const n of [256, 1024]) { const literal = scalingCases['unmatched-brackets'].make(n); assert.equal(carveToHtml(literal), `<p>${literal.trimEnd()}</p>`) }
})

const { decodeWorker, expectedRefusal, fitExponent } = await import('../scripts/properties/benchmark-results.mjs')
test('benchmark protocol preserves timeout, malformed output and spawn failure diagnostics', () => {
  const timeout = decodeWorker({ stdout: '{"event":"start","size":64,"bytes":132}\n{"event":', status: null, signal: 'SIGTERM', error: { code: 'ETIMEDOUT', message: 'deadline' } })
  assert.equal(timeout.rows.at(-1).status, 'timeout')
  assert.equal(timeout.rows.at(-1).size, 64)
  assert.match(timeout.workerError, /Malformed/)
  assert.equal(decodeWorker({ stdout: null, status: null, error: { message: 'spawn failed' } }).rows[0].status, 'error')
  const group = { reader: 'spec', mode: 'html', family: 'unmatched-brackets', exitCode: 0, signal: null, workerError: null, rows: [{ status: 'refused', size: 256, error: 'inline nesting exceeds MAX_NESTING_DEPTH' }] }
  assert.equal(expectedRefusal(group), true)
  assert.equal(expectedRefusal({ ...group, exitCode: 1 }), false)
  assert.equal(expectedRefusal({ ...group, workerError: 'bad output' }), false)
})

test('the fitted scaling exponent distinguishes linear and quadratic synthetic work', () => {
  const make = power => [8, 16, 32, 64].map(bytes => ({ bytes, medianMs: bytes ** power, status: 'ok' }))
  assert.ok(Math.abs(fitExponent(make(1)) - 1) < 1e-10)
  assert.ok(Math.abs(fitExponent(make(2)) - 2) < 1e-10)
})
