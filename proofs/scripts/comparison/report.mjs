import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { comparisonEnvironment, digest, comparisonFiles } from './environment.mjs'
import { scalingCases } from './scaling-cases.mjs'
import { validateTimings } from './validate-timings.mjs'
const read = file => JSON.parse(readFileSync(new URL('../../reports/' + file, import.meta.url)))
const data = read('comparison-results.json'), timing = read('comparison-timings.json'), current = comparisonEnvironment()
assert.deepEqual(data.metadata, { ...current, suiteSha256: digest(comparisonFiles) })
assert.deepEqual(timing.metadata.parsers, current.parsers)
validateTimings(timing)
const contractData = read('comparison-contracts.json'), containers = read('container-regressions.json')
const historical = read('history/pre-prefix-refresh/comparison-results.json')
const historicalRows = new Map(historical.rows.map(row => [`${row.reader}/${row.family}/${row.id}`, row]))
const changedObservations = data.rows.filter(row => JSON.stringify(row) !== JSON.stringify(historicalRows.get(`${row.reader}/${row.family}/${row.id}`))).length
const removedObservations = historical.rows.filter(row => !data.rows.some(now => now.reader === row.reader && now.family === row.family && now.id === row.id)).length
assert.ok(contractData.rows.every(r => r.expected === r.outcome))
const readers = ['carve', 'djot', 'commonmark'], families = Object.keys(scalingCases)
assert.deepEqual(timing.groups.map(g => `${g.reader}/${g.mode}/${g.family}`).sort(), readers.flatMap(r => ['parse', 'render', 'html'].flatMap(m => families.map(f => `${r}/${m}/${f}`))).sort())
assert.ok(timing.groups.every(g => g.completed && g.rows.every(r => r.status === 'ok')))
assert.equal(data.rows.length, 420)
for (const [reader, expected] of [['carve', ['code', 'unclosedCode', 'unclosedCode', 'heading', 'quote']], ['djot', ['code', 'unclosedCode', 'unclosedCode']], ['commonmark', ['bullet', 'ordered', 'heading', 'quote']]]) {
  assert.deepEqual(data.rows.filter(r => r.reader === reader && r.family === 'wrapping' && r.outcome === 'different').map(r => r.id.split('@')[0]), expected, 'Review the wrapping explanation')
  assert.deepEqual(data.rows.filter(r => r.reader === reader && r.family === 'stability' && r.outcome === 'different').map(r => r.id), ['list/list'], 'Review the stability explanation')
  assert.equal(data.rows.filter(r => r.reader === reader && r.family === 'resolution').length, 12)
}
for (const group of timing.groups) assert.deepEqual(group.rows.map(r => r.size), scalingCases[group.family].sizes)
const fraction = (family, reader) => { const rows = data.rows.filter(r => r.family === family && r.reader === reader); return `${rows.filter(r => r.outcome === 'equal').length}/${rows.length}` }
const behavior = ['wrapping', 'containers', 'locality', 'stability'].map(f => `| ${f} | ${readers.map(r => fraction(f, r)).join(' | ')} |`).join('\n')
const fixed = n => n.toFixed(3)
const timings = families.map(f => {
  const groups = readers.map(r => timing.groups.find(g => g.reader === r && g.mode === 'html' && g.family === f)), size = groups[0].rows.at(-1).size
  return `| ${f} | ${groups[0].rows.at(-1).bytes} | ${readers.map((_, i) => { return groups[i].rounds.map(round => { const row = round.rows.find(row => row.size === size); return `${fixed(row.medianMs)} / ${fixed(row.medianCpuMs)}` }).join('; ') }).join(' | ')} |`
}).join('\n')
const stages = readers.flatMap(r => ['nested-quotes', 'nested-lists'].map(f => {
  const values = ['parse', 'render', 'html'].map(mode => timing.groups.find(g => g.reader === r && g.mode === mode && g.family === f).rounds.map(round => round.rows.find(row => row.size === 192)))
  return `| ${r} | ${f} | ${values.map(rounds => rounds.map(v => fixed(v.medianMs)).join('; ')).join(' | ')} |`
})).join('\n')
const differences = data.rows.filter(r => r.outcome === 'different' && !['resolution'].includes(r.family)).map(r => `| ${r.reader} | ${r.family} | \`${r.id}\` |`).join('\n')
const probeOutputs = data.rows.filter(r => r.family === 'dialect-probe').map(r => `### ${r.id}: ${r.reader}\n\nSource:\n\n\`\`\`text\n${r.source}\`\`\`\n\nOutput:\n\n\`\`\`html\n${r.html.trim()}\n\`\`\``).join('\n\n')
const text = `# Carve, Djot and CommonMark comparison

This run compares the pinned Carve JS engine with @djot/djot ${current.parsers['@djot/djot'].version}
and commonmark ${current.parsers.commonmark.version}. Carve uses commit
\`${current.engine.split('#')[1]}\`. The lockfile records package sources.
Git readers use immutable commit pins; registry packages include integrity hashes.

This reader snapshot was recorded at ${timing.metadata.generatedAt}.
The [preceding comparison](history/pre-engine-performance/comparison.md) and
[timings](history/pre-engine-performance/comparison-timings.json) remain available.

The previous [report](history/pre-prefix-refresh/comparison.md),
[observations](history/pre-prefix-refresh/comparison-results.json) and
[timings](history/pre-prefix-refresh/comparison-timings.json) are preserved.
${data.rows.length - changedObservations} observations are unchanged from that baseline;
${changedObservations} are changed or added and ${removedObservations} are removed.
The comparison reader is installed separately as \`carve-comparison\`; the checked
layout model retains its original engine and specification pins.

## Behavior

${data.rows.length} observations cover three readers. Each relation compares a reader with itself
before and after an edit. Fractions count unchanged projections, not specification
conformance or a score for the language. Known language differences do not fail CI;
a change to their recorded output requires review.

| Relation | Carve | Djot | CommonMark |
|---|---:|---:|---:|
${behavior}

The twelve wrapping fixtures use each language's spelling for strong and emphasis.
Every individual ASCII space is replaced once, giving 35 edits per reader.
Carve's five differences are three changes to code-span bytes and two new block
starts, a heading and a quote. Djot's three differences are the same code-span
changes. CommonMark normalizes line endings inside code spans and treats the
unclosed backtick as text; its four differences are list, ordered-list, heading
and quote interruption. This sample is too small for a universal wrapping claim.

Containers cover ten fragments in four wrappers. The adapter removes the outer
quote or single-item list and compares the payload. Tests separately check that
container-authored reference definitions still resolve to the target. This does
not establish arbitrary nesting or definition scoping.

Locality covers four reference-like forms with an added matching definition,
a replaced definition and an unrelated definition. The projection drops resolved
destinations and titles but retains reference labels, node types and children.
CommonMark changes text into links in the two matching-definition cases; Carve
and Djot preserve the reference node classification. The 36 rendering controls
record destination changes separately, including explicit target assertions in tests.

Append stability uses six prefixes and six suffixes. All three readers change
in the list/list case: the later item extends the list and makes it loose.
A blank line has not closed that list. The closed-list control adds a heading
before appending and stays stable. Djot section wrappers and their automatic IDs
are omitted from this block-content projection, so section growth is not tested.

The [djot.v discussion](https://github.com/jgm/djot/discussions/414) describes formal
properties of a separate implementation. Code-byte equality and appending to an
open list are stronger questions than prose wrapping and stability of closed
blocks. These results do not refute its theorems or verify their hypotheses.
The tested implementation here is djot.js, not djot.v.
[CommonMark rules](https://spec.commonmark.org/0.31.2/) and the
[djot.js API](https://github.com/jgm/djot.js) define the other reader interfaces.

## Scoped contracts and expanded cases

${contractData.rows.length} [contract observations](comparison-contracts.json) check
eligible prose wrapping, append stability after an explicit heading boundary,
reference classification and nested container payloads. These are executable
contracts over the authored cases, not universal proofs.

- Wrapping excludes code bytes, escapes, hard breaks, structural line starts and destination bytes.
- Append stability compares original block content after a boundary; it excludes document-level section growth and generated IDs.
- Reference classification omits resolved destinations and titles. CommonMark has two expected classification changes when a definition turns text into a link. Separate controls assert the rendered destination. Inline links and code spans are recorded as nonreference controls.
- Container tests use quote, list and alternating wrappers at depths 2, 4 and 8. They do not establish arbitrary definition scoping.

${containers.rows.length} additional [Carve container regressions](container-regressions.json)
cover lazy continuation, tables, fences, definitions, tabs, Unicode, comments
and headings in quote, list and mixed wrappers through depth 16. They preserve
full-AST fingerprints including positions, HTML fingerprints and measured regex
work. Unwrapping must reproduce the depth-0 payload structure, including tables,
fences and lazy continuations. Reference definitions are excluded from that
payload projection and their rendered destinations are checked separately.
Terminal leaf positions must select their exact original source text;
offsets and columns are counted in codepoints. Instrumented and ordinary
parses must produce identical full trees.

The [updated profile](nesting-profile.md) separates input exposure from successful
match lengths, global regex progress and suffix argument lengths. The pinned
JavaScript reader reuses prefix classification, recognizes quote and unordered-list
markers without full-tail captures, and carries source origins through literal
prefix strips. The specification profile remains at its separately recorded older pin.

## Timings

The ${families.length} families use identical source bytes across readers.
The ${timing.metadata.controls.length} new shared-syntax controls check full HTML equality after trimming only
outer whitespace. Tree projections also agree except for dense definitions:
Carve resolves references while Djot keeps a reference table and CommonMark
omits authored reference labels. Output hashes and fixture hashes are recorded. Emphasis adaptation
is needed only in the behavioral fixtures. The unmatched and unclosed inputs
measure how each reader handles the same adversarial source; they may produce
different trees. Each nested fixture is checked to contain the requested depth
and final paragraph before measurement, through depth 192.

Largest sample in each family, full HTML pipeline. Cells show median wall / CPU
milliseconds per call for round 1; round 2. CPU includes all process threads.

| Family | Bytes | Carve | Djot | CommonMark |
|---|---:|---:|---:|---:|
${timings}

Nested inputs at depth 192, median wall milliseconds for round 1; round 2:

| Reader | Family | Parse | Render prebuilt AST | Full HTML |
|---|---|---:|---:|---:|
${stages}

The stages are measured independently. Full HTML can use fast paths and includes
resolution work not covered by render-only, so its time need not equal the sum.
Carve's public parse includes positions; Djot uses its default without source
positions; CommonMark records block positions. These are default API costs, not
identical feature configurations or a ranking of all implementations.
Large gaps between independently measured parse-only and full-pipeline
timings, including Carve's and Djot's, need isolated repeat measurements before drawing
relative-speed conclusions; it is not evidence that rendering removes parse work.

${timing.metadata.method}
Node ${timing.metadata.node}, ${timing.metadata.cpu}, ${timing.metadata.logicalCpus} logical CPUs.
${timing.metadata.execution.controlled ? `The dedicated [workflow run](${timing.metadata.execution.runUrl}) ran workers serially and rejected load above its available CPU count.` : 'This is a shared-host run.'}
Load averages at the end were ${timing.metadata.loadEnd.map(n => n.toFixed(2)).join(', ')}.
Both fresh-worker rounds appear separately in the charts, tables and downloads.
Historical laptop timings are preserved separately and cannot establish a speed change on this runner.
Tiny samples, runtime warmup and scheduling affect ratios. No timing threshold
runs in ordinary CI. The Carve nesting costs are investigated in the
[nesting profile](nesting-profile.md). The [current cost investigation](current-costs.md)
measures longer batches, position options and both parse and full HTML hotspots.

## Reproduce

\`\`\`sh
npm run check:comparison -- --check reports/comparison-results.json
npm run check:contracts -- --check reports/comparison-contracts.json
npm run check:containers -- --check reports/container-regressions.json
npm run bench:comparison -- reports/comparison-timings.json
npm run report:comparison
\`\`\`

To record reviewed behavior changes, use \`check:comparison -- --output reports/comparison-results.json\`.
The adapter supports only the tested node vocabulary and rejects unknown nodes.
It merges text and soft breaks, preserves code bytes and list tightness, omits
positions, and flattens Djot sections. Dialect-only probes below compare output
without pretending that comments, captions or shortcut links have shared semantics.

Raw data: [observations](comparison-results.json), [timings](comparison-timings.json).

## Changed projections

| Reader | Relation | Case |
|---|---|---|
${differences}

## Dialect-only probes

${probeOutputs}
`
writeFileSync(new URL('../../reports/comparison.md', import.meta.url), text)
