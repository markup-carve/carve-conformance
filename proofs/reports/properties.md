# Carve property and scaling report

Recorded 2026-09-28 against specification
`d20ebd942f91470485332cec925fa0717f20a58a` and JS engine
`c5df77f658c80a3a80a4d31ec1855d854e5da648`.

The suite records 486 observations of the JS engine and
executable specification. 36 observations contradict
the broad wrapping or earlier-block stability claims; each follows an explicit
Carve rule and is recorded as a specification exception. No unexplained
functional difference remains in this sample. Timing measurements identify
nested-container growth as a follow-up target. These engine checks add no Rocq
theorems; the existing 26 ownership theorems have a narrower scope.

The test questions come from [Djot discussion #414](https://github.com/jgm/djot/discussions/414).
They are evaluated against Carve rules; differences from a proposed Djot
guarantee are not automatically Carve defects.

## Functional results

Comparisons remove source positions, byte lengths and raw reference spelling.
They merge adjacent text and treat soft line breaks as spaces. Code-span bytes,
hard breaks, node types, attributes and block structure remain significant.
The specification projection also compares rendered inline fragments, preserving
code newlines and reference identity while removing raw reference spelling.
It is a projection for these fixtures, not a general HTML equivalence checker.

Each fraction counts equal before/after observations. Controls deliberately
expect some differences and are reported separately.

| Property | JS | Executable specification | Result |
|---|---:|---:|---|
| Wrapping at each selected space | 67/81 | 67/81 | Broad guarantee does not hold |
| Container payload consistency | 52/52 | 52/52 | All sampled wrappers preserve payload and definitions |
| Reference syntax locality | 24/24 | Not exposed as an inline AST | Syntax classifications stay stable |
| Earlier-block stability after appended source | 68/72 | 68/72 | Captions and list extension change earlier blocks |

Wrapping covers 21 paragraph forms, replacing each individual ASCII space with
a newline: prose, Unicode, emphasis, links, reference links, code, markers,
attributes, comments and definition-shaped text. The fourteen changes per
reader comprise seven breaks in code-span content, four comment changes,
heading and quote interruptions, and a newly recognized footnote definition.
Unclosed backticks are code spans in Carve, so their whitespace is content.
The marker and attribute samples preserve their interpretation. This does not
establish safety for arbitrary combinations or for multiple simultaneous wraps.
See [code spans](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/resources/spec/06-inline-links-images.ebnf),
[paragraph interruption](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/resources/spec/14-semantics-blocks.ebnf), and
[comments](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/resources/spec/16-semantics-comments-security.ebnf).

Container comparisons use 13 fragments inside a quote, list item,
quote containing a list, and list containing a quote. They compare unwrapped
payload trees and definition state, including code, paragraphs, headings,
lists, comments, tables, divs and reference definitions. Hoisted reference
definitions are compared separately from visible blocks. The cases use spaces,
not tab prefixes, and sample two wrapper levels rather than arbitrary nesting.

Locality uses 8 reference-like forms with matching, changed and unrelated
definitions. Resolved reference destinations and titles are excluded from the syntax
projection, while node types, labels, authored attributes and child structure remain. 48 rendering controls across
both readers inspect the first paragraph and assert the reference element and
target directly. The changed-definition cases compare an existing definition
with its replacement. They verify the complementary behavior: matching definitions change
full/collapsed links, images and footnotes, while unrelated definitions and
literal/code controls do not. Changing footnote body text leaves its reference
element unchanged; the reference comparison excludes the endnote body. Bare `[ref]` stays literal because Carve has no
shortcut reference links. The specification checker has no exposed inline AST
for a separate locality check; its rendering controls are not counted as such.

The append checks combine 9 prefixes and 8 suffixes. The four changes
per reader are a sibling list item extending a list and changing tightness,
and captions attaching to a code block, quote or table. One blank line does not
finalize these objects. Explicit intervening headings provide closed-list and
closed-quote controls. Four further controls show that adding matching code or
comment fence closers can reclassify earlier source. See
[caption placement](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/resources/spec/13-semantics-foundations.ebnf),
[list tightness](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/resources/spec/15-semantics-resolution-rendering.ebnf), and
[fence lookahead](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/resources/spec/14-semantics-blocks.ebnf).

## Scaling results

The main run covers 7 input families with parse-only and full HTML entry
points for each reader. The specification's parse-only API handles block layout;
the JS parse API also builds inline nodes, so their parse timings measure
different work. JS HTML also has an optimized fast path, which can make it
faster than its public parse API on simple paragraphs.

For flat inputs, the following table compares the first and last median full
HTML times. Input sizes grow by roughly eightfold. The host was heavily loaded, so these ratios are exploratory measurements
and cannot establish a scaling bound.

| Input family | Input bytes | JS HTML time growth | Spec HTML time growth |
|---|---:|---:|---:|
| long-line | 5124 → 40964 | 4.08× | 5.81× |
| unmatched-closers | 1028 → 8196 | 5.74× | 6.85× |
| unclosed-code | 5125 → 40965 | 4.65× | 5.86× |
| many-paragraphs | 1536 → 12288 | 4.56× | 6.67× |

Some nested-container samples grow faster than their input size. From depth 64 to 128, input
grows from 132 to 260 bytes. A separate run repeats those measurements. Depth 192 adds another point below
the readers' nesting limit. The fitted exponent uses all six depths from 8 to
192 in a log(time)-against-log(bytes) least-squares fit:

| Reader and entry point | Input | Median ms, depth 64 → 128 | First run growth | Repeat growth | Median ms at 192 | Fitted exponent, first/repeat |
|---|---|---:|---:|---:|---:|---:|
| js parse | nested-quotes | 0.75 → 2.46 | 3.29× | 3.01× | 5.02 | 1.17 / 1.31 |
| js parse | nested-lists | 1.37 → 3.14 | 2.29× | 2.53× | 6.09 | 1.11 / 1.17 |
| js html | nested-quotes | 0.97 → 3.16 | 3.25× | 3.22× | 6.37 | 1.01 / 1.10 |
| js html | nested-lists | 1.93 → 6.55 | 3.40× | 2.60× | 12.38 | 1.07 / 1.12 |
| spec parse | nested-quotes | 0.97 → 3.59 | 3.68× | 5.76× | 11.81 | 1.80 / 1.71 |
| spec parse | nested-lists | 1.07 → 4.56 | 4.27× | 4.27× | 15.97 | 1.73 / 1.70 |
| spec html | nested-quotes | 2.16 → 4.56 | 2.11× | 2.92× | 9.10 | 0.53 / 0.81 |
| spec html | nested-lists | 2.35 → 7.39 | 3.14× | 3.09× | 12.89 | 0.82 / 1.00 |

The repeated local growth warrants profiling, especially for the specification's
nested layout parser. Scheduling noise and small-depth overhead
can flatten the fitted exponent. These results do not establish one growth
rate for every nested input or prove an asymptotic complexity class.
Existing layout counters remain linear on these same inputs: JS counts 132
then 260 seam characters, and the specification's selected visits/views also
grow linearly. Those counters omit other work. The regression tests bound only
the instrumented operations; they do not establish a whole-parser time bound.

The specification HTML path accepts unmatched opening-bracket runs through the
sample at 128, then explicitly refuses the sample at 256 with
`inline nesting exceeds MAX_NESTING_DEPTH`. Its inline checker sets the limit
to 200. The 1024 sample is skipped in that group after refusal. JS accepts the
sampled runs through 1024 as literal content. This is a checker capacity limit,
not a crash or a timing success. All other benchmark groups completed.

Measurements used v24.19.0 on linux
x64, AMD Ryzen 9 PRO 7940HS w/ Radeon 780M Graphics. Worker processes run serially;
startup and source generation are excluded. Each size gets two warmups and
five batches of 1–32 calls, with GC before batches. Every group has a 60-second
wall-clock deadline including startup. Timing is machine-dependent and the
host is not isolated. Load averages at completion were 13.72, 22.47, 25.34
(1, 5 and 15 minutes) on 16 logical CPUs; scheduling interference can distort ratios.
An earlier run timed out on the specification's unmatched-closer HTML case
under a 30-second deadline; the recorded run uses 60 seconds.
No timing ratio is a CI pass/fail threshold. RSS values
are cumulative process peaks. Raw samples, counters, pins and a runner digest
are stored with the measurements.

## Reproduce and maintain

`npm test` runs the behavioral regressions, comparison checks and selected
layout-work budgets. Success means observations match their reviewed
expectations, including the listed exceptions. A changed or newly introduced
exception fails rather than silently entering the baseline.

```sh
npm run check:properties -- --output reports/property-results.json
npm run bench:scaling -- reports/scaling-results.json
npm run bench:scaling -- reports/scaling-confirmation.json nested-quotes,nested-lists
npm run report:properties
npm run proof:layout
```

The regular workflow compares fresh rows with the committed observations,
regenerates this Markdown report to detect drift, and uploads fresh observations.
Proof checks run before optional timing measurements.
A manual workflow run can enable the timing benchmark. Unexpected
errors, timeouts or refusal changes make that command fail. The existing bracket
limit is recorded explicitly. Full timings are excluded from ordinary CI gates.

Raw data: [property observations](property-results.json),
[reviewed exceptions](property-findings.json), [main measurements](scaling-results.json),
and [nesting confirmation](scaling-confirmation.json).

The next investigation is to profile work not represented by the nesting
counters. For formatter and extension design, the useful contracts are wrapping
outside code/comment content and interrupting line starts, and stable blocks
after their attachment opportunities have ended. Container and locality checks
should grow with each new syntax feature. PHP and Rust remain outside this run.
