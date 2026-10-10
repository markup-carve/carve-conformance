# Import evidence audit

The report published after conformance PR #5 used 652 CommonMark examples and
268 Djot examples per engine. This audit separates rendered HTML evidence from
losses of source text or structured nodes.

## Matching HTML with a named loss

The CommonMark report contained 33 observations labeled `false-loss`: seven
JavaScript, eleven PHP and fifteen Rust. Thirty-two observations name
`raw-preserved`. The importer keeps opaque HTML instead of structured Carve
nodes. Equal rendered HTML does not establish that those nodes survived.

The remaining observation is JavaScript example 40. Its leading tab is dropped
and reported as `structure-unspellable`; the whitespace-collapsing HTML
comparison ignores the tab. These observations therefore do not establish
false diagnostics.

HTML suites label matching output, including declared rendering differences,
with a named loss `unverified-loss`.
The label leaves the diagnostic's correctness unresolved. Authored adapter fixtures
retain their existing `false-loss` checks and CI gates. Those importer checks
also compare rendered semantics, so their evidence has the same limitation.

## Seven previously unassessed CommonMark mismatches

These seven were shared mismatches whose reports named no loss in PR #5's
measurement.

| Examples | Imported construct | Boundary |
| --- | --- | --- |
| 34, 144 | Fenced code | Decoded languages `föö` and `;` have no Carve language-token spelling. |
| 200, 485, 486, 487, 567 | Links | Carve has no link spelling for an empty destination. |

The importers already retain the code payload or link label. Migration reports
now name the omitted language or destination as `structure-unspellable`, with
the source line. Empty images receive the same report while retaining their
alt text and title. These seven imports keep the same output bytes.

## Rust Djot convergence

[Rust PR #2433](https://github.com/markup-carve/carve-rs/pull/2433) added Djot
normalization after the previous conformance pin. Rechecking all 268 cases
found that it fixes all 28 Rust-only mismatches without introducing a mismatch
among the previously matching cases. After applying the existing rendering
declarations, Rust has the same sixteen mismatches as JavaScript and PHP.
The refreshed conformance engine pins include that merged fix.

[Conformance PR #6](https://github.com/markup-carve/carve-conformance/pull/6)
subsequently declared two of those differences. With the current pins,
all three engines have fourteen mismatches after the PHP caption fix below.

## Remaining importer cases

Review probes also found older cases outside the seven CommonMark examples:

- JavaScript and PHP leave the nested empty image literal in `[a ![b]() c]()`,
  while Rust retains its alt text.
- Unsupported fence languages on `> - ` or `- > ` container lines still need
  consistent handling in JavaScript and PHP. Top-level fences and the container
  forms covered by the new regressions report their omitted language.

These cases need separate output and diagnostic fixes and fall outside
these suite counts.

## PHP caption and empty-footnote fixes

Refreshing PHP from `8bddf96a` to `66b1dfe7` included a Djot caption regression
introduced by [PHP PR #3030](https://github.com/markup-carve/carve-php/pull/3030).
In `tables.test:35`, the converter escaped the caption marker and imported its
text as a paragraph instead of attaching it to the table. PHP had fifteen
mismatches while JavaScript and Rust had fourteen.

[PHP PR #3055](https://github.com/markup-carve/carve-php/pull/3055) preserves table
caption markers, including captions in quotes and lists. It also protects
synthetic empty-footnote markers from the percent-run escaping added in
[PHP PR #3054](https://github.com/markup-carve/carve-php/pull/3054). Without that
protection, `footnotes.test:1`, `:33`, and `:51` expose those markers as text.

The refreshed pin includes both fixes. All three engines now have 240 matches,
fourteen mismatches, thirteen declared differences, one non-comparable case,
and no failures across the 268 Djot examples. Thirteen mismatches name a loss;
the remaining smart-quote mismatch is unassessed.
