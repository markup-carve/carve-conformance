import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { writeFileSync, readFileSync, renameSync } from 'node:fs'
import { cpus, loadavg, platform, arch } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { performanceFixtures } from './performance-fixtures.mjs'
import { environment, jsModule, binary, render, jsPin } from './environment.mjs'
import { pin as nativePin } from '../djot-v/environment.mjs'
import { invoke } from '../djot-v/adapter.mjs'
import { nativeBatch } from './batch.mjs'
const root = fileURLToPath(new URL('../../', import.meta.url))
const destination = process.argv[2] ?? 'reports/djot-triage-performance.json'
const built = environment(), parser = (await import(pathToFileURL(jsModule))).default
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const files = ['scripts/differential/performance.mjs', 'scripts/differential/performance-worker.mjs', 'scripts/differential/performance-fixtures.mjs', 'scripts/djot-v/driver.ml']
const record = { metadata: { native: nativePin, jsCurrent: jsPin, build: built, node: process.version,
  cpu: cpus()[0].model, logicalCpus: cpus().length, platform: platform(), arch: arch(),
  generatedAt: new Date().toISOString(), loadStart: loadavg(),
  sourceHashes: Object.fromEntries(files.map(path => [path, sha(readFileSync(root + path))])),
  method: 'Serial fresh workers per fixture, phase, size and engine. Positions off. Startup and input transfer excluded. 200ms warmup; five batches of at least 20ms with 16-call checks and GC before each batch. Wall and process CPU time retained. 60s worker deadline. Observations, not asymptotic proofs or cross-engine speed rankings.' }, groups: [] }
for (const [family, fixture] of Object.entries(performanceFixtures)) {
  const sources = fixture.sizes.map(size => fixture.make(size)), outputs = nativeBatch(binary, sources)
  const checks = outputs.map((html, i) => {
    try {
      const jsHtml = render(parser, sources[i])
      return { htmlAgreement: jsHtml === html, nativeSha256: sha(html), jsSha256: sha(jsHtml) }
    } catch (error) { return { htmlAgreement: null, nativeSha256: sha(html), jsError: error.message } }
  })
  for (const phase of ['parse', 'render', 'html']) {
    const rows = []
    for (const size of fixture.sizes) {
      const source = fixture.make(size), row = { size, bytes: Buffer.byteLength(source), sourceSha256: sha(source), ...checks[fixture.sizes.indexOf(size)], engines: {} }
      for (const engine of ['djot.js', 'djot.v']) {
        try {
          const result = engine === 'djot.v' ? invoke('benchmark', source, [phase]) : JSON.parse(execFileSync(process.execPath,
            ['--expose-gc', root + 'scripts/differential/performance-worker.mjs', family, phase, String(size)], { encoding: 'utf8', timeout: 60000 }))
          assert.equal(result.phase, phase); assert.equal(result.samples.length, 5)
          const median = field => result.samples.map(sample => sample[field]).sort((a, b) => a - b)[2]
          row.engines[engine] = { status: 'ok', ...result, medianWallMs: median('wallMs'), medianCpuMs: median('cpuMs') }
        } catch (error) { row.engines[engine] = { status: 'error', error: error.message } }
      }
      rows.push(row)
      console.log(`${family}/${phase}/${size}: ${Object.entries(row.engines).map(([engine, result]) => engine + ':' + result.status).join(' ')}`)
      record.metadata.loadEnd = loadavg()
      writeFileSync(destination + '.partial', JSON.stringify({ ...record, active: { family, phase, rows } }, null, 2) + '\n')
    }
    record.groups.push({ family, phase, rows })
  }
}
record.metadata.loadEnd = loadavg()
writeFileSync(destination + '.partial', JSON.stringify(record, null, 2) + '\n')
renameSync(destination + '.partial', destination)
