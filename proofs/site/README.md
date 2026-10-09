# Evidence site

The [public report](https://markup-carve.github.io/carve-proofs/) presents committed observations as an ownership explorer, language comparison, chart collection, proof map and change history.

Build and preview with Node 24 and Python 3:

```sh
npm ci
python3 -m venv .venv
. .venv/bin/activate
pip install -r site/requirements.txt
npm run build:site
python3 -m http.server 4173 --directory _site
```

For browser checks, run `npx playwright install chromium` and `npm run test:site` after building. Generated files live in `_site/` and are not committed. Matplotlib exports each chart as SVG and PNG, with CSV values and JSON metadata. The site has no external runtime dependencies.

## Evidence boundaries

The build reads the committed report files without rerunning benchmarks. Each view exposes its reader pins and source data. Benchmark datasets remain separate because their API scope, instrumentation and host load differ. Fresh-worker rounds appear as separate series in the JavaScript and cost charts. CSV exports retain their round labels, and JSON exports include workflow provenance. The direct-HTML probe records the fast path attempt, including rejected attempts that stop before AST fallback. Bands show the observed sample range; they are not confidence intervals. Refused and skipped measurements retain their status and have no plotted value.

Language comparisons describe edits within each reader. A changed tree can follow the language rules. CommonMark is the Markdown dialect used here. The ownership suite instead compares four Carve readers under its recorded projection.

The proof inventory links theorem declarations to their source. It does not claim a proof of the complete parser or a runtime complexity bound. Deployment waits for the existing proof and ownership jobs and the site checks. The Djot view preserves the recorded extraction mismatch and upstream consistency failure.

## History

`history/ownership-before-fence-fix.json` preserves the earlier 55-disagreement baseline from commit `3496c574f1b40b27dc102aef0327a9eb1dcc6abd`. The current history view compares `history/ownership-before-container-fixes.json`, copied verbatim from `reports/ownership-results.json` at commit `3483541aa364f697920057fd36ea4e7777bb6532`, with the new pins. This records 43 to 0 disagreements and includes output changes on six previously agreeing cases. The generator requires identical suite hashes, case IDs and sources. Preserve these artifacts when adding another transition.

## Publishing

The proof workflow builds the site on pull requests and main. Successful main runs deploy the artifact through GitHub Pages. Pages must use GitHub Actions as its build source. Rendered fixture output is isolated in sandboxed frames with network access and scripts blocked; source and tree text use DOM text nodes.
