# Four-reader ownership matrix

All 472 inputs agree across the pinned specification checker, JavaScript, PHP
and Rust readers. This evidence update goes from 43 disagreements to zero on
unchanged inputs and an unchanged HTML projection. The 2026-09-30 development
refresh retains zero disagreements across the recorded specification and engine commits.
Four cases were fixed by the
[earlier marker-column changes](https://github.com/markup-carve/carve/pull/2619);
the current reader changes address the other 39. There is no separately recorded
39-case baseline in this report.

| Family | Inputs | Disagreements |
|---|---:|---:|
| Footnote/list fences, columns 2 through 8 | 42 | 0 |
| Empty and visible blocks in lists and quoted lists | 30 | 0 |
| Boundary, indentation and follower combinations | 400 | 0 |

[Reader pins](../scripts/ownership/pins.json) identify the source revisions.
[Raw observations](ownership-results.json) preserve every source, complete HTML
output and reader partition. The same 472-case HTML fixture is tested in the
[checker](https://github.com/markup-carve/carve/blob/9db91206d1a4a8a8cf795c48210bca49d66f14d6/tests/fixtures/container-ownership.json),
[JavaScript](https://github.com/markup-carve/carve-js/blob/6d02fa7062dd03024e7c092016459602e9a7aeec/test/fixtures/container-ownership.json),
[PHP](https://github.com/markup-carve/carve-php/blob/7033d04b1d942263508eadf9b699a77ee656bfda/tests/fixtures/container-ownership.json)
and [Rust](https://github.com/markup-carve/carve-rs/blob/9f3f334c7d5c91c57e4e6269b32599af1062fdde/tests/fixtures/container-ownership.json).
There are no active disagreement witnesses in
[the reductions](ownership-reductions.json).

## What changed

Comments now preserve the content columns of surviving nested items. An opener
that reaches an item's column is classified in that item's context; a retained
line below the column remains text. [Rust #2197](https://github.com/markup-carve/carve-rs/pull/2197) also resumes nested collection using
the enclosing body's column, preserving indentation for the child parser.

A quote opened on a list marker line with an open paragraph keeps its lazy
continuation until the quote ends. Its over-indented continuation cannot
independently establish an authored block base (CARVE-P0-021). A comment ends that quote paragraph, allowing a later opener to
start a block in the surviving item. The [checker](https://github.com/markup-carve/carve/pull/2624),
[JavaScript](https://github.com/markup-carve/carve-js/pull/2382) and
[PHP](https://github.com/markup-carve/carve-php/pull/2752) changes account for the
marker-line quote when measuring block extents.

The checker bounds a comment's authored extent at the comment itself. PHP also
keeps below-column code delimiters in the nested paragraph that admitted them,
so the inline-code payload stays inside the list.

Review found regressions outside the matrix. Follow-up changes to the
[checker](https://github.com/markup-carve/carve/pull/2626),
[JavaScript](https://github.com/markup-carve/carve-js/pull/2386) and
[PHP](https://github.com/markup-carve/carve-php/pull/2753) preserve opaque quote
heads and matched comment spans, with 15 added boundary cases. All four
pins are merged commits. Inline-code
newlines are unchanged; this update adds no Rocq theorem. The executable
specification remains a derived checker, not the language authority.

## Changes where the readers already agreed

Output changes on 49 cases: the 43 disagreements and six previously agreeing
cases. The latter are behavior corrections, not agreement gains:

- `list-quote/ordinary/4/{heading,quote,fence}` now keeps the follower as lazy
  text in the quote paragraph instead of opening a block after the quote.
- `{list,quote-list,list-quote}/content-comment/1/sibling` now keeps `- tail`
  as text instead of opening a child list below the content column.

The history view includes all 49 changes. The
[HTML expectations](../tests/fixtures/ownership-resolved.json) copy the 49 changed
cases from the readers' shared regression fixture. They pin the reviewed output
separately from the agreement check; they are not an independently derived oracle.

## Limits

Agreement on this matrix does not establish complete reader equivalence. The
cases use ASCII spaces and at most two container levels. Tabs, deeper stacks,
matched comment fences and continuation attachments need separate coverage.
[Opaque quote ownership](https://github.com/markup-carve/carve/issues/2627) is
also unresolved outside the matrix. The new opaque-head fixtures preserve
existing output while that language question remains open.

The projection parses HTML with parse5, sorts attributes and normalizes ordinary
text whitespace. It preserves element nesting, paragraph wrappers, attributes
and whitespace inside code and preformatted elements. Empty block slots can
leave no observable DOM structure, so their HTML cannot establish their owner.
The fence cases use visible raw HTML payloads to make placement observable.

## Reproduce

Use Node 24+, PHP 8.2+ with mbstring and a compatible Rust toolchain.

```sh
npm ci
npm run build:ownership
npm run check:ownership -- --check reports/ownership-results.json
npm run reduce:ownership -- --check reports/ownership-reductions.json
node --test tests/ownership.test.mjs
```

The build fetches the pinned source into ignored `.cache/ownership/`, installs
locked JavaScript dependencies and builds the Rust CLI. It records runtime
versions and artifact hashes. The runner rejects dirty checkouts, wrong
revisions and modified artifacts. Use `--output <path>` to record reviewed pin
changes; `--check` fails on changed evidence without writing it.
