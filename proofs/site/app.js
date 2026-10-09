const main = document.querySelector('main');
const repo = 'https://github.com/markup-carve/carve-proofs';
const labels = { spec: 'Carve specification', js: 'Carve JavaScript', php: 'Carve PHP', rs: 'Carve Rust', carve: 'Carve', djot: 'Djot JavaScript', commonmark: 'CommonMark' };
const fmt = value => typeof value === 'string' ? value : JSON.stringify(value, null, 2);
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function link(text, href) { const node = el('a', text); node.href = href; return node; }
function pre(value) { return el('pre', fmt(value)); }
function heading(title, description) { main.append(el('div', 'Carve proofs / evidence explorer', 'eyebrow'), el('h1', title), el('p', description)); }
function details(title, value) { const node = el('details'); node.append(el('summary', title), pre(value)); return node; }
function table(headers, rows) {
  const wrap = el('div', undefined, 'table-wrap'), t = el('table'), head = el('tr'), body = el('tbody');
  for (const label of headers) head.append(el('th', label));
  const thead = el('thead'); thead.append(head); t.append(thead);
  for (const row of rows) { const tr = el('tr'); for (const cell of row) { const td = el('td'); td.append(cell instanceof Node ? cell : document.createTextNode(String(cell))); tr.append(td); } body.append(tr); }
  t.append(body); wrap.append(t); return wrap;
}
function select(title, values, chosen) {
  const label = el('label', title), input = el('select');
  input.setAttribute('aria-label', title);
  for (const value of values) { const [key, text] = Array.isArray(value) ? value : [value, value]; const option = el('option', text); option.value = key; input.append(option); }
  if (chosen !== undefined) input.value = chosen;
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
let data, charts;
const unique = values => [...new Set(values)].sort();
function outputs(row, target) {
  target.append(el('h2', row.id), pre(row.source), el('p', `Reader groups: ${row.groups.map(g => g.join(' + ')).join(' | ')}`));
  const grid = el('div', undefined, 'outputs');
  for (const [reader, html] of Object.entries(row.outputs)) { const item = el('article', undefined, 'card'); item.append(el('h3', labels[reader] || reader), preview(html, `${reader} rendered output`), details('HTML output', html)); grid.append(item); }
  target.append(grid);
}
function overview() {
  heading('What the evidence says', 'Explore recorded reader behavior and the models used to reason about it. Results describe the pinned versions and fixtures shown here.');
  const ownership = data.reports['ownership-results'], h = data.history, cards = el('div', undefined, 'cards');
  for (const [title, body, count, href] of [
    ['Ownership cases', 'Four Carve readers, one generated suite.', ownership.rows.length, '#ownership'],
    ['Reader disagreements', h.after === 0 ? 'All recorded ownership cases agree at these pins.' : `Grouped into ${new Set(ownership.rows.map(r => r.finding).filter(Boolean)).size} observed families.`, h.after, '#ownership'],
    ['Layout theorems', 'Rocq statements about a partial ownership model.', data.theorems.length, '#proofs'],
    ['After the ownership fixes', `${h.before} disagreements became ${h.after} on the same suite.`, `${h.before} → ${h.after}`, '#history']
  ]) { const c = card(title, body, count); c.append(link('Explore →', href)); cards.append(c); }
  main.append(cards, el('h2', 'Three kinds of evidence'), table(['Evidence', 'What it establishes', 'Limit'], [
    ['Checked model', 'A theorem follows from its definitions and hypotheses.', 'No refinement proof connects the complete Carve implementations to the model.'],
    ['Reader tests', 'The recorded output agrees or differs for these fixtures and pins.', 'Finite samples do not establish a universal language property.'],
    ['Measurements', 'Time, allocation and selected operation counts in recorded runs.', 'Historical runs with different APIs and host load do not establish a speed ranking or complexity bound.']
  ]), el('h2', 'Next work suggested by the evidence'), el('p', 'Extend the ownership matrix to deeper stacks, tabs and comment spans, connect source parsing to the ownership model, and rerun isolated benchmarks after fixes. The case explorer provides reproducers; the proof map shows which steps still need a model.'), link(`Repository snapshot ${data.revision.slice(0, 12)}`, `${repo}/tree/${data.revision}`));
}
function ownership() {
  heading('Who owns this block?', 'Compare the specification, JavaScript, PHP and Rust readers. Agreement means equal projected outputs under this suite, not a universal correctness guarantee.');
  const report = data.reports['ownership-results']; source('ownership-results', { pins: report.pins, projectionVersion: report.projectionVersion, suiteSha256: report.suiteSha256 });
  const status = select('Result', [['different', 'Disagreements'], ['all', 'All cases'], ['equal', 'Agreement']], 'different');
  const family = select('Fixture family', ['all', ...unique(report.rows.map(r => r.family))]);
  const group = select('Finding family', ['all', ...unique(report.rows.map(r => r.finding).filter(Boolean))]);
  const search = el('label', 'Search case or source'), input = el('input'); input.type = 'search'; search.append(input);
  const controls = el('div', undefined, 'controls'); controls.append(status.label, family.label, group.label, search);
  const results = el('div'), detail = el('section'); detail.id = 'case-detail';
  main.append(controls, results, detail);
  const show = row => { detail.replaceChildren(); outputs(row, detail); const reduction = data.reports['ownership-reductions'].rows.find(r => r.caseId === row.id); if (reduction) { const d = el('details'); d.append(el('summary', 'Reduced witness for this family'), el('p', 'Fixed-point single-character deletion under the recorded constraints. This does not claim a globally smallest input.')); outputs(reduction, d); detail.append(d); } };
  const render = () => {
    const rows = report.rows.filter(r => (status.input.value === 'all' || (r.groups.length > 1) === (status.input.value === 'different')) && (family.input.value === 'all' || r.family === family.input.value) && (group.input.value === 'all' || r.finding === group.input.value) && `${r.id}\n${r.source}`.toLowerCase().includes(input.value.toLowerCase()));
    const choice = select('Case', rows.map(r => r.id));
    choice.input.onchange = () => show(rows.find(r => r.id === choice.input.value));
    const inventory = el('details'); inventory.append(el('summary', 'Matching case inventory'), table(['Case', 'Finding', 'Reader groups'], rows.map(r => [button(r.id, () => { choice.input.value = r.id; show(r); detail.scrollIntoView({ block: 'start' }); }), r.finding || 'Agreement', r.groups.map(g => g.join(' + ')).join(' | ')])));
    results.replaceChildren(el('p', `${rows.length} of ${report.rows.length} cases`, 'result-count'), choice.label, inventory);
    detail.replaceChildren(); if (rows[0]) show(rows[0]);
  };
  for (const control of [status.input, family.input, group.input, input]) control.oninput = render;
  render();
}
function behavior() {
  heading('How edits change a document', 'Compare Carve, Djot and CommonMark, a specific Markdown dialect. Each edit is checked against the same reader before and after. A changed output can be an intended language rule.');
  main.append(el('p', 'Projections remove positions and normalize selected text and wrappers. Bold and emphasis spellings are adapted by language. The source and projected trees below show what each observation actually compares.', 'note'));
  const dataset = select('Dataset', [['comparison-results', 'Carve / Djot / CommonMark'], ['comparison-contracts', 'Scoped behavioral contracts'], ['container-regressions', 'Carve container regressions'], ['djot-v-results', 'Djot verified parser: kernel / document'], ['property-results', 'Carve property observations'], ['djot-differential', 'Djot implementation differences']]);
  const controls = el('div', undefined, 'controls'); controls.append(dataset.label); const content = el('div'); main.append(controls, content);
  const renderDataset = () => {
    content.replaceChildren(); const name = dataset.input.value, report = data.reports[name];
    content.append(link('Source JSON ↓', `reports/${name}.json`), details('Pins and projection metadata', report.metadata));
    if (name === 'comparison-contracts') content.append(details('Contract hypotheses and scope', report.contracts));
    if (name === 'container-regressions') {
      content.append(el('p', `${report.rows.length} cases preserve full-AST and HTML fingerprints, including source positions. Coordinates use codepoints. Instrumented and ordinary parses must agree.`));
      const choice = select('Container case', report.rows.map((r, i) => [String(i), r.id])); const witness = el('div'); content.append(choice.label, witness);
      const show = () => { const row = report.rows[Number(choice.input.value)]; witness.replaceChildren(pre(row.source), details('Recorded fingerprints and work counts', row)); };
      choice.input.onchange = show; show(); return;
    }
    if (name === 'djot-differential') {
      content.append(el('p', `${report.counts.inputs} generated inputs; ${report.counts.currentDifferences} differences against current Djot JavaScript, ${report.counts.releasedDifferences} against the release. Multiple cases can share a cause.`));
      const choice = select('Reproducer', report.reproducers.map((r, i) => [String(i), r.id])); const witness = el('div'); content.append(choice.label, witness);
      const show = () => { const row = report.reproducers[Number(choice.input.value)]; witness.replaceChildren(el('h2', row.id), pre(row.source), el('p', fmt(row.classification)), table(['Reader', 'Output'], ['jsCurrent', 'jsReleased', 'ocaml'].map(k => [k, pre(row[k])]))); };
      choice.input.onchange = show; show(); content.append(details('All recorded differences', report.differences)); return;
    }
    const rows = report.rows, families = unique(rows.map(r => r.family));
    const summary = [];
    for (const family of families) for (const reader of unique(rows.map(r => r.view || r.reader))) { const sample = rows.filter(r => r.family === family && (r.view || r.reader) === reader); if (sample.length) for (const expected of unique(sample.map(r => r.expected || 'exploratory'))) { const subset = sample.filter(r => (r.expected || 'exploratory') === expected); summary.push([family, labels[reader] || reader, expected === 'different' ? 'Change control' : expected === 'equal' ? 'Invariance claim' : 'Exploratory', subset.filter(r => r.outcome === 'equal').length, subset.filter(r => r.outcome === 'different').length, subset.length]); } }
    content.append(table(['Edit family', 'Reader / view', 'Expectation', 'Unchanged', 'Changed', 'Observations'], summary));
    if (name === 'djot-v-results') content.append(el('p', `Kernel and document are two views of the same ${new Set(rows.map(r => `${r.family}/${r.id}`)).size} fixtures. Document postprocessing includes generated heading IDs. The recorded streaming suite contains ${report.streaming.length} cases.`, 'note'));
    const family = select('Edit family', families), result = select('Outcome', ['all', 'different', 'equal']);
    const filters = el('div', undefined, 'controls'); filters.append(family.label, result.label); const list = el('div'), witness = el('div'); content.append(filters, list, witness);
    const render = () => {
      const filtered = rows.filter(r => r.family === family.input.value && (result.input.value === 'all' || r.outcome === result.input.value));
      const ids = unique(filtered.map(r => r.id)); const choice = select('Fixture', ids); list.replaceChildren(choice.label, el('p', `${ids.length} fixtures in this selection`));
      const show = () => { witness.replaceChildren(); const grid = el('div', undefined, 'outputs'); for (const row of rows.filter(r => r.family === family.input.value && r.id === choice.input.value)) { const c = el('article', undefined, 'card'); c.append(el('h3', `${labels[row.reader] || row.reader}${row.view ? ` / ${row.view}` : ''}`), badge(row.expected ? `Expected ${row.expected}; observed ${row.outcome}` : row.outcome || 'dialect probe', row.expected ? row.expected !== row.outcome : row.outcome === 'different'), el('h3', 'Before / input'), pre(row.before ?? row.source), el('h3', 'After'), pre(row.after ?? '(no edit)'), details('Before tree / HTML', row.left ?? row.html ?? row.leftHash), details('After tree', row.right ?? row.rightHash ?? '(not applicable)')); grid.append(c); } witness.append(grid); };
      choice.input.onchange = show; show();
    };
    family.input.onchange = render; result.input.onchange = render; render();
  };
  dataset.input.onchange = renderDataset; renderDataset();
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
  const render = () => {
    const chart = charts.find(c => c.dataset === dataset.input.value && c.family === family.input.value && c.phase === phase.input.value && c.metric === metric.input.value);
    panel.replaceChildren(); if (!chart) return;
    const image = el('img'); image.className = 'chart'; image.src = `charts/${chart.id}.svg`; image.alt = `${chart.family}, ${chart.phase}: ${chart.unit} by ${chart.xUnit}. Values are listed in the table below.`;
    const downloads = el('div', undefined, 'downloads'); for (const ext of ['svg', 'png', 'csv', 'json']) { const a = link(`Download ${ext.toUpperCase()}`, `charts/${chart.id}.${ext}`); a.download = `${chart.id}.${ext}`; downloads.append(a); }
    panel.append(el('p', `Recorded: ${chart.metadata.generatedAt ?? 'see reader pins'}. ${chart.metadata.engine ? 'Carve JS ' + chart.metadata.engine.split('#').at(-1).slice(0, 10) + '.' : ''}`, 'muted'), el('p', chart.note), image, downloads, details('Run metadata and reader pins', chart.metadata), table(['Reader', chart.xUnit, chart.unit, 'Sample minimum', 'Sample maximum', 'Status'], chart.points.map(p => [p.reader, p.x, ...['value', 'low', 'high'].map(k => p[k] === null ? 'Not measured' : Number.isInteger(p[k]) ? p[k] : Number(p[k].toPrecision(6))), p.status])));
  };
  const updateMetric = () => { options(metric.input, unique(charts.filter(c => c.dataset === dataset.input.value && c.family === family.input.value && c.phase === phase.input.value).map(c => c.metric))); render(); };
  const updatePhase = () => { options(phase.input, unique(charts.filter(c => c.dataset === dataset.input.value && c.family === family.input.value).map(c => c.phase))); updateMetric(); };
  const updateFamily = () => { options(family.input, unique(charts.filter(c => c.dataset === dataset.input.value).map(c => c.family))); updatePhase(); };
  dataset.input.onchange = updateFamily; family.input.onchange = updatePhase; phase.input.onchange = updateMetric; metric.input.onchange = render; updateFamily();
}
function proofs() {
  heading('Where the proofs stop', 'Rocq checks statements about explicit models. Tests connect selected examples to real readers. A proof of the complete Carve parser is still missing.');
  const grid = el('div', undefined, 'cards');
  const model = card('Checked ownership model', 'Boundary retention, owner selection, prefix consumption and claim validity in a partial layout state machine.', data.theorems.length); model.classList.add('proof'); model.append(link('Model source', `${repo}/blob/${data.revision}/proofs/layout/Ownership.v`));
  const observed = card('Implementation evidence', `${data.reports['ownership-results'].rows.length} generated ownership inputs, ${data.layoutExamples.trace} authored traces, ${data.layoutExamples.table} boundary-table examples and ${data.layoutExamples.prefix} prefix examples exercise selected behavior.`); observed.classList.add('proof');
  const missing = card('Still unmodeled', 'Source-byte tokenization, full nested stacks, Unicode and tabs, complete fence rules, and a refinement theorem connecting readers to the model.'); missing.classList.add('proof', 'unmodeled'); grid.append(model, observed, missing); main.append(grid);
  main.append(el('p', 'The layout workflow compiles the model and checks that its theorems are closed under the global context. Hypotheses in each theorem still apply. This site lists declarations from source; deployment waits for the proof and reader checks.', 'note'), link('Proof workflow and runs', `${repo}/actions/workflows/proofs.yml`));
  main.append(el('h2', 'Layout theorem inventory'), table(['Theorem', 'Statement and proof'], data.theorems.map(t => [t.name, link('Source ↗', `${repo}/blob/${data.revision}/proofs/layout/Ownership.v#L${t.line}`)])));
  main.append(el('h2', 'Djot evidence'));
  for (const name of ['djot-v-proofs', 'djot-extension-proofs', 'djot-differential-proofs']) { const report = data.reports[name]; const c = el('article', undefined, 'card'); c.append(el('h3', name), el('p', `${report.closedUnderGlobalContext} recorded statements closed under the global context.`), link('Recorded proof evidence', `reports/${name}.json`), details('Toolchain, assumptions and transcript', report)); if (name === 'djot-v-proofs') c.append(el('p', `This upstream check is a recorded local run, not a CI gate. Extension and differential proofs are rerun in CI. Extraction matches the checked-in runtime: ${report.extractionMatches ? 'yes' : 'no'}. The upstream consistency command recorded status ${report.upstreamConsistency.status}. These limits prevent treating the measured runtime as a fully verified parser.`, 'note'), link('Extraction diff', 'reports/djot-v-extraction.diff')); main.append(c); }
  main.append(el('h2', 'Executable behavioral contracts'), el('p', `${data.reports['comparison-contracts'].rows.length} scoped observations and ${data.reports['container-regressions'].rows.length} container regression cases exercise the refreshed JavaScript reader. These are empirical checks, not additional Rocq theorems.`), link('Explore contract cases', '#behavior'));
  main.append(el('h2', 'No measured complexity theorem'), el('p', 'Timing slopes, regular expression call counts and sampled allocations are empirical observations. None of the listed layout theorems establishes a runtime or memory bound for the production readers.'));
}
function history() {
  const h = data.history;
  heading('Recorded changes', 'Compare preserved evidence across reader revisions. Ownership and parser work use separate suites and pins.');
  main.append(el('h2', 'Container ownership fixes'));
  main.append(el('div', `${h.before} → ${h.after}`, 'history-count'), el('p', `Disagreeing cases out of ${h.total}. ${h.changes.length} cases changed output, including ${h.changes.filter(c => c.before.groups.length === 1).length} previously agreeing cases.`), link('Earlier evidence commit', `${repo}/blob/${h.sourceCommit}/reports/ownership-results.json`), details('Before reader pins', h.previousPins), details('After reader pins', data.reports['ownership-results'].pins));
  const bar = el('div', undefined, 'bar'); const agreeing = el('span'); agreeing.style.width = `${100 * (h.total - h.after) / h.total}%`; const different = el('span', undefined, 'difference'); different.style.flex = '1'; bar.append(agreeing, different); main.append(bar, el('p', `${h.total - h.after} agree; ${h.after} disagree.`));
  const panel = el('div'); main.append(table(['Case', 'Before reader groups', 'After reader groups'], h.changes.map(c => [button(c.after.id, () => { panel.replaceChildren(el('h2', 'Before')); outputs(c.before, panel); panel.append(el('h2', 'After')); outputs(c.after, panel); panel.scrollIntoView({ block: 'start' }); }), c.before.groups.map(g => g.join(' + ')).join(' | '), c.after.groups.map(g => g.join(' + ')).join(' | ')])), panel);
  main.append(el('p', 'This ownership comparison is one measured transition, not a long-term trend.'));
  const comparison = data.comparisonHistory;
  main.append(el('h2', 'Comparison reader refresh'), el('p', `${comparison.unchanged} of ${comparison.total} comparison observations match the preserved baseline. Prefix-state reuse had already landed in the refreshed reader.`), details('Comparison reader pins', { before: comparison.beforeEngine, after: comparison.afterEngine }), table(['Depth 192', 'Earlier regex calls', 'Refreshed regex calls'], comparison.work.map(row => [row.family, ...row.counts])), link('Preserved comparison artifacts', `${repo}/tree/${data.revision}/reports/history/pre-prefix-refresh`), el('p', 'Successful regex match lengths grow near twofold, and simple nested quotes and lists make no suffix comparisons. Input exposure still grows roughly fourfold because it charges entire strings for bounded prefix checks. Failed scans and non-regex prefix operations are outside the matched-span counter. These counters do not establish a whole-parser complexity bound.'), link('Quote prefix comparison chart', 'charts/prefix-change-quotes-parse-regex-calls.svg'));

}
const routes = { overview, ownership, behavior, scaling, proofs, history };
function route() { const key = location.hash.slice(1) || 'overview'; main.replaceChildren(); for (const a of document.querySelectorAll('nav a')) { if (a.hash === `#${key}`) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); } (routes[key] || overview)(); document.title = `${main.querySelector('h1').textContent} | Carve evidence`; }
try {
  const responses = await Promise.all([fetch('data/evidence.json'), fetch('charts/index.json')]);
  if (responses.some(r => !r.ok)) throw new Error('Evidence files could not be loaded');
  [data, charts] = await Promise.all(responses.map(r => r.json()));
  addEventListener('hashchange', route); route();
} catch (error) { main.replaceChildren(el('h1', 'Evidence unavailable'), el('p', error.message), link('Read the repository reports', `${repo}/tree/main/reports`)); }
