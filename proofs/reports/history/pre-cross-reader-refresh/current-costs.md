# Current reader cost investigation

Recorded at 2026-09-29T23:13:04.594Z, using Carve JS `45bbec34edd9d446ba9e78e8031e33c916473923` and the
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
| long-line | parse | carve | 0.174 (0.118–0.189) / 0.185 (0.173–0.209) | 0.178 / 0.205 | 7.4 |
| long-line | parse | carve-no-positions | 0.108 (0.102–0.112) / 0.212 (0.172–0.429) | 0.133 / 0.225 | 8.9 |
| long-line | parse | djot | 0.174 (0.164–0.183) / 0.310 (0.281–0.340) | 0.192 / 0.311 | 17.2 |
| long-line | parse | djot-positions | 0.309 (0.298–0.572) / 1.090 (0.435–1.599) | 0.401 / 1.131 | 16.4 |
| long-line | parse | commonmark | 0.065 (0.064–0.071) / 0.067 (0.064–0.077) | 0.065 / 0.066 | 42.6 |
| long-line | html | carve | 0.485 (0.399–0.523) / 0.478 (0.470–0.531) | 0.480 / 0.476 | 42.7 |
| long-line | html | djot | 0.309 (0.249–0.325) / 0.310 (0.211–0.326) | 0.310 / 0.321 | 16.6 |
| long-line | html | commonmark | 0.071 (0.067–0.073) / 0.069 (0.058–0.071) | 0.071 / 0.069 | 42.5 |
| unclosed-code | parse | carve | 0.429 (0.395–0.459) / 0.277 (0.270–0.342) | 0.417 / 0.285 | 8.0 |
| unclosed-code | parse | carve-no-positions | 0.451 (0.416–0.660) / 0.272 (0.266–0.456) | 0.446 / 0.280 | 9.9 |
| unclosed-code | parse | djot | 0.478 (0.278–0.591) / 0.300 (0.183–0.462) | 0.334 / 0.311 | 17.0 |
| unclosed-code | parse | djot-positions | 0.700 (0.514–0.745) / 0.594 (0.505–1.269) | 0.896 / 0.792 | 18.3 |
| unclosed-code | parse | commonmark | 0.120 (0.090–0.219) / 0.114 (0.109–0.130) | 0.123 / 0.116 | 43.0 |
| unclosed-code | html | carve | 0.963 (0.850–1.094) / 0.587 (0.562–0.650) | 0.940 / 0.602 | 24.1 |
| unclosed-code | html | djot | 0.191 (0.183–0.202) / 0.175 (0.165–0.187) | 0.213 / 0.197 | 20.0 |
| unclosed-code | html | commonmark | 0.079 (0.070–0.094) / 0.072 (0.070–0.086) | 0.085 / 0.081 | 42.6 |
| many-paragraphs | parse | carve | 2.696 (2.370–3.473) / 2.567 (2.289–2.633) | 3.971 / 3.770 | 1768.7 |
| many-paragraphs | parse | carve-no-positions | 4.594 (4.385–5.067) / 4.248 (4.063–4.705) | 6.431 / 5.928 | 2614.3 |
| many-paragraphs | parse | djot | 2.462 (2.371–3.374) / 2.383 (2.217–3.166) | 4.162 / 3.886 | 2606.6 |
| many-paragraphs | parse | djot-positions | 3.325 (2.732–4.035) / 3.177 (2.653–3.387) | 5.949 / 5.606 | 3218.1 |
| many-paragraphs | parse | commonmark | 0.438 (0.424–0.608) / 0.474 (0.451–0.557) | 0.447 / 0.483 | 1336.3 |
| many-paragraphs | html | carve | 0.911 (0.858–1.173) / 0.898 (0.823–1.327) | 1.053 / 1.057 | 1106.0 |
| many-paragraphs | html | djot | 2.878 (2.509–3.308) / 2.699 (2.525–3.301) | 4.691 / 4.438 | 2834.2 |
| many-paragraphs | html | commonmark | 0.721 (0.665–0.951) / 0.656 (0.608–1.117) | 0.737 / 0.686 | 1660.0 |
| nested-quotes | parse | carve | 0.419 (0.385–0.626) / 0.383 (0.358–0.419) | 0.695 / 0.632 | 841.7 |
| nested-quotes | parse | carve-no-positions | 0.577 (0.570–0.663) / 0.603 (0.590–0.657) | 0.934 / 0.983 | 1002.3 |
| nested-quotes | parse | djot | 0.100 (0.097–0.123) / 0.096 (0.094–0.109) | 0.151 / 0.143 | 277.1 |
| nested-quotes | parse | djot-positions | 0.116 (0.104–0.139) / 0.119 (0.110–0.151) | 0.167 / 0.172 | 341.7 |
| nested-quotes | parse | commonmark | 0.032 (0.031–0.037) / 0.034 (0.033–0.038) | 0.033 / 0.035 | 126.1 |
| nested-quotes | html | carve | 0.783 (0.637–1.056) / 0.785 (0.645–0.915) | 1.402 / 1.383 | 1332.7 |
| nested-quotes | html | djot | 0.212 (0.196–0.392) / 0.146 (0.131–0.184) | 0.349 / 0.261 | 346.7 |
| nested-quotes | html | commonmark | 0.066 (0.059–0.075) / 0.061 (0.058–0.082) | 0.068 / 0.064 | 173.5 |
| nested-lists | parse | carve | 1.091 (0.770–1.320) / 1.389 (0.798–2.565) | 1.803 / 2.491 | 1988.9 |
| nested-lists | parse | carve-no-positions | 1.846 (1.342–2.647) / 1.756 (1.156–2.588) | 3.057 / 3.066 | 2214.4 |
| nested-lists | parse | djot | 0.718 (0.698–0.828) / 0.673 (0.634–0.747) | 1.487 / 1.300 | 898.0 |
| nested-lists | parse | djot-positions | 1.063 (0.913–1.155) / 0.786 (0.732–0.913) | 1.788 / 1.432 | 1014.3 |
| nested-lists | parse | commonmark | 0.317 (0.294–0.356) / 0.299 (0.291–0.343) | 0.323 / 0.306 | 302.8 |
| nested-lists | html | carve | 1.733 (1.351–2.198) / 2.471 (1.802–3.196) | 2.770 / 4.108 | 2769.9 |
| nested-lists | html | djot | 0.895 (0.813–0.964) / 0.836 (0.782–0.993) | 1.838 / 1.678 | 1016.5 |
| nested-lists | html | commonmark | 1.068 (0.708–1.795) / 0.381 (0.344–0.431) | 0.701 / 0.389 | 414.0 |

Carve's [positions option](https://github.com/markup-carve/carve-js/blob/45bbec34edd9d446ba9e78e8031e33c916473923/src/source-positions.ts) removes fields from the
finished tree. It still constructs positions during parsing and skips the final
codepoint conversion when disabled. Treat it as an output-shape option, not a
switch that removes all positioning work. Djot's sourcePositions option enables
its position tracking. These variants expose costs; their position formats and
feature sets are not identical.

The [HTML entrypoint](https://github.com/markup-carve/carve-js/blob/45bbec34edd9d446ba9e78e8031e33c916473923/src/index.ts) tries a direct HTML path before building
an AST. Untimed probes record which path accepts each fixture and check direct
output against the public HTML entrypoint: direct: long-line, many-paragraphs; ast: unclosed-code, nested-quotes, nested-lists. An AST fallback still
pays for the rejected direct-path attempt. The unclosed-code HTML profile
attributes substantial sampled work to that eligibility scan; choosing the AST
path does not mean that the fast-path code did no work.
The phases must not be added or interpreted as a single pipeline breakdown.

## Sampled hotspots

Self time per operation below comes from separate CPU profiles, divided by the
number of calls in those profile windows, not from the timing batches. Runtime
and profiler frames are omitted from the CPU shortlist. Heap frames include
runtime allocation sites. Full frame locations remain in the JSON; line numbers
refer to installed JavaScript, not the linked TypeScript.

| Fixture | Phase | Largest Carve CPU frames, sampled self ms/op | Largest allocation frames |
|---|---|---|---|
| long-line | parse | `scanInlineInner` 0.078 ms/op; `normalizeNewlines` 0.033 ms/op; `Lexer` 0.017 ms/op | `Map` 1.1 KiB/op; `Set` 0.9 KiB/op; `parse` 0.7 KiB/op |
| long-line | html | `inlineComplex` 0.272 ms/op; `tryFastHtmlAttempt` 0.168 ms/op; `escapeHtml` 0.059 ms/op | `join` 40.2 KiB/op; `Map` 0.5 KiB/op; `blockish` 0.3 KiB/op |
| unclosed-code | parse | `verbatimSpanEnd` 0.196 ms/op; `trimUnclosedRun` 0.094 ms/op; `normalizeNewlines` 0.050 ms/op | `Map` 1.3 KiB/op; `Set` 1.0 KiB/op; `parse` 0.9 KiB/op |
| unclosed-code | html | `inlineComplex` 0.185 ms/op; `verbatimSpanEnd` 0.163 ms/op; `tryFastHtmlAttempt` 0.110 ms/op | `Map` 4.2 KiB/op; `next` 2.2 KiB/op; `Set` 1.7 KiB/op |
| many-paragraphs | parse | `parseBlockInner` 0.423 ms/op; `parseParagraph` 0.174 ms/op; `scanInlineInner` 0.151 ms/op | `parseParagraph` 444.5 KiB/op; `scanInlineInner` 278.3 KiB/op; `applyLinkDefs` 186.3 KiB/op |
| many-paragraphs | html | `renderBlocks` 0.152 ms/op; `escapeHtml` 0.102 ms/op; `tryFastHtmlAttempt` 0.096 ms/op | `renderBlocks` 514.3 KiB/op; `push` 117.3 KiB/op; `(anonymous)` 111.6 KiB/op |
| nested-quotes | parse | `parseBlockInner` 0.071 ms/op; `attachDocumentOffsets` 0.031 ms/op; `parseBlockQuote` 0.031 ms/op | `parseBlockQuote` 171.7 KiB/op; `push` 134.8 KiB/op; `attachDocumentOffsets` 127.9 KiB/op |
| nested-quotes | html | `parseBlockInner` 0.085 ms/op; `visit` 0.041 ms/op; `attachDocumentOffsets` 0.040 ms/op | `parseBlockQuote` 168.2 KiB/op; `renderBlockNode` 151.2 KiB/op; `push` 135.1 KiB/op |
| nested-lists | parse | `parseList` 0.204 ms/op; `parseBlockInner` 0.088 ms/op; `unorderedMatch` 0.062 ms/op | `parseList` 546.5 KiB/op; `Map` 242.2 KiB/op; `Set` 202.4 KiB/op |
| nested-lists | html | `parseList` 0.265 ms/op; `parseBlockInner` 0.116 ms/op; `visit` 0.087 ms/op | `parseList` 546.3 KiB/op; `Map` 247.3 KiB/op; `Set` 202.8 KiB/op |

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
commit `7b6e57b69dced437822647682838688100ca65c6`.
The current profile records their resulting costs, but the shared host does
not establish a controlled speed improvement. Ownership and performance now
use the same JavaScript commit, with their different test scopes recorded
separately. The original model and historical baselines retain their pins.

## Method and limits

Two fresh-worker rounds per fixture and phase, with reversed variant order in the second round. Parse and full HTML measured separately at the largest existing fixture per family. 500ms warmup, seven batches of at least 100ms with GC before each; separate 500ms CPU profile and 50-call heap sample at 4096 bytes, including collected objects. Position variants preserve the same reader tree after removing positions. Shared host; samples are not performance thresholds.

Host load averaged 13.87, 13.9, 11.1 at the start and
9.66, 12.72, 11.22 at the end on 16
logical CPUs. This was not an idle-host run. Scheduling, JIT state and GC can
change ratios, even with reversed variant order. Overlapping sample ranges do
not establish an ordering. Confirm improvements with controlled paired runs before setting
budgets. Position-variant trees are checked against their default reader after
removing position fields, outside the measured operations.

Reproduce with `npm run profile:costs` and `npm run report:costs`.
The site's "Current costs and positions" dataset provides charts and exact exports.
