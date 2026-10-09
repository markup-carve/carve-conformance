const READERS = { spec: 'Spec', js: 'JavaScript', php: 'PHP', rs: 'Rust' }
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const $ = id => document.getElementById(id)
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props)
  node.append(...children)
  return node
}
const fmt = n => n.toLocaleString('en-US')
const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const count = n => words[n] ?? fmt(n)

function renderSource(source) {
  const out = $('case-source')
  out.replaceChildren()
  for (const line of source.replace(/\n$/, '').split('\n')) {
    const [, lead, rest] = line.match(/^( *)(.*)$/)
    const spaces = s => [...s].map(() => el('span', { className: 'sp', textContent: ' ' }))
    if (lead) out.append(el('span', { className: 'lead-ws' }, ...spaces(lead)))
    for (const part of rest.split(/( +)/)) out.append(...(part.startsWith(' ') ? spaces(part) : [part]))
    out.append('\n')
  }
}

function renderHtml(html) {
  const out = $('case-html')
  out.replaceChildren()
  for (const part of html.split(/(<[^>]+>)/)) {
    if (part) out.append(part.startsWith('<') ? el('span', { className: 'tag', textContent: part }) : part)
  }
}

let timers = []
function renderReaders(readers) {
  timers.forEach(clearTimeout)
  const list = $('readers')
  list.replaceChildren(...Object.entries(READERS).map(([key, name]) => {
    const item = el('li', { className: 'pending', textContent: name })
    item.dataset.reader = key
    return item
  }))
  const items = [...list.children]
  const agreeing = new Set(readers)
  const settle = (item, i) => {
    const ok = agreeing.has(item.dataset.reader)
    item.className = ok ? '' : 'pending'
    item.title = ok ? 'Same output as every other reader' : 'Not in the agreeing group'
    if (i === items.length - 1) $('case-note').textContent = noteFor(current)
  }
  if (reduceMotion) items.forEach(settle)
  else timers = items.map((item, i) => setTimeout(() => settle(item, i), 140 + i * 120))
}

function noteFor(c) {
  const agreement = c.readers.length === 4 ? 'All four readers agree.' : `${c.readers.length} of 4 readers agree with the spec.`
  return `${c.note} ${agreement}`
}

let specimens = []
let current = null
function show(index) {
  const n = specimens.length
  const i = ((index % n) + n) % n
  current = specimens[i]
  $('case-id').textContent = current.id
  $('case-count').textContent = `${i + 1} / ${n}`
  $('case-note').textContent = ''
  renderSource(current.source)
  renderHtml(current.html)
  renderReaders(current.readers)
  show.index = i
}

function figure(id, value) {
  const dd = $(id)
  dd.textContent = typeof value === 'number' ? fmt(value) : value
  if (value === 0) dd.classList.add('zero')
}

function renderPins(pins) {
  const commit = (sha, repo) => sha
    ? el('a', { href: `https://github.com/markup-carve/${repo}/commit/${sha}` }, el('code', { textContent: sha }))
    : el('span', { className: 'none', textContent: 'not measured' })
  const repos = { Spec: 'carve', JavaScript: 'carve-js', PHP: 'carve-php', Rust: 'carve-rs' }
  let drift = 0
  $('pin-rows').replaceChildren(...pins.map(p => {
    const differs = p.proofs && p.compat && p.proofs !== p.compat
    if (differs) drift++
    return el('tr', { className: differs ? 'differs' : '' },
      el('th', { scope: 'row', textContent: p.reader }),
      el('td', {}, commit(p.proofs, repos[p.reader])),
      el('td', {}, commit(p.compat, repos[p.reader])))
  }))
  if (drift) {
    $('pin-drift').hidden = false
    const shared = pins.filter(p => p.proofs && p.compat).length
    const which = drift === shared ? `All ${count(shared)} readers` : `${fmt(drift)} of ${fmt(shared)} readers`
    $('pin-drift').textContent = `${which} measured by both lanes are pinned at different commits in each. Moving both lanes to one pin per reader is the next step.`
  }
}

async function main() {
  const data = await (await fetch('data/summary.json')).json()
  const { proofs, compat } = data

  figure('f-theorems', proofs.theorems.ownership + proofs.theorems.stack)
  figure('f-cases', proofs.ownershipCases)
  figure('f-disagree', proofs.disagreements)
  $('proofs-prose').append(
    `${proofs.theorems.ownership} theorems describe how indentation decides which container owns a line, and ${proofs.theorems.stack} more cover choosing among candidate frames. Across ${fmt(proofs.ownershipCases)} generated cases the spec and the JavaScript, PHP and Rust readers `,
    el('strong', { textContent: proofs.disagreements === 0 ? 'produce identical HTML' : `disagree on ${proofs.disagreements}` }),
    `, down from ${proofs.disagreementsBefore} disagreements before the ownership fixes.`)

  figure('f-targets', compat.targets.length)
  figure('f-compared', compat.passed + compat.failed)
  figure('f-failed', compat.failed)
  const names = { mdast: 'mdast', hast: 'hast', commonmark: 'commonmark.js', cmark: 'cmark', djot: 'djot.js', docutils: 'Docutils', asciidoctor: 'Asciidoctor', md4c: 'MD4C', pandoc: 'Pandoc' }
  $('targets').replaceChildren(...compat.targets.map(t => el('li', { textContent: names[t] ?? t })))
  const prose = [`Each format is mapped through all ${count(compat.engines.length)} Carve engines: ${fmt(compat.supported)} supported comparisons and ${fmt(compat.loss)} where a loss must be reported with the right diagnostic.`]
  const cm = compat.commonmark?.totals?.javascript
  if (cm) prose.push(` Of the ${fmt(compat.commonmark.examples)} CommonMark spec examples, ${fmt(cm.match)} import to matching structure and ${cm.declared} differ by declaration.`)
  $('compat-prose').append(...prose)

  renderPins(data.pins)
  const rev = $('rev')
  rev.href = `https://github.com/markup-carve/carve-conformance/commit/${data.revision}`
  rev.textContent = `committed evidence at ${data.revision.slice(0, 7)}`

  specimens = data.specimens
  if (specimens.length) show(0)
  $('prev').addEventListener('click', () => show(show.index - 1))
  $('next').addEventListener('click', () => show(show.index + 1))
}

main().catch(error => {
  $('case-note').textContent = `The summary could not be loaded (${error.message}). Open Proofs or Compatibility for the full reports.`
})
