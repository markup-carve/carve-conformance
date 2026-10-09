# Carve, Djot and CommonMark comparison

This run compares the pinned Carve JS engine with @djot/djot 0.3.2
and commonmark 0.31.2. Carve uses commit
`9f3d058708a287b58aa701596dfb76e5c45d73a2`. The lockfile records package sources and integrity hashes.

The previous [report](history/pre-prefix-refresh/comparison.md),
[observations](history/pre-prefix-refresh/comparison-results.json) and
[timings](history/pre-prefix-refresh/comparison-timings.json) are preserved.
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

The nested-prefix optimization already landed before this refresh. The
[updated profile](nesting-profile.md) records its effect against the preserved
baseline. Repeated prefix classification is now reused by the pinned JavaScript
reader. The specification profile remains at its separately recorded older pin.

## Timings

The seven families use identical source bytes across readers. Emphasis adaptation
is needed only in the behavioral fixtures. The unmatched and unclosed inputs
measure how each reader handles the same adversarial source; they may produce
different trees. Each nested fixture is checked to contain the requested depth
and final paragraph before measurement, through depth 192.

Largest sample in each family, full HTML pipeline. Cells show median wall / CPU
milliseconds per call. CPU includes all process threads.

| Family | Bytes | Carve | Djot | CommonMark |
|---|---:|---:|---:|---:|
| long-line | 40964 | 2.220 / 3.012 | 0.194 / 0.268 | 0.044 / 0.051 |
| unmatched-brackets | 1028 | 0.550 / 1.311 | 0.143 / 0.318 | 0.126 / 0.136 |
| unmatched-closers | 8196 | 0.539 / 0.861 | 0.802 / 1.463 | 0.859 / 0.921 |
| unclosed-code | 40965 | 2.323 / 2.708 | 0.181 / 0.293 | 0.065 / 0.070 |
| many-paragraphs | 12288 | 1.622 / 2.824 | 3.415 / 7.410 | 0.635 / 0.690 |
| nested-quotes | 388 | 1.260 / 4.609 | 0.158 / 0.564 | 0.059 / 0.063 |
| nested-lists | 388 | 2.816 / 6.463 | 1.588 / 5.211 | 0.345 / 0.366 |

Nested inputs at depth 192, median wall milliseconds:

| Reader | Family | Parse | Render prebuilt AST | Full HTML |
|---|---|---:|---:|---:|
| carve | nested-quotes | 0.773 | 0.121 | 1.260 |
| carve | nested-lists | 1.859 | 0.252 | 2.816 |
| djot | nested-quotes | 0.139 | 0.012 | 0.158 |
| djot | nested-lists | 0.997 | 0.035 | 1.588 |
| commonmark | nested-quotes | 0.040 | 0.030 | 0.059 |
| commonmark | nested-lists | 0.323 | 0.056 | 0.345 |

The stages are measured independently. Full HTML can use fast paths and includes
resolution work not covered by render-only, so its time need not equal the sum.
Carve's public parse includes positions; Djot uses its default without source
positions; CommonMark records block positions. These are default API costs, not
identical feature configurations or a ranking of all implementations.
Djot's two paths use the same parser. A large gap between its parse-only and
full-pipeline timings needs isolated repeat measurements before drawing
relative-speed conclusions; it is not evidence that rendering removes parse work.

Serial workers, 60s group deadline including startup, at least 200ms warmup per size, five batches of at least 20ms with 16-call time checks and no iteration cap, GC before batches. Render reuses a prebuilt AST. CPU includes all process threads. RSS is cumulative peak.
Node v24.19.0, AMD Ryzen 9 PRO 7940HS w/ Radeon 780M Graphics, 16 logical CPUs.
The host is shared; load averages at the end were 11.12, 22.14, 31.43.
Tiny samples, runtime warmup and scheduling affect ratios. No timing threshold
runs in ordinary CI. The Carve nesting costs are investigated in the
[nesting profile](nesting-profile.md).

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
