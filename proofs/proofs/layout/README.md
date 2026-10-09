# Layout ownership model

The model covers boundary transitions from `CARVE-P0-003`, the list ownership
rules in §24 C3 (`CARVE-P9-051/053`), stored continuation claims and prefix
consumption. The [specification](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/resources/spec/01-layout.ebnf) is
pinned by the repository submodule. The [list-specific clauses](https://github.com/markup-carve/carve/blob/d20ebd942f91470485332cec925fa0717f20a58a/resources/spec/16-semantics-comments-security.ebnf)
define the comment-column qualifications. The approach follows
[djot.v](https://github.com/hon-gyu/djot.v): state a parser property, check its
proof, and compare its predictions with existing implementations.

## Ownership decisions

Two traces originally disagreed with the general Part 0 column table. Both
agree with the explicit list rules in §24 C3. The specification now states
that those rules qualify the general table. The clarification also settles the
previously open comment-column distinction while preserving reader behavior:

- After a blank, a follower below the list item's content column is outside
  the item, including the band above its base column. Corpus 143 pins this.
- A line comment below the content column retains the item for a subsequent
  noninterrupting follower. It creates no stored ordinary-line claim. A blank
  after the comment clears retention; an interrupting heading goes outside.
- The comment's column matters. A comment at or above the content column
  does not retain a subsequent flush-left follower.

For example, the first source keeps `tail` in the item; the second puts it
outside:

```carve
- intro
%% c
tail
```

```carve
- intro
  %% c
tail
```

An unmatched `%%%` is a line comment. A matched comment fence at the enclosing
context's opener column ends the item under C3 and corpus 214. The boundary
transition table describes a comment already owned inside a surviving frame;
it does not establish which frame owns the comment span.

These decisions preserve the existing reader results. No engine code changed.
The seventeen traces include the original six plus ordinary continuation,
interruption, comment-column, sibling-marker and comment-fence controls. All currently agree
with both readers; a future disagreement must be declared explicitly.

## What the proofs establish

`Ownership.v` contains 26 checked theorems. The original eleven cover boundary
state, column selection and composition of boundary sequences. Their column
lemmas describe the general column-only helper, not the complete owner decision.

The additional fifteen cover exact indentation consumption, reconstruction
of successfully consumed indentation, stopping at the first prefix failure,
a bound on matched prefixes, ordinary-line claim creation, claim clearing,
rejection of interrupting or stale claims, selection of live claim owners,
post-blank list containment, below-column line-comment retention, rejection
of closed frames, selection after a matched prefix, closure by an outside boundary, and
selection of an item retained after a comment.

`match_prefixes` consumes rules outermost first. `select_frame` combines prefix
matching, a stored claim and the boundary-sensitive fallback for one candidate
frame. A missing quote marker cannot be supplied by indentation alone.
Ownership selection is separate from paragraph continuation: a live claim is
checked against the container state, not its paragraph flag.

## Scope and inputs

Prefix inputs are measured tokens: `Space` is one indentation column,
`Greater` is `>`, and `Text` stands for remaining non-prefix text. Tabs must
already be expanded in the leading whitespace run. The model checks quote
marker separation and exact indentation consumption; it does not prove Unicode
measurement, tab expansion or tokenization from source bytes.

The caller supplies the prefix rule, current column, preceding boundary and
its column, interruption classification and surviving frame. Frame identifiers must be
unique, frames must have `base_column < content_column`, and the supplied
prefix rule must describe that frame in the current local coordinates.
The source traces
use a column-zero `- ` item with content column two. The harness checks
marker geometry and authored boundary/follower columns. Boundary ownership,
sibling-marker recognition and interruption classification remain authored
inputs. `owned_step` closes the candidate when a classified
boundary belongs outside it; an internal boundary uses the transition table.
The matched-fence and repeated-comment controls exercise this closure input.

The prefix walker supports nested rules, but it is not yet connected to a
complete nested owner-selection algorithm. `select_frame` considers one
surviving candidate. Fence recognition, span ownership, lazy-claim production
from parsed source, `+` block attachment and construction of the surviving
stack remain outside this model. End-of-input absorption and equal-state
suffix laws concern the boundary reducer, not arbitrary source edits.

There is no theorem connecting an implementation to this model, proving
container parsing uniformity, safe wrapping or parser complexity. Comparisons
with the executable specification and JavaScript engine are tests. PHP and
Rust are not compared here yet.

## Run the checks

Use Node 24 or newer and the installed npm dependencies. CI pins OCaml 4.14.2,
Rocq core 9.2.0 and standard library 9.1.0. In an existing opam switch:

```sh
opam install rocq-core.9.2.0 rocq-stdlib.9.1.0
opam exec -- npm run proof:layout
```

With the compiler on `PATH`, run `npm run proof:layout`. The runner compiles
26 theorems, 28 normative boundary-table examples, 17 source-trace examples
and 11 prefix/claim examples in a temporary directory. It generates a named
assumption report for every theorem and requires each report to be closed
under the global context. Missing compilers, failed proofs, local assumptions,
admissions and disabled kernel checks fail the run.

`npm test` runs the evidence and harness tests. `npm run proof:layout:evidence`
runs reader comparisons and explicitly reports that proofs were not checked.
The `Proofs` workflow runs on every push to `main`, pull request to `main`,
and manual dispatch.
