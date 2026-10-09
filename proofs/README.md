# Carve proofs

Checked models of [Carve](https://github.com/markup-carve/carve) parsing rules,
with tests comparing their predictions against the executable
specification and the pinned JavaScript engine. The Carve repository remains the
authority for language rules.

The layout model covers boundary transitions, column ownership, stored
continuation claims and decoding of measured indentation and quote prefixes.
Its 26 theorems compile without additional assumptions. Seventeen authored
traces agree with the executable specification and pinned JavaScript engine.
The model applies the list-specific rules in §24 C3 where they qualify Part 0.
It remains a partial model, not a verified implementation of the full parser.

The [current Djot difference triage](reports/djot-difference-triage.md) classifies
all 295 differing inputs, retains reductions and agreement controls, and adds
separate performance fixtures. Only the escaped-reference family is a confirmed
djot.v parser gap; the other families have distinct policy or specification status.

The [candidate-stack model](proofs/layout/STACK.md) adds fifteen checked theorems
about choosing among supplied frame candidates. Its extracted OCaml helper is
compiled and run by `npm run proof:stack`. Candidate order, local coordinates
and classifications remain caller inputs; this does not verify a source parser.

## Visual evidence

Explore the [**evidence site**](https://markup-carve.github.io/carve-conformance/proofs/) for reader comparisons, exportable scaling charts, proof coverage and changes between recorded runs. See the [site build instructions](site/README.md) to reproduce it locally.

## Development snapshot

The development-reader checks were refreshed on 2026-09-30. The ownership
matrix uses these source commits:

| Reader | Commit |
|---|---|
| Specification | `9db91206d1a4a8a8cf795c48210bca49d66f14d6` |
| JavaScript | `6d02fa7062dd03024e7c092016459602e9a7aeec` |
| PHP | `7033d04b1d942263508eadf9b699a77ee656bfda` |
| Rust | `9f3f334c7d5c91c57e4e6269b32599af1062fdde` |

The JS comparison uses `6d02fa7062dd03024e7c092016459602e9a7aeec` through
a separate dependency. Runtime scaling retains the PHP and Rust commits above.
The [phase scaling report](reports/runtime-scaling.md) separates parsing, rendering
and conversion. Raw reports record reader provenance and host load. The
original layout model and historical baselines retain their own pins.
The [previous runtime measurements](reports/history/pre-engine-performance/runtime-timings.json)
remain available alongside the archived comparison and profiles.

The [proof recheck and remaining costs](reports/performance-refresh.md) records
the formal checks, the unchanged extraction mismatch and the next engine targets.

## Comparison contracts

The [refreshed comparison](reports/comparison.md) uses the post-fix JavaScript
reader through a separate pinned dependency. The checked model retains its
original specification and engine pins. The [nesting profile](reports/nesting-profile.md)
compares the existing prefix-state optimization with the preserved earlier run.

Run `npm run check:contracts -- --check reports/comparison-contracts.json` for
525 scoped observations, and `npm run check:containers -- --check reports/container-regressions.json`
for 112 distinct container cases with source-position checks and AST/HTML fingerprints.
The site exposes both suites under Language behavior and the before/after
measurements under Scaling & allocation.

## Setup

Use Node 24 or newer, Git, Rocq core 9.2.0 and standard library 9.1.0.

```sh
git clone --recurse-submodules https://github.com/markup-carve/carve-conformance.git
cd carve-conformance/proofs
GIT_CONFIG_COUNT=2 \
  GIT_CONFIG_KEY_0=url.https://github.com/.insteadOf \
  GIT_CONFIG_VALUE_0=ssh://git@github.com/ \
  GIT_CONFIG_KEY_1=url.https://github.com/.insteadOf \
  GIT_CONFIG_VALUE_1=git@github.com: npm ci
npm test
npm run proof:layout
```

The Git settings above fetch the public npm Git dependency over HTTPS.

For an existing clone, run `git submodule update --init` first. If Rocq is
installed in an opam switch, use `opam exec -- npm run proof:layout`.
`npm run proof:layout:evidence` runs the JavaScript comparisons without a proof
compiler and explicitly reports that it has not checked the proofs.

## Specification revision

The [spec submodule](spec) pins Carve to the revision used for the comparisons.
The npm manifest and lockfile pin the matching JS engine and parser dependency;
the runner rejects dependency pins that disagree with that specification.
Updating the submodule requires rerunning the proofs and reviewing any changed
trace or discrepancy.

See the [layout model](proofs/layout/README.md) for theorem scope, preconditions,
recorded differences and trust boundaries. CI runs the tests and compiler check
on pull requests and pushes to `main`.

## Language properties and scaling

The [property report](reports/properties.md) records wrapping, container,
reference-locality and append-stability checks against the pinned readers,
plus timing measurements for seven input families. It identifies specified
exceptions to the broad guarantees and records the nesting performance signal.

Run `npm run check:properties` for deterministic comparisons and
`npm run bench:scaling` for timed measurements. `npm test` includes the
comparisons and selected layout-work budgets. These checks do not extend the
scope of the Rocq proofs.

The [regression-limit report](reports/regression-budgets.md) records deterministic
work guards across all 14 shared families and held-out timing/allocation observations.
Run `npm run check:scaling-guards` to check the exact counter artifact. Timing and
sampled-allocation limits remain observational until calibration supports enforcement.

## Reader comparison and nesting profiles

The [three-reader comparison](reports/comparison.md) tests equivalent Carve,
Djot and CommonMark inputs and measures their default JavaScript APIs on the
same workflow runner. Each API has two rounds of fresh workers with reversed
reader order. The charts show both rounds. Language differences are recorded
explicitly, and 28 shared-syntax controls check rendered HTML across readers.
CI checks the reviewed observations; timing measurements are optional.

The [nesting profile](reports/nesting-profile.md) separates parsing, rendering,
allocation and regex work. It identifies repeated prefix inspection that the
original layout counters miss. Regression ceilings cover its regex-mediated portion without
claiming a linear parser bound.

Run `npm run check:comparison`, `npm run bench:comparison` and
`npm run profile:nesting` to collect evidence. Regenerate the reports with
`npm run report:comparison` and `npm run report:profiling`.

For publishable measurements, run the Cross-reader evidence workflow on the
measurement branch. It records runner provenance, checks host load around each
worker and uploads raw data plus reports. Download its three JSON reports and
regenerate the Markdown locally before committing. Local exploratory runs do
not satisfy the committed evidence validators.

The [cost profile](reports/current-costs.md) compares position options and
allocation, with a separate direct-HTML probe. A rejected probe ends before
AST fallback; its timing is not the full HTML call. The
[previous comparison and profiles](reports/history/pre-engine-performance/README.md)
retain the measurements replaced by this refresh. Runs on different hosts
do not isolate the effect of parser changes.

## djot.v extraction

The [djot.v report](reports/djot-v.md) checks the pinned OCaml package against
the shared fixtures, separates raw parsing from document processing, and
records streaming composition and native timing measurements. It also records
eleven theorem assumption checks and the extraction diff under our toolchain.

Run `npm run build:djot-v` with OCaml 4.14.2 and Dune 3.23.1 available through
opam, then `npm run check:djot-v -- --check reports/djot-v-results.json`.
`DJOT_V_OPAM_SWITCH` selects an optional opam switch. The build downloads the
pinned public source into ignored `.cache/`. `npm run bench:djot-v` records
timings. `npm run proof:djot-v` requires Rocq 9.2 and stdlib 9.1, builds the
upstream project, prints theorem assumptions and checks extraction consistency.
The proof command exits nonzero when extraction differs; inspect the recorded
diff before drawing conclusions about the packaged code.

The [extension fixtures](tests/djot-extensions/README.md) demonstrate one syntax
tradeoff: enabling list interruption permits sublists without blank lines, but
can turn a hard wrap into a new list. Portable JSON expectations, a native
runner and eight Rocq witnesses make the example reproducible. Run
`npm run check:djot-extensions` and `npm run proof:djot-extensions` after building
the pinned package.

The [differential report](reports/djot-differential.md) compares 4,177 inputs
against pinned current djot.js, its npm release and djot.v. It confirms the upstream
lazy-footnote fix and records an unresolved-image rendering candidate, controls
and a portable upstream test fixture. The [complete triage](reports/djot-difference-triage.md)
classifies every current disagreement and records reduced cases and performance fixtures. Run `npm run build:djot-differential`
and `npm run check:djot-differential` after building the native package.

## Four-reader ownership matrix

The [ownership report](reports/ownership.md) compares 472 inputs across pinned
versions of the executable specification, JavaScript, PHP and Rust. It records
zero structural disagreements. Run `npm run build:ownership`, then
`npm run check:ownership -- --check reports/ownership-results.json`.
The matrix uses separate pins and does not extend the layout proofs.

The [current-reader report](reports/ownership-current.md) separately checks 535
inputs, including 63 normative opaque-quote, continuation and tab cases, plus
68 versioned contract observations. Run `npm run build:ownership:current`,
`npm run check:ownership:current` and `npm run check:ownership:contracts`.
Historical measurements retain their original pins.

## Rust and PHP scaling

The [runtime measurements](reports/runtime-timings.json) cover Carve Rust and
PHP on the same seven input families as the JavaScript scaling runs. Select
**Carve Rust** or **Carve PHP** under Scaling & allocation on the evidence site.
Each dataset includes parse, render and combined HTML timings, with CPU time
and memory measurements. These runs reuse the ownership suite's engine pins.

Run `npm run build:runtime`, then `npm run bench:runtime` to reproduce the
measurements. Building requires Git, Cargo and a Rust toolchain; running also
requires Unix and PHP 8.2 or newer with mbstring and ctype. The Rust driver uses
a locked dependency graph and a release build. PHP runs with a clean INI,
without opcache, JIT or profiling extensions. Run
`node --test tests/runtime-scaling.test.mjs` after building to exercise both
workers, including their nesting-depth checks.

Each size runs in a fresh process with a 60-second deadline. Timing excludes
process startup and fixture validation. Render reuses a parsed
AST; combined HTML uses each engine's default API, including eligible fast
paths. Five timed batches follow warmup at each size. Memory measurements use
five separate warmed calls. Rust counts successful allocator requests and their
requested bytes, including the full new size of reallocations. PHP measures
peak managed-memory growth above the pre-call baseline, including the result.
PHP's metric does not count allocation churn. The charts keep runtime datasets
separate and include pins, toolchains, host load and measurement definitions in
the downloadable JSON. Historical runs do not establish a speed ranking or a
complexity bound.
