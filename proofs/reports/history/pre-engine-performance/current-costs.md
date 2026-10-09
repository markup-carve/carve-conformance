# Current reader cost investigation

Recorded at 2026-09-30T00:06:05.851Z, using Carve JS `88754ac8cb4b2ebfdd3dfb07f1edc396db11f336` and the
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
| long-line | parse | carve | 0.054 (0.052–0.057) / 0.052 (0.049–0.057) | 0.072 / 0.068 | 7.4 |
| long-line | parse | carve-no-positions | 0.056 (0.054–0.061) / 0.056 (0.054–0.060) | 0.078 / 0.081 | 8.5 |
| long-line | parse | djot | 0.084 (0.083–0.086) / 0.085 (0.084–0.092) | 0.094 / 0.096 | 16.4 |
| long-line | parse | djot-positions | 0.134 (0.133–0.143) / 0.134 (0.133–0.143) | 0.165 / 0.166 | 18.2 |
| long-line | parse | commonmark | 0.020 (0.020–0.036) / 0.021 (0.020–0.034) | 0.021 / 0.021 | 42.1 |
| long-line | html | carve | 0.145 (0.144–0.145) / 0.144 (0.144–0.145) | 0.147 / 0.146 | 42.5 |
| long-line | html | djot | 0.087 (0.086–0.088) / 0.087 (0.085–0.087) | 0.097 / 0.096 | 19.4 |
| long-line | html | commonmark | 0.021 (0.021–0.023) / 0.022 (0.022–0.023) | 0.022 / 0.022 | 42.5 |
| long-line | direct-html-probe | carve | 0.145 (0.144–0.145) / 0.145 (0.143–0.147) | 0.147 / 0.147 | 42.2 |
| unclosed-code | parse | carve | 0.139 (0.137–0.142) / 0.140 (0.138–0.141) | 0.160 / 0.160 | 7.1 |
| unclosed-code | parse | carve-no-positions | 0.141 (0.137–0.143) / 0.139 (0.136–0.144) | 0.160 / 0.163 | 8.9 |
| unclosed-code | parse | djot | 0.093 (0.090–0.096) / 0.087 (0.086–0.091) | 0.110 / 0.101 | 17.5 |
| unclosed-code | parse | djot-positions | 0.137 (0.135–0.138) / 0.145 (0.144–0.148) | 0.171 / 0.179 | 18.9 |
| unclosed-code | parse | commonmark | 0.031 (0.030–0.032) / 0.030 (0.030–0.032) | 0.031 / 0.030 | 42.7 |
| unclosed-code | html | carve | 0.279 (0.278–0.287) / 0.280 (0.277–0.284) | 0.291 / 0.289 | 22.4 |
| unclosed-code | html | djot | 0.098 (0.096–0.099) / 0.100 (0.094–0.103) | 0.112 / 0.116 | 19.3 |
| unclosed-code | html | commonmark | 0.031 (0.031–0.032) / 0.031 (0.031–0.033) | 0.032 / 0.031 | 43.3 |
| unclosed-code | direct-html-probe | carve | 0.100 (0.097–0.105) / 0.098 (0.097–0.098) | 0.101 / 0.099 | 2.6 |
| many-paragraphs | parse | carve | 1.293 (1.205–1.459) / 1.306 (1.194–1.476) | 1.791 / 1.850 | 1591.8 |
| many-paragraphs | parse | carve-no-positions | 1.920 (1.784–2.360) / 1.901 (1.860–2.393) | 2.657 / 2.571 | 2325.7 |
| many-paragraphs | parse | djot | 1.383 (1.369–1.670) / 1.419 (1.381–2.180) | 2.158 / 2.202 | 2609.1 |
| many-paragraphs | parse | djot-positions | 1.912 (1.838–2.148) / 1.980 (1.900–2.151) | 3.158 / 3.252 | 3243.5 |
| many-paragraphs | parse | commonmark | 0.257 (0.251–0.322) / 0.248 (0.247–0.288) | 0.261 / 0.252 | 1347.3 |
| many-paragraphs | html | carve | 0.485 (0.471–0.513) / 0.510 (0.499–0.531) | 0.544 / 0.572 | 1112.3 |
| many-paragraphs | html | djot | 1.622 (1.563–1.709) / 1.613 (1.578–1.764) | 2.659 / 2.690 | 2849.8 |
| many-paragraphs | html | commonmark | 0.374 (0.368–0.488) / 0.375 (0.371–0.418) | 0.382 / 0.384 | 1644.3 |
| many-paragraphs | direct-html-probe | carve | 0.515 (0.485–0.563) / 0.492 (0.472–0.504) | 0.571 / 0.550 | 1107.4 |
| nested-quotes | parse | carve | 0.206 (0.193–0.212) / 0.218 (0.206–0.228) | 0.305 / 0.326 | 778.5 |
| nested-quotes | parse | carve-no-positions | 0.298 (0.275–0.355) / 0.291 (0.280–0.353) | 0.459 / 0.442 | 931.2 |
| nested-quotes | parse | djot | 0.061 (0.059–0.064) / 0.064 (0.062–0.073) | 0.090 / 0.094 | 269.5 |
| nested-quotes | parse | djot-positions | 0.072 (0.070–0.085) / 0.076 (0.071–0.079) | 0.110 / 0.115 | 335.7 |
| nested-quotes | parse | commonmark | 0.018 (0.018–0.019) / 0.019 (0.019–0.019) | 0.019 / 0.020 | 122.5 |
| nested-quotes | html | carve | 0.370 (0.348–0.423) / 0.354 (0.330–0.403) | 0.597 / 0.571 | 1267.5 |
| nested-quotes | html | djot | 0.075 (0.073–0.093) / 0.075 (0.073–0.086) | 0.117 / 0.116 | 339.5 |
| nested-quotes | html | commonmark | 0.032 (0.031–0.036) / 0.032 (0.031–0.037) | 0.032 / 0.032 | 182.5 |
| nested-quotes | direct-html-probe | carve | 0.001 (0.001–0.001) / 0.001 (0.001–0.001) | 0.001 / 0.001 | 1.7 |
| nested-lists | parse | carve | 0.696 (0.635–0.915) / 0.659 (0.625–0.933) | 1.241 / 1.167 | 1933.7 |
| nested-lists | parse | carve-no-positions | 0.816 (0.559–0.941) / 0.822 (0.782–0.964) | 1.384 / 1.413 | 2171.2 |
| nested-lists | parse | djot | 0.408 (0.394–0.421) / 0.435 (0.396–0.707) | 0.732 / 0.782 | 882.9 |
| nested-lists | parse | djot-positions | 0.491 (0.461–0.578) / 0.486 (0.455–0.548) | 0.832 / 0.850 | 1016.4 |
| nested-lists | parse | commonmark | 0.151 (0.150–0.155) / 0.152 (0.149–0.157) | 0.154 / 0.154 | 305.4 |
| nested-lists | html | carve | 0.928 (0.842–1.175) / 1.043 (0.617–1.077) | 1.760 / 1.871 | 2695.5 |
| nested-lists | html | djot | 0.492 (0.458–0.530) / 0.505 (0.453–0.852) | 0.907 / 0.955 | 1006.2 |
| nested-lists | html | commonmark | 0.192 (0.188–0.219) / 0.190 (0.184–0.205) | 0.197 / 0.194 | 421.5 |
| nested-lists | direct-html-probe | carve | 0.001 (0.001–0.001) / 0.001 (0.001–0.001) | 0.001 / 0.001 | 1.6 |
| interior-whitespace | parse | carve | 0.022 (0.022–0.023) / 0.023 (0.022–0.024) | 0.034 / 0.035 | 7.2 |
| interior-whitespace | parse | carve-no-positions | 0.024 (0.022–0.025) / 0.023 (0.022–0.025) | 0.038 / 0.035 | 8.1 |
| interior-whitespace | parse | djot | 0.044 (0.041–0.045) / 0.042 (0.038–0.052) | 0.062 / 0.055 | 16.5 |
| interior-whitespace | parse | djot-positions | 0.063 (0.062–0.067) / 0.061 (0.055–0.069) | 0.084 / 0.078 | 16.8 |
| interior-whitespace | parse | commonmark | 0.009 (0.009–0.009) / 0.009 (0.009–0.010) | 0.009 / 0.010 | 18.5 |
| interior-whitespace | html | carve | 0.052 (0.052–0.053) / 0.050 (0.049–0.053) | 0.054 / 0.053 | 17.3 |
| interior-whitespace | html | djot | 0.046 (0.045–0.047) / 0.047 (0.044–0.049) | 0.063 / 0.067 | 17.1 |
| interior-whitespace | html | commonmark | 0.010 (0.010–0.010) / 0.010 (0.010–0.014) | 0.010 / 0.010 | 17.7 |
| interior-whitespace | direct-html-probe | carve | 0.051 (0.049–0.052) / 0.049 (0.049–0.052) | 0.052 / 0.051 | 18.1 |
| literal-brackets | parse | carve | 1.257 (1.129–1.300) / 1.192 (1.170–1.300) | 1.778 / 1.614 | 1582.7 |
| literal-brackets | parse | carve-no-positions | 1.798 (1.716–2.306) / 1.806 (1.753–2.129) | 2.459 / 2.408 | 2317.6 |
| literal-brackets | parse | djot | 1.352 (1.311–1.392) / 1.330 (1.272–1.581) | 2.108 / 2.092 | 2594.3 |
| literal-brackets | parse | djot-positions | 1.898 (1.832–1.931) / 1.889 (1.842–2.000) | 3.117 / 3.121 | 3249.6 |
| literal-brackets | parse | commonmark | 0.240 (0.230–0.316) / 0.230 (0.229–0.294) | 0.243 / 0.233 | 1342.0 |
| literal-brackets | html | carve | 2.123 (1.899–2.427) / 2.109 (1.923–2.458) | 3.319 / 3.183 | 3282.4 |
| literal-brackets | html | djot | 1.419 (1.366–1.473) / 2.144 (1.441–6.519) | 2.211 / 3.348 | 2856.1 |
| literal-brackets | html | commonmark | 0.358 (0.355–0.392) / 0.368 (0.364–0.374) | 0.367 / 0.376 | 1656.2 |
| literal-brackets | direct-html-probe | carve | 0.077 (0.068–0.083) / 0.078 (0.067–0.089) | 0.078 / 0.080 | 160.0 |
| inline-links | parse | carve | 2.808 (2.687–3.196) / 3.216 (2.779–3.460) | 4.154 / 5.259 | 4630.4 |
| inline-links | parse | carve-no-positions | 4.674 (4.399–6.597) / 4.641 (4.486–5.389) | 6.750 / 6.914 | 6263.6 |
| inline-links | parse | djot | 2.494 (2.317–3.365) / 2.550 (2.456–3.213) | 4.249 / 4.284 | 5096.8 |
| inline-links | parse | djot-positions | 3.839 (3.632–6.358) / 3.900 (3.344–4.131) | 6.661 / 6.974 | 6594.0 |
| inline-links | parse | commonmark | 0.740 (0.738–0.938) / 0.777 (0.771–1.044) | 0.751 / 0.786 | 3097.8 |
| inline-links | html | carve | 1.219 (1.174–1.352) / 1.297 (1.213–1.420) | 1.399 / 1.522 | 2022.2 |
| inline-links | html | djot | 3.283 (2.788–4.023) / 3.326 (2.688–3.892) | 6.235 / 6.301 | 5780.2 |
| inline-links | html | commonmark | 1.077 (1.053–1.084) / 1.036 (1.021–1.183) | 1.098 / 1.060 | 4111.3 |
| inline-links | direct-html-probe | carve | 1.262 (1.216–1.409) / 1.257 (1.197–1.291) | 1.490 / 1.429 | 2020.4 |
| sparse-definitions | parse | carve | 4.445 (4.362–4.657) / 4.348 (3.645–6.958) | 7.187 / 6.943 | 3941.4 |
| sparse-definitions | parse | carve-no-positions | 4.947 (3.933–6.892) / 4.776 (4.398–5.200) | 7.532 / 7.316 | 4770.9 |
| sparse-definitions | parse | djot | 1.594 (1.421–1.787) / 1.465 (1.403–2.204) | 2.808 / 2.463 | 2576.4 |
| sparse-definitions | parse | djot-positions | 1.953 (1.862–2.181) / 2.097 (1.844–2.182) | 3.441 / 3.762 | 3253.7 |
| sparse-definitions | parse | commonmark | 0.241 (0.237–0.274) / 0.254 (0.250–0.431) | 0.244 / 0.258 | 1339.7 |
| sparse-definitions | html | carve | 0.509 (0.469–0.534) / 0.482 (0.466–0.528) | 0.579 / 0.567 | 1111.3 |
| sparse-definitions | html | djot | 1.728 (1.658–1.822) / 1.641 (1.610–1.682) | 3.089 / 2.880 | 2874.5 |
| sparse-definitions | html | commonmark | 0.371 (0.369–0.420) / 0.373 (0.370–0.437) | 0.382 / 0.383 | 1652.7 |
| sparse-definitions | direct-html-probe | carve | 0.506 (0.483–0.532) / 0.474 (0.464–0.500) | 0.571 / 0.531 | 1114.5 |
| dense-definitions | parse | carve | 2.474 (2.422–2.731) / 2.556 (2.269–2.668) | 4.290 / 4.451 | 3012.7 |
| dense-definitions | parse | carve-no-positions | 3.167 (2.695–3.284) / 2.858 (2.785–3.131) | 5.168 / 4.864 | 3525.0 |
| dense-definitions | parse | djot | 1.175 (0.843–2.278) / 1.141 (1.115–1.348) | 2.238 / 2.276 | 1821.5 |
| dense-definitions | parse | djot-positions | 1.431 (1.182–1.756) / 1.564 (1.399–1.737) | 2.993 / 3.127 | 2290.0 |
| dense-definitions | parse | commonmark | 0.395 (0.394–0.452) / 0.391 (0.385–0.463) | 0.401 / 0.398 | 1032.0 |
| dense-definitions | html | carve | 3.221 (2.495–7.187) / 3.487 (2.503–3.644) | 5.823 / 6.130 | 4180.9 |
| dense-definitions | html | djot | 1.285 (1.154–2.107) / 1.336 (1.146–1.572) | 2.657 / 2.713 | 2041.2 |
| dense-definitions | html | commonmark | 0.441 (0.439–0.446) / 0.448 (0.443–0.693) | 0.450 / 0.457 | 1272.1 |
| dense-definitions | direct-html-probe | carve | 0.039 (0.038–0.045) / 0.039 (0.038–0.043) | 0.041 / 0.040 | 66.1 |
| long-unicode | parse | carve | 0.440 (0.429–0.454) / 0.473 (0.460–0.488) | 0.502 / 0.530 | 9.2 |
| long-unicode | parse | carve-no-positions | 0.278 (0.255–0.291) / 0.238 (0.235–0.240) | 0.296 / 0.278 | 8.0 |
| long-unicode | parse | djot | 0.152 (0.145–0.155) / 0.142 (0.142–0.146) | 0.164 / 0.156 | 16.4 |
| long-unicode | parse | djot-positions | 0.243 (0.241–0.248) / 0.253 (0.245–0.261) | 0.298 / 0.307 | 300.6 |
| long-unicode | parse | commonmark | 0.169 (0.166–0.172) / 0.169 (0.167–0.171) | 0.171 / 0.170 | 146.6 |
| long-unicode | html | carve | 0.507 (0.475–0.666) / 0.485 (0.473–0.501) | 0.638 / 0.552 | 21.0 |
| long-unicode | html | djot | 0.178 (0.170–0.204) / 0.174 (0.169–0.180) | 0.195 / 0.192 | 17.7 |
| long-unicode | html | commonmark | 0.186 (0.179–0.187) / 0.184 (0.180–0.190) | 0.187 / 0.188 | 146.4 |
| long-unicode | direct-html-probe | carve | 1.07e-5 (1.05e-5–1.10e-5) / 1.09e-5 (1.07e-5–1.38e-5) | 1.20e-5 / 1.23e-5 | 0.3 |
| unicode-paragraphs | parse | carve | 1.839 (1.760–2.398) / 1.858 (1.783–2.186) | 2.662 / 2.698 | 2130.3 |
| unicode-paragraphs | parse | carve-no-positions | 2.168 (1.975–2.505) / 2.156 (1.949–3.642) | 3.173 / 3.146 | 2317.2 |
| unicode-paragraphs | parse | djot | 1.462 (1.388–2.101) / 1.473 (1.387–1.798) | 2.325 / 2.305 | 2584.6 |
| unicode-paragraphs | parse | djot-positions | 2.090 (1.853–2.143) / 2.089 (1.896–2.180) | 3.542 / 3.509 | 3292.2 |
| unicode-paragraphs | parse | commonmark | 0.278 (0.277–0.376) / 0.288 (0.280–0.389) | 0.283 / 0.293 | 1366.9 |
| unicode-paragraphs | html | carve | 2.644 (2.590–3.546) / 2.622 (2.505–3.756) | 4.039 / 3.974 | 3975.7 |
| unicode-paragraphs | html | djot | 1.667 (1.468–1.702) / 1.632 (1.471–1.691) | 2.815 / 2.745 | 2840.4 |
| unicode-paragraphs | html | commonmark | 0.400 (0.396–0.535) / 0.403 (0.398–0.537) | 0.408 / 0.410 | 1683.9 |
| unicode-paragraphs | direct-html-probe | carve | 1.08e-5 (1.04e-5–1.41e-5) / 1.07e-5 (1.04e-5–1.11e-5) | 1.24e-5 / 1.20e-5 | 0.1 |

Carve's [positions option](https://github.com/markup-carve/carve-js/blob/88754ac8cb4b2ebfdd3dfb07f1edc396db11f336/src/source-positions.ts) removes fields from the
finished tree. It still constructs positions during parsing and skips the final
codepoint conversion when disabled. Treat it as an output-shape option, not a
switch that removes all positioning work. Disabling positions can cost more
than keeping them because removing fields adds work. Djot's sourcePositions option enables
its position tracking. These variants expose costs; their position formats and
feature sets are not identical.

The [HTML entrypoint](https://github.com/markup-carve/carve-js/blob/88754ac8cb4b2ebfdd3dfb07f1edc396db11f336/src/index.ts) tries a direct HTML path before building
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
| long-line | parse | `scanInlineInner` 0.024 ms/op; `normalizeNewlines` 0.012 ms/op; `lineTerminatorFree` 0.001 ms/op | `Map` 1.3 KiB/op; `Set` 1.1 KiB/op; `parse` 0.6 KiB/op |
| long-line | html | `inlineComplex` 0.066 ms/op; `escapeHtml` 0.042 ms/op; `tryFastHtmlAttempt` 0.037 ms/op | `join` 40.1 KiB/op; `Map` 0.4 KiB/op; `blockish` 0.4 KiB/op |
| long-line | direct-html-probe | `inlineComplex` 0.066 ms/op; `escapeHtml` 0.043 ms/op; `tryFastHtmlAttempt` 0.035 ms/op | `join` 40.0 KiB/op; `Map` 0.4 KiB/op; `blockish` 0.2 KiB/op |
| unclosed-code | parse | `verbatimSpanEnd` 0.065 ms/op; `trimUnclosedRun` 0.043 ms/op; `normalizeNewlines` 0.012 ms/op | `Map` 1.5 KiB/op; `Set` 0.8 KiB/op; `push` 0.7 KiB/op |
| unclosed-code | html | `verbatimSpanEnd` 0.067 ms/op; `inlineComplex` 0.066 ms/op; `escapeHtml` 0.043 ms/op | `Map` 4.5 KiB/op; `next` 2.8 KiB/op; `Set` 1.7 KiB/op |
| unclosed-code | direct-html-probe | `inlineComplex` 0.064 ms/op; `tryFastHtmlAttempt` 0.034 ms/op; `renderInline` 0.000 ms/op | `blockish` 0.4 KiB/op; `tryFastHtmlAttempt` 0.3 KiB/op; `exec` 0.3 KiB/op |
| many-paragraphs | parse | `parseBlockInner` 0.266 ms/op; `scanInlineInner` 0.088 ms/op; `parseParagraph` 0.085 ms/op | `parseParagraph` 430.0 KiB/op; `scanInlineInner` 281.2 KiB/op; `parseBlockInner` 150.4 KiB/op |
| many-paragraphs | html | `renderBlocks` 0.106 ms/op; `escapeHtml` 0.067 ms/op; `tryFastHtmlAttempt` 0.058 ms/op | `renderBlocks` 518.9 KiB/op; `push` 121.3 KiB/op; `(anonymous)` 110.6 KiB/op |
| many-paragraphs | direct-html-probe | `renderBlocks` 0.093 ms/op; `escapeHtml` 0.066 ms/op; `tryFastHtmlAttempt` 0.054 ms/op | `renderBlocks` 511.9 KiB/op; `push` 121.7 KiB/op; `(anonymous)` 111.9 KiB/op |
| nested-quotes | parse | `parseBlockInner` 0.045 ms/op; `attachDocumentOffsets` 0.020 ms/op; `parseBlockQuote` 0.020 ms/op | `parseBlockQuote` 169.6 KiB/op; `push` 137.4 KiB/op; `attachDocumentOffsets` 119.8 KiB/op |
| nested-quotes | html | `parseBlockInner` 0.042 ms/op; `visit` 0.022 ms/op; `attachDocumentOffsets` 0.019 ms/op | `parseBlockQuote` 172.4 KiB/op; `renderBlockNode` 146.8 KiB/op; `push` 140.8 KiB/op |
| nested-quotes | direct-html-probe | `tryFastHtmlAttempt` 0.001 ms/op; `renderBlocks` 0.000 ms/op; `collectDefs` 0.000 ms/op | `Map` 0.4 KiB/op; `push` 0.2 KiB/op; `renderBlocks` 0.2 KiB/op |
| nested-lists | parse | `parseList` 0.120 ms/op; `parseBlockInner` 0.052 ms/op; `unorderedMatch` 0.042 ms/op | `parseList` 549.1 KiB/op; `Map` 207.9 KiB/op; `Set` 200.9 KiB/op |
| nested-lists | html | `parseList` 0.144 ms/op; `parseBlockInner` 0.055 ms/op; `unorderedMatch` 0.044 ms/op | `parseList` 541.8 KiB/op; `Map` 207.2 KiB/op; `Set` 201.1 KiB/op |
| nested-lists | direct-html-probe | `tryFastHtmlAttempt` 0.001 ms/op; `renderBlocks` 0.000 ms/op; `collectDefs` 0.000 ms/op | `Map` 0.5 KiB/op; `renderBlocks` 0.4 KiB/op; `push` 0.2 KiB/op |
| interior-whitespace | parse | `scanInlineInner` 0.009 ms/op; `normalizeNewlines` 0.006 ms/op; `Lexer` 0.001 ms/op | `Map` 1.0 KiB/op; `Set` 1.0 KiB/op; `parse` 0.8 KiB/op |
| interior-whitespace | html | `inlineComplex` 0.024 ms/op; `tryFastHtmlAttempt` 0.014 ms/op; `escapeHtml` 0.012 ms/op | `join` 16.1 KiB/op; `blockish` 0.2 KiB/op; `tryFastHtmlAttempt` 0.2 KiB/op |
| interior-whitespace | direct-html-probe | `inlineComplex` 0.025 ms/op; `tryFastHtmlAttempt` 0.014 ms/op; `escapeHtml` 0.012 ms/op | `join` 16.3 KiB/op; `Map` 0.3 KiB/op; `renderBlocks` 0.2 KiB/op |
| literal-brackets | parse | `parseBlockInner` 0.233 ms/op; `parseParagraph` 0.084 ms/op; `scanInlineInner` 0.074 ms/op | `parseParagraph` 434.8 KiB/op; `scanInlineInner` 282.8 KiB/op; `parseBlockInner` 142.1 KiB/op |
| literal-brackets | html | `parseBlockInner` 0.232 ms/op; `visit` 0.186 ms/op; `parseParagraph` 0.089 ms/op | `entries` 522.9 KiB/op; `parseParagraph` 433.9 KiB/op; `scanInlineInner` 281.1 KiB/op |
| literal-brackets | direct-html-probe | `tryFastHtmlAttempt` 0.045 ms/op; `(anonymous)` 0.013 ms/op; `collectDefs` 0.010 ms/op | `tryFastHtmlAttempt` 110.8 KiB/op; `split` 47.2 KiB/op; `Map` 0.3 KiB/op |
| inline-links | parse | `scanInlineInner` 0.463 ms/op; `newlineIndices` 0.387 ms/op; `parseBlockInner` 0.254 ms/op | `scanInlineInner` 1295.3 KiB/op; `buildBracketMap` 635.0 KiB/op; `Map` 558.3 KiB/op |
| inline-links | html | `renderInline` 0.176 ms/op; `escapeHtml` 0.175 ms/op; `renderBlocks` 0.137 ms/op | `renderBlocks` 466.9 KiB/op; `escapeHtml` 342.6 KiB/op; `push` 306.7 KiB/op |
| inline-links | direct-html-probe | `renderInline` 0.193 ms/op; `escapeHtml` 0.170 ms/op; `renderBlocks` 0.139 ms/op | `renderBlocks` 473.9 KiB/op; `escapeHtml` 329.1 KiB/op; `push` 307.0 KiB/op |
| sparse-definitions | parse | `collectLinkDefs` 0.990 ms/op; `isBlankLine` 0.306 ms/op; `parseBlockInner` 0.245 ms/op | `collectLinkDefs` 1653.0 KiB/op; `parseParagraph` 445.3 KiB/op; `stripContainerPrefixes` 368.8 KiB/op |
| sparse-definitions | html | `renderBlocks` 0.099 ms/op; `escapeHtml` 0.068 ms/op; `tryFastHtmlAttempt` 0.056 ms/op | `renderBlocks` 514.0 KiB/op; `push` 118.5 KiB/op; `(anonymous)` 116.3 KiB/op |
| sparse-definitions | direct-html-probe | `renderBlocks` 0.100 ms/op; `tryFastHtmlAttempt` 0.058 ms/op; `escapeHtml` 0.057 ms/op | `renderBlocks` 518.3 KiB/op; `push` 121.6 KiB/op; `(anonymous)` 113.2 KiB/op |
| dense-definitions | parse | `collectLinkDefs` 0.418 ms/op; `matchLinkDef` 0.163 ms/op; `parseBlockInner` 0.111 ms/op | `collectLinkDefs` 775.5 KiB/op; `matchLinkDef` 298.8 KiB/op; `exec` 291.5 KiB/op |
| dense-definitions | html | `collectLinkDefs` 0.476 ms/op; `matchLinkDef` 0.165 ms/op; `parseBlockInner` 0.107 ms/op | `collectLinkDefs` 762.5 KiB/op; `entries` 335.6 KiB/op; `matchLinkDef` 295.0 KiB/op |
| dense-definitions | direct-html-probe | `tryFastHtmlAttempt` 0.027 ms/op; `(anonymous)` 0.007 ms/op; `collectDefs` 0.003 ms/op | `tryFastHtmlAttempt` 43.5 KiB/op; `split` 22.1 KiB/op; `Map` 0.2 KiB/op |
| long-unicode | parse | `toCodepointPositions` 0.192 ms/op; `scanInlineInner` 0.036 ms/op; `parse` 0.021 ms/op | `Map` 1.5 KiB/op; `Set` 1.0 KiB/op; `parse` 0.7 KiB/op |
| long-unicode | html | `toCodepointPositions` 0.193 ms/op; `scanInlineInner` 0.040 ms/op; `escapeHtml` 0.035 ms/op | `Map` 3.2 KiB/op; `next` 3.1 KiB/op; `Set` 1.5 KiB/op |
| long-unicode | direct-html-probe | `tryFastHtmlAttempt` 0.000 ms/op; `tryFastHtml` 0.000 ms/op | `HtmlOutput` 0.1 KiB/op; `probe` 0.1 KiB/op; `tryFastHtml` 0.1 KiB/op |
| unicode-paragraphs | parse | `walk` 0.335 ms/op; `parseBlockInner` 0.262 ms/op; `parseParagraph` 0.087 ms/op | `parseParagraph` 439.0 KiB/op; `add` 320.7 KiB/op; `scanInlineInner` 280.7 KiB/op |
| unicode-paragraphs | html | `walk` 0.342 ms/op; `parseBlockInner` 0.263 ms/op; `visit` 0.203 ms/op | `entries` 524.8 KiB/op; `next` 461.1 KiB/op; `parseParagraph` 442.8 KiB/op |
| unicode-paragraphs | direct-html-probe | `tryFastHtmlAttempt` 0.000 ms/op; `tryFastHtml` 0.000 ms/op | `tryFastHtml` 0.0 KiB/op; `probe` 0.0 KiB/op |

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
commit `45bbec34edd9d446ba9e78e8031e33c916473923`.
The current profile records their resulting costs. The preceding snapshot used
a different host and cannot isolate a reader speed improvement.
Ownership retains the independently pinned snapshot from #12. The comparison
uses the reader recorded above, with its separate test scope. The original model and historical baselines retain their pins.

## Method and limits

Two fresh-worker rounds per fixture and phase, with reversed variant order in the second round. Parse, full HTML and direct-HTML eligibility attempts measured separately at the largest existing fixture per family. 500ms warmup, seven batches of at least 100ms with GC before each; separate 500ms CPU profile and 50-call heap sample at 4096 bytes, including collected objects. Position variants preserve the same reader tree after removing positions. Dedicated workflow runs are labeled in metadata; local runs remain shared-host observations. Samples are not performance thresholds.

Host load averaged 1.61, 1.32, 0.7 at the start and
1.18, 1.22, 0.91 at the end on 4
logical CPUs. The dedicated [workflow run](https://github.com/markup-carve/carve-proofs/actions/runs/36647882125) ran workers serially and rejected load above the available CPU count. Scheduling, JIT state and GC can
change ratios, even with reversed variant order. Overlapping sample ranges do
not establish an ordering. Confirm improvements with controlled paired runs before setting
budgets. Position-variant trees are checked against their default reader after
removing position fields, outside the measured operations.

Reproduce with `npm run profile:costs` and `npm run report:costs`.
The site's "Current costs and positions" dataset provides charts and exact exports.
