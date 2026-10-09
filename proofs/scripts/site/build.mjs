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
const data = { revision, reports, theorems, layoutExamples, comparisonHistory, history: { sourceCommit: '3483541aa364f697920057fd36ea4e7777bb6532', previousPins: previous.pins, before: previous.rows.filter(r => r.groups.length > 1).length, after: current.rows.filter(r => r.groups.length > 1).length, total: current.rows.length, changes } };
await mkdir(new URL('_site/data/', root), { recursive: true });
for (const file of ['index.html', 'app.js', 'style.css']) await cp(new URL(`site/${file}`, root), new URL(`_site/${file}`, root));
await cp(new URL('reports/', root), new URL('_site/reports/', root), { recursive: true });
await writeFile(new URL('_site/data/evidence.json', root), JSON.stringify(data));
await writeFile(new URL('_site/.nojekyll', root), '');
console.log(`Built evidence at ${revision}: ${current.rows.length} ownership cases, ${theorems.length} model theorems`);
