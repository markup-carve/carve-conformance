import assert from 'node:assert/strict'
import { parseArgs } from 'node:util'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { parse as parseJs, carveToHtml } from '@markup-carve/carve'
import { parse as parseSpec } from '../spec/scripts/spec/layout.mjs'
import { renderDoc } from '../spec/scripts/spec/html.mjs'
import { normalize } from './properties/normalize.mjs'
import { paragraphs, fragments, wrappers, references, completed, suffixes, lookaheadControls } from './properties/cases.mjs'
import { evidenceEnvironment } from './evidence-environment.mjs'
import { validateSpecPins } from './spec-pins.mjs'

const readers = { js: { parse: parseJs, blocks: d => d.children.filter(n => n.type !== 'link_reference_definition') }, spec: { parse: parseSpec, blocks: d => d.blocks } }
function definitions(doc, reader) {
  return reader === 'js'
    ? { links: doc.children.filter(n => n.type === 'link_reference_definition'), footnotes: doc.footnoteDefs ?? {}, abbreviations: doc.abbrDefs ?? {} }
    : { links: doc.linkDefs, footnotes: doc.footnoteDefs, abbreviations: doc.abbrDefs }
}
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

export function unwrap(blocks, path, reader) {
  for (const part of path) {
    assert.equal(blocks.length, 1, 'Wrapper must contain exactly one outer block')
    const block = blocks[0]
    if (part === 'quote') {
      assert.equal(reader === 'js' ? block.type : block.t, reader === 'js' ? 'block_quote' : 'quote')
      blocks = block.children
    } else {
      assert.equal(reader === 'js' ? block.type : block.t, 'list')
      assert.equal(block.items.length, 1)
      blocks = reader === 'js' ? block.items[0].children : block.items[0].blocks
    }
  }
  return blocks
}

export function referenceParagraph(html) {
  const paragraph = html.match(/<p(?:\s[^>]*)?>[\s\S]*?<\/p>/)?.[0]
  assert.ok(paragraph, 'Reference control requires its source paragraph')
  return paragraph
}

export function collectProperties() {
  validateSpecPins()
  const rows = []
  function compare(family, id, reader, before, after, transform = blocks => blocks, expected = 'equal', referenceSyntax = false) {
    const r = readers[reader]
    let left, right
    try {
      const beforeDoc = r.parse(before), afterDoc = r.parse(after)
      left = normalize(r.blocks(beforeDoc), { referenceSyntax })
      right = normalize(transform(r.blocks(afterDoc), left.length), { referenceSyntax })
      if (family === 'containers') {
        left = { blocks: left, definitions: normalize(definitions(beforeDoc, reader)) }
        right = { blocks: right, definitions: normalize(definitions(afterDoc, reader)) }
      }
      const equal = same(left, right)
      rows.push({ family, id, reader, expected, outcome: equal ? 'equal' : 'different', leftHash: hash(left), rightHash: hash(right), before, after,
        ...(equal ? {} : { left, right }) })
    } catch (error) {
      rows.push({ family, id, reader, expected, outcome: 'error', error: error.message, before, after })
    }
  }
  for (const [name, source] of Object.entries(paragraphs)) {
    for (let i = 0; i < source.length; i++) if (source[i] === ' ') {
      for (const reader of Object.keys(readers)) compare('wrapping', `${name}@${i}`, reader, source + '\n', source.slice(0, i) + '\n' + source.slice(i + 1) + '\n')
    }
  }
  for (const [name, source] of Object.entries(fragments)) {
    for (const [wrapper, { wrap, path }] of Object.entries(wrappers)) {
      for (const reader of Object.keys(readers)) compare('containers', `${name}/${wrapper}`, reader, source, wrap(source), blocks => unwrap(blocks, path, reader))
    }
  }
  for (const [name, { source, definition }] of Object.entries(references)) {
    for (const [variant, defs] of Object.entries({ defined: definition, changed: definition.replace('/target', '/other').replace('/image.png', '/other.png').replace('note content', 'other note'), unrelated: '[unrelated]: /other\n' })) {
      const before = variant === 'changed' ? source + '\n' + definition : source
      const after = source + '\n' + defs
      compare('locality', `${name}/${variant}`, 'js', before, after, blocks => blocks.slice(0, 1), 'equal', true)
      for (const reader of Object.keys(readers)) {
        const render = reader === 'js' ? carveToHtml : s => renderDoc(parseSpec(s))
        const changesReference = ['full', 'collapsed', 'image'].includes(name) && variant !== 'unrelated'
          || name === 'footnote' && variant === 'defined'
        const expected = changesReference ? 'different' : 'equal'
        try {
          const left = referenceParagraph(render(before)), right = referenceParagraph(render(after))
          const target = defs.match(/^\[ref\]: (\S+)/m)?.[1]
          if (['full', 'collapsed'].includes(name)) assert.equal(right.includes('<a href="' + target + '">'), variant !== 'unrelated', 'Reference link target must resolve in the first paragraph')
          if (name === 'image') assert.equal(right.includes('<img src="' + target + '"'), variant !== 'unrelated', 'Image source must resolve in the first paragraph')
          if (name === 'footnote') assert.equal(right.includes('role="doc-noteref"'), variant !== 'unrelated', 'Footnote reference must resolve in the first paragraph')
          rows.push({ family: 'resolution-control', id: `${name}/${variant}`, reader, expected,
            outcome: same(left, right) ? 'equal' : 'different', leftHash: hash(left), rightHash: hash(right), before, after,
            ...(left === right ? {} : { left, right }) })
        } catch (error) {
          rows.push({ family: 'resolution-control', id: `${name}/${variant}`, reader, expected, outcome: 'error', error: error.message, before, after })
        }
      }
    }
  }
  for (const [name, before] of Object.entries(completed)) {
    for (const [suffix, tail] of Object.entries(suffixes)) {
      for (const reader of Object.keys(readers)) compare('stability', `${name}/${suffix}`, reader, before, before + tail, (blocks, n) => blocks.slice(0, n))
    }
  }
  for (const { id, before, after } of lookaheadControls) {
    for (const reader of Object.keys(readers)) compare('lookahead-control', id, reader, before, after, blocks => blocks, 'different')
  }
  return rows
}

export function checkFindings(rows, declarations) {
  assert.ok(rows.length > 0, 'Property population is empty')
  const seen = new Set()
  for (const row of rows) {
    const key = `${row.family}/${row.id}/${row.reader}`
    const known = declarations[key]
    if (row.outcome === row.expected) assert.equal(known, undefined, `${key}: stale finding`)
    else {
      assert.ok(known, `${key}: undeclared ${row.outcome}`)
      assert.ok(['exception', 'failure', 'coverage-gap'].includes(known.classification))
      assert.ok(known.reason)
      assert.equal(row.outcome, known.outcome, `${key}: changed outcome`)
      assert.equal(row.leftHash, known.leftHash, `${key}: changed before tree`)
      assert.equal(row.rightHash, known.rightHash, `${key}: changed after tree`)
      if (row.outcome === 'error') assert.equal(row.error, known.error, `${key}: changed error`)
      seen.add(key)
    }
  }
  assert.deepEqual([...seen].sort(), Object.keys(declarations).sort(), 'Finding refers to a missing case')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = collectProperties()
  const { values } = parseArgs({ options: { output: { type: 'string' }, 'check-artifact': { type: 'string' }, explore: { type: 'boolean', default: false } } })
  const metadata = { generatedAt: new Date().toISOString(), node: process.version, mode: values.explore ? 'exploration' : 'regression', normalizationVersion: 1,
    ...evidenceEnvironment() }
  if (values['check-artifact']) {
    const stored = JSON.parse(readFileSync(values['check-artifact'], 'utf8'))
    assert.deepEqual(JSON.parse(JSON.stringify(rows)), stored.rows, 'Committed property observations are stale')
    for (const field of ['specCommit', 'specDirty', 'engine', 'installedEngine', 'normalizationVersion']) assert.equal(metadata[field], stored.metadata[field], `Stale artifact ${field}`)
  }
  if (values.output) writeFileSync(values.output, JSON.stringify({ metadata, rows }, null, 2) + '\n')
  if (!values.explore) {
    const findings = JSON.parse(readFileSync(new URL('../reports/property-findings.json', import.meta.url), 'utf8'))
    checkFindings(rows, findings)
  }
  const counts = {}
  for (const row of rows) { const key = `${row.family}/${row.reader}`; const c = counts[key] ??= { total: 0, equal: 0, different: 0, error: 0 }; c.total++; c[row.outcome]++ }
  console.log(JSON.stringify(counts, null, 2))
}
