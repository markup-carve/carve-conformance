// Assembles the published site: the landing page at the root, the proofs
// evidence explorer under proofs/ and the compatibility report under compat/.
// Run each lane's own site build first (see the root package.json).
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const root = new URL('../', import.meta.url)
const path = p => new URL(p, root).pathname
const json = p => JSON.parse(readFileSync(path(p), 'utf8'))

for (const dir of ['proofs/_site', 'compat/dist']) {
  if (!existsSync(path(dir))) throw new Error(`${dir} is missing: build that lane's site first`)
}

rmSync(path('_site'), { recursive: true, force: true })
mkdirSync(path('_site/data'), { recursive: true })
cpSync(path('site'), path('_site'), { recursive: true })
cpSync(path('proofs/_site'), path('_site/proofs'), { recursive: true })
cpSync(path('compat/dist'), path('_site/compat'), { recursive: true })
writeFileSync(path('_site/.nojekyll'), '')

// The shared bar goes on top of each lane's own page.
const lanes = ['proofs', 'compat']
const bar = current => `<div class="cc-bar" role="navigation" aria-label="Carve conformance">` +
  `<a class="cc-home" href="../">carve <span>conformance</span></a>` +
  `<a href="../proofs/"${current === 'proofs' ? ' aria-current="page"' : ''}>Proofs</a>` +
  `<a href="../compat/"${current === 'compat' ? ' aria-current="page"' : ''}>Compatibility</a>` +
  `<a class="cc-repo" href="https://github.com/markup-carve/carve-conformance">GitHub</a></div>`
for (const lane of lanes) {
  const file = path(`_site/${lane}/index.html`)
  let html = readFileSync(file, 'utf8')
  if (!/<body[^>]*>/.test(html)) throw new Error(`${lane}/index.html has no <body>`)
  html = html.replace('</head>', '<link rel="stylesheet" href="../shared/bar.css"></head>')
  html = html.replace(/<body[^>]*>/, m => `${m}${bar(lane)}`)
  writeFileSync(file, html)
}

const evidence = json('proofs/_site/data/evidence.json')
const ownership = evidence.reports['ownership-results']
const report = json('compat/dist/report.json')
const commonmark = existsSync(path('compat/dist/commonmark.json')) ? json('compat/dist/commonmark.json') : null
const djot = existsSync(path('compat/dist/djot.json')) ? json('compat/dist/djot.json') : null
const theoremCount = file => (readFileSync(path(`proofs/proofs/layout/${file}`), 'utf8').match(/^(?:Theorem|Lemma)\s/gm) ?? []).length

// Contrast pairs for the landing page: one column of indentation moves a line
// to a different owner. Each note is checked against the spec output, so a
// changed result fails the build instead of leaving a wrong caption.
const curated = [
  ['list/blank/1/text', '<p>tail</p>', 'One column of indentation is not enough: after the blank line, tail leaves the list.'],
  ['list/blank/2/text', '<p>tail</p>\n  </li>', 'Two columns reach the item content, so tail stays inside the list item.'],
  ['list-list/blank/2/text', '</ul>\n    <p>tail</p>', 'In a nested list, two columns only reach the outer item.'],
  ['list-list/blank/4/text', '<p>tail</p>\n      </li>', 'Four columns reach the inner item, so tail moves one level deeper.'],
  ['quote-list/blank/2/text', '<p>tail</p>\n    </li>', 'Inside a quote, columns are counted after the quote marker.'],
  ['list/comment/end', '<li>a</li>', 'An indented comment belongs to the item and renders nothing.'],
]
const rowsById = new Map(ownership.rows.map(r => [r.id, r]))
const specimens = curated.map(([id, expect, note]) => {
  const r = rowsById.get(id)
  if (!r) throw new Error(`Specimen ${id} is not in the ownership suite`)
  if (!r.outputs.spec.includes(expect)) throw new Error(`Specimen ${id} no longer renders ${JSON.stringify(expect)}: update its note`)
  return { id, note, source: r.source, html: r.outputs.spec.trim(), readers: r.groups.find(g => g.includes('spec')) }
})

const suiteTotals = suite => suite && Object.fromEntries(Object.entries(suite.totals).map(([engine, t]) => [engine, { match: t.match, mismatch: t.mismatch, declared: t.declared, failed: t.failed, silentLoss: t.honesty?.['silent-loss'] ?? null }]))
const short = sha => sha?.slice(0, 7) ?? null

const summary = {
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: path(''), encoding: 'utf8' }).trim(),
  proofs: {
    ownershipCases: ownership.rows.length,
    disagreements: ownership.rows.filter(r => r.groups.length > 1).length,
    disagreementsBefore: evidence.history.before,
    theorems: { ownership: theoremCount('Ownership.v'), stack: theoremCount('StackSelection.v') },
    traces: evidence.layoutExamples.trace,
  },
  compat: {
    generatedAt: report.generatedAt,
    targets: report.selected,
    engines: report.selectedEngines,
    passed: report.passed,
    failed: report.failed,
    supported: report.rows.filter(r => r.kind === 'supported').length,
    loss: report.rows.filter(r => r.kind === 'loss').length,
    commonmark: commonmark && { examples: commonmark.spec.examples, totals: suiteTotals(commonmark) },
    djot: djot && { examples: djot.suite.examples, totals: suiteTotals(djot) },
  },
  pins: [
    { reader: 'Spec', proofs: short(ownership.pins.spec?.commit), compat: null },
    { reader: 'JavaScript', proofs: short(ownership.pins.js?.commit), compat: short(report.engines.javascript?.revision) },
    { reader: 'PHP', proofs: short(ownership.pins.php?.commit), compat: short(report.engines.php?.revision) },
    { reader: 'Rust', proofs: short(ownership.pins.rs?.commit), compat: short(report.engines.rust?.revision) },
  ],
  specimens,
}
writeFileSync(path('_site/data/summary.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(`Assembled _site at ${summary.revision.slice(0, 7)}: ${specimens.length} specimens, ${summary.proofs.ownershipCases} ownership cases, ${summary.compat.passed + summary.compat.failed} compatibility comparisons`)
