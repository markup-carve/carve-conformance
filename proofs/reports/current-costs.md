# Current reader cost investigation

Recorded at 2026-09-30T01:50:00.860Z, using Carve JS `6d02fa7062dd03024e7c092016459602e9a7aeec` and the
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
| long-line | parse | carve | 0.101 (0.100–0.108) / 0.103 (0.101–0.105) | 0.121 / 0.124 | 7.0 |
| long-line | parse | carve-no-positions | 0.110 (0.103–0.112) / 0.105 (0.104–0.115) | 0.137 / 0.133 | 10.5 |
| long-line | parse | djot | 0.158 (0.157–0.158) / 0.158 (0.157–0.159) | 0.172 / 0.173 | 16.1 |
| long-line | parse | djot-positions | 0.301 (0.278–0.336) / 0.287 (0.276–0.380) | 0.396 / 0.375 | 17.2 |
| long-line | parse | commonmark | 0.039 (0.039–0.040) / 0.037 (0.037–0.039) | 0.040 / 0.038 | 42.0 |
| long-line | html | carve | 0.268 (0.267–0.270) / 0.268 (0.267–0.270) | 0.273 / 0.273 | 42.6 |
| long-line | html | djot | 0.163 (0.161–0.238) / 0.162 (0.160–0.163) | 0.178 / 0.178 | 19.2 |
| long-line | html | commonmark | 0.039 (0.039–0.040) / 0.040 (0.039–0.040) | 0.040 / 0.041 | 42.6 |
| long-line | direct-html-probe | carve | 0.270 (0.269–0.272) / 0.267 (0.267–0.268) | 0.275 / 0.272 | 42.0 |
| unclosed-code | parse | carve | 0.273 (0.272–0.278) / 0.273 (0.272–0.276) | 0.281 / 0.280 | 8.6 |
| unclosed-code | parse | carve-no-positions | 0.277 (0.276–0.284) / 0.282 (0.276–0.292) | 0.295 / 0.305 | 8.9 |
| unclosed-code | parse | djot | 0.165 (0.157–0.177) / 0.164 (0.159–0.170) | 0.185 / 0.179 | 18.7 |
| unclosed-code | parse | djot-positions | 0.294 (0.281–0.309) / 0.294 (0.287–0.317) | 0.391 / 0.378 | 20.0 |
| unclosed-code | parse | commonmark | 0.064 (0.064–0.066) / 0.064 (0.064–0.068) | 0.066 / 0.066 | 42.8 |
| unclosed-code | html | carve | 0.591 (0.585–0.601) / 0.571 (0.564–0.585) | 0.609 / 0.585 | 20.7 |
| unclosed-code | html | djot | 0.169 (0.167–0.179) / 0.170 (0.166–0.179) | 0.190 / 0.191 | 18.9 |
| unclosed-code | html | commonmark | 0.067 (0.066–0.070) / 0.067 (0.067–0.072) | 0.068 / 0.069 | 43.1 |
| unclosed-code | direct-html-probe | carve | 0.202 (0.201–0.202) / 0.202 (0.201–0.203) | 0.205 / 0.205 | 2.6 |
| many-paragraphs | parse | carve | 2.693 (2.414–3.213) / 2.698 (2.487–3.191) | 3.977 / 4.008 | 1573.2 |
| many-paragraphs | parse | carve-no-positions | 4.130 (3.848–4.321) / 3.950 (3.680–4.403) | 5.935 / 5.750 | 2326.4 |
| many-paragraphs | parse | djot | 3.173 (2.741–3.535) / 3.224 (2.615–3.517) | 5.850 / 5.937 | 2578.9 |
| many-paragraphs | parse | djot-positions | 3.596 (3.436–3.924) / 3.590 (3.556–4.209) | 6.505 / 6.516 | 3238.6 |
| many-paragraphs | parse | commonmark | 0.468 (0.466–0.569) / 0.480 (0.478–0.582) | 0.478 / 0.489 | 1343.8 |
| many-paragraphs | html | carve | 0.986 (0.968–1.132) / 1.007 (0.985–1.096) | 1.138 / 1.148 | 1110.0 |
| many-paragraphs | html | djot | 3.541 (3.228–3.984) / 3.362 (2.631–3.711) | 6.488 / 6.231 | 2840.0 |
| many-paragraphs | html | commonmark | 0.717 (0.699–0.997) / 0.722 (0.709–1.005) | 0.734 / 0.743 | 1651.8 |
| many-paragraphs | direct-html-probe | carve | 0.995 (0.969–1.165) / 1.050 (0.996–1.127) | 1.142 / 1.275 | 1104.2 |
| nested-quotes | parse | carve | 0.490 (0.427–0.590) / 0.496 (0.462–0.545) | 0.812 / 0.845 | 781.9 |
| nested-quotes | parse | carve-no-positions | 0.662 (0.381–0.731) / 0.660 (0.384–0.732) | 1.125 / 1.114 | 925.8 |
| nested-quotes | parse | djot | 0.123 (0.119–0.143) / 0.128 (0.113–0.140) | 0.198 / 0.205 | 269.6 |
| nested-quotes | parse | djot-positions | 0.146 (0.132–0.186) / 0.151 (0.138–0.179) | 0.224 / 0.225 | 340.3 |
| nested-quotes | parse | commonmark | 0.032 (0.032–0.032) / 0.032 (0.032–0.032) | 0.033 / 0.033 | 130.4 |
| nested-quotes | html | carve | 0.799 (0.635–1.048) / 0.806 (0.450–1.069) | 1.450 / 1.370 | 1285.9 |
| nested-quotes | html | djot | 0.166 (0.142–0.204) / 0.165 (0.134–0.190) | 0.275 / 0.285 | 336.8 |
| nested-quotes | html | commonmark | 0.058 (0.056–0.062) / 0.061 (0.059–0.062) | 0.062 / 0.063 | 175.6 |
| nested-quotes | direct-html-probe | carve | 0.002 (0.001–0.002) / 0.001 (0.001–0.002) | 0.002 / 0.002 | 1.7 |
| nested-lists | parse | carve | 1.354 (0.814–1.648) / 1.375 (0.811–1.571) | 2.272 / 2.302 | 1939.3 |
| nested-lists | parse | carve-no-positions | 1.771 (1.296–2.011) / 1.817 (1.126–2.348) | 2.744 / 3.035 | 2187.4 |
| nested-lists | parse | djot | 0.924 (0.664–1.118) / 0.924 (0.649–1.108) | 1.947 / 1.888 | 897.7 |
| nested-lists | parse | djot-positions | 1.031 (0.797–1.126) / 0.979 (0.783–1.058) | 1.830 / 1.627 | 1015.8 |
| nested-lists | parse | commonmark | 0.343 (0.338–0.370) / 0.343 (0.337–0.385) | 0.350 / 0.350 | 305.5 |
| nested-lists | html | carve | 1.894 (1.177–2.208) / 2.115 (1.726–2.302) | 3.225 / 3.571 | 2698.6 |
| nested-lists | html | djot | 1.043 (0.749–1.167) / 1.019 (0.757–1.320) | 2.066 / 2.098 | 1011.0 |
| nested-lists | html | commonmark | 0.397 (0.394–0.401) / 0.400 (0.399–0.401) | 0.405 / 0.409 | 420.4 |
| nested-lists | direct-html-probe | carve | 0.001 (0.001–0.001) / 0.001 (0.001–0.002) | 0.002 / 0.002 | 1.3 |
| interior-whitespace | parse | carve | 0.045 (0.044–0.047) / 0.044 (0.043–0.044) | 0.067 / 0.065 | 5.9 |
| interior-whitespace | parse | carve-no-positions | 0.046 (0.045–0.049) / 0.047 (0.044–0.049) | 0.071 / 0.073 | 9.4 |
| interior-whitespace | parse | djot | 0.077 (0.076–0.079) / 0.077 (0.076–0.078) | 0.089 / 0.089 | 16.9 |
| interior-whitespace | parse | djot-positions | 0.135 (0.129–0.146) / 0.128 (0.127–0.140) | 0.182 / 0.173 | 16.9 |
| interior-whitespace | parse | commonmark | 0.018 (0.018–0.019) / 0.018 (0.018–0.019) | 0.019 / 0.019 | 18.2 |
| interior-whitespace | html | carve | 0.105 (0.101–0.107) / 0.105 (0.103–0.106) | 0.108 / 0.107 | 18.5 |
| interior-whitespace | html | djot | 0.081 (0.079–0.082) / 0.079 (0.078–0.081) | 0.094 / 0.095 | 17.7 |
| interior-whitespace | html | commonmark | 0.020 (0.020–0.020) / 0.020 (0.019–0.020) | 0.020 / 0.020 | 18.5 |
| interior-whitespace | direct-html-probe | carve | 0.105 (0.101–0.106) / 0.107 (0.107–0.108) | 0.107 / 0.109 | 17.8 |
| literal-brackets | parse | carve | 2.546 (2.445–3.176) / 2.614 (2.502–3.335) | 3.646 / 3.869 | 1577.8 |
| literal-brackets | parse | carve-no-positions | 3.907 (3.773–4.452) / 3.806 (3.730–4.423) | 5.672 / 5.565 | 2312.0 |
| literal-brackets | parse | djot | 2.673 (2.597–3.496) / 3.185 (2.678–3.438) | 4.596 / 5.956 | 2591.2 |
| literal-brackets | parse | djot-positions | 3.798 (3.487–4.322) / 3.811 (3.721–4.124) | 6.813 / 6.898 | 3251.9 |
| literal-brackets | parse | commonmark | 0.480 (0.477–0.581) / 0.491 (0.478–0.585) | 0.489 / 0.501 | 1352.0 |
| literal-brackets | html | carve | 4.868 (4.388–6.850) / 4.501 (4.363–6.812) | 8.092 / 7.209 | 3348.8 |
| literal-brackets | html | djot | 3.414 (3.277–3.859) / 3.483 (3.253–4.076) | 6.552 / 6.603 | 2829.8 |
| literal-brackets | html | commonmark | 0.724 (0.711–1.001) / 0.693 (0.677–0.837) | 0.742 / 0.715 | 1650.8 |
| literal-brackets | direct-html-probe | carve | 0.156 (0.155–0.156) / 0.156 (0.155–0.157) | 0.161 / 0.161 | 158.1 |
| inline-links | parse | carve | 6.691 (4.329–7.819) / 6.709 (4.248–8.090) | 11.974 / 12.011 | 4614.8 |
| inline-links | parse | carve-no-positions | 9.517 (8.789–10.285) / 9.530 (9.257–10.482) | 15.114 / 15.376 | 6223.0 |
| inline-links | parse | djot | 4.802 (4.567–6.850) / 6.276 (4.012–7.012) | 8.260 / 12.911 | 5039.8 |
| inline-links | parse | djot-positions | 7.009 (6.785–7.974) / 7.643 (7.473–8.237) | 14.458 / 16.318 | 6545.4 |
| inline-links | parse | commonmark | 1.413 (1.386–1.874) / 1.451 (1.422–1.891) | 1.439 / 1.472 | 3108.5 |
| inline-links | html | carve | 2.511 (2.352–2.596) / 2.376 (2.350–2.643) | 3.205 / 2.962 | 1996.7 |
| inline-links | html | djot | 7.209 (7.024–7.850) / 6.947 (4.645–7.895) | 15.166 / 14.696 | 5784.0 |
| inline-links | html | commonmark | 1.959 (1.946–2.521) / 1.958 (1.942–2.509) | 2.002 / 1.999 | 4118.7 |
| inline-links | direct-html-probe | carve | 2.419 (2.350–2.456) / 2.395 (2.324–2.438) | 2.937 / 2.943 | 2024.1 |
| sparse-definitions | parse | carve | 9.179 (8.551–9.711) / 9.398 (8.594–10.458) | 16.098 / 17.098 | 3930.8 |
| sparse-definitions | parse | carve-no-positions | 10.475 (9.821–11.518) / 10.861 (9.850–11.593) | 18.991 / 17.880 | 4734.4 |
| sparse-definitions | parse | djot | 3.307 (2.692–3.651) / 3.389 (3.229–3.624) | 6.713 / 6.815 | 2580.7 |
| sparse-definitions | parse | djot-positions | 3.872 (3.716–4.192) / 3.872 (3.773–4.127) | 7.549 / 7.588 | 3228.4 |
| sparse-definitions | parse | commonmark | 0.489 (0.487–0.551) / 0.496 (0.494–0.587) | 0.499 / 0.506 | 1343.6 |
| sparse-definitions | html | carve | 1.008 (0.997–1.110) / 1.061 (1.004–1.094) | 1.162 / 1.260 | 1123.1 |
| sparse-definitions | html | djot | 3.583 (3.487–4.167) / 3.669 (3.406–3.978) | 7.425 / 7.568 | 2827.6 |
| sparse-definitions | html | commonmark | 0.713 (0.679–0.946) / 0.717 (0.703–0.958) | 0.731 / 0.736 | 1660.2 |
| sparse-definitions | direct-html-probe | carve | 1.005 (0.996–1.106) / 1.053 (0.986–1.116) | 1.153 / 1.235 | 1110.5 |
| dense-definitions | parse | carve | 4.920 (4.723–5.443) / 4.743 (4.589–5.504) | 8.216 / 8.137 | 2992.5 |
| dense-definitions | parse | carve-no-positions | 5.511 (4.904–6.461) / 5.448 (5.092–6.458) | 8.712 / 8.984 | 3526.8 |
| dense-definitions | parse | djot | 2.255 (1.671–2.547) / 2.360 (1.826–2.637) | 4.691 / 4.810 | 1787.9 |
| dense-definitions | parse | djot-positions | 3.223 (2.431–3.562) / 2.861 (2.535–3.517) | 5.969 / 5.801 | 2284.5 |
| dense-definitions | parse | commonmark | 0.720 (0.710–0.864) / 0.729 (0.725–0.787) | 0.737 / 0.744 | 1038.8 |
| dense-definitions | html | carve | 6.886 (6.617–7.510) / 7.097 (6.767–7.202) | 12.214 / 12.587 | 4276.8 |
| dense-definitions | html | djot | 2.603 (1.913–2.856) / 2.521 (2.396–2.780) | 5.371 / 5.253 | 1985.8 |
| dense-definitions | html | commonmark | 0.811 (0.808–0.955) / 0.817 (0.813–0.957) | 0.828 / 0.834 | 1274.5 |
| dense-definitions | direct-html-probe | carve | 0.076 (0.076–0.077) / 0.077 (0.077–0.077) | 0.080 / 0.080 | 65.4 |
| long-unicode | parse | carve | 0.897 (0.868–0.902) / 0.893 (0.866–0.922) | 0.920 / 0.919 | 8.3 |
| long-unicode | parse | carve-no-positions | 0.484 (0.478–0.502) / 0.442 (0.441–0.452) | 0.498 / 0.451 | 9.1 |
| long-unicode | parse | djot | 0.273 (0.271–0.282) / 0.274 (0.273–0.277) | 0.296 / 0.294 | 16.4 |
| long-unicode | parse | djot-positions | 0.569 (0.535–0.585) / 0.584 (0.538–0.637) | 0.748 / 0.770 | 271.3 |
| long-unicode | parse | commonmark | 0.246 (0.241–0.258) / 0.239 (0.238–0.245) | 0.250 / 0.243 | 146.6 |
| long-unicode | html | carve | 1.102 (1.071–1.127) / 1.097 (1.088–1.126) | 1.242 / 1.272 | 21.2 |
| long-unicode | html | djot | 0.324 (0.320–0.337) / 0.325 (0.322–0.326) | 0.351 / 0.351 | 18.1 |
| long-unicode | html | commonmark | 0.291 (0.287–0.298) / 0.293 (0.290–0.306) | 0.295 / 0.298 | 146.0 |
| long-unicode | direct-html-probe | carve | 1.79e-5 (1.73e-5–1.89e-5) / 1.79e-5 (1.73e-5–1.89e-5) | 2.08e-5 / 2.07e-5 | 0.1 |
| unicode-paragraphs | parse | carve | 3.704 (3.485–3.949) / 3.740 (3.531–3.955) | 5.707 / 5.613 | 2125.7 |
| unicode-paragraphs | parse | carve-no-positions | 4.206 (3.877–4.286) / 4.101 (3.895–4.431) | 6.027 / 5.970 | 2310.0 |
| unicode-paragraphs | parse | djot | 3.137 (2.687–3.379) / 2.701 (2.652–3.351) | 5.791 / 4.495 | 2580.1 |
| unicode-paragraphs | parse | djot-positions | 3.872 (3.769–4.594) / 3.890 (3.666–3.973) | 6.824 / 6.838 | 3283.3 |
| unicode-paragraphs | parse | commonmark | 0.573 (0.566–0.706) / 0.586 (0.581–0.724) | 0.584 / 0.597 | 1373.3 |
| unicode-paragraphs | html | carve | 6.498 (5.105–7.697) / 6.364 (4.975–7.771) | 11.401 / 10.364 | 3847.9 |
| unicode-paragraphs | html | djot | 3.486 (3.182–3.946) / 3.413 (3.286–4.006) | 6.351 / 6.392 | 2845.7 |
| unicode-paragraphs | html | commonmark | 0.812 (0.796–1.073) / 0.820 (0.798–1.086) | 0.835 / 0.841 | 1689.7 |
| unicode-paragraphs | direct-html-probe | carve | 1.81e-5 (1.75e-5–1.93e-5) / 1.89e-5 (1.74e-5–1.94e-5) | 2.07e-5 / 2.24e-5 | 0.2 |

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
| long-line | parse | `scanInlineInner` 0.049 ms/op; `normalizeNewlines` 0.033 ms/op; `Lexer` 0.002 ms/op | `Map` 1.7 KiB/op; `parse` 0.9 KiB/op; `Set` 0.8 KiB/op |
| long-line | html | `inlineComplex` 0.125 ms/op; `tryFastHtmlAttempt` 0.091 ms/op; `escapeHtml` 0.061 ms/op | `join` 40.1 KiB/op; `Map` 0.4 KiB/op; `push` 0.3 KiB/op |
| long-line | direct-html-probe | `inlineComplex` 0.127 ms/op; `tryFastHtmlAttempt` 0.096 ms/op; `escapeHtml` 0.062 ms/op | `join` 40.2 KiB/op; `blockish` 0.2 KiB/op; `push` 0.2 KiB/op |
| unclosed-code | parse | `verbatimSpanEnd` 0.156 ms/op; `trimUnclosedRun` 0.078 ms/op; `normalizeNewlines` 0.043 ms/op | `Map` 1.8 KiB/op; `Set` 0.8 KiB/op; `parse` 0.7 KiB/op |
| unclosed-code | html | `verbatimSpanEnd` 0.143 ms/op; `inlineComplex` 0.126 ms/op; `tryFastHtmlAttempt` 0.099 ms/op | `Map` 3.5 KiB/op; `next` 2.5 KiB/op; `values` 2.1 KiB/op |
| unclosed-code | direct-html-probe | `inlineComplex` 0.127 ms/op; `tryFastHtmlAttempt` 0.090 ms/op; `renderBlocks` 0.001 ms/op | `Map` 0.6 KiB/op; `exec` 0.3 KiB/op; `collectDefs` 0.2 KiB/op |
| many-paragraphs | parse | `parseBlockInner` 0.470 ms/op; `scanInlineInner` 0.179 ms/op; `parseParagraph` 0.139 ms/op | `parseParagraph` 439.4 KiB/op; `scanInlineInner` 276.8 KiB/op; `parseBlockInner` 143.4 KiB/op |
| many-paragraphs | html | `renderBlocks` 0.174 ms/op; `escapeHtml` 0.128 ms/op; `tryFastHtmlAttempt` 0.108 ms/op | `renderBlocks` 523.4 KiB/op; `push` 117.8 KiB/op; `(anonymous)` 112.4 KiB/op |
| many-paragraphs | direct-html-probe | `renderBlocks` 0.213 ms/op; `escapeHtml` 0.120 ms/op; `blockish` 0.108 ms/op | `renderBlocks` 515.0 KiB/op; `push` 120.1 KiB/op; `renderInline` 111.6 KiB/op |
| nested-quotes | parse | `parseBlockInner` 0.084 ms/op; `parseBlockQuote` 0.040 ms/op; `attachDocumentOffsets` 0.029 ms/op | `parseBlockQuote` 167.0 KiB/op; `push` 137.7 KiB/op; `attachDocumentOffsets` 123.0 KiB/op |
| nested-quotes | html | `parseBlockInner` 0.093 ms/op; `visit` 0.057 ms/op; `parseBlockQuote` 0.043 ms/op | `parseBlockQuote` 173.7 KiB/op; `renderBlockNode` 144.7 KiB/op; `attachDocumentOffsets` 129.4 KiB/op |
| nested-quotes | direct-html-probe | `tryFastHtmlAttempt` 0.001 ms/op; `renderBlocks` 0.000 ms/op; `collectDefs` 0.000 ms/op | `Map` 0.5 KiB/op; `split` 0.2 KiB/op; `push` 0.2 KiB/op |
| nested-lists | parse | `parseList` 0.197 ms/op; `parseBlockInner` 0.098 ms/op; `unorderedMatch` 0.084 ms/op | `parseList` 538.9 KiB/op; `Map` 205.5 KiB/op; `Set` 195.9 KiB/op |
| nested-lists | html | `parseList` 0.210 ms/op; `parseBlockInner` 0.106 ms/op; `visit` 0.081 ms/op | `parseList` 552.1 KiB/op; `Map` 209.2 KiB/op; `Set` 205.7 KiB/op |
| nested-lists | direct-html-probe | `tryFastHtmlAttempt` 0.001 ms/op; `renderBlocks` 0.000 ms/op; `collectDefs` 0.000 ms/op | `Map` 0.4 KiB/op; `push` 0.2 KiB/op; `tryFastHtmlAttempt` 0.2 KiB/op |
| interior-whitespace | parse | `scanInlineInner` 0.020 ms/op; `normalizeNewlines` 0.014 ms/op; `lineTerminatorFree` 0.001 ms/op | `Map` 1.1 KiB/op; `Set` 0.8 KiB/op; `push` 0.7 KiB/op |
| interior-whitespace | html | `inlineComplex` 0.053 ms/op; `tryFastHtmlAttempt` 0.031 ms/op; `escapeHtml` 0.024 ms/op | `join` 16.4 KiB/op; `Map` 0.4 KiB/op; `renderBlocks` 0.3 KiB/op |
| interior-whitespace | direct-html-probe | `inlineComplex` 0.048 ms/op; `tryFastHtmlAttempt` 0.028 ms/op; `escapeHtml` 0.023 ms/op | `join` 16.1 KiB/op; `Map` 0.4 KiB/op; `push` 0.2 KiB/op |
| literal-brackets | parse | `parseBlockInner` 0.490 ms/op; `scanInlineInner` 0.181 ms/op; `parseParagraph` 0.177 ms/op | `parseParagraph` 437.8 KiB/op; `scanInlineInner` 280.9 KiB/op; `parseBlockInner` 145.8 KiB/op |
| literal-brackets | html | `parseBlockInner` 0.489 ms/op; `visit` 0.371 ms/op; `scanInlineInner` 0.208 ms/op | `entries` 529.1 KiB/op; `parseParagraph` 445.4 KiB/op; `scanInlineInner` 275.7 KiB/op |
| literal-brackets | direct-html-probe | `tryFastHtmlAttempt` 0.104 ms/op; `(anonymous)` 0.034 ms/op; `collectDefs` 0.016 ms/op | `tryFastHtmlAttempt` 55.5 KiB/op; `(anonymous)` 52.7 KiB/op; `split` 48.2 KiB/op |
| inline-links | parse | `scanInlineInner` 0.752 ms/op; `newlineIndices` 0.693 ms/op; `parseBlockInner` 0.505 ms/op | `scanInlineInner` 1300.3 KiB/op; `buildBracketMap` 637.2 KiB/op; `Map` 543.5 KiB/op |
| inline-links | html | `renderInline` 0.372 ms/op; `escapeHtml` 0.358 ms/op; `renderBlocks` 0.281 ms/op | `renderBlocks` 457.5 KiB/op; `escapeHtml` 331.0 KiB/op; `push` 306.9 KiB/op |
| inline-links | direct-html-probe | `renderInline` 0.388 ms/op; `escapeHtml` 0.350 ms/op; `renderBlocks` 0.312 ms/op | `renderBlocks` 467.5 KiB/op; `escapeHtml` 337.2 KiB/op; `push` 306.0 KiB/op |
| sparse-definitions | parse | `collectLinkDefs` 1.786 ms/op; `isBlankLine` 0.680 ms/op; `parseBlockInner` 0.548 ms/op | `collectLinkDefs` 1654.5 KiB/op; `parseParagraph` 441.5 KiB/op; `stripContainerPrefixes` 381.2 KiB/op |
| sparse-definitions | html | `renderBlocks` 0.185 ms/op; `escapeHtml` 0.123 ms/op; `tryFastHtmlAttempt` 0.105 ms/op | `renderBlocks` 532.3 KiB/op; `push` 123.2 KiB/op; `(anonymous)` 112.5 KiB/op |
| sparse-definitions | direct-html-probe | `renderBlocks` 0.188 ms/op; `escapeHtml` 0.125 ms/op; `tryFastHtmlAttempt` 0.106 ms/op | `renderBlocks` 523.2 KiB/op; `push` 121.2 KiB/op; `(anonymous)` 111.5 KiB/op |
| dense-definitions | parse | `collectLinkDefs` 0.913 ms/op; `matchLinkDef` 0.336 ms/op; `parseBlockInner` 0.241 ms/op | `collectLinkDefs` 779.0 KiB/op; `matchLinkDef` 291.4 KiB/op; `exec` 288.3 KiB/op |
| dense-definitions | html | `collectLinkDefs` 0.898 ms/op; `matchLinkDef` 0.329 ms/op; `parseBlockInner` 0.222 ms/op | `collectLinkDefs` 774.7 KiB/op; `entries` 333.7 KiB/op; `next` 301.4 KiB/op |
| dense-definitions | direct-html-probe | `tryFastHtmlAttempt` 0.052 ms/op; `(anonymous)` 0.011 ms/op; `collectDefs` 0.006 ms/op | `tryFastHtmlAttempt` 42.6 KiB/op; `split` 22.2 KiB/op; `exec` 0.2 KiB/op |
| long-unicode | parse | `toCodepointPositions` 0.401 ms/op; `scanInlineInner` 0.075 ms/op; `lineTerminatorFree` 0.064 ms/op | `Map` 1.1 KiB/op; `Set` 0.9 KiB/op; `next` 0.8 KiB/op |
| long-unicode | html | `toCodepointPositions` 0.413 ms/op; `scanInlineInner` 0.082 ms/op; `escapeHtml` 0.080 ms/op | `Map` 3.7 KiB/op; `next` 3.2 KiB/op; `values` 1.9 KiB/op |
| long-unicode | direct-html-probe | `tryFastHtmlAttempt` 0.000 ms/op; `tryFastHtml` 0.000 ms/op | `tryFastHtml` 0.0 KiB/op; `probe` 0.0 KiB/op |
| unicode-paragraphs | parse | `walk` 0.644 ms/op; `parseBlockInner` 0.476 ms/op; `scanInlineInner` 0.247 ms/op | `parseParagraph` 437.2 KiB/op; `add` 320.0 KiB/op; `scanInlineInner` 279.3 KiB/op |
| unicode-paragraphs | html | `walk` 0.605 ms/op; `parseBlockInner` 0.481 ms/op; `visit` 0.388 ms/op | `entries` 533.1 KiB/op; `parseParagraph` 444.5 KiB/op; `add` 359.1 KiB/op |
| unicode-paragraphs | direct-html-probe | `tryFastHtmlAttempt` 0.000 ms/op; `tryFastHtml` 0.000 ms/op | `tryFastHtml` 0.2 KiB/op; `probe` 0.0 KiB/op |

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

Host load averaged 1.38, 1.36, 0.8 at the start and
1.49, 1.38, 1.03 at the end on 4
logical CPUs. The dedicated [workflow run](https://github.com/markup-carve/carve-proofs/actions/runs/36656234254) ran workers serially and rejected load above the available CPU count. Scheduling, JIT state and GC can
change ratios, even with reversed variant order. Overlapping sample ranges do
not establish an ordering. Confirm improvements with controlled paired runs before setting
budgets. Position-variant trees are checked against their default reader after
removing position fields, outside the measured operations.

Reproduce with `npm run profile:costs` and `npm run report:costs`.
The site's "Current costs and positions" dataset provides charts and exact exports.
