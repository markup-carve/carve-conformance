import assert from 'node:assert/strict'
import { writeFileSync, renameSync } from 'node:fs'
import { cpus, loadavg, platform, arch } from 'node:os'
import { invoke } from './adapter.mjs'
import { extractionEnvironment, pin } from './environment.mjs'
import { digest } from '../comparison/environment.mjs'
import { scalingCases } from '../properties/scaling-cases.mjs'
const destination = process.argv[2] ?? 'reports/djot-v-timings.json'
const metadata = { extraction: pin, build: extractionEnvironment(), runnerSha256: digest(['scripts/djot-v/driver.ml','scripts/djot-v/bench.mjs','scripts/djot-v/adapter.mjs','scripts/properties/scaling-cases.mjs']), cpu: cpus()[0].model, logicalCpus:cpus().length, platform:platform(), arch:arch(), loadStart:loadavg(), generatedAt:new Date().toISOString(), method:'Packaged OCaml default profile, positions off. Serial processes per size; startup and input transfer excluded. 200ms warmup, five batches of at least 20ms with 16-call time checks. Full major GC before each batch. Allocation is Gc.allocated_bytes per call. 60s worker deadline.' }
const groups = []
for (const family of Object.keys(scalingCases)) for (const phase of ['parse','render','html']) {
  const fixture = scalingCases[family], rows = []
  for (const size of fixture.sizes) {
    const source = fixture.make(size)
    try { rows.push({ size, bytes:Buffer.byteLength(source), status:'ok', ...invoke('benchmark',source,[phase]) }) }
    catch(error) { rows.push({size,bytes:Buffer.byteLength(source),status:'error',error:error.message}); break }
  }
  groups.push({ family,phase,rows,completed:rows.length===fixture.sizes.length && rows.every(r=>r.status==='ok') })
  console.log(`${family}/${phase}: ${rows.map(r=>r.size+':'+r.status).join(' ')}`)
  writeFileSync(destination+'.partial',JSON.stringify({metadata:{...metadata,loadEnd:loadavg()},groups},null,2)+'\n')
}
renameSync(destination+'.partial',destination)
assert.ok(groups.every(g=>g.completed),'Incomplete benchmarks; inspect the recorded errors')
