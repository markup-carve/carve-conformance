import { performance } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'
import { performanceFixtures } from './performance-fixtures.mjs'
import { jsModule, render } from './environment.mjs'
const [family, phase, sizeArg] = process.argv.slice(2)
const fixture = performanceFixtures[family], size = Number(sizeArg)
if (!fixture?.sizes.includes(size) || !['parse', 'render', 'html'].includes(phase)) throw new Error('Invalid performance fixture')
const parser = (await import(pathToFileURL(jsModule))).default, source = fixture.make(size)
render(parser, '')
const doc = parser.parse(source)
let sink = 0
const once = () => {
  const value = phase === 'parse' ? parser.parse(source) : phase === 'render' ? parser.renderHTML(doc) : render(parser, source)
  sink ^= typeof value === 'string' ? value.length : value.children.length
}
const until = performance.now() + 200
while (performance.now() < until) once()
const samples = []
for (let batch = 0; batch < 5; batch++) {
  global.gc?.()
  const start = performance.now(), startCpu = process.cpuUsage()
  let iterations = 0
  do { for (let i = 0; i < 16; i++) { once(); iterations++ } } while (performance.now() - start < 20)
  const usage = process.cpuUsage(startCpu)
  samples.push({ iterations, wallMs: (performance.now() - start) / iterations, cpuMs: (usage.user + usage.system) / 1000 / iterations })
}
console.log(JSON.stringify({ phase, samples, sink }))
