import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { comparisonEnvironment, digest, costFiles } from '../comparison/environment.mjs'
import { scalingCases } from '../comparison/scaling-cases.mjs'
import { aggregateFrames } from './summary.mjs'
const median = values => {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

import { costFamilies as families, checkControls, costVariants } from '../comparison/controls.mjs'
import { createHash } from 'node:crypto'
import { validateExecution } from '../comparison/validate-execution.mjs'
export function validateCostData(data) {
  validateExecution(data.metadata.execution)
  const environment = comparisonEnvironment()
  assert.deepEqual(data.metadata.parsers, environment.parsers)
  assert.equal(data.metadata.engine, environment.engine)
  assert.equal(data.metadata.runnerSha256, digest(costFiles))
  assert.deepEqual(data.metadata.controls, checkControls())
  const expected = families.flatMap(family => ['parse', 'html', 'direct-html-probe'].flatMap(phase => costVariants(phase).map(variant => `${family}/${phase}/${variant}`)))
  assert.deepEqual(data.groups.map(g => `${g.family}/${g.phase}/${g.variant}`), expected)
  for (const group of data.groups) {
    const fixture = scalingCases[group.family]
    assert.equal(group.size, fixture.sizes.at(-1))
    assert.equal(group.bytes, Buffer.byteLength(fixture.make(group.size)))
    assert.equal(group.rounds.length, 2)
    assert.deepEqual(group.rounds.map(r => r.round), [0, 1])
    for (const round of group.rounds) {
      const order = costVariants(group.phase)
      assert.deepEqual(round.order,round.round === 0 ? order : [...order].reverse())
      for (const field of ['variant', 'phase', 'family', 'htmlPath', 'size', 'bytes']) assert.equal(round[field], group[field])
      for (const load of [round.loadStart, round.loadEnd]) {
        assert.equal(load.length, 3)
        assert.ok(load.every(value => Number.isFinite(value) && value >= 0))
      }
      assert.equal(round.sourceSha256, createHash('sha256').update(fixture.make(group.size)).digest('hex'))
      assert.equal(round.samples.length, 7)
      assert.equal(round.heapIterations, 50)
      assert.ok(round.cpuIterations > 0)
      assert.equal(round.sampledAllocationBytes, round.heapNodes.reduce((sum, frame) => sum + frame.sampledBytes, 0))
    }
    assert.deepEqual(group.samples, group.rounds.flatMap(r => r.samples))
    assert.equal(group.cpuIterations, group.rounds.reduce((sum, r) => sum + r.cpuIterations, 0))
    assert.deepEqual(group.cpuSamples, aggregateFrames(group.rounds.flatMap(r => r.cpuSamples), 'selfUs'))
    assert.deepEqual(group.heapNodes, aggregateFrames(group.rounds.flatMap(r => r.heapNodes), 'sampledBytes'))
    assert.equal(group.sampledAllocationBytes, group.rounds.reduce((sum, r) => sum + r.sampledAllocationBytes, 0))
    assert.ok(group.variant.startsWith('carve') ? ['direct', 'ast'].includes(group.htmlPath) : group.htmlPath === null)
    assert.equal(group.samples.length, 14)
    for (const sample of group.samples) {
      assert.ok(Number.isInteger(sample.iterations) && sample.iterations > 0)
      assert.ok(Number.isFinite(sample.wallMs) && sample.wallMs > 0)
      assert.ok(Number.isFinite(sample.cpuMs) && sample.cpuMs >= 0)
    }
    if (group.phase === 'direct-html-probe') {
      const full = data.groups.find(g => g.family === group.family && g.phase === 'html' && g.variant === 'carve')
      assert.equal(group.htmlPath,full.htmlPath)
    }
    assert.equal(group.heapIterations, 100)
    assert.equal(group.sampledAllocationBytes, group.heapNodes.reduce((sum, frame) => sum + frame.sampledBytes, 0))
    assert.ok(group.cpuIterations > 0 && group.cpuSamples.length > 0)
  }
}

export function costReport(data) {
  const previousReader = JSON.parse(readFileSync(new URL('../../reports/history/pre-engine-performance/comparison-results.json', import.meta.url))).metadata.engine.split('#')[1]
  validateCostData(data)
  const fixed = number => number > 0 && number < 0.0005 ? number.toExponential(2) : number.toFixed(3)
  const sample = (g, field) => g.rounds.map(r => `${fixed(median(r.samples.map(s => s[field])))} (${fixed(Math.min(...r.samples.map(s => s[field])))}–${fixed(Math.max(...r.samples.map(s => s[field])))})`).join(' / ')
  const timingRows = data.groups.map(g => `| ${g.family} | ${g.phase} | ${g.variant} | ${sample(g, 'wallMs')} | ${g.rounds.map(r => fixed(median(r.samples.map(s => s.cpuMs)))).join(' / ')} | ${(g.sampledAllocationBytes / g.heapIterations / 1024).toFixed(1)} |`).join('\n')
  const hot = data.groups.filter(g => g.variant === 'carve').map(g => {
    const cpu = g.cpuSamples.filter(f => f.file.startsWith('node_modules/carve-comparison/')).slice(0, 3)
    const heap = g.heapNodes.slice(0, 3)
    return `| ${g.family} | ${g.phase} | ${cpu.map(f => `\`${f.function}\` ${(f.selfUs / 1000 / g.cpuIterations).toFixed(3)} ms/op`).join('; ')} | ${heap.map(f => `\`${f.function}\` ${(f.sampledBytes / g.heapIterations / 1024).toFixed(1)} KiB/op`).join('; ')} |`
  }).join('\n')
  const htmlPaths = ['direct', 'ast'].map(path => `${path}: ${data.groups.filter(g => g.variant === 'carve' && g.phase === 'html' && g.htmlPath === path).map(g => g.family).join(', ') || 'none'}`).join('; ')
  const pin = data.metadata.engine.split('#')[1], source = `https://github.com/markup-carve/carve-js/blob/${pin}/src`
  return `# Current reader cost investigation

Recorded at ${data.metadata.generatedAt}, using Carve JS \`${pin}\` and the
Djot/CommonMark package versions in the [raw observations](current-costs.json).
The [cross-reader timing report](comparison.md) and this longer-sample run are
separate experiments. Their absolute timings must not be spliced together.

## Position options, phases and allocation

Wall cells show round 1 / round 2 median (minimum–maximum), not confidence
intervals. CPU cells also keep the rounds separate and show process
CPU time, including worker threads. Allocation is sampled churn per operation,
including collected objects; it is neither retained heap nor peak RSS. Timing
medians retain each fresh worker's seven batches; pooling would hide the large
drift between rounds. CPU profiles and allocation combine both rounds and divide
by their total operation counts. These timings do not support speed rankings.

| Fixture | Phase | Variant | Wall ms, round 1 / 2 median (min–max) | CPU ms, round 1 / 2 median | Sampled allocation KiB/op |
|---|---|---|---:|---:|---:|
${timingRows}

Carve's [positions option](${source}/source-positions.ts) removes fields from the
finished tree. It still constructs positions during parsing and skips the final
codepoint conversion when disabled. Treat it as an output-shape option, not a
switch that removes all positioning work. Disabling positions can cost more
than keeping them because removing fields adds work. Djot's sourcePositions option enables
its position tracking. These variants expose costs; their position formats and
feature sets are not identical.

The [HTML entrypoint](${source}/index.ts) tries a direct HTML path before building
an AST. Untimed probes record which path accepts each fixture and check direct
output against the public HTML entrypoint: ${htmlPaths}. An AST fallback still
pays for the rejected direct-path attempt. The \`direct-html-probe\` phase measures
that attempt independently, including declines, without running the AST fallback. Accepted probes include direct HTML generation. Rejected probes stop before
the AST fallback. Choosing that fallback does not remove the earlier attempt.
The phases must not be added or interpreted as a single pipeline breakdown.

## Sampled hotspots

Self time per operation below comes from separate CPU profiles, divided by the
number of calls in those profile windows, not from the timing batches. Runtime
and profiler frames are omitted from the CPU shortlist. Heap frames include
runtime allocation sites. Full frame locations remain in the JSON; line numbers
refer to installed JavaScript, not the linked TypeScript.

| Fixture | Phase | Largest Carve CPU frames, sampled self ms/op | Largest allocation frames |
|---|---|---|---|
${hot}

## Next implementation work

1. Select the remaining CPU and allocation targets from the recorded frames
   above. Recheck the direct HTML eligibility scan and rejected attempts before
   AST fallback using the current reader, rather than the older hotspot list.
2. Separate position construction, node allocation, and rendering work with
   focused inputs. The position variants here remove fields after parsing;
   they do not measure a parser that avoids constructing source positions.
3. Measure container state and buffer allocation at each nesting depth while
   preserving independent mutable state between containers.

This reader includes parser allocation changes since the preceding reader
commit \`${previousReader}\`.
The current profile records their resulting costs. The preceding snapshot used
a different host and cannot isolate a reader speed improvement.
Ownership uses the commits in \`scripts/ownership/pins.json\`, with its separate
test scope. The comparison uses the reader recorded above. The original model and historical baselines retain their pins.

## Method and limits

${data.metadata.method}

Host load averaged ${data.metadata.loadStart.join(', ')} at the start and
${data.metadata.loadEnd.join(', ')} at the end on ${data.metadata.logicalCpus}
logical CPUs. ${data.metadata.execution.controlled ? `The dedicated [workflow run](${data.metadata.execution.runUrl}) ran workers serially and rejected load above the available CPU count.` : 'This was a shared-host run.'} Scheduling, JIT state and GC can
change ratios, even with reversed variant order. Overlapping sample ranges do
not establish an ordering. Confirm improvements with controlled paired runs before setting
budgets. Position-variant trees are checked against their default reader after
removing position fields, outside the measured operations.

Reproduce with \`npm run profile:costs\` and \`npm run report:costs\`.
The site's "Current costs and positions" dataset provides charts and exact exports.
`
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const data = JSON.parse(readFileSync(new URL('../../reports/current-costs.json', import.meta.url)))
  writeFileSync(new URL('../../reports/current-costs.md', import.meta.url), costReport(data))
}
