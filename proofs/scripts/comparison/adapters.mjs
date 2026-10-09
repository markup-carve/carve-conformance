import assert from 'node:assert/strict'
import * as carve from 'carve-comparison'
import * as djot from '@djot/djot'
import * as commonmark from 'commonmark'

const cmParser = new commonmark.Parser()
const cmRenderer = new commonmark.HtmlRenderer()
export const adapters = {
  carve: { parse: carve.parse, render: carve.renderHtml, html: carve.carveToHtml },
  djot: { parse: djot.parse, render: djot.renderHTML, html: s => djot.renderHTML(djot.parse(s)) },
  commonmark: { parse: s => cmParser.parse(s), render: d => cmRenderer.render(d), html: s => cmRenderer.render(cmParser.parse(s)) },
}
const names = { document: 'doc', paragraph: 'para', text: 'text', str: 'text', emph: 'emphasis', em: 'emphasis',
  blockquote: 'quote', block_quote: 'quote', bullet_list: 'list', ordered_list: 'list', item: 'list_item',
  softbreak: 'soft_break', linebreak: 'hard_break', verbatim: 'code', thematic_break: 'thematic_break' }
function children(n, reader) {
  if (reader !== 'commonmark') return n.items ?? n.children ?? []
  const result = []
  for (let c = n.firstChild; c; c = c.next) result.push(c)
  return result
}
export function project(node, reader, { locality = false } = {}) {
  const raw = node.tag ?? node.type
  const type = names[raw] ?? raw
  const kids = () => projectBlocks(children(node, reader), reader, { locality })
  if (type === 'doc' || type === 'section') return { type, children: kids() }
  if (type === 'soft_break') return { type: 'text', value: ' ' }
  if (type === 'text') return { type, value: node.value ?? node.text ?? node.literal }
  if (['code', 'code_block'].includes(type)) return { type, value: node.value ?? node.text ?? node.literal, ...(type === 'code_block' ? { language: node.language ?? node.lang ?? node.info ?? '' } : {}) }
  if (['hard_break', 'thematic_break'].includes(type)) return { type }
  const result = { type, children: kids() }
  if (type === 'heading') result.level = node.level
  else if (type === 'list') {
    result.ordered = reader === 'commonmark' ? node.listType === 'ordered' : raw === 'ordered_list' || node.ordered === true
    result.tight = reader === 'commonmark' ? node.listTight : node.tight
    if (result.ordered) result.start = node.start ?? node.listStart ?? 1
  } else if (['link', 'image'].includes(type)) {
    const ref = node.ref ?? node.reference
    if (ref !== undefined) result.reference = ref
    if (!locality) {
      result.destination = node.href ?? node.src ?? node.destination ?? ''
      result.title = node.title ?? ''
    }
    if (type === 'image' && node.alt !== undefined) result.alt = node.alt
  } else assert.ok(['para', 'strong', 'emphasis', 'quote', 'list_item'].includes(type), `Unsupported ${reader} node: ${type}`)
  if (node.attrs || node.attributes) result.attributes = node.attrs ?? node.attributes
  return result
}
export function projectBlocks(nodes, reader, options = {}) {
  const result = []
  for (const node of nodes) {
    if (node.type === 'link_reference_definition') continue
    const p = project(node, reader, options)
    const additions = p.type === 'section' ? p.children : [p]
    for (const item of additions) {
      const last = result.at(-1)
      if (last?.type === 'text' && item.type === 'text') last.value += item.value
      else result.push(item)
    }
  }
  return result
}
export function blocks(reader, source, options) { return project(adapters[reader].parse(source), reader, options).children }
export function unwrap(nodes, path) {
  for (const kind of path) {
    assert.equal(nodes.length, 1, 'Expected exactly one wrapper')
    assert.equal(nodes[0].type, kind)
    nodes = nodes[0].children
    if (kind === 'list') { assert.equal(nodes.length, 1); assert.equal(nodes[0].type, 'list_item'); nodes = nodes[0].children }
  }
  return nodes
}
export function nestingDepth(reader, source, kind) {
  let nodes = blocks(reader, source), depth = 0
  while (nodes.length === 1 && nodes[0].type === kind) { nodes = unwrap(nodes, [kind]); depth++ }
  assert.equal(nodes.length, 1); assert.equal(nodes[0].type, 'para')
  assert.deepEqual(nodes[0].children, [{ type: 'text', value: 'end' }])
  return depth
}
