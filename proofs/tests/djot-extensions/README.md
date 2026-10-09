# An executable syntax-extension tradeoff

Allowing a list marker to interrupt a paragraph makes this a nested list:

```djot
- outer
  - inner
```

It also means that wrapping `alpha - beta` after `alpha` changes one paragraph into a paragraph followed by a list:

```djot
alpha
- beta
```

Default Djot keeps the wrapped example in one paragraph and requires a blank line before the sublist. These fixtures demonstrate both sides of that choice with the packaged OCaml parser from [djot.v at f38c92d](https://github.com/hon-gyu/djot.v/tree/f38c92d585b914d673e35d0fca23cf5cad0a6b56).

## The configuration change

The experiment keeps `djot_profile.profile_inline` and all default block fields, replacing only the marker-interruption policy:

```ocaml
Step.with_marker_interrupts Step.prose_safe_markers Step.djot_bconfig
```

This is the upstream `sublist_bconfig` setting. It accepts empty marker cores (bullets) and the ordered marker core `1`. It does not enable the full `markdown_like` profile or change the Djot specification. The runner uses the exposed extracted kernel, since the public `Profile` API has no individual switch for marker interruption.

## Observed results

Eight paired cases, two configurations and two inputs per pair give 32 checked parser outputs. Each output matches a manually specified structural expectation in [cases.json](cases.json).

| Input edit | Default Djot | List interruption |
|---|---|---|
| Wrap before `-`, `+`, `*` or `1.` | One paragraph stays one paragraph | Paragraph becomes paragraph plus list |
| Wrap before `1865.` or ordinary text | One paragraph | One paragraph |
| Wrap inside fenced code | One code block | One code block |
| Remove blank line before indented sublist | Sublist becomes paragraph content | Sublist remains nested |

The projection checks block structure: paragraph and code-block leaves, recursive quote/list children, and ordered-list start. It excludes inline text, code bytes, attributes, locations, list tightness, bullet marker characters and ordered delimiter/numbering styles. The fenced-code control therefore says nothing about preserving code content.

[Recorded native results](../../reports/djot-extension-results.json) include the source pin and fixture/runner digest. These finite cases expose a tradeoff; passing them does not establish a universal property.

## Connection to the proofs

Upstream [`wrap_neutral`](https://github.com/hon-gyu/djot.v/blob/f38c92d585b914d673e35d0fca23cf5cad0a6b56/theories/Invariants.v#L318) requires marker interruption to return false for every input, along with conditions on underlines and keyed blocks. [`hard_wrap_one_para`](https://github.com/hon-gyu/djot.v/blob/f38c92d585b914d673e35d0fca23cf5cad0a6b56/theories/Invariants.v#L346) uses that condition and its stated line preconditions to guarantee one paragraph.

[ExtensionWitness.v](../../scripts/djot-v/ExtensionWitness.v) checks eight claims in Rocq: the default setting satisfies `wrap_neutral`; the changed setting does not; incremental parsing holds for every block configuration, including the changed setting; and the concrete hyphen example has one block before wrapping, two after wrapping under the changed setting, and one after wrapping under the default setting. Two further checks establish that the changed configuration equals upstream `sublist_bconfig` and that the wrapped input meets the theorem's first-line and nonblank-line conditions. [The compiler record](../../reports/djot-extension-proofs.json) reports all eight closed under the global context.

Failure of a sufficient condition alone would not prove the wrapping property false. The concrete block-count examples supply the counterexample. The incremental theorem applies to every block configuration, so this change preserves that guarantee.

These witnesses concern the Rocq definitions. The native observations concern the packaged extraction. The earlier [extraction consistency discrepancy](../../reports/djot-v.md#formal-checks-and-extraction-boundary) remains recorded separately.

## Run or reuse

From the repository root, after `npm ci` and with OCaml 4.14.2 / Dune 3.23.1 available through opam:

```sh
npm run build:djot-v
npm run check:djot-extensions -- --check reports/djot-extension-results.json
```

For the eight formal witnesses, install Rocq 9.2 / stdlib 9.1 in that opam switch and run:

```sh
npm run proof:djot-extensions -- --check reports/djot-extension-proofs.json
```

The proof runner builds the required upstream theory, not its generated test corpus. Both commands run in CI. Add `--output <path>` to either command to save a new record; with `--check` present, writing occurs only after comparison succeeds.

To use another implementation, copy `cases.json`, select the matching configuration, and map its AST to the documented projection. Compare each input against its explicit expected tree. A parser without the extension can run just the `djot` expectations. The JSON requires neither JavaScript nor Rocq.

For a syntax proposal, add the desired new interpretation and the smallest wrapping counterexample, then link the affected theorem condition. That gives reviewers a runnable example of what the proposal gains and what it gives up.
