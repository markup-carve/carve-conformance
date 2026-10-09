# Nested-container profiling

Repeated inspection of remaining container prefixes is a source of growth that
the current layout counters miss. CPU profiles, deterministic regex counts and
allocation samples point to parsing work, especially quote-state classification
and list-marker recognition. The render-only samples are much smaller on these
fixtures. This investigation changes no parser implementation.

The JS engine is pinned to `c5df77f658c80a3a80a4d31ec1855d854e5da648`; the executable
specification is pinned to `d20ebd942f91470485332cec925fa0717f20a58a`. Each source is one line
of repeated quote or list markers followed by `end`, at depths 32, 64, 128 and
192. Depth 192 is below the 200-level layout limit. The three-reader comparison
also verifies the resulting JS, Djot and CommonMark trees at these depths.

## Separate parse and render measurements

Median wall milliseconds at depths 64 and 128, then wall / process CPU milliseconds
at depth 192. Render uses a prebuilt AST. Specification parsing builds block
layout; its renderer also interprets inline content. These stages do different
work from their JS counterparts.

| Reader | Family | Parse 64 → 128 | Growth | Parse 192 wall / CPU | Render 192 wall / CPU |
|---|---|---:|---:|---:|---:|
| js | quotes | 0.55 → 2.02 | 3.70× | 4.27 / 4.89 | 0.09 / 0.10 |
| js | lists | 0.93 → 2.87 | 3.09× | 5.04 / 6.08 | 0.22 / 0.29 |
| spec | quotes | 0.50 → 2.41 | 4.81× | 6.25 / 6.87 | 0.73 / 1.22 |
| spec | lists | 0.71 → 2.99 | 4.20× | 7.64 / 8.84 | 1.88 / 2.57 |

## Work missing from the old counters

These are exact calls observed with an instrumented `RegExp.prototype.exec`
during one parse, including calls made by `test` and string operations.
Replacing that method can disable V8 fast paths, so the counts describe matching
attempts under instrumentation, not native instruction counts or call overhead. Input exposure sums the lengths
passed to those calls. It is not the number of characters the regex engine
actually examines: an anchored failure can inspect only the first character.
The exposure column must not be treated as a runtime complexity proof.

| Reader | Family | Regex calls 64 → 128 | Call growth | Input characters presented 64 → 128 | Existing layout counter 64 → 128 |
|---|---|---:|---:|---:|---:|
| js | quotes | 14856 → 54216 | 3.65× | 670282 → 4756426 | 132 → 260 |
| js | lists | 15215 → 50831 | 3.34× | 546293 → 2266933 | 132 → 260 |
| spec | quotes | 8237 → 28749 | 3.49× | 389638 → 2593766 | 195 → 387 |
| spec | lists | 12278 → 45014 | 3.67× | 568801 → 4008833 | 195 → 387 |

The operation counts grow faster than input size, so scheduling alone cannot
explain the timing signal. The JS quote tracker walks the remaining quote
prefix in `trackBlockQuoteLazyState` and `classifyQuotedLine`; each recursive
`parseBlockQuote` invokes that tracker again. JS list parsing likewise calls
`walkContainerPrefix` and `markerPrefixLength` on remaining prefixes.

The specification's `nestedQuoteOpensParagraph` loops through the inner quote
markers for each enclosing quote parse. Its `opensParagraph` also peels nested
list markers through `matchMarkerAt`. These repeated walks explain why the
existing counts for indentation, prefix stripping and source splitting can stay
linear while other work grows faster. The source inspection supports this
mechanism; the samples do not assign an exact fraction of total cost to it.

## Allocation

V8 heap sampling estimates allocated KiB per call, including objects collected
by minor and major GC. These values measure allocation churn, not retained heap
or peak memory, and vary between runs.

| Reader | Family | Parse 64 | Parse 128 | Parse 192 | Render 192 |
|---|---|---:|---:|---:|---:|
| js | quotes | 1065.51 | 3459.98 | 7327.37 | 287.41 |
| js | lists | 1124.18 | 3105.89 | 5840.93 | 766.84 |
| spec | quotes | 451.82 | 1591.34 | 3390.56 | 486.34 |
| spec | lists | 1316.19 | 4667.47 | 10076.35 | 975.53 |

### js: quotes

CPU self samples, aggregated across recursive call paths:

- [`classifyQuotedLine`](https://github.com/markup-carve/carve-js/blob/c5df77f658c80a3a80a4d31ec1855d854e5da648/src/parse.ts): 208.89 ms of sampled self time. Runtime location: `node_modules/@markup-carve/carve/dist/parse.js:2681`.
- [`isTableRow`](https://github.com/markup-carve/carve-js/blob/c5df77f658c80a3a80a4d31ec1855d854e5da648/src/parse.ts): 15.49 ms of sampled self time. Runtime location: `node_modules/@markup-carve/carve/dist/parse.js:321`.
- [`parseBlockQuote`](https://github.com/markup-carve/carve-js/blob/c5df77f658c80a3a80a4d31ec1855d854e5da648/src/parse.ts): 13.43 ms of sampled self time. Runtime location: `node_modules/@markup-carve/carve/dist/parse.js:8780`.

Largest allocation frames: `classifyQuotedLine` (3624.71 KiB/call), `exec` (2646.22 KiB/call), `Map` (288.20 KiB/call).

### js: lists

CPU self samples, aggregated across recursive call paths:

- [`markerPrefixLength`](https://github.com/markup-carve/carve-js/blob/c5df77f658c80a3a80a4d31ec1855d854e5da648/src/parse.ts): 138.01 ms of sampled self time. Runtime location: `node_modules/@markup-carve/carve/dist/parse.js:3529`.
- [`parseList`](https://github.com/markup-carve/carve-js/blob/c5df77f658c80a3a80a4d31ec1855d854e5da648/src/parse.ts): 32.74 ms of sampled self time. Runtime location: `node_modules/@markup-carve/carve/dist/parse.js:9058`.
- [`extractItemAttr`](https://github.com/markup-carve/carve-js/blob/c5df77f658c80a3a80a4d31ec1855d854e5da648/src/parse.ts): 23.23 ms of sampled self time. Runtime location: `node_modules/@markup-carve/carve/dist/parse.js:98`.

Largest allocation frames: `exec` (2814.19 KiB/call), `markerLineState` (1157.59 KiB/call), `Map` (409.91 KiB/call).

### spec: quotes

CPU self samples, aggregated across recursive call paths:

- [`nestedQuoteOpensParagraph`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 278.45 ms of sampled self time. Runtime location: `spec/scripts/spec/layout.mjs:3113`.
- [`trackFence`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 10.59 ms of sampled self time. Runtime location: `spec/scripts/spec/layout.mjs:3135`.
- [`parseBlocksImpl`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 7.62 ms of sampled self time. Runtime location: `spec/scripts/spec/layout.mjs:2073`.

Largest allocation frames: `exec` (2626.71 KiB/call), `nestedQuoteOpensParagraph` (406.32 KiB/call), `parseBlocksImpl` (295.63 KiB/call).

### spec: lists

CPU self samples, aggregated across recursive call paths:

- [`matchMarkerAt`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 211.59 ms of sampled self time. Runtime location: `spec/scripts/spec/layout.mjs:3827`.
- [`opensParagraph`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 49.64 ms of sampled self time. Runtime location: `spec/scripts/spec/layout.mjs:1302`.
- [`collectItems`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 24.66 ms of sampled self time. Runtime location: `spec/scripts/spec/layout.mjs:3893`.

Largest allocation frames: `exec` (6792.29 KiB/call), `collectItems` (1564.46 KiB/call), `opensParagraph` (1310.43 KiB/call).

CPU profiles include inspector startup and GC frames in the raw data. The lists
above show parser-source frames only, aggregated by function and source location.
Allocation lists include runtime allocation frames such as `exec`.
The JS links point to TypeScript source; recorded line numbers refer to installed
JavaScript and are not interchangeable with TypeScript line numbers.

## Regression coverage and next fix

The tests count regex calls and input exposure for both readers at all four
depths. Their ceiling is the recorded count plus 5%, rejecting larger
regressions. A drop below half the baseline also requires review and re-recording
to distinguish a large improvement from instrumentation that stopped observing
work. Sticky-regex calls are rejected because instrumenting regex-based split
can expand one operation into per-position calls. These fixtures contain none. They also compare instrumented and ordinary parse
trees and check that instrumentation restores `RegExp.prototype.exec` after an
exception. The ceiling records current behavior; it does not certify linearity or cover prefix work implemented without regexes.

The first optimization target is to reuse the nested paragraph-state result or
carry a shared prefix description into recursive parsing, rather than walking
the remaining markers again at every level. The JS quote tracker is the first
candidate, followed by list prefix walks and the corresponding specification
helpers. Any change needs lazy-continuation, table, fence, definition and mixed
container tests, because those states are why the trackers exist.

## Method and reproduction

Serial workers. At least 200ms warmup, then five uninstrumented batches of at least 20ms with 16-call time checks and no iteration cap; GC before each batch. Separate one-call regex instrumentation, 300ms CPU profile at 100us sampling, and 20-call heap sampling at 4096 bytes including collected objects. CPU and heap profiles are statistical estimates; regex input lengths are exposure counts, not engine step counts.
Timing and CPU/heap sampling run before regex instrumentation, so patching the
regex method cannot change optimization behavior during those measurements.
The AST is parsed before render-only measurement, and profiler setup is excluded
from the uninstrumented timings. Inspector self-time remains visible in profiles.

Node v24.19.0, AMD Ryzen 9 PRO 7940HS w/ Radeon 780M Graphics, 16 logical CPUs;
load averages at completion: 9.13, 10.50, 13.74.
The host is shared. Timings and sampled allocations are evidence for this input
family, not a whole-parser complexity bound. Deterministic regex ceilings run
in CI; sampling and timings are explicit local commands.

```sh
npm run profile:nesting -- reports/nesting-profile.json
npm run report:profiling
node --test tests/profiling.test.mjs
```

[Profile summaries, counters and measurements](nesting-profile.json).
CPU and heap frames are recorded with their weights; full inspector call trees
and chronological sample streams are not retained.
