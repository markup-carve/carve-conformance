# Parser verification work remaining

The repository has checked layout models and executable comparisons. It does not have a verified production parser. Candidate-stack selection extends the abstract model; source classification and construction of surviving frames remain caller responsibilities.

## Establish a source-to-model boundary

Specify the input contract for producing candidate contexts from source bytes. It must cover tab measurement, prefix decoding, frame identifiers, base/content geometry, surviving-stack construction, opaque spans, sibling recognition, continuation claims and `+` attachment. The producer must also establish that the supplied candidate order and local prefix inputs match source parsing, including whether an outer explicit prefix may override an inner claim or fallback. The current prototype chooses that priority; a source-backed refinement must justify or replace it.

Completion requires a correspondence theorem between that producer and the model's inputs, with normative fixtures for its conditions. Tests that compare current readers remain evidence for examples, not the correspondence proof.

## Separate the 0.1 and 0.2 contracts

Current-reader observations describe the pinned 0.1 grammar. The [0.2 no-interruption change](https://github.com/markup-carve/carve/issues/315) is implemented on `next`; it needs separate proof and migration obligations.

Define paragraph closure at blank lines, EOF and enclosing structural boundaries. State how nested-list markers, caption attachment and container ownership qualify the rule. Prove wrapping only under those conditions and the inline-content exclusions. Migration checks must preserve the old AST boundaries when inserting blank lines, then establish idempotence for the migrated source.

## Connect an executable component

The candidate helper is extracted and executed, but no production reader uses it. Choose a small source-parsing component whose specification and API are settled, then either extract it or prove a correspondence with an existing implementation. The result must identify extraction mappings, source positions and resource limits that remain trusted.

Begin with one component and one implementation. A cross-reader agreement result cannot substitute for an implementation proof.

## Prove language properties

Reference locality should concern inline classification before document resolution. It needs a theorem about the source parser, not a renderer projection that removes destination attributes.

Committed-block stability needs a parser state and a precise commitment boundary. EOF-finished lists, open fences and caption attachment windows are excluded until the parser commits them. Equal-state suffix laws on an abstract reducer don't establish incremental source parsing.

Container uniformity needs valid authored indentation and explicit treatment of opaque bodies and continuation attachments. Inline precedence and formatter roundtrip should begin with named supported subsets, then expand by node type and attribute category.

## Account for total work

The candidate scan has a visit bound and first-witness/failure characterizations. It excludes global claim lookup and the work inside prefix consumption. Existing engine counters and scaling guards also cover selected operations rather than total parser time.

A whole-parser complexity argument needs to account for prefix inspection, nested frame setup, source mapping, delimiter operations, reference indexing and allocation. Rendering measurements must account for final output size. Keep phase measurements and deterministic operation budgets separate from asymptotic claims.

## Expand executable coverage

Add nested tab-prefix measurement, deeper ownership stacks, invisible AST slots and generated combinations of matched comments with continuation attachments. Preserve the current normative inputs and their expected output independently of reader agreement. Any new disagreement needs reduction and a rule-based decision before it becomes an expected result.

The general roundtrip theorem, whole-parser complexity theorem and production refinement remain open work. A larger theorem count does not close these obligations.
