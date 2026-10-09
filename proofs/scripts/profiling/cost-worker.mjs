import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { Session } from 'node:inspector'
import { loadavg } from 'node:os'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { parse as carveParse, carveToHtml } from 'carve-comparison'
import { parse as djotParse, renderHTML as djotHtml } from '@djot/djot'
import { Parser, HtmlRenderer } from 'commonmark'
import { scalingCases } from '../comparison/scaling-cases.mjs'
import { aggregateFrames } from './summary.mjs'

const [variant, family, phase = 'parse'] = process.argv.slice(2)
const cm = new Parser(), cmHtml = new HtmlRenderer()
const parsers = {
  carve: carveParse,
  'carve-no-positions': source => carveParse(source, { positions: false }),
  djot: djotParse,
  'djot-positions': source => djotParse(source, { sourcePositions: true }),
  commonmark: source => cm.parse(source),
}
assert.ok(parsers[variant] && scalingCases[family] && ['parse', 'html', 'direct-html-probe'].includes(phase))
const html = { carve: carveToHtml, djot: source => djotHtml(djotParse(source)), commonmark: source => cmHtml.render(cm.parse(source)) }
if (phase === 'html') assert.ok(html[variant])
const loadStart = loadavg()
const size = scalingCases[family].sizes.at(-1), source = scalingCases[family].make(size)
const parse = parsers[variant]
const strip = value => Array.isArray(value) ? value.map(strip) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'pos').map(([key, child]) => [key, strip(child)])) : value
if (variant.startsWith('carve')) assert.deepEqual(strip(parse(source)), strip(carveParse(source)))
if (variant.startsWith('djot')) assert.deepEqual(strip(parse(source)), strip(djotParse(source)))
let htmlPath = null, probe
if (variant.startsWith('carve')) {
  const { tryFastHtml } = await import(new URL('./fast-html.js', import.meta.resolve('carve-comparison')))
  probe = () => tryFastHtml(source, {})
  const direct = tryFastHtml(source, {})
  htmlPath = direct === undefined ? 'ast' : 'direct'
  if (direct !== undefined) assert.equal(direct, carveToHtml(source))
}
let sink = 0
if (phase === 'direct-html-probe') assert.equal(variant, 'carve')
const operation = phase === 'parse' ? parse : phase === 'html' ? html[variant] : probe
const once = () => { const result = operation(source); sink ^= typeof result === 'string' ? result.length : result?.children?.length ?? (result?.firstChild ? 1 : 0) }
const warmUntil = performance.now() + 500
while (performance.now() < warmUntil) once()
const samples = []
for (let batch = 0; batch < 7; batch++) {
  global.gc()
  const cpu = process.cpuUsage(), start = performance.now()
  let iterations = 0, elapsed
  do { for (let i = 0; i < 16; i++) once(); iterations += 16; elapsed = performance.now() - start } while (elapsed < 100)
  const usage = process.cpuUsage(cpu)
  samples.push({ iterations, wallMs: elapsed / iterations, cpuMs: (usage.user + usage.system) / 1000 / iterations })
}
const session = new Session(); session.connect()
const post = (method, params = {}) => new Promise((resolve, reject) => session.post(method, params, (error, value) => error ? reject(error) : resolve(value)))
await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 100 }); await post('Profiler.start')
const until = performance.now() + 500
let cpuIterations = 0
while (performance.now() < until) { once(); cpuIterations++ }
const { profile } = await post('Profiler.stop'); await post('Profiler.disable')
global.gc()
await post('HeapProfiler.enable')
await post('HeapProfiler.startSampling', { samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true })
const heapIterations = 50
for (let i = 0; i < heapIterations; i++) once()
const { profile: heap } = await post('HeapProfiler.stopSampling'); await post('HeapProfiler.disable'); session.disconnect()
const root = fileURLToPath(new URL('../../', import.meta.url))
const frame = f => ({ function: f.functionName || '(anonymous)', file: f.url.replace('file://', '').replace(root, ''), line: f.lineNumber + 1 })
const weights = new Map()
for (let i = 0; i < profile.samples.length; i++) weights.set(profile.samples[i], (weights.get(profile.samples[i]) ?? 0) + profile.timeDeltas[i])
const cpuSamples = aggregateFrames(profile.nodes.map(n => ({ ...frame(n.callFrame), selfUs: weights.get(n.id) ?? 0 })).filter(n => n.selfUs), 'selfUs')
const heapFrames = []
function walk(node) { if (node.selfSize) heapFrames.push({ ...frame(node.callFrame), sampledBytes: node.selfSize }); node.children.forEach(walk) }
walk(heap.head)
const heapNodes = aggregateFrames(heapFrames, 'sampledBytes')
console.log(JSON.stringify({ sourceSha256: createHash('sha256').update(source).digest('hex'), variant, phase, family, htmlPath, loadStart, loadEnd: loadavg(), size, bytes: Buffer.byteLength(source), samples, cpuIterations, cpuSamples, heapIterations,
  sampledAllocationBytes: heapNodes.reduce((sum, row) => sum + row.sampledBytes, 0), heapNodes, sink }))
