# Rust and PHP phase scaling

Recorded 2026-09-30T01:26:36.940Z. Rust uses commit `9f3f334c7d5c91c57e4e6269b32599af1062fdde`;
PHP uses `7033d04b1d942263508eadf9b699a77ee656bfda`. The [raw batches](runtime-timings.json) retain
wall and CPU samples, memory observations, source pins and build hashes.

Each phase is measured independently. Render reuses a parsed tree; HTML uses
the default conversion API and can take its fast route. Do not add phase timings.
PHP uses a clean INI with JIT disabled, unlike the tracing-JIT throughput
benchmarks in carve-bench. These measurements do not establish a runtime ranking.

## Endpoints and observed growth

The exponent is a log-log fit of wall time against input bytes over the recorded
sizes. It describes these samples, not a proven complexity bound. Tiny timings,
GC and scheduling can distort the fit. Nested inputs verify the requested depth.
Pretty-printed nested HTML grows with indentation as well as node count. The
HTML size column records that output cost; superlinear growth against source
bytes alone does not prove avoidable renderer work.

The final column has different units by reader: Rust reports total requested
allocation KiB per call, including reallocations; PHP reports peak managed
growth KiB above its pre-call baseline. Neither is retained memory or RSS,
and the columns cannot be compared as allocation totals.

Definitions recorded by the measurement runner:

- Rust: Successful global allocator requests, counting the full new size on realloc; includes result disposal, excludes fixture setup, prebuilt render AST and reporting. Atomic counters enabled only during memory calls; the allocator flag check remains in timed calls. Requested bytes are allocation churn, not peak or retained memory.
- PHP: Peak managed bytes above the pre-call memory_get_usage(false) baseline after cycle collection and memory_reset_peak_usage. Includes the live result; excludes prebuilt render AST, input and reporting. This is peak growth, not total allocated bytes or RSS. Clean INI disables opcache/JIT and profiling extensions.

| Reader | Family | Phase | Repeat count / depth | First / last wall ms | Last CPU ms | Observed exponent | Last HTML KiB | Last memory KiB |
|---|---|---|---|---:|---:|---:|---:|---:|
| rs | long-line | parse | 1024 to 8192 | 0.013 / 0.096 | 0.096 | 0.955 | 40.0 | 203.3 |
| rs | long-line | render | 1024 to 8192 | 0.005 / 0.041 | 0.041 | 0.975 | 40.0 | 100.9 |
| rs | long-line | html | 1024 to 8192 | 0.017 / 0.140 | 0.140 | 0.999 | 40.0 | 120.1 |
| rs | unmatched-brackets | parse | 16 to 1024 | 0.003 / 0.043 | 0.043 | 0.721 | 1.0 | 48.3 |
| rs | unmatched-brackets | render | 16 to 1024 | 0.001 / 0.002 | 0.002 | 0.265 | 1.0 | 3.4 |
| rs | unmatched-brackets | html | 16 to 1024 | 0.003 / 0.051 | 0.051 | 0.705 | 1.0 | 52.9 |
| rs | unmatched-closers | parse | 1024 to 8192 | 0.038 / 0.291 | 0.291 | 0.980 | 8.0 | 43.3 |
| rs | unmatched-closers | render | 1024 to 8192 | 0.002 / 0.009 | 0.009 | 0.844 | 8.0 | 20.9 |
| rs | unmatched-closers | html | 1024 to 8192 | 0.004 / 0.029 | 0.029 | 0.956 | 8.0 | 24.1 |
| rs | unclosed-code | parse | 1024 to 8192 | 0.012 / 0.109 | 0.109 | 1.068 | 40.0 | 243.3 |
| rs | unclosed-code | render | 1024 to 8192 | 0.006 / 0.041 | 0.041 | 0.968 | 40.0 | 100.9 |
| rs | unclosed-code | html | 1024 to 8192 | 0.033 / 0.296 | 0.295 | 1.045 | 40.0 | 423.3 |
| rs | many-paragraphs | parse | 128 to 1024 | 0.121 / 1.023 | 1.023 | 1.024 | 18.0 | 2508.9 |
| rs | many-paragraphs | render | 128 to 1024 | 0.022 / 0.181 | 0.181 | 1.029 | 18.0 | 676.0 |
| rs | many-paragraphs | html | 128 to 1024 | 0.023 / 0.180 | 0.180 | 0.980 | 18.0 | 99.9 |
| rs | nested-quotes | parse | 8 to 192 | 0.007 / 0.198 | 0.198 | 1.135 | 76.3 | 674.3 |
| rs | nested-quotes | render | 8 to 192 | 0.002 / 0.404 | 0.404 | 1.723 | 76.3 | 28970.6 |
| rs | nested-quotes | html | 8 to 192 | 0.009 / 0.806 | 0.806 | 1.479 | 76.3 | 29592.7 |
| rs | nested-lists | parse | 8 to 192 | 0.019 / 5.178 | 5.178 | 1.881 | 290.6 | 1523.4 |
| rs | nested-lists | render | 8 to 192 | 0.002 / 0.187 | 0.187 | 1.504 | 290.6 | 670.9 |
| rs | nested-lists | html | 8 to 192 | 0.021 / 4.844 | 4.844 | 1.838 | 290.6 | 2106.1 |
| php | long-line | parse | 1024 to 8192 | 0.017 / 0.035 | 0.035 | 0.337 | 40.0 | 44.8 |
| php | long-line | render | 1024 to 8192 | 0.030 / 0.191 | 0.191 | 0.889 | 40.0 | 128.9 |
| php | long-line | html | 1024 to 8192 | 0.047 / 0.226 | 0.226 | 0.759 | 40.0 | 130.0 |
| php | unmatched-brackets | parse | 16 to 1024 | 0.082 / 4.124 | 4.120 | 1.004 | 1.0 | 215.9 |
| php | unmatched-brackets | render | 16 to 1024 | 0.011 / 0.014 | 0.014 | 0.069 | 1.0 | 4.7 |
| php | unmatched-brackets | html | 16 to 1024 | 0.095 / 3.921 | 3.916 | 0.951 | 1.0 | 215.9 |
| php | unmatched-closers | parse | 1024 to 8192 | 0.025 / 0.076 | 0.076 | 0.548 | 8.0 | 12.8 |
| php | unmatched-closers | render | 1024 to 8192 | 0.014 / 0.040 | 0.040 | 0.518 | 8.0 | 32.9 |
| php | unmatched-closers | html | 1024 to 8192 | 0.041 / 0.119 | 0.119 | 0.523 | 8.0 | 34.0 |
| php | unclosed-code | parse | 1024 to 8192 | 0.019 / 0.035 | 0.035 | 0.273 | 40.0 | 48.2 |
| php | unclosed-code | render | 1024 to 8192 | 0.031 / 0.200 | 0.200 | 0.906 | 40.0 | 129.0 |
| php | unclosed-code | html | 1024 to 8192 | 0.053 / 0.228 | 0.228 | 0.709 | 40.0 | 174.0 |
| php | many-paragraphs | parse | 128 to 1024 | 0.999 / 8.045 | 8.045 | 0.987 | 18.0 | 691.4 |
| php | many-paragraphs | render | 128 to 1024 | 0.591 / 4.499 | 4.500 | 0.981 | 18.0 | 296.4 |
| php | many-paragraphs | html | 128 to 1024 | 1.563 / 12.230 | 12.233 | 0.992 | 18.0 | 916.7 |
| php | nested-quotes | parse | 8 to 192 | 0.116 / 6.420 | 6.422 | 1.355 | 76.3 | 1605.4 |
| php | nested-quotes | render | 8 to 192 | 0.035 / 5.211 | 5.212 | 1.677 | 76.3 | 313.4 |
| php | nested-quotes | html | 8 to 192 | 0.148 / 11.194 | 11.161 | 1.442 | 76.3 | 1605.4 |
| php | nested-lists | parse | 8 to 192 | 0.289 / 44.675 | 44.680 | 1.707 | 290.6 | 3321.8 |
| php | nested-lists | render | 8 to 192 | 0.067 / 34.120 | 34.136 | 2.137 | 290.6 | 1055.8 |
| php | nested-lists | html | 8 to 192 | 0.365 / 75.738 | 75.735 | 1.803 | 290.6 | 3321.8 |

## Method

Serial release Rust and clean-INI PHP workers; One fresh process per size, with a 60s deadline including startup. Per size: 200ms warmup, five batches of at least 20ms, checked after every call. Timings exclude startup, input decoding, depth and output checks. Render reuses a parsed AST. Combined HTML uses the default API, including eligible fast paths. Rust drops each result within timing; PHP includes automatic cycle collection and collects cycles before batches. Memory is measured in five separate warmed calls, outside timing. These runs do not establish a cross-runtime ranking.

This is a local shared-host run. Host load was 4.59, 11.8, 12.73 at the start and
5.87, 10.7, 12.28 at the end on 16
logical CPUs. Compare candidate changes with
alternating baseline runs before making a speed claim.

Reproduce with `npm run build:runtime`, `npm run bench:runtime` and
`npm run report:runtime`. The [JavaScript comparison](comparison.md) and
[CPU and allocation profiles](current-costs.md) cover the separately pinned JS reader.
