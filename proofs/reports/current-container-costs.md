# Current container costs

At depth 192, current Rust requests 352,045 allocation bytes for a borrowed quote render, compared with 29,665,904 in the historical proof pin: a 98.81% reduction. The HTML is unchanged. This resolves the original allocation lead on this fixture.

The snapshots include the merged [Rust shared-buffer work](https://github.com/markup-carve/carve-rs/pull/2282) and [PHP quote-chain work](https://github.com/markup-carve/carve-php/pull/2847). The comparisons cover multiple changes and do not isolate those PRs.

PHP deep-list rendering remains expensive. The scaling rows below measure total render time against output bytes. Code inspection identifies repeated subtree indentation as a candidate cause; this profile does not time indentation alone. A guarded cumulative-indentation experiment can test that cause without changing parsing or ownership.

## Snapshots

| Reader | Historical proof pin | Current snapshot |
| --- | --- | --- |
| rs | `9f3f334c7d5c91c57e4e6269b32599af1062fdde` | `c8ef7dffc6e61b58cdb92c1ed081048b0dc999a5` |
| php | `7033d04b1d942263508eadf9b699a77ee656bfda` | `fba5f377a72771b164b638ef9997b7caf4850ede` |

The [raw observations](current-container-costs.json) contain source fingerprints, binary hashes, tool versions, fixture and preflight HTML hashes, host load and every sample. Historical pins and reports are unchanged.

## Allocation evidence

Rust counts requested bytes and successful allocation/reallocation calls in five separate operations per observation. These are churn counts, not live or peak memory. Rendering uses the borrowed API, including its internal AST clone.

| Family | Depth | HTML bytes | Baseline bytes | Current bytes | Baseline calls | Current calls |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| quote | 48 | 5722 | 543368 | 33373 | 400 | 64 |
| quote | 96 | 20650 | 3898752 | 102733 | 869 | 113 |
| quote | 192 | 78154 | 29665904 | 352045 | 1899 | 210 |
| list | 48 | 19107 | 61903 | 61797 | 119 | 114 |
| list | 96 | 75075 | 196543 | 196437 | 216 | 211 |
| list | 192 | 297603 | 687007 | 686901 | 409 | 404 |

## Phase observations at depth 192

Each cell shows wall-time medians from round 0 / round 1. Changes within the round spread are inconclusive on this shared host; the table is not a timing gate or a cross-language ranking. PHP opcache and JIT are disabled. CPU samples and managed-heap peaks are recorded separately.

The one-minute load was 12.96 at the start and 8.48 at the end, on 16 logical CPUs.

| Reader | Family | Phase | Baseline wall ms, rounds 0 / 1 | Current wall ms, rounds 0 / 1 |
| --- | --- | --- | ---: | ---: |
| rs | quote | parse | 0.205 / 0.182 | 0.249 / 0.246 |
| rs | quote | render | 0.482 / 0.375 | 0.071 / 0.068 |
| rs | quote | html | 1.100 / 0.764 | 0.388 / 0.380 |
| rs | list | parse | 4.886 / 5.400 | 4.838 / 4.266 |
| rs | list | render | 0.183 / 0.165 | 0.161 / 0.144 |
| rs | list | html | 5.434 / 4.680 | 5.305 / 4.520 |
| php | quote | parse | 6.146 / 4.756 | 6.000 / 5.991 |
| php | quote | render | 5.805 / 4.609 | 0.390 / 0.384 |
| php | quote | html | 11.929 / 10.268 | 6.475 / 6.860 |
| php | list | parse | 42.558 / 40.448 | 41.505 / 39.832 |
| php | list | render | 35.338 / 28.890 | 31.991 / 29.109 |
| php | list | html | 73.823 / 69.024 | 75.399 / 68.330 |

## PHP list-render scaling

| Depth | HTML bytes | Baseline wall ms, rounds 0 / 1 | Current wall ms, rounds 0 / 1 |
| ---: | ---: | ---: | ---: |
| 48 | 19108 | 0.764 / 0.740 | 0.656 / 0.667 |
| 96 | 75076 | 5.264 / 4.306 | 4.744 / 4.359 |
| 192 | 297604 | 35.338 / 28.890 | 31.991 / 29.109 |

## Reproduce

Use clean checkouts at the current commits above. The runner creates detached historical clones from those repositories, builds each Rust library with its own lockfile and Cargo release profile, then compiles the same worker with `rustc --edition=2021 -O`. Worker flags and library profile are recorded separately.

Builds use `CARGO_TARGET_DIR` or `/var/tmp/cargo-shared/carve-rs`. The optional `--target-baseline=DIR` and `--target-current=DIR` flags override that location. Each worker is linked immediately after its library build.

```sh
node scripts/runtime/refresh-containers.mjs \
  --rust=/path/to/carve-rs --php=/path/to/carve-php \
  --report=reports/current-container-costs.json
node --test tests/current-container-costs.test.mjs
```

The runner requires all 144 observations and two reversed fresh-process rounds. Each fixture/phase warms for 200 ms and records five batches of at least 20 ms. It validates requested parse depth and checks parse/render against combined HTML before and after timing.

Preflight HTML fingerprints must remain equal within each language across variants and rounds. They are recorded alongside phase rows, not recomputed for every timed iteration. Rust and PHP have different trailing-newline conventions, so hashes are not compared across languages. The runner regenerates this report with the JSON.

These checks cover six simple nested fixtures per reader, not complete corpus conformance, arbitrary nesting or invisible AST ownership. They establish no parser complexity bound. Corpus, callback, raw-payload and source-position checks belong with any proposed implementation change.
