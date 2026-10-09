import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { comparisonEnvironment, digest } from '../comparison/environment.mjs'
import { median, aggregateFrames, regexTotals } from './summary.mjs'
import { validateExecution } from '../comparison/validate-execution.mjs'
const read = name => JSON.parse(readFileSync(new URL('../../reports/' + name, import.meta.url)))
const data = read('nesting-profile.json'), before = read('history/pre-prefix-refresh/nesting-profile.json'), current = comparisonEnvironment()
validateExecution(data.metadata.execution)
assert.deepEqual(data.metadata.parsers, current.parsers)
assert.equal(data.metadata.specCommit, current.specCommit)
assert.equal(data.metadata.specDirty, false)
assert.equal(data.metadata.runnerSha256, digest(['scripts/profiling/run.mjs', 'scripts/profiling/worker.mjs', 'scripts/profiling/instrument.mjs', 'scripts/profiling/summary.mjs', 'scripts/comparison/measurement-host.mjs']))
assert.deepEqual(data.groups.map(g => `${g.reader}/${g.phase}/${g.family}/${g.size}`).sort(), ['js', 'spec'].flatMap(r => ['parse', 'render'].flatMap(p => ['quotes', 'lists'].flatMap(f => [32, 64, 128, 192].map(n => `${r}/${p}/${f}/${n}`)))).sort())
assert.ok(data.groups.every(g => !g.error))
const get = (report, reader, phase, family, size) => report.groups.find(g => g.reader === reader && g.phase === phase && g.family === family && g.size === size)
const fixed = n => n.toFixed(2)
const time = g => median(g.samples.map(s => s.wallMs))
const allocation = g => g.sampledAllocationBytes / g.heapIterations / 1024
const changes = ['quotes', 'lists'].map(family => {
  const old = get(before, 'js', 'parse', family, 192), now = get(data, 'js', 'parse', family, 192)
  const a = regexTotals(old.patterns), b = regexTotals(now.patterns)
  assert.ok(b.calls < a.calls / 2, 'Review the recorded prefix-work improvement')
  return `| ${family} | ${a.calls} → ${b.calls} | ${fixed(100 * (1 - b.calls / a.calls))}% | ${fixed(allocation(old))} → ${fixed(allocation(now))} |`
}).join('\n')
const preceding = read('history/pre-engine-performance/nesting-profile.json')
const recentChanges = ['quotes', 'lists'].map(family => {
  const old = regexTotals(get(preceding, 'js', 'parse', family, 192).patterns).calls
  const now = regexTotals(get(data, 'js', 'parse', family, 192).patterns).calls
  return `${family}: ${old} → ${now} (${now - old >= 0 ? '+' : ''}${now - old})`
}).join('; ')
const growth = ['js', 'spec'].flatMap(reader => ['quotes', 'lists'].map(family => {
  const low = get(data, reader, 'parse', family, 64), high = get(data, reader, 'parse', family, 128), last = get(data, reader, 'parse', family, 192)
  const a = regexTotals(low.patterns), b = regexTotals(high.patterns)
  if (reader === 'js') assert.ok(b.calls <= a.calls * 2.1, 'Review the near-doubling call-growth observation')
  return `| ${reader} | ${family} | ${a.calls} → ${b.calls} | ${fixed(b.calls / a.calls)}× | ${a.inputChars} → ${b.inputChars} | ${fixed(time(last))} | ${fixed(time(get(data, reader, 'render', family, 192)))} |`
})).join('\n')
const spanRows = ['js', 'spec'].flatMap(reader => ['quotes', 'lists'].map(family => {
  const groups = [64, 128].map(size => get(data, reader, 'parse', family, size))
  groups.forEach(g => regexTotals(g.patterns))
  if (reader === 'js') {
    const spans = groups.map(g => g.patterns.reduce((n, p) => n + p.matchedChars, 0))
    assert.ok(spans[0] > 0 && spans[1] <= spans[0] * 2.1, 'Review successful match growth')
    assert.ok(groups.every(g => g.suffixes.suffixChars === 0), 'Review suffix comparisons')
  }
  const sum = field => groups.map(g => g.patterns.reduce((n, p) => n + p[field], 0)).join(' → ')
  return `| ${reader} | ${family} | ${sum('matchedChars')} | ${sum('globalAdvance')} | ${groups.map(g => g.suffixes.suffixChars).join(' → ')} |`
})).join('\n')
const allocationRows = ['js', 'spec'].flatMap(reader => ['quotes', 'lists'].map(family => `| ${reader} | ${family} | ${[64, 128, 192].map(size => fixed(allocation(get(data, reader, 'parse', family, size)))).join(' | ')} |`)).join('\n')
const sourceUrl = file => file.startsWith('spec/') ? `https://github.com/markup-carve/carve/blob/${current.specCommit}/${file.slice(5)}` : file.startsWith('node_modules/carve-comparison/') ? `https://github.com/markup-carve/carve-js/blob/${current.engine.split('#')[1]}/${file.replace('node_modules/carve-comparison/dist/', 'src/').replace(/\.js$/, '.ts')}` : null
const hotspots = ['js', 'spec'].flatMap(reader => ['quotes', 'lists'].map(family => {
  const g = get(data, reader, 'parse', family, 192)
  const frames = aggregateFrames(g.cpuSamples, 'selfUs').filter(n => sourceUrl(n.file)).slice(0, 3)
  const heap = aggregateFrames(g.heapNodes, 'sampledBytes').slice(0, 3)
  return `### ${reader}: ${family}\n\n${frames.map(n => `- [\`${n.function}\`](${sourceUrl(n.file)}): ${fixed(n.selfUs / 1000)} ms sampled self time at \`${n.file}:${n.line}\`.`).join('\n')}\n\nLargest sampled allocation frames: ${heap.map(n => `\`${n.function}\` (${fixed(n.sampledBytes / g.heapIterations / 1024)} KiB/call)`).join(', ')}.`
})).join('\n\n')
const text = `# Nested-container profiling

The refreshed JavaScript reader already contains quote-state reuse and prefix
memoization. At depth 192, both quote and list parsing use fewer than half the
regex calls recorded by the earlier reader. The historical
[profile](history/pre-prefix-refresh/nesting-profile.json) and
[report](history/pre-prefix-refresh/nesting-profile.md) remain available.

This reader snapshot was recorded at ${data.metadata.generatedAt}.
The immediately preceding [profile](history/pre-engine-performance/nesting-profile.json)
and [report](history/pre-engine-performance/nesting-profile.md) preserve the prior reader.

Current JS pin: \`${current.engine.split('#')[1]}\`.
Earlier JS pin: \`${before.metadata.engine.split('#')[1]}\`.
The executable specification remains pinned separately to
\`${current.specCommit}\`; its measurements do not describe the latest specification.
The model's JS dependency also stays at its original pin. The comparison uses
the separately locked \`carve-comparison\` dependency.

## Recorded change at depth 192

| Family | Regex calls, before → after | Call reduction | Sampled allocation KiB/call, before → after |
|---|---:|---:|---:|
${changes}

Regex calls are deterministic observations under the same instrumentation.
Allocation estimates come from separate hosts and remain subject to sampling
variation. The current data comes from the recorded workflow runner; the
earlier data came from a shared host. Wall times are shown only for the current
run below. This comparison does not isolate the effect of parser changes.

The relevant changes landed in
[quote-state reuse](https://github.com/markup-carve/carve-js/pull/2259) and
[prefix classification reuse](https://github.com/markup-carve/carve-js/pull/2274)
before this refresh.
The current reader also replaces repeated quote and unordered-list tail captures
with prefix recognition and reuses recorded origins for literal prefix strips.

Against the immediately preceding snapshot, regex calls at depth 192 changed by
${recentChanges}. These net changes are recorded separately from the larger
historical reduction. Operation counts do not establish a wall-time change.

## Current growth and phase costs

| Reader | Family | Regex calls, depth 64 → 128 | Call growth | Regex input exposure, 64 → 128 | Parse wall ms, 192 | Render wall ms, 192 |
|---|---|---:|---:|---:|---:|---:|
${growth}

Input exposure charges the complete input for every regex call, including failed
anchored checks and global matches that resume at the previous match. For example,
matching each quote marker in a 256-character prefix with a global regex makes
129 calls, charging 33,024 input characters while advancing through 256.

| Reader | Family | Successful match lengths, 64 → 128 | Global forward progress, 64 → 128 | Suffix argument lengths, 64 → 128 |
|---|---|---:|---:|---:|
${spanRows}

Lengths use JavaScript UTF-16 code units. Successful match lengths sum complete
matches, without adding capture groups. Global forward progress includes the
remaining range on a failed global search; it excludes sticky regexes. Suffix
lengths count string arguments passed to \`endsWith\` in a separate parse.
Non-string regex inputs run unchanged and are excluded from these counters.
None of these lengths measures engine steps or proves whole-parser complexity.
Failed non-global scans and non-regex prefix operations are outside the matched-span
and global-progress counters. Regression tests separately bound input supplied
to the terminator scan.
The simple JavaScript fixtures show near-doubling successful match lengths
and no suffix comparisons. Input exposure still grows roughly fourfold because
many bounded prefix checks receive each remaining line.

The parse and render phases are independent runs. JavaScript parsing includes
source positions. Specification parsing produces block layout, while its
renderer also interprets inline content. Those phases do different work.

## Allocation and sampled frames

V8 heap sampling estimates allocation churn, including collected objects. It
does not measure retained heap or peak memory.

| Reader | Family | Parse KiB/call, 64 | Parse KiB/call, 128 | Parse KiB/call, 192 |
|---|---|---:|---:|---:|
${allocationRows}

${hotspots}

Frame times are aggregated self samples across recursive paths. Runtime line
numbers refer to installed JavaScript, not the linked TypeScript source.

## Regression coverage

The simple depth fixtures retain reviewed regex ceilings with 5% headroom.
A drop below half the recorded baseline requires review to distinguish an
improvement from instrumentation that stopped observing work. JavaScript also
checks call growth across depths 64, 128 and 192. These guards cover selected
regex work, not every operation in the parser.

The [expanded container suite](container-regressions.json) adds 112 distinct cases across
lazy lines, tables, fences, definitions, tabs, Unicode, comments and headings.
It checks quote, list and mixed wrappers through depth 16, exact terminal source
coordinates, full-AST and HTML fingerprints, preserved unwrapped payload structure and
reference destinations, and identical trees with and without
instrumentation. The [scoped contracts](comparison-contracts.json) separately
check wrapping, closed-block append behavior, references and nested payloads.

## Method and reproduction

${data.metadata.method}

Node ${data.metadata.node}; ${data.metadata.cpu}; ${data.metadata.logicalCpus} logical CPUs.
Host load at completion: ${data.metadata.loadEnd.join(', ')}.
Timing and sampling run before regex instrumentation. Patching regex execution
can disable V8 fast paths, so instrumented call counts do not measure native
instruction cost. Full inspector call trees are not retained.

\`\`\`sh
npm run profile:nesting
npm run report:profiling
npm run check:containers -- --check reports/container-regressions.json
node --test tests/profiling.test.mjs tests/comparison-contracts.test.mjs
\`\`\`
`
writeFileSync(new URL('../../reports/nesting-profile.md', import.meta.url), text)
