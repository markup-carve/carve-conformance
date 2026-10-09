# djot.v: executable checks and theorem scope

Tested [djot.v f38c92d](https://github.com/hon-gyu/djot.v/tree/f38c92d585b914d673e35d0fca23cf5cad0a6b56), using the packaged OCaml code with its default Djot profile and positions disabled. OCaml 4.14.2; Dune 3.23.1.

## Behavior

These are 140 observations through each of two views of the same parser, not 280 independent inputs. The shared projection folds soft breaks into spaces, removes reference definitions and flattens sections. It retains heading attributes and code bytes. Unsupported nodes fail the adapter.

| Check | Raw block parser | Document API |
|---|---:|---:|
| Wrapping unchanged | 32/35 | 32/35 |
| Container payload unchanged | 40/40 | 36/40 |
| Reference syntax unchanged | 12/12 | 12/12 |
| HTML changes after definition | n/a | 4/12 |
| Finished prefix unchanged after append | 35/36 | 35/36 |

The HTML resolution checks and five dialect probes always use the document API; their duplicate records across views are not independent raw-parser checks. All observations completed without adapter errors. The three wrapping differences involve code-span bytes. Reference resolution deliberately changes four HTML outputs while syntax classification stays local.

All four document-level container differences involve headings: for `# Heading\n\ntail\n`, the automatic ID belongs to a top-level section; inside a quote or list it belongs to the heading. The shared projection drops the section wrapper but keeps the heading ID. Raw parsing passes all 40 cases. This is a stage and projection distinction, not a counterexample to raw container uniformity. See the exact trees in [the observations](djot-v-results.json).

All 36 streaming checks pass both composition and preservation of committed blocks under the adapter projection. They split prefix and suffix into lines, call `run_lines` on the prefix, then resume with its state. For the list/list fixture, finishing the prefix produces one list but `run_lines` has committed zero blocks. The finished list can grow and change tightness when another item arrives. This explains the one append difference without contradicting committed-block stability.

## Formal checks and extraction boundary

The upstream Rocq project builds with Rocq 9.2 and stdlib 9.1. Each of these eleven theorems prints `Closed under the global context`:

- `hard_wrap_one_para`
- `hard_wrap_para_then_rest`
- `quote_uniformity`
- `list_uniformity`
- `prefix_determinism`
- `no_future_line_dependence`
- `classify_inlines_locality`
- `iscan_str_no_reread`
- `lazy_stack_line`
- `list_spacing_separates`
- `block_shape_independent`

The [compiler transcript](djot-v-proofs.json) records the full signatures. Hard wrapping requires the configuration and line conditions in the theorem; it preserves a paragraph's structure, not arbitrary inline bytes. Quote uniformity has a header condition. List uniformity requires valid markers and items in the canonical layout. Prefix stability concerns emitted blocks, not an EOF-finished tree. Inline locality concerns classification before reference resolution. Lazy continuation requires a lazy stack, a text-classified line and no underline. List spacing is proved in one direction, under the item-safety and nonblank-first-line conditions: a loose list has a separating blank. Block-shape independence requires keyed blocks to be disabled; its projection erases inline content and table captions.

Fresh extraction differs from the packaged kernel under this toolchain. The [complete extraction diff](djot-v-extraction.diff) records the discrepancy; the upstream `ocaml-pkg-check-current` command also failed (its status and output are in the proof evidence). The diff includes generated BinNat and FMapAVL modules. Fresh files have trailing whitespace removed, matching the upstream consistency command. This run does not establish why they differ or semantic inequivalence. The behavioral and timing results use the pinned packaged kernel. The theorem checks cover Rocq definitions; extraction overrides, the public API and runtime complexity are outside these checks.

## Native measurements

Packaged OCaml default profile, positions off. Serial processes per size; startup and input transfer excluded. 200ms warmup, five batches of at least 20ms with 16-call time checks. Full major GC before each batch. Allocation is Gc.allocated_bytes per call. 60s worker deadline.

Host: AMD Ryzen 9 PRO 7940HS w/ Radeon 780M Graphics, linux/x64. The parse phase calls `Doc.of_string` and includes document processing. Render calls `Html.of_doc` on an already parsed document; html combines both. Five batches per point; medians below use process CPU time. Host load and all wall/CPU/allocation samples are in [the raw measurements](djot-v-timings.json). All seven families completed parse, render and combined-HTML measurements. These runs do not support a cross-runtime speed ranking against earlier JavaScript runs.

| Family | Phase | Size range | CPU ms, first → last | Allocation bytes, first → last |
|---|---|---:|---:|---:|
| long-line | parse | 1024 → 8192 | 0.0707 → 0.5220 | 95713 → 740835 |
| long-line | render | 1024 → 8192 | 0.0199 → 0.1581 | 16272 → 123793 |
| long-line | html | 1024 → 8192 | 0.0898 → 0.8003 | 111985 → 864629 |
| unmatched-brackets | parse | 16 → 1024 | 0.0026 → 0.1511 | 12584 → 1090137 |
| unmatched-brackets | render | 16 → 1024 | 0.0002 → 0.0035 | 960 → 3984 |
| unmatched-brackets | html | 16 → 1024 | 0.0023 → 0.1072 | 13544 → 1094121 |
| unmatched-closers | parse | 1024 → 8192 | 0.0622 → 0.5571 | 158312 → 1240683 |
| unmatched-closers | render | 1024 → 8192 | 0.0027 → 0.0269 | 3984 → 25488 |
| unmatched-closers | html | 1024 → 8192 | 0.0751 → 0.6262 | 162297 → 1266171 |
| unclosed-code | parse | 1024 → 8192 | 0.5054 → 4.7586 | 931035 → 7418082 |
| unclosed-code | render | 1024 → 8192 | 0.0176 → 0.1306 | 16544 → 124065 |
| unclosed-code | html | 1024 → 8192 | 0.4809 → 5.1202 | 947579 → 7542146 |
| many-paragraphs | parse | 128 → 1024 | 0.0867 → 0.8775 | 467593 → 3736205 |
| many-paragraphs | render | 128 → 1024 | 0.0254 → 0.2503 | 114984 → 919594 |
| many-paragraphs | html | 128 → 1024 | 0.1019 → 1.0855 | 582577 → 4655797 |
| nested-quotes | parse | 8 → 192 | 0.0014 → 0.0288 | 12064 → 278496 |
| nested-quotes | render | 8 → 192 | 0.0014 → 0.0268 | 5544 → 112080 |
| nested-quotes | html | 8 → 192 | 0.0026 → 0.0631 | 17608 → 390576 |
| nested-lists | parse | 8 → 192 | 0.0027 → 0.1226 | 22032 → 729697 |
| nested-lists | render | 8 → 192 | 0.0021 → 0.0523 | 7760 → 166368 |
| nested-lists | html | 8 → 192 | 0.0051 → 0.1828 | 29792 → 896065 |

Sizes mean repeated words, delimiters, paragraphs or nesting depth as defined in [the fixtures](../scripts/properties/scaling-cases.mjs). All 12 nested fixtures were checked to produce their requested AST depth, up to 192.

For nested-quotes, depth 64 → 128 gives 2.06× parse CPU and 2.16× allocation.

For nested-lists, depth 64 → 128 gives 2.51× parse CPU and 2.34× allocation.

These finite ranges do not establish an asymptotic bound. They provide regression fixtures and support measuring depth separately from document length.

## Reproduce

Run from the repository root after `npm ci`, with the OCaml/Dune and Rocq versions above available through opam:

```sh
npm run build:djot-v
npm run check:djot-v -- --check reports/djot-v-results.json --output reports/djot-v-results.json
npm run bench:djot-v
npm run proof:djot-v
npm run report:djot-v
```

The proof command records its evidence and exits nonzero on extraction mismatch. CI rebuilds the packaged runtime and checks deterministic observations. Timing and the full upstream proof/extraction check are recorded local runs, not CI gates.
