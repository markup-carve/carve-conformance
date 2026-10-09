# Classification of the 295 current HTML differences

Checked on 2026-10-02 against djot.v `f38c92d585b914d673e35d0fca23cf5cad0a6b56` and djot.js `d93aff39561a4306c8d59cebd9e07cc6712e1be3`. The original 4,177-input corpus is unchanged. All 295 exact HTML disagreements reproduce; none remain unclassified within this corpus.

| Family | Inputs | Status | Responsibility |
| --- | ---: | --- | --- |
| Unresolved image alt text | 223 | Renderer policy; specification does not state the fallback | djot.js and Djot specification; no demonstrated djot.v defect |
| Escaped closing bracket in a reference label | 41 | Confirmed, already acknowledged parser gap | djot.v |
| Failed block attribute inside a quote | 24 | Recovery behavior is a documented specification gap | Djot specification and djot.js recovery implementation |
| Smart punctuation in a heading identifier | 7 | Explicitly intentional representation difference | No upstream fix requested |

These counts partition inputs, not bugs. Each family includes wrappers and unrelated definitions. The [machine record](djot-difference-triage.json) assigns every original ID, hashes the original source, records a targeted agreement control, and retains a reduced source with both outputs. Reducing all 295 inputs produces nine distinct sources; their remaining literal characters differ, so they are not nine root causes.

## Confirmed djot.v gap: escaped reference closing bracket

A readable case is `[x][a\]b]`. djot.js keeps the escaped `]` inside the reference label and renders `<p><a>x</a></p>`. djot.v closes the label there and renders `<p><a>x</a>b]</p>`. The trailing `b]` becomes visible content. The reduced case is:

```djot
[x][\]]
```

Here djot.v leaves a literal `]` after the link. Without the backslash, both parsers render the trailing text; with two backslashes before the first `]`, both do so too. The [focused cases](../tests/differential/triage-cases.json) retain those controls.

The [Djot syntax reference](https://github.com/jgm/djot/blob/d77f8a0cbea6785c42b3e2b03463195b5ca6f7c7/doc/syntax.md#ordinary-text) permits backslash escapes for ASCII punctuation. More decisively, djot.v's [existing ledger](https://github.com/hon-gyu/djot.v/blob/f38c92d585b914d673e35d0fca23cf5cad0a6b56/.project/djotjs-divergences.md) already identifies `[a][b\]c] d` as a gap: `INote` has an escape flag, while `IReference` does not. This investigation confirms the same gap at the current HEAD. It is not a newly discovered defect.

For every affected corpus input, removing the escaped bracket pair from the reference label makes the outputs agree. This is a diagnostic intervention, not the desired parser repair. A repair needs escape parity in reference-label scanning and regression checks for links, images, wrappers and incomplete labels. Escaped-label reference definitions have separate recognition rules and need their own specification decision.

## Unresolved image alt text

For `![x][r]`, djot.js renders `<img>` and djot.v renders `<img alt="x">`. All 223 differences in this family disappear when only the native renderer's alt attribute on images without a source is removed. The source and exact outputs remain in the original comparison record; that diagnostic comparison does not count them as exact matches.

A stronger control adds definitions for the image labels in each original document. All 223 modified documents then agree. A readable reduced example is `![x][]`. The reducer preserves nonempty native alt text, so it does not reduce this family to a difference between an empty attribute and a missing one.

Keeping authored alt text appears useful, but the [image and link rules](https://github.com/jgm/djot/blob/d77f8a0cbea6785c42b3e2b03463195b5ca6f7c7/doc/syntax.md#image) do not specify unresolved-image HTML fallback. This is a renderer question for djot.js and the specification, not a proven djot.v conformance failure.

## Failed block attribute recovery inside a quote

The reduced shape is:

```djot
> {
> a
```

Both parsers keep a quote and paragraph. djot.v's paragraph contains `{` followed by `a`; djot.js includes the second quote marker as literal text, producing `&gt; a`. In the original nested-list variants it also replays the indentation following that marker. Closing the attribute specification in each of the 24 original documents makes both outputs agree.

The [upstream recovery entry](https://github.com/hon-gyu/djot.v/blob/f38c92d585b914d673e35d0fca23cf5cad0a6b56/.project/djotjs-divergences.md) describes absolute-source replay in djot.js and calls the behavior a specification gap. The available rules do not settle failed-attribute recovery. This remains a reduced recovery question, not a request to make djot.v reproduce djot.js's leaked prefix.

## Intentional heading identifier difference

The seven inputs reduce to `# "`. The displayed heading agrees: both render a curly opening quote. djot.js derives the identifier from the source quote; djot.v derives it from the rendered curly quote. Escaping the source quote makes all seven original documents agree.

The [smart-punctuation ledger entry](https://github.com/hon-gyu/djot.v/blob/f38c92d585b914d673e35d0fca23cf5cad0a6b56/.project/djotjs-divergences.md) explicitly chooses this behavior. It can affect anchor names, so it is not merely attribute ordering. It is kept separate from parser defects and no compatibility fix is requested here.

## Performance fixtures outside the 295-input comparison

The [fixture generators](../scripts/differential/performance-fixtures.mjs) and [raw observations](djot-triage-performance.json) cover one-line nested lists, nested quotes as a contrasting fixture, unique reference definitions, and those definitions with one use each. Parsing, rendering and the combined path are measured separately. Output agreement is recorded before measurements where both renderers succeed. Every such comparison agreed in this run.

The following are median process CPU milliseconds per call for djot.v on this host:

| Fixture and phase | Smaller size | Time | Doubled size | Time |
| --- | ---: | ---: | ---: | ---: |
| Unique reference definitions, parse | 1,024 | 11.884 | 2,048 | 47.842 |
| Definitions with one use each, render | 1,024 | 13.088 | 2,048 | 50.833 |
| One-line nested lists, parse | 512 | 0.821 | 1,024 | 3.158 |

The timings are observations, not asymptotic proofs or cross-engine speed rankings. The one-minute load average was 3.97 at the start and 17.95 at the end, on 16 logical CPUs. The table uses process CPU time; wall time was more affected by contention. An idle-host rerun is needed before comparing small timing differences. JavaScript process CPU time also includes V8 helper threads, so it must not be read as single-thread CPU cost. The reference fixtures also expose a source-level cause: [`Refs.add_ref`](https://github.com/hon-gyu/djot.v/blob/f38c92d585b914d673e35d0fca23cf5cad0a6b56/theories/Document.v#L987) inserts through [`alist_set`](https://github.com/hon-gyu/djot.v/blob/f38c92d585b914d673e35d0fca23cf5cad0a6b56/theories/Ast.v#L44), which scans the existing list for each new unique label. The insertion work includes `n(n-1)/2` existing-entry comparisons. Rendering one use of each label performs association-list lookups through [`lookup_reference`](https://github.com/hon-gyu/djot.v/blob/f38c92d585b914d673e35d0fca23cf5cad0a6b56/theories/Ast.v#L1346). The packaged extraction retains these list operations. This confirms a concrete optimization target already acknowledged in the README. An indexed implementation must preserve label normalization, duplicate-definition replacement and observable ordering.

Separately, djot.js on Node 24.19.0 parses 1,024 nested list items but its default HTML renderer throws `RangeError: Maximum call stack size exceeded`. A fresh process renders the 512-level control successfully. The failing source is `'- '.repeat(1024) + 'x\n'`, only 2,050 bytes. djot.v renders it. The observed stack limit depends on the runtime and call path; 1,024 is a reproducible failing fixture here, not a universal minimum. This additional finding is outside the 295 corpus differences.

## Reproduction and remaining work

Run `npm run build:djot-v` and `npm run build:djot-differential`, then:

```sh
npm run triage:djot-differences -- --check reports/djot-difference-triage.json
npm run bench:djot-triage -- /tmp/djot-triage-performance.json
```

The triage command replays all 4,177 inputs, verifies the original 295 disagreements, checks ten focused examples, checks 295 agreement controls and reduces every disagreement. Every final one-character deletion is tested against the same diagnostic family. This is local minimality under that predicate, not globally shortest-source minimality or a proof that no unrelated interaction remains.

For us, the reporting and reduction gap is closed for this corpus. Broader fuzzing, source positions, AST-only differences and Carve reader conformance are outside this investigation. The caption AST issue and extraction reproducibility question do not account for these HTML differences. Our production-parser correspondence and whole-parser complexity obligations also remain open.
