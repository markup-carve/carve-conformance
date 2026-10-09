import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { validateProofSource, generateChecks } from '../layout-proof-check.mjs';
import { finding } from '../ownership/findings.mjs';

const root = new URL('../../', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const names = ['ownership-results', 'ownership-reductions', 'comparison-results', 'comparison-contracts', 'container-regressions', 'property-results', 'djot-v-results', 'djot-differential', 'djot-v-proofs', 'djot-extension-proofs', 'djot-differential-proofs', 'comparison-timings', 'djot-v-timings', 'nesting-profile', 'scaling-results', 'scaling-confirmation', 'runtime-timings'];
const reports = Object.fromEntries(await Promise.all(names.map(async name => [name, await read(`reports/${name}.json`)])));
const previous = await read('site/history/ownership-before-container-fixes.json');
const current = reports['ownership-results'];
if (previous.suiteSha256 !== current.suiteSha256) throw new Error('History requires the same suite');
const oldRows = new Map(previous.rows.map(row => [row.id, row]));
if (oldRows.size !== current.rows.length || current.rows.some(row => oldRows.get(row.id)?.source !== row.source)) throw new Error('History requires identical case IDs and sources');
const changes = current.rows.filter(row => JSON.stringify(row.outputs) !== JSON.stringify(oldRows.get(row.id)?.outputs)).map(row => ({ before: oldRows.get(row.id), after: row }));
for (const row of current.rows) row.finding = finding(row);
const proofSource = await readFile(new URL('proofs/layout/Ownership.v', root), 'utf8');
const theorems = validateProofSource(proofSource).map(name => ({ name, line: proofSource.split('\n').findIndex(line => new RegExp(`^(?:Theorem|Lemma|Corollary|Fact|Remark|Proposition|Example)\\s+${name}(?:\\s|:)`).test(line)) + 1 }));
const checks = generateChecks(proofSource);
const layoutExamples = Object.fromEntries(['table', 'trace', 'prefix'].map(kind => [kind, [...checks.matchAll(new RegExp(`^Example ${kind}_`, 'gm'))].length]));
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const previousComparison = await read('reports/history/pre-prefix-refresh/comparison-results.json');
const previousProfile = await read('reports/history/pre-prefix-refresh/nesting-profile.json');
const currentComparison = reports['comparison-results'];
const comparisonHistory = {
  sourceCommit: '940125c470e39b126a90a7cede7c24b7ce77e356',
  beforeEngine: previousComparison.metadata.engine,
  afterEngine: currentComparison.metadata.engine,
  unchanged: currentComparison.rows.filter(row => previousComparison.rows.some(old => JSON.stringify(old) === JSON.stringify(row))).length,
  total: currentComparison.rows.length,
  work: ['quotes', 'lists'].map(family => ({ family, counts: [previousProfile, reports['nesting-profile']].map(report => report.groups.find(g => g.reader === 'js' && g.phase === 'parse' && g.family === family && g.size === 192).patterns.reduce((sum, pattern) => sum + pattern.calls, 0)) })),
};
// Plain-language reading of the Carve / Djot / CommonMark edit relations for the
// overview. Each note restates reports/comparison.md for the counts given here;
// if a count moves, the build stops so the note is rewritten, not left stale.
const editRelations = [
  ['wrapping', 'Break a line at one space', { carve: [30, 35], djot: [32, 35], commonmark: [31, 35] },
    'Carve and Djot keep the new line break inside three code spans. Carve also starts a heading or quote twice where the new line begins. CommonMark starts a list, ordered list, heading or quote four times.'],
  ['containers', 'Move a fragment into a quote or list item', { carve: [40, 40], djot: [40, 40], commonmark: [40, 40] },
    'No reader changes the moved content.'],
  ['locality', 'Add or replace a link definition elsewhere', { carve: [12, 12], djot: [12, 12], commonmark: [10, 12] },
    'CommonMark turns plain text into a link when a matching definition appears. Carve and Djot keep the reference as written.'],
  ['stability', 'Append text after the document', { carve: [35, 36], djot: [35, 36], commonmark: [35, 36] },
    'All three change in the same case: a later item extends an open list and makes it loose.'],
]
const comparisonSummary = editRelations.map(([family, edit, expected, note]) => {
  const counts = Object.fromEntries(Object.entries(expected).map(([reader, [unchanged, total]]) => {
    const rows = currentComparison.rows.filter(row => row.family === family && row.reader === reader)
    const got = [rows.filter(row => row.outcome === 'equal').length, rows.length]
    if (got[0] !== unchanged || got[1] !== total) throw new Error(`${family}/${reader} is now ${got.join('/')}, not ${unchanged}/${total}: rewrite its overview note`)
    return [reader, { unchanged, total }]
  }))
  return { family, edit, counts, note }
})
const data = { revision, reports, theorems, comparisonSummary, layoutExamples, comparisonHistory, history: { sourceCommit: '3483541aa364f697920057fd36ea4e7777bb6532', previousPins: previous.pins, before: previous.rows.filter(r => r.groups.length > 1).length, after: current.rows.filter(r => r.groups.length > 1).length, total: current.rows.length, changes } };
await mkdir(new URL('_site/data/', root), { recursive: true });
for (const file of ['index.html', 'app.js', 'style.css']) await cp(new URL(`site/${file}`, root), new URL(`_site/${file}`, root));
await cp(new URL('reports/', root), new URL('_site/reports/', root), { recursive: true });
await writeFile(new URL('_site/data/evidence.json', root), JSON.stringify(data));
await writeFile(new URL('_site/.nojekyll', root), '');
console.log(`Built evidence at ${revision}: ${current.rows.length} ownership cases, ${theorems.length} model theorems`);
