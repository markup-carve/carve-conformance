import assert from 'node:assert/strict'
import { adapters, blocks, unwrap } from './adapters.mjs'
import { paragraphs, fragments, wrappers, references, suffixes } from '../../tests/comparison/fixtures.mjs'

export const contracts = {
  'eligible-prose-wrap': 'Replace one ASCII word separator in the authored eligible prose fixtures with a newline. Excludes code spans, escapes, hard breaks, structural line starts and destination bytes. Compare projected block content.',
  'closed-block-append': 'Append a tested block after an explicit heading boundary. Compare the original projected blocks, excluding document-level section growth and generated IDs.',
  'reference-classification': 'Add or replace a matching reference definition. Compare the first paragraph with resolved destinations and titles omitted. Carve and Djot preserve reference syntax; CommonMark matching definitions can change text into links.',
  'nonreference-control': 'Inline links and code spans contain no reference to resolve; adding or replacing a reference definition must leave their projected first paragraph unchanged.',
  'nested-container-payload': 'Wrap a fragment in one-item lists and quotes with authored indentation, then remove exactly those wrappers. Compare the projected payload; this does not claim arbitrary definition scoping.',
}
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
export function collectContracts() {
  const rows = []
  for (const reader of Object.keys(adapters)) {
    const compare = (family, id, before, after, expected, transform = x => x, options = {}) => {
      const left = blocks(reader, before, options), right = transform(blocks(reader, after, options), left.length)
      rows.push({ reader, family, id, before, after, expected, outcome: equal(left, right) ? 'equal' : 'different', left, right })
    }
    for (const name of ['prose', 'unicode', 'strong', 'emphasis', 'link', 'reference']) {
      const source = paragraphs[name][reader]
      for (let at = 0; at < source.length; at++) if (source[at] === ' ') compare('eligible-prose-wrap', `${name}@${at}`, source + '\n', source.slice(0, at) + '\n' + source.slice(at + 1) + '\n', 'equal')
    }
    for (const [name, fragment] of Object.entries(fragments)) for (const [tail, suffix] of Object.entries(suffixes)) {
      const before = fragment[reader] + '\n# Boundary\n\n'
      compare('closed-block-append', `${name}/${tail}`, before, before + suffix, 'equal', (right, n) => right.slice(0, n))
    }
    for (const [name, source] of Object.entries(references)) for (const changed of [false, true]) {
      compare(['inline', 'code'].includes(name) ? 'nonreference-control' : 'reference-classification', `${name}/${changed ? 'replace' : 'add'}`, source + (changed ? '\n[ref]: /one\n' : ''), source + '\n[ref]: /two\n', reader === 'commonmark' && !changed && ['full', 'collapsed'].includes(name) ? 'different' : 'equal', right => right.slice(0, 1), { locality: true })
    }
    for (const [name, fragment] of Object.entries(fragments)) for (const depth of [2, 4, 8]) for (const shape of ['quotes', 'lists', 'mixed']) {
      let source = fragment[reader], path = []
      for (let i = 0; i < depth; i++) {
        const wrapper = wrappers[shape === 'quotes' || (shape === 'mixed' && i % 2 === 0) ? 'quote' : 'list']
        source = wrapper.wrap(source); path = [...wrapper.path, ...path]
      }
      compare('nested-container-payload', `${name}/${shape}/${depth}`, fragment[reader], source, 'equal', right => unwrap(right, path))
    }
  }
  assert.equal(new Set(rows.map(r => `${r.reader}/${r.family}/${r.id}`)).size, rows.length)
  return rows
}
