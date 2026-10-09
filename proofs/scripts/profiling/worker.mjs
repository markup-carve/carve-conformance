import { Session } from 'node:inspector'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { parse, renderHtml } from 'carve-comparison'
import { parse as parseSpec, layoutWork, resetLayoutWork } from '../../spec/scripts/spec/layout.mjs'
import { renderDoc } from '../../spec/scripts/spec/html.mjs'
import { regexWork, suffixWork } from './instrument.mjs'
import { aggregateFrames } from './summary.mjs'
const { layoutWork: jsWork } = await import(new URL('./parse.js', import.meta.resolve('carve-comparison')))
const [reader, phase, family, sizeText] = process.argv.slice(2), size = Number(sizeText)
if (!['js', 'spec'].includes(reader) || !['parse', 'render'].includes(phase) || !['quotes', 'lists'].includes(family) || ![32, 64, 128, 192].includes(size)) throw new Error('Invalid profile task')
const source = (family === 'quotes' ? '> ' : '- ').repeat(size) + 'end\n'
const parser = reader === 'js' ? parse : parseSpec, render = reader === 'js' ? renderHtml : renderDoc
const ast = parser(source), once = phase === 'parse' ? () => parser(source) : () => render(ast)
let sink = 0
const run = () => { const v = once(); sink ^= typeof v === 'string' ? v.length : (v.children ?? v.blocks).length }
const warmUntil = performance.now() + 200
do { run() } while (performance.now() < warmUntil)
const samples = []
for (let batch = 0; batch < 5; batch++) {
  global.gc(); const cpu = process.cpuUsage(), start = performance.now()
  let iterations = 0, ms
  do {
    for (let i = 0; i < 16; i++) run()
    iterations += 16; ms = performance.now() - start
  } while (ms < 20)
  const usage = process.cpuUsage(cpu)
  samples.push({ iterations, wallMs: ms / iterations, cpuMs: (usage.user + usage.system) / 1000 / iterations })
}
const session = new Session(); session.connect()
const post = (method, params = {}) => new Promise((resolve, reject) => session.post(method, params, (e, r) => e ? reject(e) : resolve(r)))
await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 100 }); await post('Profiler.start')
const until = performance.now() + 300; let cpuIterations = 0
while (performance.now() < until) { run(); cpuIterations++ }
const { profile } = await post('Profiler.stop'); await post('Profiler.disable')
global.gc()
await post('HeapProfiler.enable')
await post('HeapProfiler.startSampling', { samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true })
const heapIterations = 20
for (let i = 0; i < heapIterations; i++) run()
const { profile: heap } = await post('HeapProfiler.stopSampling')
await post('HeapProfiler.disable'); session.disconnect()
const patterns = regexWork(run)
const suffixes = suffixWork(run)
let layout
if (reader === 'js') { jsWork.reset(); jsWork.on = true; try { run(); layout = { gate: jsWork.gate, strip: jsWork.strip, seam: jsWork.seam, total: jsWork.total } } finally { jsWork.on = false } }
else { resetLayoutWork(); run(); layout = { ...layoutWork } }
const root = fileURLToPath(new URL('../../', import.meta.url))
const frame = f => ({ function: f.functionName || '(anonymous)', file: f.url.replace('file://', '').replace(root, ''), line: f.lineNumber + 1 })
const weights = new Map()
for (let i = 0; i < profile.samples.length; i++) { const id = profile.samples[i]; weights.set(id, (weights.get(id) ?? 0) + profile.timeDeltas[i]) }
const cpuSamples = aggregateFrames(profile.nodes.map(n => ({ ...frame(n.callFrame), selfUs: weights.get(n.id) ?? 0, hits: n.hitCount ?? 0 })).filter(n => n.selfUs), 'selfUs')
const heapFrames = []
function walk(n) { if (n.selfSize) heapFrames.push({ ...frame(n.callFrame), sampledBytes: n.selfSize }); for (const c of n.children) walk(c) }
walk(heap.head); const heapNodes = aggregateFrames(heapFrames, 'sampledBytes')
console.log(JSON.stringify({ reader, phase, family, size, bytes: Buffer.byteLength(source), samples, patterns, suffixes, layout,
  cpuIterations, cpuDurationUs: profile.endTime - profile.startTime, cpuSamples, heapIterations,
  sampledAllocationBytes: heapNodes.reduce((sum, n) => sum+n.sampledBytes, 0), heapNodes, sink }))
