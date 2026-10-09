import assert from 'node:assert/strict'
import { paragraphs, fragments, references, completed, suffixes } from './properties/cases.mjs'
import { scalingCases } from './properties/scaling-cases.mjs'
import { expectedRefusal, runnerDigest } from './properties/benchmark-results.mjs'
import { validateProofSource } from './layout-proof-check.mjs'
import { checkFindings } from './property-check.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
const read = name => JSON.parse(readFileSync(new URL('../reports/' + name, import.meta.url)))
const properties = read('property-results.json')
const scaling = read('scaling-results.json')
const confirmation = read('scaling-confirmation.json')
const findings = read('property-findings.json')
const proofCount = validateProofSource(readFileSync(new URL('../proofs/layout/Ownership.v', import.meta.url), 'utf8')).length
checkFindings(properties.rows, findings)
assert.ok(Object.values(findings).every(f => f.classification === 'exception'), 'Review report wording for new failure classifications')
assert.equal(scaling.groups.length, 28, 'The report requires the full scaling run')
assert.equal(confirmation.groups.length, 8, 'The report requires both nesting confirmation families')
for (const data of [scaling, confirmation]) {
  for (const key of ['specCommit', 'engine', 'installedEngine']) assert.equal(data.metadata[key], properties.metadata[key], `Report mixes ${key}`)
  assert.equal(data.metadata.specDirty, false, 'Report requires a clean pinned specification')
  assert.equal(data.metadata.runnerSha256, runnerDigest(), 'Rerun measurements after benchmark source changes')
  for (const key of ['node', 'cpu', 'platform', 'arch', 'release']) assert.equal(data.metadata[key], scaling.metadata[key], `Confirmation changed ${key}`)
  const families = data === scaling ? Object.keys(scalingCases) : ['nested-quotes', 'nested-lists']
  const expected = ['js', 'spec'].flatMap(r => ['parse', 'html'].flatMap(m => families.map(f => `${r}/${m}/${f}`))).sort()
  assert.deepEqual(data.groups.map(g => `${g.reader}/${g.mode}/${g.family}`).sort(), expected)
  for (const g of data.groups) assert.ok(g.completed || expectedRefusal(g), 'Review unexpected incomplete measurements before reporting')
}
assert.equal(properties.metadata.specDirty, false)

const count = (family, reader, outcome) => properties.rows.filter(r => r.family === family && r.reader === reader && (!outcome || r.outcome === outcome)).length
const fraction = (family, reader) => `${count(family, reader, 'equal')}/${count(family, reader)}`
const group = (data, reader, mode, family) => data.groups.find(g => g.reader === reader && g.mode === mode && g.family === family)
const ratio = (data, reader, mode, family) => {
  const rows = group(data, reader, mode, family).rows.filter(r => r.status === 'ok')
  return (rows.at(-1).medianMs / rows[0].medianMs).toFixed(2)
}
const fixed = n => n.toFixed(2)
const specUrl = `https://github.com/markup-carve/carve/blob/${properties.metadata.specCommit}/resources/spec/`
const flatRows = ['long-line', 'unmatched-closers', 'unclosed-code', 'many-paragraphs'].map(family => {
  const rows = group(scaling, 'js', 'html', family).rows
  return `| ${family} | ${rows[0].bytes} → ${rows.at(-1).bytes} | ${ratio(scaling, 'js', 'html', family)}× | ${ratio(scaling, 'spec', 'html', family)}× |`
}).join('\n')
const depthRows = ['js', 'spec'].flatMap(reader => ['parse', 'html'].flatMap(mode => ['nested-quotes', 'nested-lists'].map(family => {
  const measured = group(scaling, reader, mode, family), repeated = group(confirmation, reader, mode, family)
  const low = measured.rows.find(r => r.size === 64), high = measured.rows.find(r => r.size === 128), last = measured.rows.find(r => r.size === 192)
  assert.equal(low.bytes, 132); assert.equal(high.bytes, 260); assert.equal(last.bytes, 388)
  const repeatLow = repeated.rows.find(r => r.size === 64), repeatHigh = repeated.rows.find(r => r.size === 128)
  return `| ${reader} ${mode} | ${family} | ${fixed(low.medianMs)} → ${fixed(high.medianMs)} | ${fixed(high.medianMs / low.medianMs)}× | ${fixed(repeatHigh.medianMs / repeatLow.medianMs)}× | ${fixed(last.medianMs)} | ${fixed(measured.fittedExponent)} / ${fixed(repeated.fittedExponent)} |`
}))).join('\n')
for (const reader of ['js', 'spec']) {
  assert.equal(count('wrapping', reader, 'different'), 14, 'Review wrapping explanation for changed cases')
  assert.equal(properties.rows.filter(r => r.reader === reader && r.family === 'wrapping' && r.outcome === 'different' && /^(code|codeFence|rawFence)@/.test(r.id)).length, 7)
  assert.equal(properties.rows.filter(r => r.reader === reader && r.family === 'wrapping' && r.outcome === 'different' && r.id.startsWith('comment@')).length, 4)
  assert.equal(count('stability', reader, 'different'), 4, 'Review stability explanation for changed cases')
}
assert.match(readFileSync(new URL('../spec/scripts/spec/render.mjs', import.meta.url), 'utf8'), /const MAX_NESTING_DEPTH = 200\b/)

const text = `# Carve property and scaling report

Recorded ${scaling.metadata.generatedAt.slice(0, 10)} against specification
\`${properties.metadata.specCommit}\` and JS engine
\`${properties.metadata.engine.split('#')[1]}\`.

The suite records ${properties.rows.length} observations of the JS engine and
executable specification. ${Object.keys(findings).length} observations contradict
the broad wrapping or earlier-block stability claims; each follows an explicit
Carve rule and is recorded as a specification exception. No unexplained
functional difference remains in this sample. Timing measurements identify
nested-container growth as a follow-up target. These engine checks add no Rocq
theorems; the existing ${proofCount} ownership theorems have a narrower scope.

The test questions come from [Djot discussion #414](https://github.com/jgm/djot/discussions/414).
They are evaluated against Carve rules; differences from a proposed Djot
guarantee are not automatically Carve defects.

## Functional results

Comparisons remove source positions, byte lengths and raw reference spelling.
They merge adjacent text and treat soft line breaks as spaces. Code-span bytes,
hard breaks, node types, attributes and block structure remain significant.
The specification projection also compares rendered inline fragments, preserving
code newlines and reference identity while removing raw reference spelling.
It is a projection for these fixtures, not a general HTML equivalence checker.

Each fraction counts equal before/after observations. Controls deliberately
expect some differences and are reported separately.

| Property | JS | Executable specification | Result |
|---|---:|---:|---|
| Wrapping at each selected space | ${fraction('wrapping', 'js')} | ${fraction('wrapping', 'spec')} | Broad guarantee does not hold |
| Container payload consistency | ${fraction('containers', 'js')} | ${fraction('containers', 'spec')} | All sampled wrappers preserve payload and definitions |
| Reference syntax locality | ${fraction('locality', 'js')} | Not exposed as an inline AST | Syntax classifications stay stable |
| Earlier-block stability after appended source | ${fraction('stability', 'js')} | ${fraction('stability', 'spec')} | Captions and list extension change earlier blocks |

Wrapping covers ${Object.keys(paragraphs).length} paragraph forms, replacing each individual ASCII space with
a newline: prose, Unicode, emphasis, links, reference links, code, markers,
attributes, comments and definition-shaped text. The fourteen changes per
reader comprise seven breaks in code-span content, four comment changes,
heading and quote interruptions, and a newly recognized footnote definition.
Unclosed backticks are code spans in Carve, so their whitespace is content.
The marker and attribute samples preserve their interpretation. This does not
establish safety for arbitrary combinations or for multiple simultaneous wraps.
See [code spans](${specUrl}06-inline-links-images.ebnf),
[paragraph interruption](${specUrl}14-semantics-blocks.ebnf), and
[comments](${specUrl}16-semantics-comments-security.ebnf).

Container comparisons use ${Object.keys(fragments).length} fragments inside a quote, list item,
quote containing a list, and list containing a quote. They compare unwrapped
payload trees and definition state, including code, paragraphs, headings,
lists, comments, tables, divs and reference definitions. Hoisted reference
definitions are compared separately from visible blocks. The cases use spaces,
not tab prefixes, and sample two wrapper levels rather than arbitrary nesting.

Locality uses ${Object.keys(references).length} reference-like forms with matching, changed and unrelated
definitions. Resolved reference destinations and titles are excluded from the syntax
projection, while node types, labels, authored attributes and child structure remain. ${count('resolution-control', 'js') + count('resolution-control', 'spec')} rendering controls across
both readers inspect the first paragraph and assert the reference element and
target directly. The changed-definition cases compare an existing definition
with its replacement. They verify the complementary behavior: matching definitions change
full/collapsed links, images and footnotes, while unrelated definitions and
literal/code controls do not. Changing footnote body text leaves its reference
element unchanged; the reference comparison excludes the endnote body. Bare \`[ref]\` stays literal because Carve has no
shortcut reference links. The specification checker has no exposed inline AST
for a separate locality check; its rendering controls are not counted as such.

The append checks combine ${Object.keys(completed).length} prefixes and ${Object.keys(suffixes).length} suffixes. The four changes
per reader are a sibling list item extending a list and changing tightness,
and captions attaching to a code block, quote or table. One blank line does not
finalize these objects. Explicit intervening headings provide closed-list and
closed-quote controls. Four further controls show that adding matching code or
comment fence closers can reclassify earlier source. See
[caption placement](${specUrl}13-semantics-foundations.ebnf),
[list tightness](${specUrl}15-semantics-resolution-rendering.ebnf), and
[fence lookahead](${specUrl}14-semantics-blocks.ebnf).

## Scaling results

The main run covers ${Object.keys(scalingCases).length} input families with parse-only and full HTML entry
points for each reader. The specification's parse-only API handles block layout;
the JS parse API also builds inline nodes, so their parse timings measure
different work. JS HTML also has an optimized fast path, which can make it
faster than its public parse API on simple paragraphs.

For flat inputs, the following table compares the first and last median full
HTML times. Input sizes grow by roughly eightfold. The host was heavily loaded, so these ratios are exploratory measurements
and cannot establish a scaling bound.

| Input family | Input bytes | JS HTML time growth | Spec HTML time growth |
|---|---:|---:|---:|
${flatRows}

Some nested-container samples grow faster than their input size. From depth 64 to 128, input
grows from 132 to 260 bytes. A separate run repeats those measurements. Depth 192 adds another point below
the readers' nesting limit. The fitted exponent uses all six depths from 8 to
192 in a log(time)-against-log(bytes) least-squares fit:

| Reader and entry point | Input | Median ms, depth 64 → 128 | First run growth | Repeat growth | Median ms at 192 | Fitted exponent, first/repeat |
|---|---|---:|---:|---:|---:|---:|
${depthRows}

The repeated local growth warrants profiling, especially for the specification's
nested layout parser. Scheduling noise and small-depth overhead
can flatten the fitted exponent. These results do not establish one growth
rate for every nested input or prove an asymptotic complexity class.
Existing layout counters remain linear on these same inputs: JS counts 132
then 260 seam characters, and the specification's selected visits/views also
grow linearly. Those counters omit other work. The regression tests bound only
the instrumented operations; they do not establish a whole-parser time bound.

The specification HTML path accepts unmatched opening-bracket runs through the
sample at 128, then explicitly refuses the sample at 256 with
\`inline nesting exceeds MAX_NESTING_DEPTH\`. Its inline checker sets the limit
to 200. The 1024 sample is skipped in that group after refusal. JS accepts the
sampled runs through 1024 as literal content. This is a checker capacity limit,
not a crash or a timing success. All other benchmark groups completed.

Measurements used ${scaling.metadata.node} on ${scaling.metadata.platform}
${scaling.metadata.arch}, ${scaling.metadata.cpu}. Worker processes run serially;
startup and source generation are excluded. Each size gets two warmups and
five batches of 1–32 calls, with GC before batches. Every group has a 60-second
wall-clock deadline including startup. Timing is machine-dependent and the
host is not isolated. Load averages at completion were ${scaling.metadata.loadAverage.map(fixed).join(', ')}
(1, 5 and 15 minutes) on ${scaling.metadata.logicalCpus} logical CPUs; scheduling interference can distort ratios.
An earlier run timed out on the specification's unmatched-closer HTML case
under a 30-second deadline; the recorded run uses 60 seconds.
No timing ratio is a CI pass/fail threshold. RSS values
are cumulative process peaks. Raw samples, counters, pins and a runner digest
are stored with the measurements.

## Reproduce and maintain

\`npm test\` runs the behavioral regressions, comparison checks and selected
layout-work budgets. Success means observations match their reviewed
expectations, including the listed exceptions. A changed or newly introduced
exception fails rather than silently entering the baseline.

\`\`\`sh
npm run check:properties -- --output reports/property-results.json
npm run bench:scaling -- reports/scaling-results.json
npm run bench:scaling -- reports/scaling-confirmation.json nested-quotes,nested-lists
npm run report:properties
npm run proof:layout
\`\`\`

The regular workflow compares fresh rows with the committed observations,
regenerates this Markdown report to detect drift, and uploads fresh observations.
Proof checks run before optional timing measurements.
A manual workflow run can enable the timing benchmark. Unexpected
errors, timeouts or refusal changes make that command fail. The existing bracket
limit is recorded explicitly. Full timings are excluded from ordinary CI gates.

Raw data: [property observations](property-results.json),
[reviewed exceptions](property-findings.json), [main measurements](scaling-results.json),
and [nesting confirmation](scaling-confirmation.json).

The next investigation is to profile work not represented by the nesting
counters. For formatter and extension design, the useful contracts are wrapping
outside code/comment content and interrupting line starts, and stable blocks
after their attachment opportunities have ended. Container and locality checks
should grow with each new syntax feature. PHP and Rust remain outside this run.
`
writeFileSync(new URL('../reports/properties.md', import.meta.url), text)
