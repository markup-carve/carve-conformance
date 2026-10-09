# Nested-container profiling

The refreshed JavaScript reader already contains quote-state reuse and prefix
memoization. At depth 192, both quote and list parsing use fewer than half the
regex calls recorded by the earlier reader. The historical
[profile](history/pre-prefix-refresh/nesting-profile.json) and
[report](history/pre-prefix-refresh/nesting-profile.md) remain available.

This reader snapshot was recorded at 2026-09-30T15:32:09.130Z.
The immediately preceding [profile](history/pre-engine-performance/nesting-profile.json)
and [report](history/pre-engine-performance/nesting-profile.md) preserve the prior reader.

Current JS pin: `6d02fa7062dd03024e7c092016459602e9a7aeec`.
Earlier JS pin: `c5df77f658c80a3a80a4d31ec1855d854e5da648`.
The executable specification remains pinned separately to
`d20ebd942f91470485332cec925fa0717f20a58a`; its measurements do not describe the latest specification.
The model's JS dependency also stays at its original pin. The comparison uses
the separately locked `carve-comparison` dependency.

## Recorded change at depth 192

| Family | Regex calls, before → after | Call reduction | Sampled allocation KiB/call, before → after |
|---|---:|---:|---:|
| quotes | 118152 → 3293 | 97.21% | 7327.37 → 809.43 |
| lists | 106927 → 9440 | 91.17% | 5840.93 → 2003.64 |

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
quotes: 3293 → 3293 (+0); lists: 9440 → 9440 (+0). These net changes are recorded separately from the larger
historical reduction. Operation counts do not establish a wall-time change.

## Current growth and phase costs

| Reader | Family | Regex calls, depth 64 → 128 | Call growth | Regex input exposure, 64 → 128 | Parse wall ms, 192 | Render wall ms, 192 |
|---|---|---:|---:|---:|---:|---:|
| js | quotes | 1117 → 2205 | 1.97× | 74585 → 288345 | 0.65 | 0.12 |
| js | lists | 3168 → 6304 | 1.99× | 211298 → 823906 | 1.86 | 0.29 |
| spec | quotes | 8237 → 28749 | 3.49× | 389638 → 2593766 | 7.37 | 0.94 |
| spec | lists | 12278 → 45014 | 3.67× | 568801 → 4008833 | 9.04 | 1.65 |

Input exposure charges the complete input for every regex call, including failed
anchored checks and global matches that resume at the previous match. For example,
matching each quote marker in a 256-character prefix with a global regex makes
129 calls, charging 33,024 input characters while advancing through 256.

| Reader | Family | Successful match lengths, 64 → 128 | Global forward progress, 64 → 128 | Suffix argument lengths, 64 → 128 |
|---|---|---:|---:|---:|
| js | quotes | 3 → 3 | 132 → 260 | 0 → 0 |
| js | lists | 511 → 1023 | 132 → 260 | 0 → 0 |
| spec | quotes | 293149 → 2220605 | 264 → 520 | 0 → 0 |
| spec | lists | 208445 → 1531005 | 4488 → 17160 | 0 → 0 |

Lengths use JavaScript UTF-16 code units. Successful match lengths sum complete
matches, without adding capture groups. Global forward progress includes the
remaining range on a failed global search; it excludes sticky regexes. Suffix
lengths count string arguments passed to `endsWith` in a separate parse.
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
| js | quotes | 266.29 | 542.50 | 809.43 |
| js | lists | 673.80 | 1331.48 | 2003.64 |
| spec | quotes | 453.67 | 1588.20 | 3374.70 |
| spec | lists | 1289.09 | 4627.58 | 10082.25 |

### js: quotes

- [`parseBlockInner`](https://github.com/markup-carve/carve-js/blob/6d02fa7062dd03024e7c092016459602e9a7aeec/src/parse.ts): 71.00 ms sampled self time at `node_modules/carve-comparison/dist/parse.js:7777`.
- [`parseBlockQuote`](https://github.com/markup-carve/carve-js/blob/6d02fa7062dd03024e7c092016459602e9a7aeec/src/parse.ts): 37.03 ms sampled self time at `node_modules/carve-comparison/dist/parse.js:9406`.
- [`attachDocumentOffsets`](https://github.com/markup-carve/carve-js/blob/6d02fa7062dd03024e7c092016459602e9a7aeec/src/parse.ts): 30.89 ms sampled self time at `node_modules/carve-comparison/dist/parse.js:1073`.

Largest sampled allocation frames: `push` (219.29 KiB/call), `parseBlockQuote` (146.95 KiB/call), `nestedSubLexer` (68.66 KiB/call).

### js: lists

- [`parseList`](https://github.com/markup-carve/carve-js/blob/6d02fa7062dd03024e7c092016459602e9a7aeec/src/parse.ts): 70.16 ms sampled self time at `node_modules/carve-comparison/dist/parse.js:9745`.
- [`parseBlockInner`](https://github.com/markup-carve/carve-js/blob/6d02fa7062dd03024e7c092016459602e9a7aeec/src/parse.ts): 34.38 ms sampled self time at `node_modules/carve-comparison/dist/parse.js:7777`.
- [`attachBlockPos`](https://github.com/markup-carve/carve-js/blob/6d02fa7062dd03024e7c092016459602e9a7aeec/src/parse.ts): 22.23 ms sampled self time at `node_modules/carve-comparison/dist/parse.js:2044`.

Largest sampled allocation frames: `parseList` (509.03 KiB/call), `Map` (218.77 KiB/call), `Set` (198.07 KiB/call).

### spec: quotes

- [`nestedQuoteOpensParagraph`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 287.87 ms sampled self time at `spec/scripts/spec/layout.mjs:3113`.
- [`parseBlocksImpl`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 8.43 ms sampled self time at `spec/scripts/spec/layout.mjs:2073`.
- [`trackFence`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 5.79 ms sampled self time at `spec/scripts/spec/layout.mjs:3135`.

Largest sampled allocation frames: `exec` (2608.36 KiB/call), `nestedQuoteOpensParagraph` (411.28 KiB/call), `parseBlocksImpl` (290.47 KiB/call).

### spec: lists

- [`matchMarkerAt`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 220.43 ms sampled self time at `spec/scripts/spec/layout.mjs:3827`.
- [`opensParagraph`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 52.46 ms sampled self time at `spec/scripts/spec/layout.mjs:1302`.
- [`collectItems`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 19.03 ms sampled self time at `spec/scripts/spec/layout.mjs:3893`.

Largest sampled allocation frames: `exec` (6792.74 KiB/call), `collectItems` (1592.66 KiB/call), `opensParagraph` (1302.97 KiB/call).

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

Serial workers. At least 200ms warmup, then five uninstrumented batches of at least 20ms with 16-call time checks and no iteration cap; GC before each batch. Separate one-call regex and suffix instrumentation (UTF-16 lengths; string inputs only), 300ms CPU profile at 100us sampling, and 20-call heap sampling at 4096 bytes including collected objects. CPU and heap profiles are statistical estimates; regex input lengths are exposure counts, not engine step counts.

Node v24.21.0; Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz; 4 logical CPUs.
Host load at completion: 1.6, 1.4, 1.03.
Timing and sampling run before regex instrumentation. Patching regex execution
can disable V8 fast paths, so instrumented call counts do not measure native
instruction cost. Full inspector call trees are not retained.

```sh
npm run profile:nesting
npm run report:profiling
npm run check:containers -- --check reports/container-regressions.json
node --test tests/profiling.test.mjs tests/comparison-contracts.test.mjs
```
