# Carve, Djot and CommonMark comparison

This run compares the pinned Carve JS engine with @djot/djot 0.3.2
and commonmark 0.31.2. Carve uses commit
`88754ac8cb4b2ebfdd3dfb07f1edc396db11f336`. The lockfile records package sources and integrity hashes.

This reader snapshot was recorded at 2026-09-29T23:59:26.536Z.
The [preceding comparison](../pre-cross-reader-refresh/comparison.md) and
[timings](../pre-cross-reader-refresh/comparison-timings.json) remain available.

The previous [report](../pre-prefix-refresh/comparison.md),
[observations](../pre-prefix-refresh/comparison-results.json) and
[timings](../pre-prefix-refresh/comparison-timings.json) are preserved.
420 observations are unchanged from that baseline;
0 are changed or added and 0 are removed.
The comparison reader is installed separately as `carve-comparison`; the checked
layout model retains its original engine and specification pins.

## Behavior

420 observations cover three readers. Each relation compares a reader with itself
before and after an edit. Fractions count unchanged projections, not specification
conformance or a score for the language. Known language differences do not fail CI;
a change to their recorded output requires review.

| Relation | Carve | Djot | CommonMark |
|---|---:|---:|---:|
| wrapping | 30/35 | 32/35 | 31/35 |
| containers | 40/40 | 40/40 | 40/40 |
| locality | 12/12 | 12/12 | 10/12 |
| stability | 35/36 | 35/36 | 35/36 |

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

525 [contract observations](comparison-contracts.json) check
eligible prose wrapping, append stability after an explicit heading boundary,
reference classification and nested container payloads. These are executable
contracts over the authored cases, not universal proofs.

- Wrapping excludes code bytes, escapes, hard breaks, structural line starts and destination bytes.
- Append stability compares original block content after a boundary; it excludes document-level section growth and generated IDs.
- Reference classification omits resolved destinations and titles. CommonMark has two expected classification changes when a definition turns text into a link. Separate controls assert the rendered destination. Inline links and code spans are recorded as nonreference controls.
- Container tests use quote, list and alternating wrappers at depths 2, 4 and 8. They do not establish arbitrary definition scoping.

112 additional [Carve container regressions](container-regressions.json)
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

The 14 families use identical source bytes across readers.
The 28 new shared-syntax controls check full HTML equality after trimming only
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
| long-line | 40964 | 0.148 / 0.165; 0.143 / 0.162 | 0.101 / 0.165; 0.098 / 0.161 | 0.021 / 0.023; 0.019 / 0.021 |
| unmatched-brackets | 1028 | 0.507 / 1.518; 0.494 / 1.568 | 0.128 / 0.390; 0.130 / 0.395 | 0.056 / 0.060; 0.055 / 0.059 |
| unmatched-closers | 8196 | 0.061 / 0.074; 0.062 / 0.075 | 0.383 / 0.649; 0.374 / 0.615 | 0.426 / 0.458; 0.418 / 0.446 |
| unclosed-code | 40965 | 0.281 / 0.358; 0.287 / 0.381 | 0.109 / 0.181; 0.105 / 0.175 | 0.030 / 0.032; 0.030 / 0.032 |
| many-paragraphs | 12288 | 0.542 / 0.760; 0.559 / 0.792 | 2.453 / 5.953; 2.421 / 5.631 | 0.353 / 0.374; 0.362 / 0.384 |
| nested-quotes | 388 | 0.749 / 2.399; 0.670 / 2.194 | 0.213 / 0.790; 0.186 / 0.647 | 0.031 / 0.034; 0.032 / 0.035 |
| nested-lists | 388 | 1.546 / 4.120; 1.582 / 5.118 | 1.334 / 4.948; 1.301 / 4.430 | 0.179 / 0.191; 0.189 / 0.200 |
| interior-whitespace | 16387 | 0.055 / 0.066; 0.055 / 0.067 | 0.064 / 0.182; 0.067 / 0.197 | 0.010 / 0.011; 0.014 / 0.015 |
| literal-brackets | 12289 | 5.476 / 9.975; 3.059 / 5.420 | 2.414 / 5.911; 2.633 / 6.445 | 0.379 / 0.404; 0.610 / 0.702 |
| inline-links | 22528 | 1.669 / 2.644; 1.644 / 2.598 | 4.026 / 8.976; 4.167 / 9.457 | 1.084 / 1.128; 1.094 / 1.135 |
| sparse-definitions | 12302 | 0.708 / 1.107; 0.652 / 0.946 | 2.547 / 5.846; 2.651 / 5.927 | 0.381 / 0.404; 0.376 / 0.396 |
| dense-definitions | 7461 | 3.861 / 7.196; 3.878 / 7.812 | 2.392 / 6.804; 2.429 / 7.105 | 0.446 / 0.472; 0.456 / 0.481 |
| long-unicode | 90113 | 0.547 / 0.654; 0.572 / 0.683 | 0.201 / 0.310; 0.196 / 0.304 | 0.186 / 0.196; 0.178 / 0.188 |
| unicode-paragraphs | 12288 | 3.579 / 6.599; 3.427 / 5.898 | 2.529 / 6.196; 2.432 / 5.955 | 0.506 / 0.536; 0.405 / 0.427 |

Nested inputs at depth 192, median wall milliseconds for round 1; round 2:

| Reader | Family | Parse | Render prebuilt AST | Full HTML |
|---|---|---:|---:|---:|
| carve | nested-quotes | 0.420; 0.446 | 0.074; 0.075 | 0.749; 0.670 |
| carve | nested-lists | 0.614; 1.026 | 0.161; 0.151 | 1.546; 1.582 |
| djot | nested-quotes | 0.182; 0.117 | 0.009; 0.008 | 0.213; 0.186 |
| djot | nested-lists | 0.638; 0.903 | 0.021; 0.021 | 1.334; 1.301 |
| commonmark | nested-quotes | 0.018; 0.018 | 0.013; 0.013 | 0.031; 0.032 |
| commonmark | nested-lists | 0.152; 0.151 | 0.029; 0.028 | 0.179; 0.189 |

The stages are measured independently. Full HTML can use fast paths and includes
resolution work not covered by render-only, so its time need not equal the sum.
Carve's public parse includes positions; Djot uses its default without source
positions; CommonMark records block positions. These are default API costs, not
identical feature configurations or a ranking of all implementations.
Large gaps between independently measured parse-only and full-pipeline
timings, including Carve's and Djot's, need isolated repeat measurements before drawing
relative-speed conclusions; it is not evidence that rendering removes parse work.

Two fresh-worker rounds per family and API, Carve-Djot-CommonMark then CommonMark-Djot-Carve. Serial workers; 60s group deadline including startup; 200ms warmup per size, five batches of at least 20ms with 16-call time checks, GC before batches. Each round remains in the raw data. Render reuses a prebuilt AST. CPU includes all process threads. RSS is cumulative peak.
Node v24.21.0, AMD EPYC 9V45 96-Core Processor, 4 logical CPUs.
The dedicated [workflow run](https://github.com/markup-carve/carve-proofs/actions/runs/36647882125) ran workers serially and rejected load above its available CPU count.
Load averages at the end were 1.61, 1.32, 0.70.
Both fresh-worker rounds appear separately in the charts, tables and downloads.
Historical laptop timings are preserved separately and cannot establish a speed change on this runner.
Tiny samples, runtime warmup and scheduling affect ratios. No timing threshold
runs in ordinary CI. The Carve nesting costs are investigated in the
[nesting profile](nesting-profile.md). The [current cost investigation](current-costs.md)
measures longer batches, position options and both parse and full HTML hotspots.

## Reproduce

```sh
npm run check:comparison -- --check reports/comparison-results.json
npm run check:contracts -- --check reports/comparison-contracts.json
npm run check:containers -- --check reports/container-regressions.json
npm run bench:comparison -- reports/comparison-timings.json
npm run report:comparison
```

To record reviewed behavior changes, use `check:comparison -- --output reports/comparison-results.json`.
The adapter supports only the tested node vocabulary and rejects unknown nodes.
It merges text and soft breaks, preserves code bytes and list tightness, omits
positions, and flattens Djot sections. Dialect-only probes below compare output
without pretending that comments, captions or shortcut links have shared semantics.

Raw data: [observations](comparison-results.json), [timings](comparison-timings.json).

## Changed projections

| Reader | Relation | Case |
|---|---|---|
| carve | wrapping | `code@11` |
| carve | wrapping | `unclosedCode@11` |
| carve | wrapping | `unclosedCode@17` |
| carve | wrapping | `heading@5` |
| carve | wrapping | `quote@5` |
| carve | stability | `list/list` |
| djot | wrapping | `code@11` |
| djot | wrapping | `unclosedCode@11` |
| djot | wrapping | `unclosedCode@17` |
| djot | stability | `list/list` |
| commonmark | wrapping | `bullet@5` |
| commonmark | wrapping | `ordered@5` |
| commonmark | wrapping | `heading@5` |
| commonmark | wrapping | `quote@5` |
| commonmark | locality | `full/defined` |
| commonmark | locality | `collapsed/defined` |
| commonmark | stability | `list/list` |

## Dialect-only probes

### comment: carve

Source:

```text
alpha %% hidden
```

Output:

```html
<p>alpha</p>
```

### caption: carve

Source:

```text
> alpha

^ caption
```

Output:

```html
<figure>
  <blockquote><p>alpha</p></blockquote>
  <figcaption>caption</figcaption>
</figure>
```

### shortcut: carve

Source:

```text
[ref]

[ref]: /target
```

Output:

```html
<p>[ref]</p>
```

### setext: carve

Source:

```text
heading
======
```

Output:

```html
<p>heading
======</p>
```

### unclosedCode: carve

Source:

```text
`payload
```

Output:

```html
<p><code>payload</code></p>
```

### comment: djot

Source:

```text
alpha %% hidden
```

Output:

```html
<p>alpha %% hidden</p>
```

### caption: djot

Source:

```text
> alpha

^ caption
```

Output:

```html
<blockquote>
<p>alpha</p>
</blockquote>
```

### shortcut: djot

Source:

```text
[ref]

[ref]: /target
```

Output:

```html
<p>[ref]</p>
```

### setext: djot

Source:

```text
heading
======
```

Output:

```html
<p>heading
======</p>
```

### unclosedCode: djot

Source:

```text
`payload
```

Output:

```html
<p><code>payload</code></p>
```

### comment: commonmark

Source:

```text
alpha %% hidden
```

Output:

```html
<p>alpha %% hidden</p>
```

### caption: commonmark

Source:

```text
> alpha

^ caption
```

Output:

```html
<blockquote>
<p>alpha</p>
</blockquote>
<p>^ caption</p>
```

### shortcut: commonmark

Source:

```text
[ref]

[ref]: /target
```

Output:

```html
<p><a href="/target">ref</a></p>
```

### setext: commonmark

Source:

```text
heading
======
```

Output:

```html
<h1>heading</h1>
```

### unclosedCode: commonmark

Source:

```text
`payload
```

Output:

```html
<p>`payload</p>
```
