# Layout ownership in Carve 0.2

`Ownership02.v` models which block takes a line below a list item under the
Carve 0.2 block rules
([spec/0.2/syntax-blocks.md](https://github.com/markup-carve/carve/blob/9a0ee0004fc0589d2d524785c7bd3fee485e30ed/spec/0.2/syntax-blocks.md)
at carve `next2` 9a0ee00). It replaces nothing yet: the 0.1 model in
`Ownership.v` keeps checking the 0.1 lane until the 0.2 rewrite tracked in
markup-carve/carve-conformance#22.

## What changed from 0.1

spec/0.2 has no boundary table (0.1's CARVE-P0-003). Three rules decide the
traces instead:

- An open paragraph takes every line that is not an interrupter, at any
  column (C2-B-012). A heading, a quote, a definition and a `%%` comment are
  not interrupters (C2-B-024).
- A comment-only line is not seen by block structure (C2-B-137). Its comment
  goes to the open leaf (C2-B-138), so it neither ends the item paragraph nor
  counts as a blank line.
- With no paragraph open, a line belongs to the item whose marker it is
  indented past, measured from the marker column (C2-B-025). The content
  column plays no part.

An unclosed `%%%` opens a comment block that runs to the end of its container
(C2-B-014, C2-B-111). The 0.1 model read it as a line comment.

## The model

Lines are classified, not parsed: text (including headings, quotes and
definitions), blank, comment-only line, a table row or thematic break, a bare
comment fence, and a list marker at the list's column. `owner` says whether the
last line lands in the item, outside it, or in an open comment body. The marker
column is a parameter; the traces use column 0.

Ten theorems compile without assumptions:

| Theorem | Clause |
|---|---|
| `comment_line_unseen`, `comment_lines_unseen`, `comment_lines_keep_owner` | C2-B-137 |
| `lazy_line_any_column` | C2-B-012, C2-B-024 |
| `unparagraphed_line_by_marker_column` | C2-B-025 |
| `interrupter_by_marker_column` | C2-B-025, C2-B-228 |
| `blank_closes_paragraph` | C2-B-013 |
| `closed_item_stays_closed` | C2-B-026 |
| `unclosed_comment_fence_takes_the_rest` | C2-B-111 |
| `comment_fence_closes_unowning_item` | C2-B-014, C2-B-026 |

Code fences, divs, captions, description lists, nested lists, quotes as
containers and region markers are outside the model.

## Traces

`cases-0.2.mjs` reads the seventeen 0.1 traces of `cases.mjs` under 0.2, each
with the clauses it rests on. The runner classifies every source line itself,
generates one Rocq example per trace and compares the owner with carve-js
`next2` 42644b7 (the `carve-next2` dependency). All seventeen agree. Seven read
differently from 0.1:

| Trace | 0.1 | 0.2 | Clause |
|---|---|---|---|
| `post-blank-between-base-and-content` | outside | item | C2-B-025 |
| `interrupter-rejects-claim` | outside | item | C2-B-024 |
| `unmatched-comment-fence-is-line-comment` | item | comment body | C2-B-111 |
| `comment-does-not-retain-interrupter` | outside | item | C2-B-137, C2-B-024 |
| `content-comment-does-not-retain-base-follower` | outside | item | C2-B-137 |
| `consecutive-comments-end-at-content` | outside | item | C2-B-137 |
| `outside-comment-cannot-reopen-item` | outside | item | C2-B-137 |

The trace names describe the 0.1 reading and are kept so the two sets line up.

## Run the checks

```sh
opam exec -- npm run proof:layout:0.2
```

`npm test` runs the engine comparison without a proof compiler.
