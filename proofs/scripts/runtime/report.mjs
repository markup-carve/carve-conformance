import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { pins, runnerDigest } from './build.mjs'
import { scalingCases } from '../properties/scaling-cases.mjs'
import { fitExponent } from '../properties/benchmark-results.mjs'

const data = JSON.parse(readFileSync(new URL('../../reports/runtime-timings.json', import.meta.url)))
assert.deepEqual(data.metadata.pins, pins)
assert.equal(data.metadata.build.runnerSha256, runnerDigest())
assert.equal(data.groups.length, 42)
for (const reader of ['rs', 'php']) assert.equal(typeof data.metadata.memory[reader], 'string')
const median = values => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}
const fixed = value => value.toFixed(3)
const rows = []
for (const reader of ['rs', 'php']) for (const [family, fixture] of Object.entries(scalingCases)) {
  for (const mode of ['parse', 'render', 'html']) {
    const matches = data.groups.filter(group => group.reader === reader && group.family === family && group.mode === mode)
    assert.equal(matches.length, 1)
    const group = matches[0]
    assert.equal(group.completed, true)
    assert.deepEqual(group.rows.map(row => row.size), fixture.sizes)
    assert.ok(group.rows.every(row => row.status === 'ok'))
    const measured = group.rows.map(row => ({ ...row, medianMs: median(row.samplesMs), medianCpuMs: median(row.samplesCpuMs) }))
    const first = measured[0], last = measured.at(-1)
    const memory = reader === 'rs' ? last.samplesAllocatedBytes : last.samplesPeakManagedBytes
    assert.equal(memory.length, 5)
    rows.push(`| ${reader} | ${family} | ${mode} | ${first.size} to ${last.size} | ${fixed(first.medianMs)} / ${fixed(last.medianMs)} | ${fixed(last.medianCpuMs)} | ${fixed(fitExponent(measured))} | ${(last.htmlBytes / 1024).toFixed(1)} | ${(median(memory) / 1024).toFixed(1)} |`)
  }
}
const text = `# Rust and PHP phase scaling

Recorded ${data.metadata.generatedAt}. Rust uses commit \`${pins.rs.commit}\`;
PHP uses \`${pins.php.commit}\`. The [raw batches](runtime-timings.json) retain
wall and CPU samples, memory observations, source pins and build hashes.

Each phase is measured independently. Render reuses a parsed tree; HTML uses
the default conversion API and can take its fast route. Do not add phase timings.
PHP uses a clean INI with JIT disabled, unlike the tracing-JIT throughput
benchmarks in carve-bench. These measurements do not establish a runtime ranking.

## Endpoints and observed growth

The exponent is a log-log fit of wall time against input bytes over the recorded
sizes. It describes these samples, not a proven complexity bound. Tiny timings,
GC and scheduling can distort the fit. Nested inputs verify the requested depth.
Pretty-printed nested HTML grows with indentation as well as node count. The
HTML size column records that output cost; superlinear growth against source
bytes alone does not prove avoidable renderer work.

The final column has different units by reader: Rust reports total requested
allocation KiB per call, including reallocations; PHP reports peak managed
growth KiB above its pre-call baseline. Neither is retained memory or RSS,
and the columns cannot be compared as allocation totals.

Definitions recorded by the measurement runner:

- Rust: ${data.metadata.memory.rs}
- PHP: ${data.metadata.memory.php}

| Reader | Family | Phase | Repeat count / depth | First / last wall ms | Last CPU ms | Observed exponent | Last HTML KiB | Last memory KiB |
|---|---|---|---|---:|---:|---:|---:|---:|
${rows.join('\n')}

## Method

${data.metadata.method}

This is a local shared-host run. Host load was ${data.metadata.loadStart.join(', ')} at the start and
${data.metadata.loadEnd.join(', ')} at the end on ${data.metadata.logicalCpus}
logical CPUs. Compare candidate changes with
alternating baseline runs before making a speed claim.

Reproduce with \`npm run build:runtime\`, \`npm run bench:runtime\` and
\`npm run report:runtime\`. The [JavaScript comparison](comparison.md) and
[CPU and allocation profiles](current-costs.md) cover the separately pinned JS reader.
`
writeFileSync(new URL('../../reports/runtime-scaling.md', import.meta.url), text)
