# Source roundtrip through HTML

`npm run compat:roundtrip` measures what comes back when a document goes
through HTML, or another writer, and is read back into its own language. It
compares Carve with and without its roundtrip export (PART 10 §13) against
remark, turndown and pandoc on the same content. The method was decided in
[carve-conformance#11](https://github.com/markup-carve/carve-conformance/issues/11).

## Chains

Each chain takes source in one language and returns source in the same
language.

| Chain | Language | Through HTML |
|---|---|---|
| `carve-html`, `carve-html-carriers` | Carve | yes, plain and with roundtrip carriers |
| `carve-markdown`, `carve-markdown-carriers` | Carve | no, through Markdown |
| `carve-fmt` | Carve | no, canonical writer |
| `remark-html` | Markdown | yes, remark-rehype then rehype-remark |
| `remark-md` | Markdown | no |
| `turndown-html` | Markdown | yes, commonmark.js then turndown with default options |
| `pandoc-gfm-html`, `pandoc-gfm` | Markdown | yes and no |
| `pandoc-djot-html`, `pandoc-djot` | Djot | yes and no |

The chains without HTML separate what a tool's own writer normalizes from what
HTML loses.

## Two layers

**Meaning** compares the compat semantic projection of the original and of the
returned source, read by the same reader for that language. The inputs are the
paired `external-compat/cases.json` documents that language's reader covers,
plus the variant cases below. Spelling fields stay out of this projection.

**Spelling** reads, for each case in `cases.json`, the sequence of spellings of
that case's one distinction from the original and from the returned source.
The case counts as kept when the two sequences are equal. Markdown spelling is
read from source slices at mdast positions. Djot spelling comes from djot.js
fields and slices. Carve spelling comes from the PART 12 AST fields that record
it (`bulletChar`, `delim`, `marker`, `ref` and `rawRef`, `autolink`,
`separatorWidths`, `label`), except the fence character, which comes from the
source slice at the block's position.

## Distinctions

A distinction is measured only for a language that can spell it two ways, and
is reported as n/a elsewhere. Carve has no setext heading, and Markdown has no
fence label, so neither counts against the other. Carve accepts backtick and
tilde fences but its tree does not record which one was written, and the
canonical writer has a single spelling (CARVE-P11-013). Its fence character is
read from the source slice and measured anyway, so the report shows that
normalization rather than hiding it.

`validateVariantCases()` reads every authored case back through its own
inventory, so a case cannot claim a spelling its source does not hold.

## Reading the result

The report is per distinction and per chain, `kept/measured`, with no blended
percentage. The variant set has one case per spelling, so `1/3` for bullets
means one of three bullet characters came back as written, usually the
default. These are small authored samples, not a statistical corpus.
