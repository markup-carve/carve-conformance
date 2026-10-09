# Selection across supplied candidates

`StackSelection.v` composes the existing single-frame decision over a list of candidate contexts. Fifteen theorems check that composition, and `npm run proof:stack` compiles and runs an extracted OCaml helper.

Each candidate supplies its frame ID and state, previous boundary, local boundary/follower columns, prefix rule and measured prefix tokens, plus interruption and sibling classifications. The caller supplies the candidate order and stored claim. The public selector first looks for an open candidate with a matching explicit prefix. If no prefix matches, it resolves the claim against open candidates that reject neither interruption nor sibling classification. If no claim is eligible, it scans candidates with no claim. The per-candidate classifications are the only interruption/sibling inputs. This is an experimental prefix-first policy: even an outer matching prefix overrides an inner live claim or successful fallback. Two controls pin that inversion. It is not established as Carve policy. When no prefix matches, a live ancestor claim wins over inner fallback; sibling and interruption flags reject claims on the classified candidate.

## Checked properties

- A claim accepted by a singleton frame names that frame.
- A selected candidate is open and returns its own ID.
- A stack selection identifies an open member of the supplied stack.
- The first accepted candidate wins over the remaining candidates.
- A closed candidate is skipped.
- Appending candidates preserves a successful selection in the original prefix; a failed prefix delegates to the suffix.
- Once no explicit prefix matches, a globally eligible live claim wins before the unclaimed scan.
- Once no explicit prefix matches, a rejected global claim delegates to the unclaimed scan.
- A failed scan visits every supplied candidate.
- A successful scan has a first accepted witness, preceded only by rejected candidates; its visit count equals that prefix length plus one.
- A live-owner lookup identifies an open member of the supplied stack.
- A matching explicit prefix wins over claims and fallback.
- Explicit-prefix selection identifies an open member.
- The public staged selection identifies an open member.
- The scan counter is bounded by the supplied stack length.

The runner checks thirteen concrete scenarios, including explicit prefix success, sibling rejection, closed-frame rejection and distinct local follower columns. The other controls cover post-blank fallback to an ancestor, below-column comment retention, rejection of inner retention for an interrupting heading, rejection of a stale claim, and selection of an ancestor through its claim when an inner column fallback would also succeed. Additional controls reject stale, sibling and interrupting claims, and give explicit prefixes priority over ancestor claims. Every example checks the public result and the separate unclaimed scan result and count. It also checks empty-stack controls and exact visit counts. The examples use already classified and measured inputs, not source documents.

The fifteen theorem assumption reports must be closed under the global context. Admissions, extra assumptions and disabled kernel checks fail before compilation. The runner validates both this module and its imported `Ownership.v` model, then generates the example and assumption-check module in a temporary directory.

## Executable boundary

Rocq extracts `select_candidates` and `selection_visits` to OCaml. The runner compiles that generated code and a small driver, then checks the post-blank ancestor result and two candidate visits, an ancestor claim overriding inner fallback, and rejection of a sibling claim. This executes the same model definitions used by the theorems. Extraction, OCaml compilation and the driver's construction of inputs remain trust boundaries; there is no theorem about the handwritten driver. Extraction maps natural numbers to machine integers. The executed example uses small IDs and columns; the unbounded-natural proofs don't establish behavior for arbitrary machine-integer inputs.

The [recorded evidence](../../reports/stack-selection-proofs.json) includes source hashes, theorem names, compiler transcripts, commands and the extracted result. CI recompiles the proofs and runs the helper. The original 26 ownership theorems keep their original scope and source/reader pins.

## What remains outside the model

Candidate order is a policy input. These theorems don't establish that an innermost-first or any other order implements Carve's full ownership rule. The caller must already have selected surviving frames and decoded local prefixes. The public wrapper orders explicit-prefix selection, global claim selection and unclaimed fallback. This order is checked only over the supplied contexts, not derived from source bytes. Recognition of boundaries, sibling markers, opaque spans and `+` attachment remains outside this composition, as does production-parser conformance.

The append theorem concerns a list of fixed candidate decisions with an unchanged claim. It is not a theorem about appending source text or reparsing edits. The visit bound counts the unclaimed scan, tied to its result by the first-witness and failure theorems. It excludes the earlier explicit-prefix scan and global live-claim lookup. Each scan evaluation can consume a prefix. It is not a linear-time bound in source bytes or even a bound on total prefix work.

The next refinement needs a specification-backed producer for these candidate contexts and a correspondence proof to source parsing. The current-reader matrix can provide regression examples, but agreement on those examples cannot supply that proof.
