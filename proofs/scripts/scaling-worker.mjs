import { performance } from 'node:perf_hooks'
import { parse as jsParse, carveToHtml } from '@markup-carve/carve'
import { parse as specParse, resetLayoutWork, layoutWork, Refuse } from '../spec/scripts/spec/layout.mjs'
import { renderDoc } from '../spec/scripts/spec/html.mjs'
import { scalingCases } from './properties/scaling-cases.mjs'

const { layoutWork: jsWork } = await import(new URL('./parse.js', import.meta.resolve('@markup-carve/carve')))

const [reader, mode, family] = process.argv.slice(2)
const fixture = scalingCases[family]
if (!fixture || !['js', 'spec'].includes(reader) || !['parse', 'html'].includes(mode)) throw new Error('Invalid benchmark task')
const run = reader === 'js' ? (mode === 'parse' ? jsParse : carveToHtml)
  : (mode === 'parse' ? specParse : source => renderDoc(specParse(source)))
let sink = 0
for (const size of fixture.sizes) {
  const source = fixture.make(size)
  process.stdout.write(JSON.stringify({ event: 'start', size, bytes: Buffer.byteLength(source) }) + '\n')
  try {
    const once = () => { const value = run(source); sink ^= typeof value === 'string' ? value.length : (value.children ?? value.blocks).length }
    once()
    const start = performance.now(); once(); const pilotMs = performance.now() - start
    const iterations = Math.max(1, Math.min(32, Math.ceil(10 / Math.max(pilotMs, 0.01))))
    const samples = []
    for (let i = 0; i < 5; i++) {
      global.gc?.()
      const start = performance.now()
      for (let j = 0; j < iterations; j++) once()
      samples.push((performance.now() - start) / iterations)
    }
    let counters
    if (reader === 'spec') { resetLayoutWork(); once(); counters = { ...layoutWork } }
    else { jsWork.reset(); jsWork.on = true; try { once(); counters = { gate: jsWork.gate, strip: jsWork.strip, seam: jsWork.seam, total: jsWork.total } } finally { jsWork.on = false } }
    const sorted = [...samples].sort((a, b) => a - b)
    process.stdout.write(JSON.stringify({ event: 'result', status: 'ok', size, bytes: Buffer.byteLength(source), samplesMs: samples,
      medianMs: sorted[2], minMs: sorted[0], maxMs: sorted[4], iterations, counters, peakRssKiB: process.resourceUsage().maxRSS }) + '\n')
  } catch (error) {
    process.stdout.write(JSON.stringify({ event: 'result', status: error instanceof Refuse ? 'refused' : 'error', size, bytes: Buffer.byteLength(source), error: error.message, errorType: error.constructor.name }) + '\n')
    break
  }
}
process.stdout.write(JSON.stringify({ event: 'sink', value: sink }) + '\n')
