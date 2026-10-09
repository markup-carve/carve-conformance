# Current ownership and conditional contracts

Checked on 2026-10-02 against [the pinned main-branch readers](../scripts/ownership/current-pins.json). All 535 inputs agree across the specification checker, JavaScript, PHP and Rust. The original 472 inputs retain every recorded output.

The 63 additional inputs come from the pinned normative corpus:

| Family | Cases | What it covers |
|---|---:|---|
| Opaque marker-line quotes | 36 | Code/raw fence heads, open and closed fences, band markers and controls |
| Continuation columns | 19 | `+` attachment in different containers and column positions |
| Opaque spans | 6 | Container boundaries around opaque payload |
| Tabs after markers | 2 | Heading and quote marker separation |

Each copied fixture records its original filename, source and expected HTML. The runner checks those bytes against the pinned corpus before executing all readers. It checks structural agreement and compares every added output with the normative expected HTML. The [observations](ownership-current-results.json) preserve complete rendered output.

The opaque-quote ruling is settled by CARVE-P0-022 and [Carve #2627](https://github.com/markup-carve/carve/issues/2627). The older [ownership report](ownership.md) describes the earlier pins and is retained as historical evidence. Its unresolved-issue passage no longer describes current main.

## Versioned contracts

The [contract observations](ownership-current-contracts.json) cover 17 edits through each of the four readers. They record eligible wrapping, deliberately excluded wraps, closed-prefix stability, attachment exceptions and reference-render shape. These are executable examples, not universal theorems.

For the tested 0.1 sources:

- Prose, Unicode, emphasis, link-label and list-marker wraps preserve the projected content.
- Heading/quote interruption, code-span bytes and line comments are excluded. The corresponding examples must change interpretation; the checker fails if they silently become positive cases.
- An explicit heading boundary closes the preceding list or code block. Prefix comparison flattens generated heading sections, retaining the heading ID, before selecting the original projected blocks. It also requires the appended block to survive. It does not require the document-level section wrapper to stop growing.
- A list can grow when another item is appended. Code and quote captions can attach after a blank. A blank alone therefore doesn't establish that an EOF-finished block is committed.
- Replacing link/image definitions preserves the tested rendered structure when destination and title attributes are excluded. Separate assertions require the destination to change from `/one` to `/two`; full projected trees are retained. The unrelated-definition control compares all attributes. This measures rendered shape, not inline AST classification.

The projection preserves code bytes, element nesting and attributes, apart from the stated reference attributes. Ordinary HTML text whitespace is normalized. Invisible AST ownership cannot be inferred from HTML.

Carve's [0.2 no-interruption decision](https://github.com/markup-carve/carve/issues/315) is implemented on `next`. These 0.1 interruption expectations must remain versioned. A 0.2 proof needs its own contract for paragraph closure and the enclosing-container exceptions, plus migration checks for inserted blank lines. Nothing here claims that current main and `next` have the same semantics.

## Reproduce

```sh
npm run build:ownership:current
npm run check:ownership:current
npm run check:ownership:contracts
```

The current profile uses a separate cache and immutable pins. The historical ownership and performance records keep their original pins. Source or normative-output drift fails rather than silently rewriting expectations.

Remaining coverage includes tab expansion inside nested prefixes, arbitrary-depth ownership, invisible AST slots and generated combinations of matched comments with continuation attachments. The abstract Rocq ownership model still has caller-supplied classification and surviving-frame inputs; this matrix doesn't connect a production parser to the model.
