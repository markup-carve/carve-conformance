import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { validateContainerEvidence } from './container-evidence.mjs'

const median = values => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function renderContainerReport(report, jsonName = 'current-container-costs.json') {
  validateContainerEvidence(report)
  const rows = (reader, family, phase, variant, depth = 192) => report.observations.filter(row =>
    row.reader === reader && row.family === family && row.phase === phase && row.variant === variant && row.depth === depth)
  const samples = (reader, family, phase, variant, key = 'samplesMs', depth = 192) =>
    rows(reader, family, phase, variant, depth).flatMap(row => row[key])
  const rounds = (reader, family, phase, variant, depth = 192) =>
    [0, 1].map(round => median(rows(reader, family, phase, variant, depth)
      .filter(row => row.round === round).flatMap(row => row.samplesMs))).map(value => value.toFixed(3)).join(' / ')
  const oldBytes = median(samples('rs', 'quote', 'render', 'baseline', 'samplesAllocatedBytes'))
  const newBytes = median(samples('rs', 'quote', 'render', 'current', 'samplesAllocatedBytes'))
  const lines = [
    '# Current container costs', '',
    `At depth 192, current Rust requests ${newBytes.toLocaleString('en-US')} allocation bytes for a borrowed quote render, compared with ${oldBytes.toLocaleString('en-US')} in the historical proof pin: a ${((1 - newBytes / oldBytes) * 100).toFixed(2)}% reduction. The HTML is unchanged. This resolves the original allocation lead on this fixture.`, '',
    'The snapshots include the merged [Rust shared-buffer work](https://github.com/markup-carve/carve-rs/pull/2282) and [PHP quote-chain work](https://github.com/markup-carve/carve-php/pull/2847). The comparisons cover multiple changes and do not isolate those PRs.', '',
    'PHP deep-list rendering remains expensive. The scaling rows below measure total render time against output bytes. Code inspection identifies repeated subtree indentation as a candidate cause; this profile does not time indentation alone. A guarded cumulative-indentation experiment can test that cause without changing parsing or ownership.', '',
    '## Snapshots', '', '| Reader | Historical proof pin | Current snapshot |', '| --- | --- | --- |',
  ]
  for (const reader of ['rs', 'php']) lines.push(`| ${reader} | \`${report.sources[reader].baseline.commit}\` | \`${report.sources[reader].current.commit}\` |`)
  lines.push('', `The [raw observations](${jsonName}) contain source fingerprints, binary hashes, tool versions, fixture and preflight HTML hashes, host load and every sample. Historical pins and reports are unchanged.`, '',
    '## Allocation evidence', '',
    'Rust counts requested bytes and successful allocation/reallocation calls in five separate operations per observation. These are churn counts, not live or peak memory. Rendering uses the borrowed API, including its internal AST clone.', '',
    '| Family | Depth | HTML bytes | Baseline bytes | Current bytes | Baseline calls | Current calls |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |')
  for (const family of ['quote', 'list']) for (const depth of [48, 96, 192]) {
    const values = ['samplesAllocatedBytes', 'samplesAllocationCalls'].flatMap(key =>
      ['baseline', 'current'].map(variant => median(samples('rs', family, 'render', variant, key, depth))))
    lines.push(`| ${family} | ${depth} | ${rows('rs', family, 'render', 'current', depth)[0].htmlBytes} | ${values.join(' | ')} |`)
  }
  lines.push('', '## Phase observations at depth 192', '',
    'Each cell shows wall-time medians from round 0 / round 1. Changes within the round spread are inconclusive on this shared host; the table is not a timing gate or a cross-language ranking. PHP opcache and JIT are disabled. CPU samples and managed-heap peaks are recorded separately.', '',
    `The one-minute load was ${report.host.loadStart[0].toFixed(2)} at the start and ${report.host.loadEnd[0].toFixed(2)} at the end, on ${report.host.logicalCpus} logical CPUs.`, '',
    '| Reader | Family | Phase | Baseline wall ms, rounds 0 / 1 | Current wall ms, rounds 0 / 1 |',
    '| --- | --- | --- | ---: | ---: |')
  for (const reader of ['rs', 'php']) for (const family of ['quote', 'list']) for (const phase of ['parse', 'render', 'html']) {
    lines.push(`| ${reader} | ${family} | ${phase} | ${rounds(reader, family, phase, 'baseline')} | ${rounds(reader, family, phase, 'current')} |`)
  }
  lines.push('', '## PHP list-render scaling', '',
    '| Depth | HTML bytes | Baseline wall ms, rounds 0 / 1 | Current wall ms, rounds 0 / 1 |',
    '| ---: | ---: | ---: | ---: |')
  for (const depth of [48, 96, 192]) lines.push(`| ${depth} | ${rows('php', 'list', 'render', 'current', depth)[0].htmlBytes} | ${rounds('php', 'list', 'render', 'baseline', depth)} | ${rounds('php', 'list', 'render', 'current', depth)} |`)
  lines.push('', '## Reproduce', '',
    'Use clean checkouts at the current commits above. The runner creates detached historical clones from those repositories, builds each Rust library with its own lockfile and Cargo release profile, then compiles the same worker with `rustc --edition=2021 -O`. Worker flags and library profile are recorded separately.', '',
    'Builds use `CARGO_TARGET_DIR` or `/var/tmp/cargo-shared/carve-rs`. The optional `--target-baseline=DIR` and `--target-current=DIR` flags override that location. Each worker is linked immediately after its library build.', '',
    '```sh', 'node scripts/runtime/refresh-containers.mjs \\',
    '  --rust=/path/to/carve-rs --php=/path/to/carve-php \\',
    '  --report=reports/current-container-costs.json',
    'node --test tests/current-container-costs.test.mjs', '```', '',
    'The runner requires all 144 observations and two reversed fresh-process rounds. Each fixture/phase warms for 200 ms and records five batches of at least 20 ms. It validates requested parse depth and checks parse/render against combined HTML before and after timing.', '',
    'Preflight HTML fingerprints must remain equal within each language across variants and rounds. They are recorded alongside phase rows, not recomputed for every timed iteration. Rust and PHP have different trailing-newline conventions, so hashes are not compared across languages. The runner regenerates this report with the JSON.', '',
    'These checks cover six simple nested fixtures per reader, not complete corpus conformance, arbitrary nesting or invisible AST ownership. They establish no parser complexity bound. Corpus, callback, raw-payload and source-position checks belong with any proposed implementation change.', '')
  return lines.join('\n')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const json = new URL('../../reports/current-container-costs.json', import.meta.url)
  const markdown = new URL('../../reports/current-container-costs.md', import.meta.url)
  writeFileSync(markdown, renderContainerReport(JSON.parse(readFileSync(json))))
}
