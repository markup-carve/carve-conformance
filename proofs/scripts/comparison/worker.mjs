import { performance } from 'node:perf_hooks'
import { createHash } from 'node:crypto'
import { adapters, nestingDepth } from './adapters.mjs'
import { scalingCases } from './scaling-cases.mjs'
const [reader, mode, family] = process.argv.slice(2)
const adapter = adapters[reader], fixture = scalingCases[family]
if (!adapter || !fixture || !['parse', 'render', 'html'].includes(mode)) throw new Error('Invalid benchmark task')
let sink = 0
for (const size of fixture.sizes) {
  const source = fixture.make(size), bytes = Buffer.byteLength(source)
  process.stdout.write(JSON.stringify({ event: 'start', size, bytes }) + '\n')
  try {
    if (family.startsWith('nested-')) {
      const depth = nestingDepth(reader, source, family === 'nested-quotes' ? 'quote' : 'list')
      if (depth !== size) throw new Error(`Requested depth ${size}, parsed ${depth}`)
    }
    const ast = mode === 'render' ? adapter.parse(source) : null
    const once = () => { const result = mode === 'render' ? adapter.render(ast) : adapter[mode](source); sink ^= typeof result === 'string' ? result.length : 1 }
    const warmUntil = performance.now() + 200
    do { once() } while (performance.now() < warmUntil)
    const samplesMs = [], samplesCpuMs = [], batchIterations = []
    for (let batch = 0; batch < 5; batch++) {
      global.gc?.()
      const cpu = process.cpuUsage(), start = performance.now()
      let iterations = 0, elapsed
      do {
        for (let i = 0; i < 16; i++) once()
        iterations += 16; elapsed = performance.now() - start
      } while (elapsed < 20)
      const usage = process.cpuUsage(cpu)
      batchIterations.push(iterations)
      samplesMs.push(elapsed / iterations); samplesCpuMs.push((usage.user + usage.system) / 1000 / iterations)
    }
    const median = xs => [...xs].sort((a, b) => a - b)[2]
    process.stdout.write(JSON.stringify({ event: 'result', status: 'ok', size, bytes, sourceSha256: createHash('sha256').update(source).digest('hex'), batchIterations, samplesMs, samplesCpuMs, medianMs: median(samplesMs), medianCpuMs: median(samplesCpuMs), peakRssKiB: process.resourceUsage().maxRSS }) + '\n')
  } catch (error) {
    process.stdout.write(JSON.stringify({ event: 'result', status: 'error', size, bytes, error: error.message }) + '\n'); break
  }
}
process.stdout.write(JSON.stringify({ event: 'sink', value: sink }) + '\n')
