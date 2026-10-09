# Current reader cost investigation

Recorded at 2026-09-30T15:24:12.621Z, using Carve JS `6d02fa7062dd03024e7c092016459602e9a7aeec` and the
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
| long-line | parse | carve | 0.099 (0.098–0.101) / 0.098 (0.097–0.101) | 0.121 / 0.118 | 6.9 |
| long-line | parse | carve-no-positions | 0.105 (0.095–0.112) / 0.104 (0.100–0.107) | 0.132 / 0.130 | 9.4 |
| long-line | parse | djot | 0.154 (0.153–0.156) / 0.152 (0.148–0.153) | 0.170 / 0.168 | 16.4 |
| long-line | parse | djot-positions | 0.265 (0.261–0.269) / 0.263 (0.257–0.269) | 0.347 / 0.337 | 18.2 |
| long-line | parse | commonmark | 0.040 (0.039–0.040) / 0.037 (0.037–0.038) | 0.041 / 0.038 | 42.3 |
| long-line | html | carve | 0.237 (0.236–0.238) / 0.236 (0.235–0.238) | 0.242 / 0.241 | 42.6 |
| long-line | html | djot | 0.158 (0.154–0.159) / 0.157 (0.152–0.158) | 0.174 / 0.172 | 17.7 |
| long-line | html | commonmark | 0.041 (0.041–0.041) / 0.041 (0.041–0.042) | 0.042 / 0.042 | 42.3 |
| long-line | direct-html-probe | carve | 0.235 (0.235–0.237) / 0.236 (0.235–0.237) | 0.241 / 0.242 | 42.3 |
| unclosed-code | parse | carve | 0.253 (0.251–0.254) / 0.254 (0.254–0.258) | 0.260 / 0.263 | 7.1 |
| unclosed-code | parse | carve-no-positions | 0.256 (0.254–0.262) / 0.254 (0.252–0.266) | 0.280 / 0.273 | 9.9 |
| unclosed-code | parse | djot | 0.159 (0.157–0.161) / 0.159 (0.155–0.161) | 0.181 / 0.180 | 17.3 |
| unclosed-code | parse | djot-positions | 0.269 (0.263–0.273) / 0.267 (0.265–0.290) | 0.352 / 0.341 | 17.7 |
| unclosed-code | parse | commonmark | 0.064 (0.063–0.069) / 0.063 (0.063–0.066) | 0.065 / 0.066 | 42.0 |
| unclosed-code | html | carve | 0.538 (0.537–0.543) / 0.550 (0.543–0.557) | 0.557 / 0.571 | 22.7 |
| unclosed-code | html | djot | 0.163 (0.161–0.165) / 0.161 (0.159–0.165) | 0.185 / 0.185 | 20.4 |
| unclosed-code | html | commonmark | 0.066 (0.066–0.070) / 0.066 (0.065–0.071) | 0.068 / 0.067 | 42.9 |
| unclosed-code | direct-html-probe | carve | 0.181 (0.180–0.184) / 0.205 (0.205–0.206) | 0.184 / 0.210 | 2.5 |
| many-paragraphs | parse | carve | 2.212 (2.152–2.435) / 2.295 (2.190–2.556) | 3.390 / 3.584 | 1579.1 |
| many-paragraphs | parse | carve-no-positions | 3.655 (3.569–4.188) / 3.747 (3.611–4.141) | 5.483 / 5.670 | 2305.4 |
| many-paragraphs | parse | djot | 2.523 (2.384–4.240) / 2.383 (2.249–2.702) | 4.321 / 4.079 | 2589.6 |
| many-paragraphs | parse | djot-positions | 3.422 (3.214–3.626) / 3.514 (3.302–3.620) | 6.286 / 6.381 | 3233.6 |
| many-paragraphs | parse | commonmark | 0.492 (0.489–0.554) / 0.495 (0.491–0.556) | 0.505 / 0.507 | 1338.3 |
| many-paragraphs | html | carve | 0.894 (0.873–0.950) / 0.912 (0.867–0.986) | 1.040 / 1.090 | 1121.8 |
| many-paragraphs | html | djot | 2.729 (2.608–3.406) / 3.232 (2.723–3.420) | 4.676 / 6.157 | 2845.6 |
| many-paragraphs | html | commonmark | 0.747 (0.738–0.923) / 0.742 (0.726–0.911) | 0.771 / 0.762 | 1665.9 |
| many-paragraphs | direct-html-probe | carve | 0.875 (0.862–0.933) / 0.878 (0.866–0.921) | 1.004 / 1.005 | 1099.0 |
| nested-quotes | parse | carve | 0.447 (0.392–0.521) / 0.433 (0.397–0.453) | 0.747 / 0.708 | 780.9 |
| nested-quotes | parse | carve-no-positions | 0.640 (0.580–0.668) / 0.638 (0.589–0.659) | 1.092 / 1.077 | 913.2 |
| nested-quotes | parse | djot | 0.128 (0.121–0.151) / 0.123 (0.119–0.137) | 0.206 / 0.191 | 268.2 |
| nested-quotes | parse | djot-positions | 0.142 (0.125–0.171) / 0.141 (0.131–0.154) | 0.222 / 0.215 | 339.6 |
| nested-quotes | parse | commonmark | 0.038 (0.037–0.039) / 0.037 (0.036–0.038) | 0.039 / 0.038 | 125.8 |
| nested-quotes | html | carve | 0.746 (0.543–0.930) / 0.735 (0.477–0.933) | 1.290 / 1.265 | 1308.9 |
| nested-quotes | html | djot | 0.161 (0.150–0.184) / 0.157 (0.147–0.185) | 0.257 / 0.248 | 343.0 |
| nested-quotes | html | commonmark | 0.064 (0.062–0.067) / 0.064 (0.060–0.069) | 0.067 / 0.067 | 175.5 |
| nested-quotes | direct-html-probe | carve | 0.002 (0.001–0.002) / 0.001 (0.001–0.002) | 0.002 / 0.002 | 1.5 |
| nested-lists | parse | carve | 1.344 (0.765–1.414) / 1.279 (0.824–1.611) | 2.254 / 2.177 | 1960.7 |
| nested-lists | parse | carve-no-positions | 1.674 (1.135–2.016) / 1.700 (1.066–1.811) | 2.576 / 2.665 | 2176.0 |
| nested-lists | parse | djot | 0.921 (0.634–0.971) / 0.953 (0.709–1.063) | 1.870 / 1.968 | 892.3 |
| nested-lists | parse | djot-positions | 1.005 (0.803–1.079) / 0.974 (0.796–1.080) | 1.870 / 1.848 | 1014.9 |
| nested-lists | parse | commonmark | 0.339 (0.332–0.376) / 0.338 (0.334–0.348) | 0.347 / 0.346 | 303.9 |
| nested-lists | html | carve | 1.931 (1.281–2.143) / 1.914 (1.689–2.115) | 3.240 / 3.400 | 2709.1 |
| nested-lists | html | djot | 1.004 (0.758–1.167) / 1.044 (0.759–1.254) | 2.019 / 2.050 | 1003.7 |
| nested-lists | html | commonmark | 0.396 (0.393–0.398) / 0.393 (0.391–0.401) | 0.405 / 0.402 | 413.8 |
| nested-lists | direct-html-probe | carve | 0.001 (0.001–0.001) / 0.001 (0.001–0.001) | 0.002 / 0.002 | 0.9 |
| interior-whitespace | parse | carve | 0.042 (0.041–0.043) / 0.043 (0.040–0.043) | 0.063 / 0.064 | 6.3 |
| interior-whitespace | parse | carve-no-positions | 0.047 (0.044–0.048) / 0.048 (0.047–0.049) | 0.074 / 0.077 | 8.9 |
| interior-whitespace | parse | djot | 0.074 (0.073–0.078) / 0.075 (0.075–0.076) | 0.084 / 0.088 | 16.5 |
| interior-whitespace | parse | djot-positions | 0.120 (0.119–0.128) / 0.122 (0.109–0.137) | 0.159 / 0.162 | 17.6 |
| interior-whitespace | parse | commonmark | 0.017 (0.017–0.017) / 0.017 (0.017–0.017) | 0.018 / 0.018 | 18.0 |
| interior-whitespace | html | carve | 0.096 (0.095–0.099) / 0.096 (0.095–0.100) | 0.098 / 0.098 | 18.3 |
| interior-whitespace | html | djot | 0.077 (0.075–0.078) / 0.078 (0.076–0.078) | 0.089 / 0.090 | 16.7 |
| interior-whitespace | html | commonmark | 0.019 (0.019–0.019) / 0.018 (0.018–0.019) | 0.019 / 0.019 | 18.6 |
| interior-whitespace | direct-html-probe | carve | 0.096 (0.096–0.100) / 0.096 (0.095–0.099) | 0.098 / 0.098 | 17.2 |
| literal-brackets | parse | carve | 2.224 (1.896–2.626) / 2.203 (2.133–2.530) | 3.380 / 3.361 | 1591.6 |
| literal-brackets | parse | carve-no-positions | 3.635 (3.573–3.972) / 3.667 (3.443–3.872) | 5.384 / 5.316 | 2300.8 |
| literal-brackets | parse | djot | 2.574 (2.488–3.174) / 2.590 (2.424–3.131) | 4.370 / 4.535 | 2582.1 |
| literal-brackets | parse | djot-positions | 3.453 (3.268–3.721) / 3.440 (3.398–3.688) | 6.420 / 6.369 | 3235.8 |
| literal-brackets | parse | commonmark | 0.504 (0.501–0.570) / 0.503 (0.500–0.574) | 0.516 / 0.513 | 1344.0 |
| literal-brackets | html | carve | 4.138 (3.854–4.790) / 4.414 (3.939–4.896) | 6.706 / 7.134 | 3328.4 |
| literal-brackets | html | djot | 2.723 (2.623–3.246) / 3.153 (2.676–3.493) | 4.770 / 5.999 | 2845.3 |
| literal-brackets | html | commonmark | 0.744 (0.702–0.869) / 0.736 (0.726–0.943) | 0.768 / 0.756 | 1647.1 |
| literal-brackets | direct-html-probe | carve | 0.141 (0.139–0.144) / 0.142 (0.140–0.143) | 0.147 / 0.147 | 162.8 |
| inline-links | parse | carve | 6.397 (5.081–6.758) / 6.698 (6.332–7.536) | 11.476 / 12.019 | 4639.3 |
| inline-links | parse | carve-no-positions | 9.994 (9.359–10.268) / 9.742 (9.389–10.562) | 15.369 / 15.543 | 6246.6 |
| inline-links | parse | djot | 4.768 (4.577–5.062) / 4.666 (4.534–6.654) | 8.311 / 8.195 | 5048.7 |
| inline-links | parse | djot-positions | 7.297 (6.937–7.770) / 7.603 (6.857–8.202) | 16.006 / 16.228 | 6534.0 |
| inline-links | parse | commonmark | 1.589 (1.542–1.914) / 1.569 (1.520–1.917) | 1.618 / 1.604 | 3094.8 |
| inline-links | html | carve | 2.259 (2.179–2.292) / 2.240 (2.187–2.288) | 2.847 / 2.783 | 2006.8 |
| inline-links | html | djot | 6.938 (6.515–7.163) / 6.767 (5.093–7.447) | 14.343 / 14.316 | 5794.3 |
| inline-links | html | commonmark | 2.176 (2.172–2.590) / 2.172 (2.159–2.577) | 2.230 / 2.224 | 4104.0 |
| inline-links | direct-html-probe | carve | 2.226 (2.214–2.328) / 2.276 (2.223–2.359) | 2.803 / 2.929 | 2006.8 |
| sparse-definitions | parse | carve | 7.832 (5.018–8.303) / 7.576 (5.254–9.403) | 14.425 / 14.101 | 3941.0 |
| sparse-definitions | parse | carve-no-positions | 8.946 (8.251–9.424) / 8.890 (8.568–9.162) | 14.977 / 15.543 | 4748.5 |
| sparse-definitions | parse | djot | 2.602 (2.501–3.358) / 3.194 (2.665–3.286) | 4.841 / 6.632 | 2606.2 |
| sparse-definitions | parse | djot-positions | 3.713 (3.613–3.995) / 3.660 (3.556–4.069) | 7.293 / 7.272 | 3248.5 |
| sparse-definitions | parse | commonmark | 0.513 (0.510–0.575) / 0.509 (0.508–0.574) | 0.525 / 0.527 | 1340.3 |
| sparse-definitions | html | carve | 0.880 (0.870–0.973) / 0.925 (0.898–0.999) | 1.007 / 1.096 | 1106.7 |
| sparse-definitions | html | djot | 3.496 (3.165–3.732) / 3.293 (2.684–3.635) | 7.117 / 6.959 | 2829.5 |
| sparse-definitions | html | commonmark | 0.749 (0.734–0.951) / 0.750 (0.745–0.934) | 0.769 / 0.778 | 1668.5 |
| sparse-definitions | direct-html-probe | carve | 0.879 (0.871–0.962) / 0.879 (0.876–0.952) | 1.006 / 1.011 | 1114.0 |
| dense-definitions | parse | carve | 4.446 (3.031–4.548) / 4.302 (2.877–4.652) | 7.069 / 7.167 | 2994.0 |
| dense-definitions | parse | carve-no-positions | 5.097 (3.588–5.328) / 5.026 (4.780–6.728) | 8.363 / 8.383 | 3526.8 |
| dense-definitions | parse | djot | 2.194 (1.853–2.526) / 2.213 (1.735–2.421) | 4.457 / 4.682 | 1797.4 |
| dense-definitions | parse | djot-positions | 2.740 (2.146–3.205) / 2.877 (1.954–3.266) | 5.507 / 5.400 | 2304.8 |
| dense-definitions | parse | commonmark | 0.690 (0.680–0.786) / 0.716 (0.687–0.767) | 0.707 / 0.733 | 1035.3 |
| dense-definitions | html | carve | 5.114 (4.050–5.318) / 5.375 (4.936–7.091) | 8.722 / 9.966 | 4209.1 |
| dense-definitions | html | djot | 2.437 (1.758–2.664) / 2.434 (1.814–2.683) | 5.004 / 5.070 | 1984.6 |
| dense-definitions | html | commonmark | 0.812 (0.802–0.897) / 0.805 (0.803–0.901) | 0.833 / 0.827 | 1259.9 |
| dense-definitions | direct-html-probe | carve | 0.072 (0.071–0.074) / 0.071 (0.070–0.071) | 0.076 / 0.074 | 67.3 |
| long-unicode | parse | carve | 0.860 (0.851–0.913) / 0.885 (0.863–0.935) | 0.886 / 0.933 | 9.0 |
| long-unicode | parse | carve-no-positions | 0.424 (0.421–0.443) / 0.458 (0.438–0.460) | 0.434 / 0.543 | 9.2 |
| long-unicode | parse | djot | 0.288 (0.282–0.290) / 0.288 (0.281–0.289) | 0.312 / 0.313 | 17.7 |
| long-unicode | parse | djot-positions | 0.528 (0.509–0.555) / 0.548 (0.506–0.635) | 0.682 / 0.732 | 275.7 |
| long-unicode | parse | commonmark | 0.218 (0.211–0.225) / 0.223 (0.221–0.225) | 0.222 / 0.228 | 146.5 |
| long-unicode | html | carve | 1.077 (1.034–1.110) / 1.043 (1.023–1.085) | 1.294 / 1.233 | 21.9 |
| long-unicode | html | djot | 0.332 (0.328–0.338) / 0.337 (0.331–0.339) | 0.362 / 0.368 | 18.2 |
| long-unicode | html | commonmark | 0.264 (0.262–0.270) / 0.263 (0.261–0.266) | 0.269 / 0.268 | 146.9 |
| long-unicode | direct-html-probe | carve | 2.12e-5 (2.05e-5–2.22e-5) / 2.13e-5 (2.06e-5–2.20e-5) | 2.39e-5 / 2.45e-5 | 0.2 |
| unicode-paragraphs | parse | carve | 3.274 (3.218–3.462) / 3.148 (2.786–3.400) | 5.140 / 4.843 | 2113.4 |
| unicode-paragraphs | parse | carve-no-positions | 3.749 (3.500–3.868) / 3.649 (3.557–4.089) | 5.591 / 5.382 | 2306.8 |
| unicode-paragraphs | parse | djot | 2.465 (2.330–3.177) / 2.459 (2.308–2.701) | 4.173 / 4.214 | 2588.7 |
| unicode-paragraphs | parse | djot-positions | 3.576 (3.451–3.778) / 3.585 (3.393–3.725) | 6.457 / 6.498 | 3286.3 |
| unicode-paragraphs | parse | commonmark | 0.588 (0.585–0.719) / 0.586 (0.580–0.755) | 0.602 / 0.599 | 1364.1 |
| unicode-paragraphs | html | carve | 4.831 (4.588–6.848) / 4.716 (4.585–6.742) | 7.713 / 7.512 | 3729.5 |
| unicode-paragraphs | html | djot | 2.797 (2.675–3.510) / 3.146 (2.607–3.550) | 4.787 / 5.953 | 2859.8 |
| unicode-paragraphs | html | commonmark | 0.802 (0.793–1.007) / 0.808 (0.791–1.009) | 0.824 / 0.838 | 1683.6 |
| unicode-paragraphs | direct-html-probe | carve | 2.04e-5 (1.97e-5–2.17e-5) / 2.03e-5 (1.97e-5–2.13e-5) | 2.33e-5 / 2.37e-5 | 0.2 |

Carve's [positions option](https://github.com/markup-carve/carve-js/blob/6d02fa7062dd03024e7c092016459602e9a7aeec/src/source-positions.ts) removes fields from the
finished tree. It still constructs positions during parsing and skips the final
codepoint conversion when disabled. Treat it as an output-shape option, not a
switch that removes all positioning work. Disabling positions can cost more
than keeping them because removing fields adds work. Djot's sourcePositions option enables
its position tracking. These variants expose costs; their position formats and
feature sets are not identical.

The [HTML entrypoint](https://github.com/markup-carve/carve-js/blob/6d02fa7062dd03024e7c092016459602e9a7aeec/src/index.ts) tries a direct HTML path before building
an AST. Untimed probes record which path accepts each fixture and check direct
output against the public HTML entrypoint: direct: long-line, many-paragraphs, interior-whitespace, inline-links, sparse-definitions; ast: unclosed-code, nested-quotes, nested-lists, literal-brackets, dense-definitions, long-unicode, unicode-paragraphs. An AST fallback still
pays for the rejected direct-path attempt. The `direct-html-probe` phase measures
that attempt independently, including declines, without running the AST fallback. Accepted probes include direct HTML generation. Rejected probes stop before
the AST fallback. Choosing that fallback does not remove the earlier attempt.
The phases must not be added or interpreted as a single pipeline breakdown.

## Sampled hotspots

Self time per operation below comes from separate CPU profiles, divided by the
number of calls in those profile windows, not from the timing batches. Runtime
and profiler frames are omitted from the CPU shortlist. Heap frames include
runtime allocation sites. Full frame locations remain in the JSON; line numbers
refer to installed JavaScript, not the linked TypeScript.

| Fixture | Phase | Largest Carve CPU frames, sampled self ms/op | Largest allocation frames |
|---|---|---|---|
| long-line | parse | `scanInlineInner` 0.041 ms/op; `normalizeNewlines` 0.028 ms/op; `lineTerminatorFree` 0.003 ms/op | `Map` 1.4 KiB/op; `Set` 1.1 KiB/op; `parse` 0.7 KiB/op |
| long-line | html | `inlineComplex` 0.120 ms/op; `tryFastHtmlAttempt` 0.069 ms/op; `escapeHtml` 0.049 ms/op | `join` 40.1 KiB/op; `Map` 0.6 KiB/op; `tryFastHtmlAttempt` 0.3 KiB/op |
| long-line | direct-html-probe | `inlineComplex` 0.118 ms/op; `tryFastHtmlAttempt` 0.070 ms/op; `escapeHtml` 0.051 ms/op | `join` 40.1 KiB/op; `Map` 0.4 KiB/op; `push` 0.2 KiB/op |
| unclosed-code | parse | `verbatimSpanEnd` 0.141 ms/op; `trimUnclosedRun` 0.065 ms/op; `normalizeNewlines` 0.027 ms/op | `Map` 1.5 KiB/op; `Set` 1.0 KiB/op; `push` 0.7 KiB/op |
| unclosed-code | html | `verbatimSpanEnd` 0.133 ms/op; `inlineComplex` 0.127 ms/op; `tryFastHtmlAttempt` 0.101 ms/op | `Map` 4.2 KiB/op; `next` 3.0 KiB/op; `Set` 1.6 KiB/op |
| unclosed-code | direct-html-probe | `inlineComplex` 0.120 ms/op; `tryFastHtmlAttempt` 0.081 ms/op; `collectDefs` 0.001 ms/op | `Map` 0.5 KiB/op; `push` 0.3 KiB/op; `tryFastHtmlAttempt` 0.3 KiB/op |
| many-paragraphs | parse | `parseBlockInner` 0.350 ms/op; `scanInlineInner` 0.135 ms/op; `parseParagraph` 0.121 ms/op | `parseParagraph` 439.1 KiB/op; `scanInlineInner` 272.5 KiB/op; `parseBlockInner` 145.3 KiB/op |
| many-paragraphs | html | `renderBlocks` 0.148 ms/op; `escapeHtml` 0.104 ms/op; `tryFastHtmlAttempt` 0.096 ms/op | `renderBlocks` 524.5 KiB/op; `push` 121.2 KiB/op; `renderInline` 113.3 KiB/op |
| many-paragraphs | direct-html-probe | `renderBlocks` 0.152 ms/op; `escapeHtml` 0.102 ms/op; `tryFastHtmlAttempt` 0.097 ms/op | `renderBlocks` 519.3 KiB/op; `push` 116.3 KiB/op; `(anonymous)` 110.5 KiB/op |
| nested-quotes | parse | `parseBlockInner` 0.069 ms/op; `parseBlockQuote` 0.033 ms/op; `attachDocumentOffsets` 0.030 ms/op | `parseBlockQuote` 165.7 KiB/op; `push` 139.3 KiB/op; `attachDocumentOffsets` 124.6 KiB/op |
| nested-quotes | html | `parseBlockInner` 0.066 ms/op; `visit` 0.036 ms/op; `parseBlockQuote` 0.034 ms/op | `parseBlockQuote` 175.9 KiB/op; `push` 135.0 KiB/op; `attachDocumentOffsets` 125.9 KiB/op |
| nested-quotes | direct-html-probe | `tryFastHtmlAttempt` 0.001 ms/op; `renderBlocks` 0.000 ms/op; `collectDefs` 0.000 ms/op | `renderBlocks` 0.3 KiB/op; `Map` 0.2 KiB/op; `tryFastHtmlAttempt` 0.2 KiB/op |
| nested-lists | parse | `parseList` 0.210 ms/op; `parseBlockInner` 0.079 ms/op; `unorderedMatch` 0.069 ms/op | `parseList` 549.2 KiB/op; `Map` 208.5 KiB/op; `Set` 202.8 KiB/op |
| nested-lists | html | `parseList` 0.207 ms/op; `parseBlockInner` 0.080 ms/op; `indent` 0.078 ms/op | `parseList` 544.6 KiB/op; `Map` 209.0 KiB/op; `Set` 201.9 KiB/op |
| nested-lists | direct-html-probe | `tryFastHtmlAttempt` 0.001 ms/op; `renderBlocks` 0.000 ms/op; `collectDefs` 0.000 ms/op | `Map` 0.2 KiB/op; `tryFastHtmlAttempt` 0.2 KiB/op; `renderBlocks` 0.2 KiB/op |
| interior-whitespace | parse | `scanInlineInner` 0.018 ms/op; `normalizeNewlines` 0.011 ms/op; `Lexer` 0.001 ms/op | `Map` 1.4 KiB/op; `Set` 0.8 KiB/op; `parse` 0.5 KiB/op |
| interior-whitespace | html | `inlineComplex` 0.047 ms/op; `tryFastHtmlAttempt` 0.029 ms/op; `escapeHtml` 0.021 ms/op | `join` 16.4 KiB/op; `Map` 0.4 KiB/op; `blockish` 0.3 KiB/op |
| interior-whitespace | direct-html-probe | `inlineComplex` 0.048 ms/op; `tryFastHtmlAttempt` 0.032 ms/op; `escapeHtml` 0.020 ms/op | `join` 15.9 KiB/op; `escapeHtml` 0.2 KiB/op; `push` 0.2 KiB/op |
| literal-brackets | parse | `parseBlockInner` 0.339 ms/op; `scanInlineInner` 0.133 ms/op; `parseParagraph` 0.131 ms/op | `parseParagraph` 434.8 KiB/op; `scanInlineInner` 276.8 KiB/op; `parseBlockInner` 143.6 KiB/op |
| literal-brackets | html | `parseBlockInner` 0.357 ms/op; `visit` 0.348 ms/op; `scanInlineInner` 0.134 ms/op | `entries` 522.9 KiB/op; `parseParagraph` 435.8 KiB/op; `scanInlineInner` 278.1 KiB/op |
| literal-brackets | direct-html-probe | `tryFastHtmlAttempt` 0.088 ms/op; `(anonymous)` 0.030 ms/op; `collectDefs` 0.014 ms/op | `tryFastHtmlAttempt` 112.1 KiB/op; `split` 48.7 KiB/op; `blockish` 0.3 KiB/op |
| inline-links | parse | `newlineIndices` 0.763 ms/op; `scanInlineInner` 0.676 ms/op; `parseBlockInner` 0.430 ms/op | `scanInlineInner` 1251.7 KiB/op; `buildBracketMap` 648.1 KiB/op; `Map` 550.4 KiB/op |
| inline-links | html | `escapeHtml` 0.333 ms/op; `renderInline` 0.297 ms/op; `renderBlocks` 0.220 ms/op | `renderBlocks` 467.7 KiB/op; `escapeHtml` 337.9 KiB/op; `push` 306.5 KiB/op |
| inline-links | direct-html-probe | `escapeHtml` 0.316 ms/op; `renderInline` 0.288 ms/op; `renderBlocks` 0.231 ms/op | `renderBlocks` 479.9 KiB/op; `escapeHtml` 333.2 KiB/op; `push` 307.6 KiB/op |
| sparse-definitions | parse | `collectLinkDefs` 1.328 ms/op; `isBlankLine` 0.484 ms/op; `parseBlockInner` 0.356 ms/op | `collectLinkDefs` 1658.3 KiB/op; `parseParagraph` 441.0 KiB/op; `stripContainerPrefixes` 372.5 KiB/op |
| sparse-definitions | html | `renderBlocks` 0.154 ms/op; `tryFastHtmlAttempt` 0.107 ms/op; `escapeHtml` 0.105 ms/op | `renderBlocks` 518.8 KiB/op; `push` 119.4 KiB/op; `(anonymous)` 110.8 KiB/op |
| sparse-definitions | direct-html-probe | `renderBlocks` 0.141 ms/op; `escapeHtml` 0.105 ms/op; `tryFastHtmlAttempt` 0.104 ms/op | `renderBlocks` 524.8 KiB/op; `push` 121.5 KiB/op; `renderInline` 109.7 KiB/op |
| dense-definitions | parse | `collectLinkDefs` 0.656 ms/op; `matchLinkDef` 0.288 ms/op; `isBlankLine` 0.185 ms/op | `collectLinkDefs` 775.9 KiB/op; `matchLinkDef` 297.6 KiB/op; `exec` 280.1 KiB/op |
| dense-definitions | html | `collectLinkDefs` 0.682 ms/op; `matchLinkDef` 0.296 ms/op; `visit` 0.191 ms/op | `collectLinkDefs` 777.8 KiB/op; `entries` 335.4 KiB/op; `matchLinkDef` 290.3 KiB/op |
| dense-definitions | direct-html-probe | `tryFastHtmlAttempt` 0.048 ms/op; `(anonymous)` 0.009 ms/op; `collectDefs` 0.006 ms/op | `tryFastHtmlAttempt` 45.5 KiB/op; `split` 21.3 KiB/op; `tryFastHtml` 0.2 KiB/op |
| long-unicode | parse | `toCodepointPositions` 0.395 ms/op; `scanInlineInner` 0.070 ms/op; `lineTerminatorFree` 0.052 ms/op | `Map` 1.1 KiB/op; `Set` 1.1 KiB/op; `push` 0.7 KiB/op |
| long-unicode | html | `toCodepointPositions` 0.392 ms/op; `escapeHtml` 0.089 ms/op; `scanInlineInner` 0.078 ms/op | `next` 3.5 KiB/op; `Map` 3.2 KiB/op; `values` 1.9 KiB/op |
| long-unicode | direct-html-probe | `tryFastHtmlAttempt` 0.000 ms/op; `tryFastHtml` 0.000 ms/op | `HtmlOutput` 0.1 KiB/op; `tryFastHtml` 0.1 KiB/op; `#onMessage` 0.0 KiB/op |
| unicode-paragraphs | parse | `walk` 0.576 ms/op; `parseBlockInner` 0.368 ms/op; `scanInlineInner` 0.153 ms/op | `parseParagraph` 435.6 KiB/op; `add` 320.9 KiB/op; `scanInlineInner` 279.3 KiB/op |
| unicode-paragraphs | html | `walk` 0.589 ms/op; `parseBlockInner` 0.359 ms/op; `visit` 0.340 ms/op | `entries` 522.9 KiB/op; `parseParagraph` 438.0 KiB/op; `add` 360.8 KiB/op |
| unicode-paragraphs | direct-html-probe | `tryFastHtmlAttempt` 0.000 ms/op; `tryFastHtml` 0.000 ms/op | `probe` 0.1 KiB/op; `post` 0.0 KiB/op; `tryFastHtml` 0.0 KiB/op |

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
commit `88754ac8cb4b2ebfdd3dfb07f1edc396db11f336`.
The current profile records their resulting costs. The preceding snapshot used
a different host and cannot isolate a reader speed improvement.
Ownership uses the commits in `scripts/ownership/pins.json`, with its separate
test scope. The comparison uses the reader recorded above. The original model and historical baselines retain their pins.

## Method and limits

Two fresh-worker rounds per fixture and phase, with reversed variant order in the second round. Parse, full HTML and direct-HTML eligibility attempts measured separately at the largest existing fixture per family. 500ms warmup, seven batches of at least 100ms with GC before each; separate 500ms CPU profile and 50-call heap sample at 4096 bytes, including collected objects. Position variants preserve the same reader tree after removing positions. Dedicated workflow runs are labeled in metadata; local runs remain shared-host observations. Samples are not performance thresholds.

Host load averaged 1.46, 1.26, 0.73 at the start and
1.61, 1.39, 1.01 at the end on 4
logical CPUs. The dedicated [workflow run](https://github.com/markup-carve/carve-proofs/actions/runs/36735323958) ran workers serially and rejected load above the available CPU count. Scheduling, JIT state and GC can
change ratios, even with reversed variant order. Overlapping sample ranges do
not establish an ordering. Confirm improvements with controlled paired runs before setting
budgets. Position-variant trees are checked against their default reader after
removing position fields, outside the measured operations.

Reproduce with `npm run profile:costs` and `npm run report:costs`.
The site's "Current costs and positions" dataset provides charts and exact exports.
