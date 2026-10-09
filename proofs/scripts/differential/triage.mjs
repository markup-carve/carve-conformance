import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { expandedCorpus } from '../../tests/differential/corpus.mjs'
import { nativeBatch } from './batch.mjs'
import { reduce } from './reduce.mjs'
import { environment, binary, jsModule, jsPin, render } from './environment.mjs'
import { pin as nativePin } from '../djot-v/environment.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const withoutIds = html => html.replace(/ id="[^"]*"/g, '')

// These diagnostic comparisons identify deltas; they do not redefine HTML agreement.
export function classify(source, js, native) {
  if (js === native) return null
  if (/<img alt="[^"]+">/.test(native) && native.replace(/<img alt="[^"]*">/g, '<img>') === js) return 'unresolved-image-alt'
  const label = source.match(/\[[^\]\n]+\]\[[^\n]*?\\\]([^\]\n]*\])/)
  if (label && withoutIds(native.replace('</a>' + escape(label[1]), '</a>')) === withoutIds(js))
    return 'escaped-reference-close'
  if (/\{[^}\n]*\n[^\n]*>/.test(source) && js.replace(/&gt; */g, '') === native)
    return 'block-attribute-recovery'
  const smartIds = js.replace(/ id="([^"]*)"/g, (_, id) => ` id="${id.replaceAll('&quot;', '“').replaceAll("'", '’')}"`)
  if (smartIds === native) return 'smart-punctuation-id'
  return 'unclassified'
}

export function controlFor(source, family) {
  if (family === 'escaped-reference-close') return source.replace('\\]', '')
  if (family === 'block-attribute-recovery') return source.replace('{#same\n', '{#same}\n')
  if (family === 'smart-punctuation-id') return source.replace('"', '\\"')
  if (family === 'unresolved-image-alt') {
    const labels = [...source.matchAll(/!\[([^\]\n]*)\]\[([^\]\n]*)\]/g)].map(match => match[2] || match[1])
    assert.ok(labels.length > 0, 'Missing image label for control')
    return source + '\n' + [...new Set(labels)].map(label => `[${label}]: /triage\n`).join('\n')
  }
  throw new Error('Unknown triage family')
}

export async function runTriage() {
  environment()
  const parser = (await import(pathToFileURL(jsModule))).default
  const baselineBytes = readFileSync(root + 'reports/djot-differential.json')
  const baseline = JSON.parse(baselineBytes)
  assert.deepEqual(baseline.metadata.jsCurrent, jsPin)
  assert.deepEqual(baseline.metadata.native, nativePin)
  const inputs = expandedCorpus(), native = nativeBatch(binary, inputs.map(row => row.source))
  const observations = new Map()
  const observe = sources => {
    const missing = [...new Set(sources)].filter(source => !observations.has(source))
    const outputs = nativeBatch(binary, missing)
    missing.forEach((source, i) => {
      const js = render(parser, source), ocaml = outputs[i]
      observations.set(source, { jsCurrent: js, ocaml, family: classify(source, js, ocaml) })
    })
    return sources.map(source => observations.get(source))
  }
  const differences = []
  for (const [i, row] of inputs.entries()) {
    const jsCurrent = render(parser, row.source), ocaml = native[i]
    observations.set(row.source, { jsCurrent, ocaml, family: classify(row.source, jsCurrent, ocaml) })
    if (jsCurrent !== ocaml) differences.push({ ...row, jsCurrent, ocaml })
  }
  assert.deepEqual(differences, baseline.differences.filter(row => row.jsCurrent !== row.ocaml)
    .map(({ id, source, jsCurrent, ocaml }) => ({ id, source, jsCurrent, ocaml })))
  const focused = JSON.parse(readFileSync(root + 'tests/differential/triage-cases.json'))
  const focusedOutputs = observe(focused.map(row => row.source))
  focused.forEach((row, i) => assert.deepEqual(focusedOutputs[i], {
    jsCurrent: row.jsCurrent, ocaml: row.ocaml, family: row.family,
  }, row.id))
  const rows = [], counts = {}
  for (const [i, row] of differences.entries()) {
    const family = observations.get(row.source).family
    assert.notEqual(family, 'unclassified', row.id)
    const controlSource = controlFor(row.source, family), control = observe([controlSource])[0]
    assert.notEqual(controlSource, row.source, `${row.id}: unchanged control`)
    assert.equal(control.jsCurrent, control.ocaml, `${row.id}: intervention did not remove the difference`)
    const reduced = reduce(row.source, sources => observe(sources).map(item => item.family === family))
    const observation = observe([reduced.source])[0]
    rows.push({ id: row.id, family, originalSha256: hash(row.source), control: { sourceSha256: hash(controlSource), htmlSha256: hash(control.ocaml), agreement: true }, ...reduced, minimality: 'No single-character deletion keeps the same diagnostic family.',
      jsCurrent: observation.jsCurrent, ocaml: observation.ocaml })
    counts[family] = (counts[family] ?? 0) + 1
    if ((i + 1) % 50 === 0) console.log(`Reduced ${i + 1}/${differences.length}`)
  }
  const sources = ['scripts/differential/triage.mjs', 'scripts/differential/reduce.mjs', 'scripts/differential/batch.mjs', 'scripts/differential/environment.mjs', 'tests/differential/corpus.mjs', 'tests/differential/triage-cases.json']
  return { metadata: { native: nativePin, jsCurrent: jsPin, baselineSha256: hash(baselineBytes),
    sourceHashes: Object.fromEntries(sources.map(path => [path, hash(readFileSync(root + path))])),
    method: 'Replay the unchanged corpus, classify exact HTML deltas, then delete characters while preserving the same family. Every final one-character deletion is checked. Diagnostic comparisons do not replace exact HTML agreement.' },
    counts: { inputs: inputs.length, differences: rows.length, families: counts,
      distinctReducedSources: new Set(rows.map(row => row.source)).size, agreeingControls: rows.length }, focused, rows }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { output: { type: 'string' }, check: { type: 'string' } } })
  const evidence = await runTriage()
  if (values.check) assert.deepEqual(evidence, JSON.parse(readFileSync(values.check)))
  if (values.output) writeFileSync(values.output, JSON.stringify(evidence, null, 2) + '\n')
  console.log(evidence.counts)
}
