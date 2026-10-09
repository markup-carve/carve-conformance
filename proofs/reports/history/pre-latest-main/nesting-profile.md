# Nested-container profiling

The refreshed JavaScript reader already contains quote-state reuse and prefix
memoization. At depth 192, both quote and list parsing use fewer than half the
regex calls recorded by the earlier reader. The historical
[profile](history/pre-prefix-refresh/nesting-profile.json) and
[report](history/pre-prefix-refresh/nesting-profile.md) remain available.

This reader snapshot was recorded at 2026-09-29T13:55:00.534Z.
The immediately preceding [profile](history/pre-current-refresh/nesting-profile.json)
and [report](history/pre-current-refresh/nesting-profile.md) preserve the prior reader.

Current JS pin: `7b6e57b69dced437822647682838688100ca65c6`.
Earlier JS pin: `c5df77f658c80a3a80a4d31ec1855d854e5da648`.
The executable specification remains pinned separately to
`d20ebd942f91470485332cec925fa0717f20a58a`; its measurements do not describe the latest specification.
The model's JS dependency also stays at its original pin. The comparison uses
the separately locked `carve-comparison` dependency.

## Recorded change at depth 192

| Family | Regex calls, before → after | Call reduction | Sampled allocation KiB/call, before → after |
|---|---:|---:|---:|
| quotes | 118152 → 4295 | 96.36% | 7327.37 → 1433.94 |
| lists | 106927 → 11406 | 89.33% | 5840.93 → 2807.16 |

Regex calls are deterministic observations under the same instrumentation.
Allocation estimates come from separate runs on a shared host and remain
subject to sampling variation. Wall times are shown only for the current run
below; differing host load prevents attributing a before/after timing change
to the prefix optimization.

The relevant changes landed in
[quote-state reuse](https://github.com/markup-carve/carve-js/pull/2259) and
[prefix classification reuse](https://github.com/markup-carve/carve-js/pull/2274)
before this refresh.
The current reader also replaces repeated quote and unordered-list tail captures
with prefix recognition and reuses recorded origins for literal prefix strips.

Against the immediately preceding snapshot, regex calls at depth 192 changed by
quotes: 4103 → 4295 (+192); lists: 11214 → 11406 (+192). These net changes are recorded separately from the larger
historical reduction; it is not evidence of a wall-time regression.

## Current growth and phase costs

| Reader | Family | Regex calls, depth 64 → 128 | Call growth | Regex input exposure, 64 → 128 | Parse wall ms, 192 | Render wall ms, 192 |
|---|---|---:|---:|---:|---:|---:|
| js | quotes | 1479 → 2887 | 1.95× | 101831 → 391879 | 1.35 | 0.10 |
| js | lists | 3854 → 7630 | 1.98× | 257375 → 997855 | 2.94 | 0.23 |
| spec | quotes | 8237 → 28749 | 3.49× | 389638 → 2593766 | 17.26 | 1.96 |
| spec | lists | 12278 → 45014 | 3.67× | 568801 → 4008833 | 28.37 | 4.23 |

Input exposure charges the complete input for every regex call, including failed
anchored checks and global matches that resume at the previous match. For example,
matching each quote marker in a 256-character prefix with a global regex makes
129 calls, charging 33,024 input characters while advancing through 256.

| Reader | Family | Successful match lengths, 64 → 128 | Global forward progress, 64 → 128 | Suffix argument lengths, 64 → 128 |
|---|---|---:|---:|---:|
| js | quotes | 707 → 1411 | 263 → 519 | 0 → 0 |
| js | lists | 1277 → 2557 | 135 → 263 | 0 → 0 |
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
| js | quotes | 467.66 | 936.12 | 1433.94 |
| js | lists | 939.81 | 1879.08 | 2807.16 |
| spec | quotes | 457.17 | 1582.05 | 3344.90 |
| spec | lists | 1285.55 | 4669.30 | 10065.49 |

### js: quotes

- [`parseBlockInner`](https://github.com/markup-carve/carve-js/blob/7b6e57b69dced437822647682838688100ca65c6/src/parse.ts): 49.94 ms sampled self time at `node_modules/carve-comparison/dist/parse.js:7742`.
- [`Lexer`](https://github.com/markup-carve/carve-js/blob/7b6e57b69dced437822647682838688100ca65c6/src/parse.ts): 29.86 ms sampled self time at `node_modules/carve-comparison/dist/parse.js:551`.
- [`Lexer`](https://github.com/markup-carve/carve-js/blob/7b6e57b69dced437822647682838688100ca65c6/src/parse.ts): 25.35 ms sampled self time at `node_modules/carve-comparison/dist/parse.js:757`.

Largest sampled allocation frames: `Map` (341.34 KiB/call), `push` (228.82 KiB/call), `Set` (176.42 KiB/call).

### js: lists

- [`parseList`](https://github.com/markup-carve/carve-js/blob/7b6e57b69dced437822647682838688100ca65c6/src/parse.ts): 62.62 ms sampled self time at `node_modules/carve-comparison/dist/parse.js:9708`.
- [`parseBlockInner`](https://github.com/markup-carve/carve-js/blob/7b6e57b69dced437822647682838688100ca65c6/src/parse.ts): 32.08 ms sampled self time at `node_modules/carve-comparison/dist/parse.js:7742`.
- [`Lexer`](https://github.com/markup-carve/carve-js/blob/7b6e57b69dced437822647682838688100ca65c6/src/parse.ts): 14.37 ms sampled self time at `node_modules/carve-comparison/dist/parse.js:551`.

Largest sampled allocation frames: `Map` (567.64 KiB/call), `parseList` (486.87 KiB/call), `Set` (369.36 KiB/call).

### spec: quotes

- [`nestedQuoteOpensParagraph`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 269.62 ms sampled self time at `spec/scripts/spec/layout.mjs:3113`.
- [`parseBlocksImpl`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 20.99 ms sampled self time at `spec/scripts/spec/layout.mjs:2073`.
- [`trackFence`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 10.74 ms sampled self time at `spec/scripts/spec/layout.mjs:3135`.

Largest sampled allocation frames: `exec` (2570.77 KiB/call), `nestedQuoteOpensParagraph` (397.91 KiB/call), `parseBlocksImpl` (185.99 KiB/call).

### spec: lists

- [`matchMarkerAt`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 220.23 ms sampled self time at `spec/scripts/spec/layout.mjs:3827`.
- [`opensParagraph`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 40.10 ms sampled self time at `spec/scripts/spec/layout.mjs:1302`.
- [`collectItems`](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/scripts/spec/layout.mjs): 29.30 ms sampled self time at `spec/scripts/spec/layout.mjs:3893`.

Largest sampled allocation frames: `exec` (6765.99 KiB/call), `collectItems` (1610.77 KiB/call), `opensParagraph` (1298.33 KiB/call).

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

Node v24.19.0; AMD Ryzen 9 PRO 7940HS w/ Radeon 780M Graphics; 16 logical CPUs.
Host load at completion: 23.05, 14.02, 17.3.
Timing and sampling run before regex instrumentation. Patching regex execution
can disable V8 fast paths, so instrumented call counts do not measure native
instruction cost. Full inspector call trees are not retained.

```sh
npm run profile:nesting
npm run report:profiling
npm run check:containers -- --check reports/container-regressions.json
node --test tests/profiling.test.mjs tests/comparison-contracts.test.mjs
```
