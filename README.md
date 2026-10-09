# Carve conformance

Evidence that the [Carve](https://github.com/markup-carve/carve) readers agree:
with the specification, with each other, and with the document formats around
them. The Carve repository remains the authority for language rules.

Website: <https://markup-carve.github.io/carve-conformance/>

| Lane | Question | Contents |
|---|---|---|
| [`proofs/`](proofs/README.md) | Does the spec hold together, and do the readers follow it? | Rocq models of layout ownership and candidate-stack selection, the four-reader ownership matrix, Djot difference triage, scaling measurements |
| [`compat/`](compat/README.md) | What survives when a document crosses into another format and back? | AST adapters for nine foreign targets measured through the JavaScript, PHP and Rust engines, plus CommonMark and djot.js import measurements |

Each lane keeps its own `package.json`, lockfile, tests and site build. The root
assembles both sites under one landing page.

## Building the website

```sh
git clone --recurse-submodules https://github.com/markup-carve/carve-conformance.git
cd carve-conformance
npm ci && npm --prefix proofs ci && npm --prefix compat ci
pip install -r proofs/site/requirements.txt
```

The compatibility site needs measured reports in `compat/reports/`. Produce them
with the steps in [the compatibility methodology](compat/tests/external-compat/README.md),
or download the `compatibility-evidence` artifact from a recent run of the
Website workflow. Then:

```sh
npm run build:site    # builds both lanes, then assembles _site/
npm run test:site     # browser checks for the landing page and the shared bar
npm run preview       # serves _site/ on http://127.0.0.1:4173
```

## Workflows

- `site.yml` is the only workflow a pull request starts. It runs `proofs.yml`
  or `compat.yml` when that lane changed, and both lanes plus the assembled
  site when the root site changed.
- On every push to `main` and once a day, `site.yml` runs both lanes, assembles
  the site and deploys it to GitHub Pages. A failed proof check blocks the
  deploy. A failed compatibility comparison does not, because the published
  report is where that failure is read.
- `cross-reader-evidence.yml` takes controlled timing measurements for `proofs/`
  on demand.

## History

This repository combines `markup-carve/carve-proofs` and
`markup-carve/carve-compat`, which are archived with their full commit history.
Reports recorded before the merge link to commits in those repositories.

## License

MIT

## Exploring the evidence

Current ownership is the default profile: 535 cases and 68 versioned contract
observations. The original 472-case profile remains available for historical
comparisons. The proof inventory includes both ownership and candidate-stack
selection, with statements, source links and recorded compiler evidence.

Explorer URLs preserve filters, selected cases and chart settings. Import
examples include matches, declared differences and non-comparable inputs as
well as mismatches. Diagnostic assessment filters expose false loss reports
and losses that still need explanation. Each example provides source, diagnostic
and structural-difference evidence. Adapter assertion failures and import
mismatches are separate results; expected-loss assertions can pass.

Reference import totals use the JavaScript renderer. Native totals parse and
render each importer's output through its own engine. Foreign AST adapters
remain shared JavaScript infrastructure. The generated source suite compares
identical Carve inputs across engines, including Unicode, CRLF, tabs, comments,
empty slots and nesting to depth 16. It records semantic AST differences,
position availability and source byte lengths. These are finite observations
without a normative oracle. Semantic or byte-length differences remain visible;
execution failures, invalid schemas and invalid position bounds fail the command.

Run the generated suite after provisioning the compatibility engines:

```sh
npm --prefix compat run compat:provision
npm --prefix compat run compat:source-agreement
```

Site summaries load first. Detailed cases, import suites and chart points load
when opened. Complete JSON downloads remain available. Browser checks cover
Chromium on desktop and mobile, Firefox and WebKit.
