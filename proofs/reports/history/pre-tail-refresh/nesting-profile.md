# Nested-container profiling

The refreshed JavaScript reader already contains quote-state reuse and prefix
memoization. At depth 192, both quote and list parsing use fewer than half the
regex calls recorded by the earlier reader. The historical
[profile](history/pre-prefix-refresh/nesting-profile.json) and
[report](history/pre-prefix-refresh/nesting-profile.md) remain available.

Current JS pin: `9f3d058708a287b58aa701596dfb76e5c45d73a2`.
Earlier JS pin: `c5df77f658c80a3a80a4d31ec1855d854e5da648`.
The executable specification remains pinned separately to
`d20ebd942f91470485332cec925fa0717f20a58a`; its measurements do not describe the latest specification.
The model's JS dependency also stays at its original pin. The comparison uses
the separately locked `carve-comparison` dependency.

## Recorded change at depth 192

| Family | Regex calls, before → after | Call reduction | Sampled allocation KiB/call, before → after |
|---|---:|---:|---:|
| quotes | 118152 → 4487 | 96.20% | 7327.37 → 1306.66 |
| lists | 106927 → 11406 | 89.33% | 5840.93 → 2423.21 |

Regex calls are deterministic observations under the same instrumentation.
Allocation estimates come from separate runs on a shared host and remain
subject to sampling variation. Wall times are shown only for the current run
below; differing host load prevents attributing a before/after timing change
to the prefix optimization.

The relevant changes landed in
[quote-state reuse](https://github.com/markup-carve/carve-js/pull/2259) and
[prefix classification reuse](https://github.com/markup-carve/carve-js/pull/2274)
before this refresh. This update measures and guards the existing optimization.
It does not introduce another parser rewrite.

## Current growth and phase costs

| Reader | Family | Regex calls, depth 64 → 128 | Call growth | Regex input exposure, 64 → 128 | Parse wall ms, 192 | Render wall ms, 192 |
|---|---|---:|---:|---:|---:|---:|
| js | quotes | 1543 → 3015 | 1.95× | 106055 → 408519 | 1.02 | 0.10 |
| js | lists | 3854 → 7630 | 1.98× | 257247 → 997599 | 2.20 | 0.24 |
| spec | quotes | 8237 → 28749 | 3.49× | 389638 → 2593766 | 6.82 | 0.96 |
| spec | lists | 12278 → 45014 | 3.67× | 568801 → 4008833 | 8.22 | 1.49 |

On these simple JavaScript nesting fixtures, regex-call growth is near doubling
when depth doubles. Input exposure still counts every character supplied to a
regex. Input exposure grows roughly fourfold when depth doubles on these
fixtures, so substantial repeated input presentation remains. An anchored match
may inspect only its first character. Exposure is not
an executed-character count, and neither metric proves a whole-parser bound.
The older specification reader retains its separately measured costs.

The parse and render phases are independent runs. JavaScript parsing includes
source positions. Specification parsing produces block layout, while its
renderer also interprets inline content. Those phases do different work.

## Allocation and sampled frames

V8 heap sampling estimates allocation churn, including collected objects. It
does not measure retained heap or peak memory.

| Reader | Family | Parse KiB/call, 64 | Parse KiB/call, 128 | Parse KiB/call, 192 |
|---|---|---:|---:|---:|
| js | quotes | 431.10 | 845.97 | 1306.66 |
| js | lists | 786.55 | 1530.46 | 2423.21 |
| spec | quotes | 461.36 | 1584.14 | 3356.56 |
| spec | lists | 1306.49 | 4628.31 | 9998.72 |

### js: quotes

- [`attachDocumentOffsets`](https://github.com/markup-carve/carve-js/blob/9f3d058708a287b58aa701596dfb76e5c45d73a2/src/parse.ts): 86.15 ms sampled self time at `node_modules/carve-comparison/dist/parse.js:985`.
- [`parseBlockInner`](https://github.com/markup-carve/carve-js/blob/9f3d058708a287b58aa701596dfb76e5c45d73a2/src/parse.ts): 48.14 ms sampled self time at `node_modules/carve-comparison/dist/parse.js:7600`.
- [`parseBlockQuote`](https://github.com/markup-carve/carve-js/blob/9f3d058708a287b58aa701596dfb76e5c45d73a2/src/parse.ts): 25.71 ms sampled self time at `node_modules/carve-comparison/dist/parse.js:9227`.

Largest sampled allocation frames: `Map` (314.09 KiB/call), `push` (241.69 KiB/call), `Set` (170.14 KiB/call).

### js: lists

- [`parseList`](https://github.com/markup-carve/carve-js/blob/9f3d058708a287b58aa701596dfb76e5c45d73a2/src/parse.ts): 65.45 ms sampled self time at `node_modules/carve-comparison/dist/parse.js:9563`.
- [`attachDocumentOffsets`](https://github.com/markup-carve/carve-js/blob/9f3d058708a287b58aa701596dfb76e5c45d73a2/src/parse.ts): 39.84 ms sampled self time at `node_modules/carve-comparison/dist/parse.js:985`.
- [`parseBlockInner`](https://github.com/markup-carve/carve-js/blob/9f3d058708a287b58aa701596dfb76e5c45d73a2/src/parse.ts): 30.27 ms sampled self time at `node_modules/carve-comparison/dist/parse.js:7600`.

Largest sampled allocation frames: `Map` (499.98 KiB/call), `parseList` (470.51 KiB/call), `Set` (378.21 KiB/call).

### spec: quotes

- [`nestedQuoteOpensParagraph`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 274.73 ms sampled self time at `spec/scripts/spec/layout.mjs:3113`.
- [`trackFence`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 9.49 ms sampled self time at `spec/scripts/spec/layout.mjs:3135`.
- [`parseBlocksImpl`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 7.33 ms sampled self time at `spec/scripts/spec/layout.mjs:2073`.

Largest sampled allocation frames: `exec` (2606.68 KiB/call), `nestedQuoteOpensParagraph` (394.51 KiB/call), `parseBlocksImpl` (294.43 KiB/call).

### spec: lists

- [`matchMarkerAt`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 222.65 ms sampled self time at `spec/scripts/spec/layout.mjs:3827`.
- [`opensParagraph`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 47.31 ms sampled self time at `spec/scripts/spec/layout.mjs:1302`.
- [`collectItems`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 17.71 ms sampled self time at `spec/scripts/spec/layout.mjs:3893`.

Largest sampled allocation frames: `exec` (6775.80 KiB/call), `collectItems` (1552.09 KiB/call), `opensParagraph` (1294.70 KiB/call).

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

Serial workers. At least 200ms warmup, then five uninstrumented batches of at least 20ms with 16-call time checks and no iteration cap; GC before each batch. Separate one-call regex instrumentation, 300ms CPU profile at 100us sampling, and 20-call heap sampling at 4096 bytes including collected objects. CPU and heap profiles are statistical estimates; regex input lengths are exposure counts, not engine step counts.

Node v24.19.0; AMD Ryzen 9 PRO 7940HS w/ Radeon 780M Graphics; 16 logical CPUs.
Host load at completion: 8.68, 19.95, 30.25.
Timing and sampling run before regex instrumentation. Patching regex execution
can disable V8 fast paths, so instrumented call counts do not measure native
instruction cost. Full inspector call trees are not retained.

```sh
npm run profile:nesting
npm run report:profiling
npm run check:containers -- --check reports/container-regressions.json
node --test tests/profiling.test.mjs tests/comparison-contracts.test.mjs
```
