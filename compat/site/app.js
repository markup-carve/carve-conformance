import { copyButton, structuralDiff, updateQuery, restoreSelect } from './evidence-tools.js'
const $ = selector => document.querySelector(selector)
const node = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el }
const append = (parent, ...children) => { parent.append(...children); return parent }
const fetchJson = async path => { const response = await fetch(path, {cache:'no-store'}); if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`); return response.json() }
let report, tools, activeButton, detailVersion = 0
const checkLabels = { 'reference-source-read':'Read reference source', 'native-source-read':'Reference reads engine source', 'independent-docbook':'Separate DocBook output', 'foreign-ast-roundtrip':'Foreign AST interchange', 'source-conversion-changes':'Declared source conversion changes', 'source-conversion-diagnostics':'Reference source conversion diagnostics', 'ast-schema': 'AST schema', 'ast-mapping': 'Semantic structure', 'html-structure': 'HTML structure', 'carve-source-roundtrip': 'Carve source round trip', 'json-roundtrip': 'JSON interchange', 'foreign-source-roundtrip': 'Foreign source round trip', 'built-in-importer-rendering': 'Public importer', 'loss-diagnostic': 'Exact loss diagnostic', 'fallback-schema': 'Fallback schema', 'fallback-content': 'Readable fallback' }
function ring(passed, total) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 48 48'); svg.classList.add('ring'); svg.setAttribute('aria-hidden', 'true')
  for (const [stroke, dash] of [['#e4e8e4', null], [total && passed === total ? '#46816f' : total ? '#b94861' : '#aab2af', 113.1 * (total ? passed / total : 0)]]) {
    const circle = document.createElementNS(svg.namespaceURI, 'circle')
    for (const [key, value] of Object.entries({ cx:24, cy:24, r:18, fill:'none', stroke, 'stroke-width':4, transform:'rotate(-90 24 24)' })) circle.setAttribute(key, value)
    if (dash !== null) circle.setAttribute('stroke-dasharray', `${dash} 113.1`)
    svg.append(circle)
  }
  return svg
}
function fillOverview(manifest) {
  const supported = report.rows.filter(r => r.kind === 'supported'), losses = report.rows.filter(r => r.kind === 'loss')
  $('#stat-tools').textContent = report.selected.length; $('#stat-positive').textContent = supported.length; $('#stat-loss').textContent = losses.length; $('#stat-failed').textContent = report.failed
  const status = $('#run-status'); status.textContent = `${report.passed} adapter assertions passed · ${report.failed} assertion failures${report.notMeasured.length ? ` · ${report.notMeasured.length} unmeasured targets` : ''}`
  status.classList.add(report.failed ? 'status-bad' : 'status-good')
  const time = $('#measured-at'); time.dateTime = report.generatedAt; time.textContent = new Date(report.generatedAt).toLocaleString('en-GB', { timeZone:'UTC', dateStyle:'medium', timeStyle:'short' }) + ' UTC'
  if (Date.now() - new Date(report.generatedAt).getTime() > 48 * 3600000) status.textContent += ' · report older than 48 hours'
  const engine = $('#engine-version'); engine.textContent = `Carve ${report.engine.version}`
  const pin = report.engine.dependency.split('#')[1]; if (/^[a-f0-9]{40}$/.test(pin)) engine.href = `https://github.com/markup-carve/carve-js/commit/${pin}`
  if (manifest.runUrl) $('#run-link').href = manifest.runUrl
  for(const id of report.selectedEngines??['javascript']){const meta=report.engines?.[id]??report.engine;const rows=report.rows.filter(r=>(r.engine??'javascript')===id);const card=node('article',undefined,'engine-card');card.append(node('h3',meta.name??id),ring(rows.filter(r=>r.status==='passed').length,rows.length),node('p',`${rows.filter(r=>r.status==='passed').length} / ${rows.length} comparisons passed`),node('p',meta.version??meta.error??'Version unavailable','version'),...(meta.runtime?[node('p',meta.runtime,'version')]:[]) );$('#engine-cards').append(card);const option=node('option',meta.name??id);option.value=id;$('#engine-filter').append(option)}
  const pairs = [['Suite revision', report.suiteRevision], ['Reference engine pin', report.engine.dependency], ['Schema revision', report.schema.revision], ['Engine config SHA-256',report.engineConfigSha256??'Unavailable'], ['Importer assessment SHA-256',report.importerAssessmentSha256??'Unavailable'], ['Schema SHA-256', report.schema.sha256], ['cases.json SHA-256', report.fixtureHashes['cases.json']], ['losses.json SHA-256', report.fixtureHashes['losses.json']], ['Comparison duration', `${(report.durationMs / 1000).toFixed(1)} seconds`], ['Unmeasured targets', report.notMeasured.join(', ') || 'None'], ['Run scope', 'Foreign AST mapping uses shared JavaScript adapters; native engines verify the mapped trees. Import suites separately compare reference and native rendering.']]
  for(const [id,meta]of Object.entries(report.engines??{}))pairs.push([`${id} revision`,meta.revision??meta.error??'Unavailable'])
  for (const [key, value] of pairs) append($('#provenance'), node('dt', key), node('dd', value))
  for (const tool of tools) {
    const rows = report.rows.filter(r => r.tool === tool.id), passed = rows.filter(r => r.status === 'passed').length
    const card = node('article', undefined, 'tool-card'), top = node('div', undefined, 'tool-top'), h = node('h3'), link = node('a', tool.name)
    link.href = tool.url; append(top, append(h, link), ring(passed, rows.length)); card.append(top, node('p', tool.format, 'format'), node('span', rows.length ? `${passed} / ${rows.length} engine comparisons passed` : 'Not measured', 'count'))
    card.append(node('p', `${rows.filter(r => r.kind === 'supported').length} supported · ${rows.filter(r => r.kind === 'loss').length} loss comparisons`), node('p', tool.description))
    const versions = [...new Set(rows.map(r => r.version).filter(Boolean))]; card.append(node('p', versions.length ? versions.join(' · ') : 'Version unavailable', 'version'))
    const button = node('button', 'Inspect cases →'); button.type = 'button'; button.disabled = !rows.length; button.addEventListener('click', () => { closeDetail(); $('#tool-filter').value = tool.id; renderMatrix(); $('#explorer').scrollIntoView(); $('#tool-filter').focus() }); card.append(button); $('#tool-cards').append(card)
    const option = node('option', tool.name); option.value = tool.id; $('#tool-filter').append(option)
  }
}
function closeDetail() {
  $('#detail').hidden = true
  if (activeButton?.isConnected) { activeButton.setAttribute('aria-pressed', 'false'); activeButton.focus({preventScroll:true}) }
  activeButton = null
  detailVersion++; updateQuery({case:null, tool:null, kind:null})
}
function pane(title, value, open = false) {
  const el = node('details'); el.open = open; append(el, node('summary', title), append(node('pre'), node('code', typeof value === 'string' ? value : JSON.stringify(value, null, 2)))); return el
}
async function showDetail(row, button, scroll = true) {
  const version = ++detailVersion;
  if (row.evidenceUrl) {
    activeButton?.setAttribute('aria-pressed','false'); activeButton=button; button?.setAttribute('aria-pressed','true');
    $('#detail').hidden = false; $('#detail-title').textContent = row.case; for(const id of ['detail-meta','detail-summary','detail-checks']) $('#'+id).textContent=''; $('#detail-panes').replaceChildren(node('p', 'Loading case evidence…'));
    try { row = await fetchJson(row.evidenceUrl); } catch(error) { if(version === detailVersion) $('#detail-panes').replaceChildren(node('p', error.message)); return; }
    if(version !== detailVersion) return;
  }
  activeButton?.setAttribute('aria-pressed', 'false'); activeButton = button; button?.setAttribute('aria-pressed', 'true')
  const tool = tools.find(t => t.id === row.tool); $('#detail-meta').textContent = `${row.engine??'javascript'} / ${tool.name} / ${row.kind === 'loss' ? 'EXPECTED LOSS' : 'SUPPORTED SUBSET'} / ${row.status.toUpperCase()}`
  const title = $('#detail-title'); title.textContent = row.case; title.tabIndex = -1
  $('#detail-summary').textContent = row.error ?? (row.kind === 'loss' ? (row.engine && row.engine!=='javascript'?'The JavaScript adapter verified this expected loss. This engine checked the resulting fallback AST through the checks listed below.':'This case passed because the expected limitation was reported at its declared path and readable fallback content survived.') : 'This fixture preserved the declared semantic fields through every listed check. Normalization diagnostics remain visible below.')
  $('#detail-checks').textContent = (row.checks ?? []).map(c => `✓ ${checkLabels[c] ?? c}`).join('  ·  ')
  const panes = $('#detail-panes'); panes.replaceChildren(copyButton('Copy link', () => location.href)); const e = row.evidence ?? {}; if(e.source !== undefined) panes.append(copyButton('Copy source', e.source)); panes.append(pane('Reproduce the adapter suite', `npm run compat:check -- --tools=${row.tool} --engines=${row.engine ?? 'javascript'} --report=/tmp/carve-compat.json`));
  if (e.source !== undefined) panes.append(pane(`Input source · ${e.sourceFormat}`, e.source, true))
  if (row.importer) panes.append(pane('Importer report', `Report class: ${row.importer.reportClass}\nHonesty: ${row.importer.honesty}\nDiagnostic codes: ${row.importer.codes.join(', ') || 'None'}`, true))
  if(e.scope && row.status==='passed')$('#detail-summary').textContent=`This fixture preserved its authored AST fields through the listed interchange checks. Scope: ${e.scope}. Each engine checks source changes against declared before/after values; this does not claim a lossless source round trip. Conversion-diagnostic checks use the JavaScript reference.`
  if(e.sourceChanges)panes.append(pane('Engine source before/after changes',e.sourceChanges))
  if(e.expectedAst)panes.append(pane('Authored AST expectation',e.expectedAst))
  if(e.carveConversion)panes.append(pane('Reference Carve source conversion and diagnostics',e.carveConversion))
  if (e.carve !== undefined) panes.append(pane('Authored Carve expectation', e.carve, true))
  if (e.ast) panes.append(pane('Mapped Carve AST', e.ast, !e.carve))
  if(e.engineAst)panes.append(pane('Engine decoded AST',e.engineAst)); if(e.expectedAst && e.engineAst) panes.append(pane('Structural differences at JSON paths', structuralDiff(e.expectedAst, e.engineAst)))
  if(e.engineCarve!==undefined)panes.append(pane('Engine canonical Carve',e.engineCarve))
  if(e.independentAst)panes.append(pane('Separate DocBook AST',e.independentAst))
  if(e.independentSource!==undefined)panes.append(pane('Separate DocBook source',e.independentSource))
  if (e.exportedSource !== undefined) panes.append(pane('Exported foreign source', e.exportedSource))
  if (e.foreignHtml !== undefined) panes.append(pane('Foreign rendered HTML · source only', e.foreignHtml))
  if (e.expected) panes.append(pane('Required loss diagnostic', { ...e.expected, retainedContent: e.retained }, true))
  if (row.errorDetails && (row.errorDetails.actual !== undefined || row.errorDetails.expected !== undefined)) panes.append(pane('Failure comparison · actual and expected', row.errorDetails, true))
  const diagnostics = node('details'); diagnostics.open = row.kind === 'loss'; const unique = new Map()
  for (const d of row.diagnostics ?? []) { const key = JSON.stringify([d.path, d.code, d.fidelity, d.message]); const current = unique.get(key); if (current) current.count++; else unique.set(key, { ...d, count:1 }) }
  diagnostics.append(node('summary', `Diagnostics · ${unique.size} distinct`))
  const list = node('ul', undefined, 'diag-list')
  for (const d of unique.values()) { const item = node('li'); append(item, node('span', d.fidelity, `badge ${d.fidelity}`), node('code', d.code), node('code', `Path: ${d.path || '(root)'}${d.count > 1 ? ` · ${d.count} occurrences across checks` : ''}`), node('p', d.message)); list.append(item) }
  if (!unique.size) list.append(node('li', row.status === 'failed' ? 'No diagnostics were captured before this failure.' : 'No adapter diagnostics.'))
  diagnostics.append(list); panes.append(diagnostics); $('#detail').hidden = false
  const url = new URL(location.href); url.searchParams.set('case', row.case); url.searchParams.set('tool', row.tool); url.searchParams.set('kind', row.kind); url.searchParams.set('engine',row.engine??'javascript'); url.hash = 'explorer'; history.replaceState(null, '', url)
  if (scroll) { $('#detail').scrollIntoView({ block:'start' }); title.focus({ preventScroll:true }) }
}
function renderMatrix() {
  $('#detail').hidden = true; activeButton = null
  const search = $('#search').value.toLowerCase().trim(), selectedTool = $('#tool-filter').value, kind = $('#kind-filter').value, status = $('#status-filter').value
  updateQuery({engine:$('#engine-filter').value, target:$('#tool-filter').value, type:$('#kind-filter').value, status:$('#status-filter').value, q:$('#search').value});
  const rows = report.rows.filter(r => (r.engine??'javascript')===$('#engine-filter').value && (!search || `${r.case} ${r.error ?? ''} ${(r.diagnostics ?? []).map(d => `${d.code} ${d.message}`).join(' ')}`.toLowerCase().includes(search)) && (!selectedTool || r.tool === selectedTool) && (!kind || r.kind === kind) && (!status || r.status === status))
  const visibleTools = tools.filter(t => !selectedTool || t.id === selectedTool)
  const head = $('#matrix thead'); head.replaceChildren(); const tr = node('tr'); const first = node('th', 'Fixture'); first.scope = 'col'; tr.append(first)
  for (const tool of visibleTools) { const th = node('th', tool.name); th.scope = 'col'; tr.append(th) } head.append(tr)
  const grouped = new Map(); for (const row of rows) { const key = `${row.kind}/${row.case}`; if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(row) }
  const body = $('#matrix tbody'); body.replaceChildren()
  for (const group of grouped.values()) {
    const tr = node('tr'), th = node('th', group[0].case); th.scope = 'row'; tr.append(th)
    for (const tool of visibleTools) {
      const td = node('td'), row = group.find(r => r.tool === tool.id)
      if (!row) { const empty = node('span', '—', 'cell-empty'); empty.setAttribute('aria-label', 'Outside this filtered coverage'); td.append(empty) }
      else {
        const type = row.status === 'failed' ? 'fail' : row.kind === 'loss' ? 'loss' : (row.scope ?? row.evidence?.scope) ? 'interchange' : 'pass', button = node('button', type === 'fail' ? '×' : type === 'loss' ? 'L' : type === 'interchange' ? 'I' : '✓', type)
        button.type = 'button'; button.dataset.case = row.case; button.dataset.tool = row.tool; button.dataset.kind = row.kind; button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-label', `${tool.name}: ${row.case}, ${row.status}${row.kind === 'loss' ? ', expected loss' : (row.scope ?? row.evidence?.scope) ? ', AST interchange with separate source conversion checks' : ''}. View evidence`); button.addEventListener('click', () => showDetail(row, button)); td.append(button)
      }
      tr.append(td)
    }
    body.append(tr)
  }
  $('#case-count').textContent = `${grouped.size} fixtures · ${rows.length} measured target/case pairs`; $('#empty-results').hidden = rows.length !== 0
}
function suiteTable(selector, caption, headers, rows) {
  const table = $(selector), head = node('tr'), body = node('tbody')
  for (const label of headers) { const th = node('th', label); th.scope = 'col'; head.append(th) }
  for (const values of rows) {
    const tr = node('tr'), th = node('th', values[0]); th.scope = 'row'; tr.append(th)
    for (const value of values.slice(1)) tr.append(node('td', value))
    body.append(tr)
  }
  table.replaceChildren(node('caption', caption), append(node('thead'), head), body)
}
function fillHtmlSuite(data, {id,kind,label,sourceKey,sourceLabel,sectionLabel}) {
  const select = suffix => $(`#${id}-${suffix}`)
  const exampleLink = row => id === 'commonmark' ? `https://spec.commonmark.org/0.31.2/#example-${row.example}` : row.link
  const setLink = (link, row) => { const url = exampleLink(row); if (typeof url === 'string' && URL.canParse(url) && new URL(url).protocol === 'https:') link.href = url }
  if (data.schemaVersion !== 1 || data.kind !== kind || !Array.isArray(data.rows) || !Array.isArray(data.sections) || !Array.isArray(data.selectedEngines)) throw new Error(`Unsupported ${label} report`)
  const engines = data.selectedEngines, name = engine => data.engines[engine]?.name ?? engine
  const outcomes = ['reported','unassessed','silent-loss','unverified-loss','ok']
  const baselines = Object.entries(data.baselines ?? {}), baselineName = 'pandoc to Djot (baseline)'
  suiteTable(`#${id}-totals`, `Totals by ${sourceLabel} importer`, ['Engine','Match','Mismatch','Declared','Not comparable','Failed','Names the loss','Only fidelity-unverified','Clean report = silent',...outcomes], engines.map(engine => {
    const t = data.totals[engine]
    return [name(engine),t.match,t.mismatch,t.declared,t.notComparable,t.failed,t.mismatchByReport['names-loss'],t.mismatchByReport['unverified-only'],t.mismatchByReport.clean,...outcomes.map(outcome => t.honesty?.[outcome] ?? 'Not measured')]
  }).concat(baselines.map(([,{totals:t}]) => [baselineName,t.match,t.mismatch,'n/a',t.notComparable,t.failed,...Array(3 + outcomes.length).fill('n/a')])))
  if(data.nativeRendering) {
    const native = node('table'); native.id = `${id}-native-totals`; select('totals').after(native)
    suiteTable(`#${id}-native-totals`, 'Native rendering of each importer output', ['Engine','Match','Mismatch','Declared','Not comparable','Failed','Differs from reference'], engines.map(engine=>{const t=data.nativeRendering.totals[engine];return [name(engine),t.match,t.mismatch,t.declared,t.notComparable,t.failed,t.referenceDisagreements]}))
  }
  const declarations = select('declarations'); declarations.replaceChildren()
  for (const d of data.declarations ?? []) {
    const item = node('li'), link = node('a', 'Reference')
    if (typeof d.reference === 'string' && URL.canParse(d.reference) && new URL(d.reference).protocol === 'https:') link.href = d.reference
    item.append(node('span', `${d.reason} `), link, node('span', ` · ${engines.map(engine => `${name(engine)}: ${d.declared[engine]} declared examples`).join(' · ')}`))
    for (const kind of ['stale','insufficient']) for (const engine of engines) {
      if (d[kind][engine]?.length) item.append(node('span', ` · ${name(engine)} ${kind}: examples ${d[kind][engine].join(', ')}`))
    }
    declarations.append(item)
  }
  if (!declarations.children.length) declarations.append(node('li', 'No declared rendering differences.'))
  const baselineNote = select('baseline-note')
  if (baselineNote) baselineNote.hidden = baselines.length === 0
  const disagreements = select('disagreements'); disagreements.replaceChildren()
  for (const row of data.reportDisagreements ?? []) {
    const item = node('li'), link = node('a', `Example ${row.example}`)
    setLink(link, row)
    item.append(link, node('span', ` · ${row.section} · ${engines.map(engine => `${name(engine)}: ${row.classes[engine]} (codes: ${row.codes[engine].join(', ') || 'None'})`).join(' · ')}`))
    disagreements.append(item)
  }
  if (!disagreements.children.length) disagreements.append(node('li', 'No report class disagreements among the selected engines.'))
  select('silent').textContent = `Silent losses with clean reports: ${engines.map(engine => `${name(engine)} ${data.totals[engine].mismatchByReport.clean}`).join(' · ')}`
  suiteTable(`#${id}-sections`, `Matches / comparable examples by ${sectionLabel}`, [id === 'djot' ? 'File' : 'Section',...engines.map(name),...baselines.map(() => baselineName)], data.sections.map(s => [s.section,...engines.map(engine => { const t = s.results[engine]; return `${t.match}/${t.match + t.mismatch + t.declared}` }),...baselines.map(([baseline]) => { const t = s.baselines[baseline]; return `${t.match}/${t.match + t.mismatch}` })]))
  const filter = select('engine-filter')
  for (const engine of engines) { const option = node('option', name(engine)); option.value = engine; filter.append(option) }
  const controls = node('div', undefined, 'filters')
  const makeSelect = (label, values, key) => {
    const input = node('select'), wrapper = node('label', label)
    for (const [value,text] of values) { const option = node('option',text); option.value = value; input.append(option) }
    input.dataset.key = key; input.setAttribute('aria-label', `${label} (${labelPrefix})`)
    wrapper.append(input); controls.append(wrapper); return input
  }
  const labelPrefix = id === 'djot' ? 'Djot' : 'CommonMark'
  const status = makeSelect('Import outcome', [['','All outcomes'], ...['match','mismatch','declared','not-comparable','failed'].map(v=>[v,v])], 'outcome')
  const assessment = makeSelect('Diagnostic assessment', [['','All assessments'], ...outcomes.map(v=>[v,v])], 'assessment')
  const section = makeSelect(sectionLabel, [['','All sections'], ...data.sections.map(v=>[v.section,v.section])], 'section')
  const search = node('input'); search.type = 'search'; search.setAttribute('aria-label', `Search examples (${labelPrefix})`); const searchLabel = node('label','Example or diagnostic'); searchLabel.append(search); controls.append(searchLabel)
  select('examples').before(controls)
  const provenance = node('details'); provenance.append(node('summary','Import measurement pins, date and rendering scope'), node('pre',JSON.stringify({generatedAt:data.generatedAt,suiteRevision:data.suiteRevision,engines:data.engines,referenceRenderer:data.renderer,nativeRendering:data.nativeRendering ?? 'Not measured in this archived report'},null,2))); controls.before(provenance)
  const query = new URL(location.href).searchParams
  if(query.get('suite') === id) {
    restoreSelect(filter, query.get('importFilter') ?? (query.has('example') ? '' : query.get('importEngine'))); restoreSelect(status, query.get('outcome')); restoreSelect(assessment, query.get('assessment') === 'false-loss' ? 'unverified-loss' : query.get('assessment')); restoreSelect(section, query.get('section')); search.value = query.get('importQ') ?? ''
  }
  let limit = 30, selectionVersion = 0
  const issueQueue = node('details'); issueQueue.append(node('summary','Findings grouped by section and diagnostic assessment'))
  const queue = node('ul')
  const groups = new Map()
  for(const row of data.rows.filter(r => r.status === 'mismatch' || r.status === 'failed' || r.honesty === 'unverified-loss')) {
    const key = `${row.section} / ${row.honesty ?? row.status}`; if(!groups.has(key)) groups.set(key,[]); groups.get(key).push(row)
  }
  for(const [key,rows] of groups) {
    const item = node('li'), button = node('button',`${key}: ${new Set(rows.map(r=>r.example)).size} examples`); button.type = 'button'
    button.addEventListener('click',()=>{ filter.value=''; search.value=''; section.value=rows[0].section; assessment.value=rows[0].honesty ?? ''; status.value=rows[0].honesty==='unverified-loss'?'':rows[0].status; limit=30; updateSelection(); renderExamples(); select('examples').scrollIntoView() }); item.append(button); queue.append(item)
  }
  issueQueue.append(queue); controls.before(issueQueue)
  const renderExamples = () => {
    const version = ++selectionVersion, list = select('examples'); list.replaceChildren()
    const q = search.value.toLowerCase().trim()
    const rows = data.rows.filter(r => (!filter.value || r.engine === filter.value) && (!status.value || r.status === status.value) && (!assessment.value || r.honesty === assessment.value) && (!section.value || r.section === section.value) && (!q || `${r.example} ${r.section} ${(r.diagnostics??[]).map(d=>`${d.code} ${d.message??''}`).join(' ')}`.toLowerCase().includes(q)))
    select('count').textContent = `${new Set(rows.map(row=>row.example)).size} examples (${rows.length} engine observations) in this selection; showing ${Math.min(rows.length,limit)} observations`
    let visible = rows.slice(0,limit)
    const liveQuery = new URL(location.href).searchParams
    const linked = liveQuery.get('suite')===id ? rows.find(r => String(r.example)===liveQuery.get('example') && r.engine === liveQuery.get('importEngine')) : null
    if(linked && !visible.includes(linked)) visible = [...visible,linked]
    for (const row of visible) {
      const item = node('li'), details = node('details'), summary = node('summary', `${name(row.engine)} · Example ${row.example} · ${row.section} · ${row.status}`), link = node('a', `${label} example ${row.example}`)
      setLink(link,row); details.append(summary,link)
      let loaded = false
      details.addEventListener('toggle', async () => {
        if(!details.open) return
        updateQuery({suite:id,example:row.example,importEngine:row.engine,importFilter:filter.value || 'all',outcome:status.value,assessment:assessment.value,section:section.value,importQ:search.value})
        if(loaded) return
        loaded = true
        const panes = node('div',undefined,'detail-panes'); panes.append(node('p','Loading example evidence…')); details.append(panes)
        try {
          const evidence = row.evidenceUrl ? await fetchJson(row.evidenceUrl) : row
          if(version !== selectionVersion || !details.isConnected) return
          panes.replaceChildren(copyButton('Copy source',evidence[sourceKey]),copyButton('Copy link',()=>{const url=new URL(location.href);for(const [key,value] of Object.entries({suite:id,example:row.example,importEngine:row.engine,importFilter:filter.value || 'all',outcome:status.value,assessment:assessment.value,section:section.value,importQ:search.value})){if(value==='')url.searchParams.delete(key);else url.searchParams.set(key,value)}url.hash=id;return url.href}),pane(sourceLabel,evidence[sourceKey],true),pane('Expected HTML',evidence.expectedHtml,true),pane('Carve output',evidence.carve,true),pane('Reference rendered HTML',evidence.carveHtml,true),pane('Diagnostics',evidence.diagnostics??[],true))
          if(evidence.error) panes.prepend(node('p',evidence.error))
          panes.append(node('p',`Report class: ${evidence.reportClass}. Diagnostic assessment: ${evidence.honesty ?? 'not assessed'}.`))
          if(evidence.comparison) panes.append(pane('Reference structural changes at JSON paths', structuralDiff(evidence.comparison.expected,evidence.comparison.actual),true))
          if(evidence.nativeHtml!==undefined) panes.append(pane('Native rendered HTML',evidence.nativeHtml,true),pane('Native renderer comparison',evidence.nativeComparison,true))
          else panes.append(node('p','Native rendering was not measured in this archived report.'))
          panes.append(pane('Reproduce this import suite', `npm run compat:${id==='djot'?'djot':'commonmark'} -- --engines=${row.engine} --report=/tmp/${id}.json`))
        } catch(error) { panes.replaceChildren(node('p',error.message)); loaded=false }
      })
      if(linked === row) details.open = true
      item.append(details); list.append(item)
    }
    if(!rows.length) list.append(node('li','No examples match these filters.'))
    if(rows.length>limit) { const item=node('li'), more=node('button','Show 30 more examples'); more.type='button';more.onclick=()=>{limit+=30;renderExamples()};item.append(more);list.append(item) }
  }
  const updateSelection = () => updateQuery({suite:id,example:null,importEngine:null,importFilter:filter.value || 'all',outcome:status.value,assessment:assessment.value,section:section.value,importQ:search.value})
  for(const input of [filter,status,assessment,section,search]) input.addEventListener(input===search?'input':'change',()=>{
    limit=30; updateSelection();renderExamples()
  })
  renderExamples()
  select('note').hidden = true; select('results').hidden = false
}
const loadedSuites = new Set()
async function loadHtmlSuite(config) {
  if(loadedSuites.has(config.id)) return; loadedSuites.add(config.id)
  const note = $(`#${config.id}-note`)
  try {
    const response = await fetch(`${config.id}-summary.json`, {cache:'no-store'})
    if (response.status === 404) { note.textContent = 'Not measured in this report.'; return }
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    fillHtmlSuite(await response.json(), config)
  } catch (error) { note.textContent = `${config.label} report could not be loaded: ${error.message}` }
}
const suites = [{id:'commonmark',kind:'commonmark-spec',label:'CommonMark',sourceKey:'markdown',sourceLabel:'Markdown',sectionLabel:'spec section'}, {id:'djot',kind:'djot-tests',label:'Djot',sourceKey:'source',sourceLabel:'Djot',sectionLabel:'file'}]
const suiteObserver = new IntersectionObserver(entries => { for(const entry of entries) if(entry.isIntersecting) { suiteObserver.unobserve(entry.target); const config = suites.find(s=>s.id===entry.target.id); void loadHtmlSuite(config); } }, {rootMargin:'300px'})
for(const config of suites) suiteObserver.observe($(`#${config.id}`))
const loadLinkedSuite = () => { const config = suites.find(s => location.hash === `#${s.id}` || new URL(location.href).searchParams.get('suite') === s.id); if(config) void loadHtmlSuite(config) }
addEventListener('hashchange',loadLinkedSuite);loadLinkedSuite()
try {
  const [data, manifest] = await Promise.all([fetchJson('matrix.json'), fetchJson('manifest.json')])
  if (data.schemaVersion !== 1 || !Array.isArray(data.rows) || !data.generatedAt) throw new Error('Unsupported or incomplete report')
  if (!Array.isArray(manifest.tools) || !manifest.tools.length) throw new Error('Unsupported or incomplete manifest')
  report = data; tools = manifest.tools; fillOverview(manifest)
  const query = new URL(location.href).searchParams
  for (const selector of ['#search', '#tool-filter', '#kind-filter', '#status-filter', '#engine-filter']) $(selector).addEventListener(selector === '#search' ? 'input' : 'change', () => { closeDetail(); renderMatrix() })
  $('#reset').addEventListener('click', () => { closeDetail(); for (const selector of ['#search', '#tool-filter', '#kind-filter', '#status-filter']) $(selector).value = ''; restoreSelect($('#engine-filter'),'javascript'); if(!$('#engine-filter').value) $('#engine-filter').selectedIndex=0; renderMatrix() })
  $('#close-detail').addEventListener('click', closeDetail); document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#detail').hidden) closeDetail() })
  for(const [selector,key] of [['#tool-filter','target'],['#kind-filter','type'],['#status-filter','status']]) restoreSelect($(selector),query.get(key)); $('#search').value=query.get('q')??'';
  if(query.get('engine') && [...$('#engine-filter').options].some(o=>o.value===query.get('engine')))$('#engine-filter').value=query.get('engine')
  renderMatrix()
  const initial = report.rows.find(r => r.case === query.get('case') && r.tool === query.get('tool') && r.kind === query.get('kind') && (r.engine??'javascript')===$('#engine-filter').value)
  if (initial) showDetail(initial, [...$('#matrix tbody').querySelectorAll('button')].find(b => b.dataset.case === initial.case && b.dataset.tool === initial.tool && b.dataset.kind === initial.kind))
} catch (error) {
  $('#run-status').textContent = 'Report unavailable'; $('#load-error').hidden = false; $('#load-error').textContent = `The measured report could not be loaded: ${error.message}. Use the GitHub run artifacts to inspect the evidence.`
}

let sourceLoaded = false
async function loadSourceAgreement() {
  if(sourceLoaded) return; sourceLoaded=true
  const note=$('#source-note'), target=$('#source-results')
  try {
    const data=await fetchJson('source-agreement-summary.json')
    const family=node('select'), choice=node('select'), results=node('div'), controls=node('div',undefined,'filters')
    const label=(title,input)=>{const el=node('label',title);el.append(input);return el}
    family.setAttribute('aria-label','Generated source family'); choice.setAttribute('aria-label','Generated source case')
    const all=node('option','All families');all.value='';family.append(all)
    for(const value of [...new Set(data.rows.map(r=>r.family))]) {const option=node('option',value);option.value=value;family.append(option)}
    restoreSelect(family,new URL(location.href).searchParams.get('sourceFamily'))
    controls.append(label('Family',family),label('Case',choice)); target.append(node('p',`${data.rows.length} sources; seed ${data.seed}; ${data.rows.filter(r=>r.semanticAgreement).length} semantic agreements.`),node('p',data.scope),pane('Pins and measurement date',{engines:data.engines,generatedAt:data.generatedAt,suiteSha256:data.suiteSha256}),controls,results)
    const findings=data.rows.filter(row=>!row.semanticAgreement || Object.values(row.results).some(r=>r.error || !r.schemaValid || !r.positions.sourceByteLengthMatches || r.positions.invalid.length))
    const findingsList=node('details');findingsList.append(node('summary',`${findings.length} sources with structural, byte-length or validation findings`))
    for(const row of findings) {const button=node('button',row.id);button.type='button';button.onclick=()=>{family.value='';renderChoices();choice.value=row.id;show()};findingsList.append(button)}
    controls.before(findingsList)
    let version=0
    const show=async()=>{
      const current=++version,row=data.rows.find(r=>r.id===choice.value);results.replaceChildren();if(!row)return
      updateQuery({sourceCase:row.id,sourceFamily:family.value})
      try {
        const full=await fetchJson(row.evidenceUrl);if(current!==version)return
        results.append(copyButton('Copy source',full.source),copyButton('Copy link',()=>{const url=new URL(location.href);url.hash='source-agreement';return url.href}),pane('Carve source',full.source,true),pane('Reproduce the generated suite',`npm run compat:source-agreement -- --report=/tmp/source-agreement.json`))
        for(const [engine,result]of Object.entries(full.results)) results.append(pane(`${engine}: position availability, byte length and schema`,{positions:result.positions,schemaValid:result.schemaValid,schemaErrors:result.schemaErrors,error:result.error},true),pane(`${engine}: full AST`,result.ast),pane(`${engine}: rendered HTML`,result.html))
        for(const [engine,diff]of Object.entries(full.differences)) results.append(pane(`${engine}: semantic changes at JSON paths`,diff.semantic,true),pane(`${engine}: full AST and position changes`,diff.positioned))
      }catch(error){results.append(node('p',error.message))}
    }
    const renderChoices=()=>{
      choice.replaceChildren();for(const row of data.rows.filter(r=>!family.value || r.family===family.value)){const option=node('option',row.id);option.value=row.id;choice.append(option)}
      restoreSelect(choice,new URL(location.href).searchParams.get('sourceCase'));show()
    }
    family.onchange=renderChoices;choice.onchange=show;renderChoices();note.hidden=true;target.hidden=false
  }catch(error){note.textContent=`Generated-source evidence unavailable: ${error.message}`}
}
const sourceObserver=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){sourceObserver.disconnect();void loadSourceAgreement()}},{rootMargin:'300px'})
sourceObserver.observe($('#source-agreement'))
addEventListener('hashchange',()=>{if(location.hash === '#source-agreement') void loadSourceAgreement()})
if(location.hash === '#source-agreement') { sourceObserver.disconnect(); void loadSourceAgreement() }
