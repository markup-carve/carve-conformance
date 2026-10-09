# Differential comparison after the lazy-footnote fix

The packaged `djot.v` parser now keeps lazy continuation lines inside a footnote. Both former failing examples and their controls agree with djot.js. The remaining exact HTML differences are classified in the [complete current triage](djot-difference-triage.md), which separates confirmed gaps from intentional behavior and specification questions.

Tested pins:

| Implementation | Revision |
|---|---|
| djot.v | [`f38c92d`](https://github.com/hon-gyu/djot.v/tree/f38c92d585b914d673e35d0fca23cf5cad0a6b56) |
| djot.js pinned development source | [`d93aff3`](https://github.com/jgm/djot.js/tree/d93aff39561a4306c8d59cebd9e07cc6712e1be3) |
| Released djot.js, secondary comparison | npm `@djot/djot` 0.3.2 |

## Resolved: lazy footnote continuation

```djot
[^n]: a
b

[^n]
```

Both parsers keep `a` and `b` in the footnote paragraph, with no extra main-document paragraph. The unreferenced version renders nothing in both. An indented `b` also stays in the note; a blank before an unindented `b` puts it outside.

The [footnote syntax](https://github.com/jgm/djot/blob/d77f8a0cbea6785c42b3e2b03463195b5ca6f7c7/doc/syntax.md#footnote) permits subsequent paragraph lines to omit indentation. The [upstream ledger](https://github.com/hon-gyu/djot.v/blob/f38c92d585b914d673e35d0fca23cf5cad0a6b56/.project/djotjs-divergences.md#closed-2026-09-28----a-footnotes-paragraph-continues-on-a-lazy-line) records the fix. Our [earlier evidence](https://github.com/markup-carve/carve-proofs/blob/203c77c/reports/djot-differential.md) remains available for the failure at `3279f36`; it is not a current defect.

Four [Rocq witnesses](../scripts/differential/FootnoteWitness.v) check lazy ownership, indented ownership, equality of the lazy and indented parsed content, and the blank-line control. All four are [closed under the global context](djot-differential-proofs.json). These concrete examples establish the checked cases, not universal footnote conformance.

[footnote-lazy.test](../tests/differential/footnote-lazy.test) retains the same four portable conformance cases. Expected HTML matches djot.js. The runner checks them against fresh outputs, and upstream's conformance harness with the packaged parser as `--subject` now reports [four matches, zero mismatches and zero errors](djot-differential-upstream.txt).

## Separate renderer candidate: unresolved image alt text

```djot
![x][r]
```

Djot.js emits `<p><img></p>`; djot.v emits `<p><img alt="x"></p>`. Adding `[r]: /target` makes both render the same image, with alt text and a source. The collapsed form `![x][]` has the same unresolved-reference difference.

In [djot.js's renderer](https://github.com/jgm/djot.js/blob/d93aff39561a4306c8d59cebd9e07cc6712e1be3/src/html.ts#L411), the reference-image branch assigns `alt` only when reference lookup succeeds. Retaining the available alt text on lookup failure is a concrete renderer improvement to discuss. The syntax reference does not specify the exact HTML fallback for an unresolved image, so this report does not label it a specification violation.

## Sweep and triage

The deterministic corpus has 4,177 distinct inputs: combinations of inline constructs, containers and document context, three-block sequences, and 750 seeded document attempts with duplicates removed. It covers references, heading IDs, attributes, incomplete syntax, tables and footnotes. Every input uses the default profiles.

| Exact HTML comparison | Different inputs |
|---|---:|
| Current djot.js versus djot.v | 295 |
| npm djot.js 0.3.2 versus djot.v | 470 |
| Current versus npm djot.js | 198 |

These counts are candidate inputs, not distinct bugs. No HTML whitespace, attribute ordering or other serialization is normalized. Of the current comparison, 3,882 inputs match exactly. [The raw record](djot-differential.json) contains every observed disagreement, both JavaScript outputs, native output, pins, suite digest, focused controls and reductions.

The focused triage also checks three already documented differences: [recovered attributes inside containers and escaped closing brackets in reference labels](https://github.com/hon-gyu/djot.v/blob/f38c92d585b914d673e35d0fca23cf5cad0a6b56/.project/djotjs-divergences.md), and the intentional use of rendered smart punctuation in heading IDs. Those are not presented as new findings. A duplicate footnote-reference ID difference in npm 0.3.2 is already fixed in the current source revision. The focused fixture records that agreement as a control.

Twelve focused cases were checked in both batch and fresh processes for all three readers. JavaScript batch runs reset smart-quote defaults using upstream's test-harness recipe. Native messages use byte-length framing; the focused Unicode case checks that framing against a fresh process.

A character-deletion reducer shrinks the remaining unresolved-image family while retaining a nonempty reference image. It reaches:

```djot
![a][g]
```

No single-character deletion that stays in that family retains a disagreement. This is a local minimality claim, not a proof of globally shortest inputs. The former lazy-footnote reduction is no longer an active disagreement. The [complete current triage](djot-difference-triage.md) now partitions all 295 current disagreements into four diagnostic families, with reductions and agreement controls for every original input. That classification distinguishes a confirmed djot.v gap, specification and renderer questions, and an intentional policy difference; it does not prove independent root causes for every possible interaction.

## Reproduce

From the repository root with dependencies installed and OCaml 4.14.2 / Dune 3.23.1 available through opam:

```sh
npm run build:djot-v
npm run build:djot-differential
npm run check:djot-differential -- --check reports/djot-differential.json
# With Rocq 9.2 / stdlib 9.1 installed:
npm run proof:djot-differential -- --check reports/djot-differential-proofs.json
```

The build fetches the pinned djot.js source, installs its locked build dependencies in ignored `.cache/`, compiles it with TypeScript 4.9.4, and builds a separate native HTML driver. It verifies source revisions and records compiled-output hashes. Add `--output <path>` to save fresh observations; with `--check`, writing happens only after the snapshot comparison passes.

CI runs the same deterministic comparison. The native observations use the packaged kernel; the earlier [Rocq/extraction consistency discrepancy](djot-v.md#formal-checks-and-extraction-boundary) remains a separate result. Nothing here claims a proof of full Djot conformance.
