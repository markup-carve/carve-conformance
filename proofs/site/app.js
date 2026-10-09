import { copyButton, structuralDiff, updateQuery, restoreSelect } from './evidence-tools.js';
const main = document.querySelector('main');
document.querySelector('.skip').addEventListener('click', event => { event.preventDefault(); main.tabIndex = -1; main.focus(); });
const repo = 'https://github.com/markup-carve/carve-conformance';
// Commits recorded before the merge live in the archived source repository.
const legacyRepo = 'https://github.com/markup-carve/carve-proofs';
const labels = { spec: 'Carve specification', js: 'Carve JavaScript', php: 'Carve PHP', rs: 'Carve Rust', carve: 'Carve', djot: 'Djot JavaScript', commonmark: 'CommonMark' };
const fmt = value => typeof value === 'string' ? value : JSON.stringify(value, null, 2);
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function link(text, href) { const node = el('a', text); node.href = href; return node; }
function actions(value) { const node = el('div', undefined, 'evidence-actions'); node.append(copyButton('Copy source', value), copyButton('Copy link', () => location.href)); return node; }
function pre(value) { return el('pre', fmt(value)); }
function heading(title, description) { main.append(el('div', 'Carve proofs / evidence explorer', 'eyebrow'), el('h1', title), el('p', description)); }
function details(title, value) { const node = el('details'); node.append(el('summary', title), pre(value)); return node; }
function table(headers, rows) {
  const wrap = el('div', undefined, 'table-wrap'), t = el('table'), head = el('tr'), body = el('tbody');
  for (const label of headers) { const th = el('th', label); th.scope = 'col'; head.append(th); }
  const thead = el('thead'); thead.append(head); t.append(thead);
  for (const row of rows) { const tr = el('tr'); for (const cell of row) { const td = el('td'); td.append(cell instanceof Node ? cell : document.createTextNode(String(cell))); tr.append(td); } body.append(tr); }
  t.append(body); wrap.append(t); return wrap;
}
function select(title, values, chosen) {
  const label = el('label', title), input = el('select');
  input.setAttribute('aria-label', title);
  for (const value of values) { const [key, text] = Array.isArray(value) ? value : [value, value]; const option = el('option', text); option.value = key; input.append(option); }
  if (chosen !== undefined) restoreSelect(input, chosen);
  label.append(input); return { label, input };
}
function button(text, action) { const node = el('button', text); node.type = 'button'; node.onclick = action; return node; }
function source(name, metadata) { main.append(link('Source JSON ↓', `reports/${name}.json`), details('Reader pins, suite and method', metadata)); }
function badge(text, difference = false) { return el('span', text, `badge${difference ? ' difference' : ''}`); }
function card(title, body, count) { const node = el('article', undefined, 'card'); if (count !== undefined) node.append(el('span', count, 'stat')); node.append(el('h2', title), el('p', body)); return node; }
function preview(html, title) {
  const frame = el('iframe'); frame.title = title; frame.setAttribute('sandbox', ''); frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.srcdoc = '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;"><style>body{font:14px system-ui;padding:10px;overflow-wrap:anywhere}pre{white-space:pre-wrap}a{pointer-events:none}</style>' + html;
  return frame;
}
let data, charts, routeVersion = 0;
const requests = new Map();
async function fetchJson(url) {
  if (!requests.has(url)) requests.set(url, fetch(url).then(response => { if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`); return response.json(); }).catch(error => { requests.delete(url); throw error; }));
  return requests.get(url);
}
async function loadReport(name) {
  if (!data.reports[name]) data.reports[name] = await fetchJson(`reports/${name}.json`);
  return data.reports[name];
}
function state() { return new URL(location.href).searchParams; }
function retain(input, key, handler) { restoreSelect(input, state().get(key)); input.onchange = () => { updateQuery({ [key]: input.value, ...(key === 'case' ? {} : {case: null}) }); handler(); }; }
function resultCount(text) { const node = el('p', text, 'result-count'); node.setAttribute('role', 'status'); return node; }

const unique = values => [...new Set(values)].sort();
function outputs(row, target) {
  target.append(el('h2', row.id), actions(row.source), pre(row.source), el('p', `Reader groups: ${row.groups.map(g => g.join(' + ')).join(' | ')}`));
  const grid = el('div', undefined, 'outputs');
  for (const [reader, html] of Object.entries(row.outputs)) { const item = el('article', undefined, 'card'); item.append(el('h3', labels[reader] || reader), preview(html, `${reader} rendered output`), details('HTML output', html)); grid.append(item); }
  target.append(grid);
}
function comparisonSummary() {
  const readers = ['carve', 'djot', 'commonmark'];
  const intro = el('p', 'Each edit is applied to the same document in each language, and the output before and after is compared. The counts show how often the edit left the rest of the document unchanged. With 12 to 40 edits per row this is a sample of specific situations, not a ranking of the languages.');
  const rows = data.comparisonSummary.map(r => [r.edit, ...readers.map(reader => `${r.counts[reader].unchanged}\u00a0of\u00a0${r.counts[reader].total}`), r.note]);
  const more = el('p'); more.append(link('Every observation, with source and trees', '#behavior'));
  return [el('h2', 'Carve next to Djot and CommonMark'), intro, table(['Edit', 'Carve', 'Djot', 'CommonMark', 'What changes'], rows), more];
}
function overview() {
  heading('What the evidence says', 'Explore recorded reader behavior and the models used to reason about it. Results describe the pinned versions and fixtures shown here.');
  const ownership = data.ownership, h = data.history, cards = el('div', undefined, 'cards');
  for (const [title, body, count, href] of [
    ['Ownership cases', 'Four Carve readers, current pinned suite.', ownership.cases, '#ownership'],
    ['Reader disagreements', ownership.disagreements === 0 ? 'All current ownership cases agree at these pins.' : 'Inspect differences at the current pins.', ownership.disagreements, '#ownership'],
    ['Layout theorems', 'Rocq statements about a partial ownership model.', data.theorems.length + data.stackTheorems.length, '#proofs'],
    ['After the ownership fixes', `${h.before} disagreements became ${h.after} on the same suite.`, `${h.before} → ${h.after}`, '#history']
  ]) { const c = card(title, body, count); c.append(link('Explore →', href)); cards.append(c); }
  main.append(cards, ...comparisonSummary(), el('h2','Dataset pins and measurement dates'), el('p','Build time and measurement time are separate. Undated committed observations retain their pins; a new deployment does not make historical measurements fresh.'), table(['Dataset','Observations','Measured at','Evidence'],Object.entries(data.reportIndex).map(([name,record])=>[name,record.rows ?? 'See report',record.measuredAt ?? 'Not recorded',link('Pins and full report',record.source)])), el('h2', 'Three kinds of evidence'), table(['Evidence', 'What it establishes', 'Limit'], [
    ['Checked model', 'A theorem follows from its definitions and hypotheses.', 'No refinement proof connects the complete Carve implementations to the model.'],
    ['Reader tests', 'The recorded output agrees or differs for these fixtures and pins.', 'Finite samples do not establish a universal language property.'],
    ['Measurements', 'Time, allocation and selected operation counts in recorded runs.', 'Historical runs with different APIs and host load do not establish a speed ranking or complexity bound.']
  ]), el('h2','Coverage and remaining boundaries'), table(['Area','Published evidence','Remaining boundary'],[
    ['Container ownership',link('Current and historical profiles','#ownership'),'Finite suites; arbitrary-depth ownership is not proved'],
    ['Edit contracts',link('Four-reader versioned contracts','?dataset=ownership-current-contracts#behavior'),'Contracts apply to tested 0.1 sources; 0.2 needs separate expectations'],
    ['AST fields and coordinates',link('Generated native comparisons','../compat/#source-agreement'),'Coordinate availability and bounded observations do not prove exact source attribution'],
    ['Cross-format imports',link('All measured outcomes','../compat/#commonmark'),'Authored heading IDs and unsupported mapper fields need separate coverage'],
    ['Includes, lint and formatting','Not measured by this site','Host policy, diagnostic parity and source-preservation suites remain outside these claims'],
    ['Formal models',link('Ownership and candidate stacks','#proofs'),'No refinement theorem connects the full readers to these models'],
  ]), el('h2', 'Next work suggested by the evidence'), el('p', 'Extend the ownership matrix to deeper stacks, tabs and comment spans, connect source parsing to the ownership model, and rerun isolated benchmarks after fixes. The case explorer provides reproducers; the proof map shows which steps still need a model.'), link(`Repository snapshot ${data.revision.slice(0, 12)}`, `${repo}/tree/${data.revision}/proofs`));
}
function ownership() {
  heading('Who owns this block?', 'Compare the specification, JavaScript, PHP and Rust readers. Agreement means equal projected outputs under this suite, not a universal correctness guarantee.');
  const profile = select('Evidence profile', [['current', 'Current pinned readers'], ['historical', 'Historical ownership fixes']], state().get('profile') ?? 'current');
  profile.input.onchange = () => { updateQuery({profile: profile.input.value, case: null, family: null, finding: null}); route(); };
  main.append(profile.label);
  const name = profile.input.value === 'historical' ? 'ownership-results' : 'ownership-current-results';
  const report = data.reports[name]; source(name, { pins: report.pins, projectionVersion: report.projectionVersion, suiteSha256: report.suiteSha256 });
  const status = select('Result', [['all', 'All cases'], ['different', 'Disagreements'], ['equal', 'Agreement']], state().get('result') ?? 'all');
  const family = select('Fixture family', ['all', ...unique(report.rows.map(r => r.family))]);
  const group = select('Finding family', ['all', ...unique(report.rows.map(r => r.finding).filter(Boolean))]);
  const search = el('label', 'Search case or source'), input = el('input'); input.type = 'search'; search.append(input);
  const controls = el('div', undefined, 'controls'); controls.append(status.label, family.label, group.label, search);
  const results = el('div'), detail = el('section'); detail.id = 'case-detail';
  main.append(controls, results, detail);
  const show = row => { updateQuery({case: row.id}); detail.replaceChildren(); outputs(row, detail); const reduction = data.reports['ownership-reductions']?.rows.find(r => r.caseId === row.id); if (reduction) { const d = el('details'); d.append(el('summary', 'Reduced witness for this family'), el('p', 'Fixed-point single-character deletion under the recorded constraints. This does not claim a globally smallest input.')); outputs(reduction, d); detail.append(d); } };
  const render = () => {
    const rows = report.rows.filter(r => (status.input.value === 'all' || (r.groups.length > 1) === (status.input.value === 'different')) && (family.input.value === 'all' || r.family === family.input.value) && (group.input.value === 'all' || r.finding === group.input.value) && `${r.id}\n${r.source}`.toLowerCase().includes(input.value.toLowerCase()));
    const choice = select('Case', rows.map(r => r.id)); restoreSelect(choice.input, state().get('case'));
    choice.input.onchange = () => show(rows.find(r => r.id === choice.input.value));
    const inventory = el('details'); inventory.append(el('summary', 'Matching case inventory'), table(['Case', 'Finding', 'Reader groups'], rows.map(r => [button(r.id, () => { choice.input.value = r.id; show(r); detail.scrollIntoView({ block: 'start' }); }), r.finding || 'Agreement', r.groups.map(g => g.join(' + ')).join(' | ')])));
    results.replaceChildren(resultCount(`${rows.length} of ${report.rows.length} cases`), choice.label, inventory);
    detail.replaceChildren(); if (rows.length) show(rows.find(row => row.id === choice.input.value) ?? rows[0]); else { updateQuery({case: null}); results.append(el('p', 'No cases match. Choose All cases or clear the filters.')); }
  };
  for (const [control, key] of [[status.input, 'result'], [family.input, 'family'], [group.input, 'finding']]) retain(control, key, render);
  input.value = state().get('q') ?? ''; input.oninput = () => { updateQuery({q: input.value, case: null}); render(); };
  render();
}
function behavior() {
  heading('How edits change a document', 'Compare Carve, Djot and CommonMark, a specific Markdown dialect. Each edit is checked against the same reader before and after. A changed output can be an intended language rule.');
  main.append(el('p', 'Projections remove positions and normalize selected text and wrappers. Bold and emphasis spellings are adapted by language. The source and projected trees below show what each observation actually compares.', 'note'));
  const dataset = select('Dataset', [['comparison-results', 'Carve / Djot / CommonMark'], ['ownership-current-contracts', 'Current versioned contracts (four readers)'], ['comparison-contracts', 'Scoped behavioral contracts'], ['container-regressions', 'Carve container regressions'], ['djot-v-results', 'Djot verified parser: kernel / document'], ['property-results', 'Carve property observations'], ['djot-differential', 'Djot implementation differences']]);
  const controls = el('div', undefined, 'controls'); controls.append(dataset.label); const content = el('div'); main.append(controls, content);
  let selectionVersion = 0;
  const renderDataset = async () => {
    const version = ++selectionVersion, name = dataset.input.value;
    content.replaceChildren(resultCount('Loading dataset…'));
    let report; try { report = await loadReport(name); } catch(error) { if (version === selectionVersion) content.replaceChildren(resultCount(error.message)); return; }
    if (version !== selectionVersion || !content.isConnected) return;
    content.replaceChildren();
    content.append(link('Source JSON ↓', `reports/${name}.json`), details('Pins and projection metadata', report.metadata ?? { pins: report.pins, version: report.version, projectionVersion: report.projectionVersion, suiteSha256: report.suiteSha256 }));
    if (name === 'comparison-contracts') content.append(details('Contract hypotheses and scope', report.contracts));
    if (name === 'container-regressions') {
      content.append(el('p', `${report.rows.length} cases preserve full-AST and HTML fingerprints, including source positions. Coordinates use codepoints. Instrumented and ordinary parses must agree.`));
      const choice = select('Container case', report.rows.map((r, i) => [String(i), r.id])); const witness = el('div'); content.append(choice.label, witness);
      const show = () => { const row = report.rows[Number(choice.input.value)]; witness.replaceChildren(pre(row.source), details('Recorded fingerprints and work counts', row)); };
      retain(choice.input, 'case', show); show(); return;
    }
    if (name === 'djot-differential') {
      content.append(el('p', `${report.counts.inputs} generated inputs; ${report.counts.currentDifferences} differences against current Djot JavaScript, ${report.counts.releasedDifferences} against the release. Multiple cases can share a cause.`));
      const choice = select('Reproducer', report.reproducers.map((r, i) => [String(i), r.id])); const witness = el('div'); content.append(choice.label, witness);
      const show = () => { const row = report.reproducers[Number(choice.input.value)]; witness.replaceChildren(el('h2', row.id), pre(row.source), el('p', fmt(row.classification)), table(['Reader', 'Output'], ['jsCurrent', 'jsReleased', 'ocaml'].map(k => [k, pre(row[k])]))); };
      retain(choice.input, 'case', show); show(); content.append(details('All recorded differences', report.differences)); return;
    }
    const rows = report.rows.map(row => ({...row, family: row.family ?? row.contract})), families = unique(rows.map(r => r.family));
    const summary = [];
    for (const family of families) for (const reader of unique(rows.map(r => r.view || r.reader))) { const sample = rows.filter(r => r.family === family && (r.view || r.reader) === reader); if (sample.length) for (const expected of unique(sample.map(r => r.expected || 'exploratory'))) { const subset = sample.filter(r => (r.expected || 'exploratory') === expected); summary.push([family, labels[reader] || reader, expected === 'different' ? 'Change control' : expected === 'equal' ? 'Invariance claim' : 'Exploratory', subset.filter(r => r.outcome === 'equal').length, subset.filter(r => r.outcome === 'different').length, subset.length]); } }
    content.append(table(['Edit family', 'Reader / view', 'Expectation', 'Unchanged', 'Changed', 'Observations'], summary));
    if (name === 'djot-v-results') content.append(el('p', `Kernel and document are two views of the same ${new Set(rows.map(r => `${r.family}/${r.id}`)).size} fixtures. Document postprocessing includes generated heading IDs. The recorded streaming suite contains ${report.streaming.length} cases.`, 'note'));
    const family = select('Edit family', families), result = select('Outcome', ['all', 'different', 'equal']);
    const filters = el('div', undefined, 'controls'); filters.append(family.label, result.label); const list = el('div'), witness = el('div'); content.append(filters, list, witness);
    const render = () => {
      const filtered = rows.filter(r => r.family === family.input.value && (result.input.value === 'all' || r.outcome === result.input.value));
      const ids = unique(filtered.map(r => r.id)); const choice = select('Fixture', ids); restoreSelect(choice.input, state().get('case')); list.replaceChildren(choice.label, resultCount(`${ids.length} fixtures in this selection`));
      const show = () => { updateQuery({case: choice.input.value}); witness.replaceChildren(); const grid = el('div', undefined, 'outputs'); for (const row of rows.filter(r => r.family === family.input.value && r.id === choice.input.value)) { const c = el('article', undefined, 'card'); c.append(el('h3', `${labels[row.reader] || row.reader}${row.view ? ` / ${row.view}` : ''}`), badge(row.expected ? `Expected ${row.expected}; observed ${row.outcome}` : row.outcome || 'dialect probe', row.expected ? row.expected !== row.outcome : row.outcome === 'different'), el('h3', 'Before / input'), actions(row.before ?? row.source), pre(row.before ?? row.source), el('h3', 'After'), pre(row.after ?? '(no edit)'), details('Before tree / HTML', row.left ?? row.html ?? row.leftHash), details('After tree', row.right ?? row.rightHash ?? '(not applicable)')); grid.append(c); } witness.append(grid); const selected = rows.find(row => row.family === family.input.value && row.id === choice.input.value); if (selected?.left && selected?.right) witness.append(details('Structural changes at JSON paths', structuralDiff(selected.left, selected.right))); };
      choice.input.onchange = show; show();
    };
    retain(family.input, 'family', render); retain(result.input, 'outcome', render); render();
  };
  retain(dataset.input, 'dataset', renderDataset); renderDataset();
}
function scaling() {
  heading('Scaling, time and allocation', 'Historical measurements from the committed runs. Select a dataset, input family and API phase. Runtime datasets remain separate; memory metrics use runtime-specific definitions.');
  main.append(el('p', 'Run metadata identifies dedicated workflow measurements and historical shared-host runs. Carve, Djot and CommonMark expose different API features and source positions. Parse, render and HTML phases were measured independently, so their times must not be added. Unusual curves need an isolated repeat.', 'note'));
  main.append(link('Current cost investigation and next implementation work', 'reports/current-costs.md'));
  main.append(link('Scaling guards and held-out regression limits', 'reports/regression-budgets.md'));
  const dataset = select('Dataset', [['javascript', 'JavaScript readers'], ['rust', 'Carve Rust'], ['php', 'Carve PHP'], ['current-costs', 'Current costs and positions'], ['native', 'Historical Djot native / OCaml'], ['container-tails', 'Remaining container tails'], ['profile-js', 'Carve JS instrumented operations'], ['profile', 'Carve JS / specification operations'], ['prefix-change', 'Before / after prefix reuse'], ['tail-change', 'Before / after tail matching'], ['scaling', 'Original scaling run'], ['confirmation', 'Scaling confirmation']]);
  const family = select('Input family', []), phase = select('API phase', []), metric = select('Metric', []);
  const controls = el('div', undefined, 'controls'); controls.append(dataset.label, family.label, phase.label, metric.label); const panel = el('div'); main.append(controls, panel);
  function options(input, values) { const old = input.value; input.replaceChildren(...values.map(v => { const option = el('option', v); option.value = v; return option; })); if (values.includes(old)) input.value = old; }
  let chartVersion = 0;
  const render = async () => {
    const version = ++chartVersion;
    const selected = charts.find(c => c.dataset === dataset.input.value && c.family === family.input.value && c.phase === phase.input.value && c.metric === metric.input.value);
    panel.replaceChildren(); if (!selected) return;
    updateQuery({dataset: dataset.input.value, family: family.input.value, phase: phase.input.value, metric: metric.input.value});
    let chart; try { chart = await fetchJson(`charts/${selected.id}.json`); } catch(error) { if(version === chartVersion) panel.append(resultCount(error.message)); return; }
    if(version !== chartVersion || !panel.isConnected) return;
    const image = el('img'); image.className = 'chart'; image.src = `charts/${chart.id}.svg`; image.alt = `${chart.family}, ${chart.phase}: ${chart.unit} by ${chart.xUnit}. Values are listed in the table below.`;
    const downloads = el('div', undefined, 'downloads'); for (const ext of ['svg', 'png', 'csv', 'json']) { const a = link(`Download ${ext.toUpperCase()}`, `charts/${chart.id}.${ext}`); a.download = `${chart.id}.${ext}`; downloads.append(a); }
    panel.append(el('p', `Recorded: ${chart.metadata.generatedAt ?? 'see reader pins'}. ${chart.metadata.engine ? 'Carve JS ' + chart.metadata.engine.split('#').at(-1).slice(0, 10) + '.' : ''}`, 'muted'), el('p', chart.note), image, downloads, details('Run metadata and reader pins', chart.metadata), table(['Reader', chart.xUnit, chart.unit, 'Sample minimum', 'Sample maximum', 'Status'], chart.points.map(p => [p.reader, p.x, ...['value', 'low', 'high'].map(k => p[k] === null ? 'Not measured' : Number.isInteger(p[k]) ? p[k] : Number(p[k].toPrecision(6))), p.status])));
  };
  const updateMetric = () => { options(metric.input, unique(charts.filter(c => c.dataset === dataset.input.value && c.family === family.input.value && c.phase === phase.input.value).map(c => c.metric))); render(); };
  const updatePhase = () => { options(phase.input, unique(charts.filter(c => c.dataset === dataset.input.value && c.family === family.input.value).map(c => c.phase))); updateMetric(); };
  const updateFamily = () => { options(family.input, unique(charts.filter(c => c.dataset === dataset.input.value).map(c => c.family))); updatePhase(); };
  dataset.input.onchange = updateFamily; family.input.onchange = updatePhase; phase.input.onchange = updateMetric; metric.input.onchange = render;
  restoreSelect(dataset.input, state().get('dataset'));
  options(family.input, unique(charts.filter(c => c.dataset === dataset.input.value).map(c => c.family))); restoreSelect(family.input, state().get('family'));
  options(phase.input, unique(charts.filter(c => c.dataset === dataset.input.value && c.family === family.input.value).map(c => c.phase))); restoreSelect(phase.input, state().get('phase'));
  options(metric.input, unique(charts.filter(c => c.dataset === dataset.input.value && c.family === family.input.value && c.phase === phase.input.value).map(c => c.metric))); restoreSelect(metric.input, state().get('metric')); render();
}
function proofs() {
  heading('Where the proofs stop', 'Rocq checks statements about explicit models. Tests connect selected examples to real readers. A proof of the complete Carve parser is still missing.');
  const grid = el('div', undefined, 'cards');
  const model = card('Checked ownership model', 'Boundary retention, owner selection, prefix consumption and claim validity in a partial layout state machine.', data.theorems.length); model.classList.add('proof'); model.append(link('Model source', `${repo}/blob/${data.revision}/proofs/proofs/layout/Ownership.v`));
  const observed = card('Implementation evidence', `${data.ownership.cases} current ownership inputs, ${data.layoutExamples.trace} authored traces, ${data.layoutExamples.table} boundary-table examples and ${data.layoutExamples.prefix} prefix examples exercise selected behavior.`); observed.classList.add('proof');
  const missing = card('Still unmodeled', 'Source-byte tokenization, full nested stacks, Unicode and tabs, complete fence rules, and a refinement theorem connecting readers to the model.'); missing.classList.add('proof', 'unmodeled'); grid.append(model, observed, missing); main.append(grid);
  main.append(el('p', 'The layout workflow compiles the model and checks that its theorems are closed under the global context. Hypotheses in each theorem still apply. This site lists declarations from source; deployment waits for the proof and reader checks.', 'note'), link('Proof workflow and runs', `${repo}/actions/workflows/proofs.yml`));
  main.append(el('h2', 'Layout theorem inventory'), table(['Theorem', 'Statement and hypotheses', 'Proof source'], [...data.theorems, ...data.stackTheorems].map(t => [t.name, details('Statement and hypotheses', t.statement), link('Source ↗', `${repo}/blob/${data.revision}/proofs/proofs/layout/${t.model}#L${t.line}`)])));
  main.append(el('h2', 'Checked candidate-stack selection'), el('p', `${data.stackTheorems.length} declarations, including selection-visit bounds for the abstract helper. This does not bound the production parser.`), details('Toolchain, assumptions and extracted-helper checks', data.reports['stack-selection-proofs']), link('Download stack proof evidence', 'reports/stack-selection-proofs.json'), details('Recorded ownership proof check', data.reports['proof-refresh']), link('Current CI checks', `${repo}/actions/workflows/proofs.yml`));
  main.append(el('h2', 'Djot evidence'));
  for (const name of ['djot-v-proofs', 'djot-extension-proofs', 'djot-differential-proofs']) { const report = data.reports[name]; const c = el('article', undefined, 'card'); c.append(el('h3', name), el('p', `${report.closedUnderGlobalContext} recorded statements closed under the global context.`), link('Recorded proof evidence', `reports/${name}.json`), details('Toolchain, assumptions and transcript', report)); if (name === 'djot-v-proofs') c.append(el('p', `This upstream check is a recorded local run, not a CI gate. Extension and differential proofs are rerun in CI. Extraction matches the checked-in runtime: ${report.extractionMatches ? 'yes' : 'no'}. The upstream consistency command recorded status ${report.upstreamConsistency.status}. These limits prevent treating the measured runtime as a fully verified parser.`, 'note'), link('Extraction diff', 'reports/djot-v-extraction.diff')); main.append(c); }
  main.append(el('h2', 'Executable behavioral contracts'), el('p', `${data.reportIndex['ownership-current-contracts'].rows} current four-reader contract observations and ${data.reports['comparison-contracts'].rows.length} scoped observations and ${data.reports['container-regressions'].rows.length} container regression cases exercise the refreshed JavaScript reader. These are empirical checks, not additional Rocq theorems.`), link('Explore contract cases', '#behavior'));
  main.append(el('h2', 'No measured complexity theorem'), el('p', 'Timing slopes, regular expression call counts and sampled allocations are empirical observations. None of the listed layout theorems establishes a runtime or memory bound for the production readers.'));
}
function compareRuns() {
  const before = select('Earlier behavior run',data.historyRuns.map(r=>[r.id,r.label]),'pre-prefix-refresh');
  const after = select('Later behavior run',data.historyRuns.map(r=>[r.id,r.label]),'current');
  restoreSelect(before.input,state().get('before')); restoreSelect(after.input,state().get('after'));
  const controls=el('div',undefined,'controls'), results=el('div');controls.append(before.label,after.label);main.append(el('h2','Compare recorded behavior runs'),el('p','Added and removed observations are counted separately. Changed observations use the same reader, edit family and fixture ID. Different pins or projection versions limit the comparison.'),controls,results);
  let version=0;
  const render=async()=>{
    const current=++version;updateQuery({before:before.input.value,after:after.input.value});results.replaceChildren(resultCount('Loading recorded runs…'));
    try {
      const [left,right]=await Promise.all([before,after].map(control=>fetchJson(data.historyRuns.find(r=>r.id===control.input.value).source)));if(current!==version || !results.isConnected)return;
      const key=row=>JSON.stringify([row.reader,row.view,row.family,row.id]);const a=new Map(left.rows.map(row=>[key(row),row])),b=new Map(right.rows.map(row=>[key(row),row]));
      const added=[...b].filter(([id])=>!a.has(id)),removed=[...a].filter(([id])=>!b.has(id)),changed=[...b].filter(([id,row])=>a.has(id) && structuralDiff(a.get(id),row).length);
      results.replaceChildren(resultCount(`${changed.length} changed, ${added.length} added, ${removed.length} removed observations`),details('Pins and projections',{before:left.metadata,after:right.metadata}),details('Added observations',added.map(([,row])=>row)),details('Removed observations',removed.map(([,row])=>row)));
      const witness=el('div');results.append(table(['Reader','Family','Fixture','Inspect'],changed.map(([id,row])=>[row.reader,row.family,row.id,button('Show changes',()=>witness.replaceChildren(details('Earlier observation',a.get(id)),details('Later observation',row),details('Changes at JSON paths',structuralDiff(a.get(id),row))))])),witness);
    } catch(error){if(current===version)results.replaceChildren(resultCount(error.message));}
  };
  before.input.onchange=render;after.input.onchange=render;render();
}
function history() {
  const h = data.history;
  heading('Recorded changes', 'Compare preserved evidence across reader revisions. Ownership and parser work use separate suites and pins.');
  main.append(el('h2', 'Container ownership fixes'));
  main.append(el('div', `${h.before} → ${h.after}`, 'history-count'), el('p', `Disagreeing cases out of ${h.total}. ${h.changes.length} cases changed output, including ${h.changes.filter(c => c.before.groups.length === 1).length} previously agreeing cases.`), link('Earlier evidence commit', `${legacyRepo}/blob/${h.sourceCommit}/reports/ownership-results.json`), details('Before reader pins', h.previousPins), details('After reader pins', data.reports['ownership-results'].pins));
  const bar = el('div', undefined, 'bar'); const agreeing = el('span'); agreeing.style.width = `${100 * (h.total - h.after) / h.total}%`; const different = el('span', undefined, 'difference'); different.style.flex = '1'; bar.append(agreeing, different); main.append(bar, el('p', `${h.total - h.after} agree; ${h.after} disagree.`));
  const panel = el('div'); main.append(table(['Case', 'Before reader groups', 'After reader groups'], h.changes.map(c => [button(c.after.id, () => { panel.replaceChildren(el('h2', 'Before')); outputs(c.before, panel); panel.append(el('h2', 'After')); outputs(c.after, panel); panel.scrollIntoView({ block: 'start' }); }), c.before.groups.map(g => g.join(' + ')).join(' | '), c.after.groups.map(g => g.join(' + ')).join(' | ')])), panel);
  main.append(el('p', 'This ownership comparison is one measured transition, not a long-term trend.'));
  compareRuns();
  const comparison = data.comparisonHistory;
  main.append(el('h2', 'Comparison reader refresh'), el('p', `${comparison.unchanged} of ${comparison.total} comparison observations match the preserved baseline. Prefix-state reuse had already landed in the refreshed reader.`), details('Comparison reader pins', { before: comparison.beforeEngine, after: comparison.afterEngine }), table(['Depth 192', 'Earlier regex calls', 'Refreshed regex calls'], comparison.work.map(row => [row.family, ...row.counts])), link('Preserved comparison artifacts', `${repo}/tree/${data.revision}/proofs/reports/history/pre-prefix-refresh`), el('p', 'Successful regex match lengths grow near twofold, and simple nested quotes and lists make no suffix comparisons. Input exposure still grows roughly fourfold because it charges entire strings for bounded prefix checks. Failed scans and non-regex prefix operations are outside the matched-span counter. These counters do not establish a whole-parser complexity bound.'), link('Quote prefix comparison chart', 'charts/prefix-change-quotes-parse-regex-calls.svg'));

}
const routes = { overview, ownership, behavior, scaling, proofs, history };
async function route(focus = false) {
  const hash = location.hash.slice(1); if(hash === 'main' && main.querySelector('h1')) return; const key = hash === 'main' ? 'overview' : hash || 'overview'; const version = ++routeVersion;
  main.replaceChildren(resultCount('Loading evidence…'));
  try {
    const required = {
      overview: [],
      ownership: [state().get('profile') === 'historical' ? 'ownership-results' : 'ownership-current-results', 'ownership-reductions'],
      behavior: [], scaling: [],
      proofs: ['stack-selection-proofs', 'proof-refresh', 'djot-v-proofs', 'djot-extension-proofs', 'djot-differential-proofs', 'comparison-contracts', 'container-regressions'],
      history: [],
    }[key] ?? [];
    await Promise.all(required.map(loadReport));
    if(key === 'scaling' && !charts) charts = await fetchJson('charts/catalog.json');
    if(key === 'history') { data.history = await fetchJson('data/history.json'); data.reports['ownership-results'] = await loadReport('ownership-results'); }
    if(version !== routeVersion) return;
    main.replaceChildren();
    for (const a of document.querySelectorAll('nav a')) { if(a.hash === `#${key}`) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
    (routes[key] || overview)();
    document.title = `${main.querySelector('h1').textContent} | Carve evidence`;
    if(focus) { const title = main.querySelector('h1'); title.tabIndex = -1; title.focus(); }
  } catch(error) { if(version === routeVersion) main.replaceChildren(el('h1', 'Evidence unavailable'), el('p', error.message), link('Read the repository reports', `${repo}/tree/main/proofs/reports`)); }
}
try {
  data = await fetchJson('data/index.json'); data.reports = {};
  addEventListener('hashchange', () => route(true));
  await route();
} catch(error) { main.replaceChildren(el('h1', 'Evidence unavailable'), el('p', error.message), link('Read the repository reports', `${repo}/tree/main/proofs/reports`)); }
