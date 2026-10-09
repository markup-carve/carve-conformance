# Proof recheck and remaining engine costs

The post-improvement PHP reader retains every recorded ownership result.
All 472 inputs agree across the pinned specification, JS, PHP and Rust readers.
The JS refresh also retains all 420 comparison observations, 525 scoped
contracts and 112 container cases, including their fingerprints and source
positions. These are scoped executable checks, not a proof of each engine.

## Formal checks

The 26 Carve layout theorems compile without added assumptions. The authored
traces and generated table, trace and prefix examples pass. The model and its
original reader and specification pins remain unchanged.

The eleven Djot theorem assumption checks, four footnote witnesses and eight
extension witnesses also pass without axioms. The packaged Djot extraction
still differs from fresh extraction under Rocq 9.2 and OCaml 4.14.2. The refreshed upstream check at `f38c92d` differs in four generated library
files; the combined proof/extraction command exits 1.
The [recheck record](proof-refresh.json) keeps that failure separate from the
successful theorem checks. The engines have no complete parser verification
or proven linear runtime bound in this repository.

## PHP

The local phase run had load averages of 4.59, 11.80 and 12.73 at the start,
and 5.87, 10.70 and 12.28 at the end on 16 logical CPUs. Shared-host activity
affects these PHP and Rust timings; the figures identify experiments to run.

The [phase measurements](runtime-scaling.md) use PHP commit
`7033d04b1d942263508eadf9b699a77ee656bfda`, after the bracket index,
paragraph materialization and HTML padding changes.
At 1,024 unmatched open brackets, parsing measures 4.124 ms without JIT;
the observed exponent over the recorded sizes is 1.004. This supports keeping
the bracket scan out of the immediate optimization queue on this fixture,
without extending the result to arbitrary inline nesting.

Deep lists remain expensive: at depth 192, parsing measures 44.675 ms and
rendering 34.120 ms. Quotes at the same depth measure 6.420 ms to parse and
5.211 ms to render. Next, separate nested container setup from inline parsing,
and measure writing into a shared HTML buffer against subtree-string assembly.
The output has 290.6 KiB for the list fixture and 76.3 KiB for the quote fixture;
indentation contributes to that growth. A fit against source bytes alone does
not establish avoidable rendering work.

## Rust

At depth 192, list parsing measures 5.178 ms, while rendering measures 0.187 ms.
That makes container parsing the first target for this fixture. The current
mapped-source path builds line cursors for nested container bodies; measure
cursor setup and source mapping before changing their ownership rules.

Quote rendering is a separate allocation lead. Its final output is 78,154
bytes, while each render requests 29,665,904 allocation bytes across 1,899
requests. These are allocation churn counts, including reallocations, not
live memory. The renderer collects child strings before appending them.
A shared buffer could reduce intermediate allocation while preserving output
indentation, but its gain has not been measured here.

## JavaScript

The refreshed comparison and CPU/allocation profiles use commit
`6d02fa7062dd03024e7c092016459602e9a7aeec`. Use the
[current cost report](current-costs.md) to choose targets by fixture and phase.
The nested-list profiles point to `parseList`, with large `Map`/`Set` allocations.
Sparse and dense definitions spend CPU and allocate in `collectLinkDefs`;
inline links allocate bracket maps, and Unicode positions spend time in the
position walk. Measure those paths separately from rendering and document-wide
semantic walks. The option that removes
position fields after parsing does not measure avoiding their construction.

The [nesting profile](nesting-profile.md) and container-tail counters keep
regex exposure and copied characters distinct. Neither counter proves a
linear parser bound. Failed fast-route attempts are measured separately from
the full AST fallback, so their cost does not replace its allocation profile.

## Interpreting the runs

The Rust/PHP runtime measurements cover 42 groups and 204 size observations,
with parse, render and HTML measured independently. PHP has a clean INI and
JIT disabled. The [throughput benchmarks](https://github.com/markup-carve/carve-bench)
enable tracing JIT and use different inputs. Do not combine their phase costs
or use these runs as a cross-runtime ranking.

The committed JS timing and allocation datasets come from the dedicated
cross-reader workflow; their metadata links to the run. The Rust/PHP dataset
records this local host and its load. Neither comparison with an older host
nor a small change between samples isolates an engine speed improvement.
The next implementation PRs should use alternating baseline/candidate runs
and retain exact AST/HTML parity on the ownership and container suites.

## Current container follow-up

The [current container measurements](current-container-costs.md) compare the
historical reader pins with later Rust and PHP main snapshots. They retain exact
output fingerprints and separate Rust allocation churn from shared-host timing
observations. The original quote-allocation lead is resolved in current Rust;
PHP deep-list rendering remains expensive; code inspection identifies repeated
subtree indentation as a candidate cause.
