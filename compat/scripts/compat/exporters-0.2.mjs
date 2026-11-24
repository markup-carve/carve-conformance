// Exporters: a 0.2 tree back to each foreign format, reporting every field the format cannot hold.
import { execFileSync } from 'node:child_process'
import { unified } from 'unified'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import rehypeStringify from 'rehype-stringify'
import * as djot from '@djot/djot'
import { pandocAlignment, shiftTableWidth } from './tables.mjs'
import { context, plain } from './trees-0.2.mjs'

const native = (command, args, input) => execFileSync(command, args, { input, encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024 })
const mdWriter = unified().use(remarkGfm).use(remarkStringify)
const hastWriter = unified().use(rehypeStringify)
const groupRows = n => (n.children ?? []).flatMap(g => g.children ?? [])
const ordered = n => n.marker?.kind === 'ordered'
const tight = n => n.spacing === 'tight'
const checkedOf = item => item.task === undefined ? undefined : item.task.mark !== ' '
// Inline content of a cell for formats whose cells hold inline content only; more blocks are a reported loss.
function cellInline(cell, path, ctx, map) {
  const [first, ...rest] = cell.children
  if (!first) return []
  if (first.type === 'cell_paragraph' && !rest.length) return first.children.map((c, k) => map(c, `${path}/children/0/children/${k}`))
  ctx.note(`${path}/children`, 'unsupported-field', 'degraded', `${ctx.tool} table cells hold inline content only; retained the readable text of the cell blocks.`)
  return [map({ type: 'text', value: cell.children.map(plain).join(' ') }, `${path}/children`)]
}

const blockImageOf = n => n.type === 'paragraph' && n.role === 'image' ? n.children.find(c => c.type === 'image') : undefined

export function exportForeign(tool, ast) {
  const ctx = context(tool)
  let source
  if (tool === 'hast') source = hastWriter.stringify(toHast(ast, ctx))
  else if (['mdast', 'commonmark', 'cmark', 'md4c'].includes(tool)) source = mdWriter.stringify(toMdast(ast, ctx))
  else if (tool === 'djot') {
    const tree = toDjot(ast, ctx)
    const hasBreak = n => n.tag === 'hard_break' || n.children?.some(hasBreak)
    if (hasBreak(tree)) {
      ctx.note('', 'foreign-writer-workaround', 'normalized', 'djot.js 0.3.2 cannot serialize hard_break; used the subset writer.')
      source = exportRichSource(tool, ast, ctx)
    } else source = djot.renderDjot(tree)
  } else if (tool === 'pandoc') {
    const command = process.env.CARVE_PANDOC ?? 'pandoc'
    const api = JSON.parse(native(command, ['--from=markdown', '--to=json'], ''))['pandoc-api-version']
    source = native(command, ['--from=json', '--to=markdown-smart-auto_identifiers-simple_tables-multiline_tables-grid_tables', '--wrap=none'], JSON.stringify(toPandoc(ast, api, ctx)))
  } else if (tool === 'docutils' || tool === 'asciidoctor') source = exportRichSource(tool, ast, ctx)
  else throw new Error(`Unknown compatibility tool: ${tool}`)
  return { source, diagnostics: ctx.diagnostics }
}

// Spelling and resolution results the parser adds; no foreign format needs to keep them.
const structural = ['type', 'children', 'pos', 'srcByteLength', 'astVersion', 'stages', 'segments', 'generatedId', 'refForm', 'resolvedAlign', 'resolvedValign']
function exportFields(n, path, ctx, allowed = []) {
  for (const key of Object.keys(n)) {
    if ([...structural, ...allowed].includes(key)) continue
    if (key === 'marker' && n.type === 'list') continue
    if (key === 'role' && n.role === 'image') continue
    if (key === 'number' && n.type === 'footnote_ref') continue
    ctx.note(`${path}/${key}`, 'unsupported-field', 'dropped', `${key} is outside the ${ctx.tool} adapter subset.`)
  }
}
const decimalOnly = (n, path, ctx) => { if (ordered(n) && n.marker.style !== '1') ctx.note(`${path}/marker/style`, 'unsupported-field', 'dropped', 'This export writes decimal ordered lists only.') }

export function toMdast(root, ctx = context('mdast')) {
  const gfm = ctx.tool === 'mdast'
  const map = (n, path) => {
    exportFields(n, path, ctx, ['value', 'level', 'spacing', 'href', 'src', 'alt', 'tooltip', 'syntax', ...(gfm ? ['task', 'key', 'namespace', 'header', 'columns'] : [])])
    if (n.type === 'list') decimalOnly(n, path, ctx)
    const children = () => (n.children ?? []).map((c, i) => map(c, `${path}/children/${i}`))
    if (n.type === 'strike' && !gfm) return { type: 'text', value: plain(ctx.unsupported(n, path)) }
    if (n.type === 'document') return { type: 'root', children: children() }
    if (n.type === 'text') return { type: 'text', value: n.value }
    if (n.type === 'soft_break') return { type: 'text', value: '\n' }
    if (n.type === 'list_item' && gfm) return { type: 'listItem', children: children(), ...(checkedOf(n) === undefined ? {} : { checked: checkedOf(n) }) }
    if (n.type === 'table' && gfm) {
      for (const [i, column] of n.columns.entries()) for (const key of ['width', 'valign']) if (column[key]) ctx.note(`${path}/columns/${i}/${key}`, 'unsupported-field', 'dropped', 'GFM tables cannot retain column widths or vertical alignment.')
      const rows = groupRows(n)
      if (n.children[0]?.type !== 'table_head' || n.children[0].children.length !== 1) ctx.note(`${path}/children`, 'unsupported-field', 'degraded', 'A GFM table has exactly one header row and one body; its first row becomes the header.')
      else if (n.children.length > 2 || n.children.some(g => g.type === 'table_foot')) ctx.note(`${path}/children`, 'unsupported-field', 'degraded', 'A GFM table has one body and no footer.')
      return { type: 'table', align: (rows[0]?.children ?? []).map((_, i) => n.columns[i]?.align ?? n.columns[i]?.resolvedAlign ?? null), children: n.children.flatMap((group, g) => group.children.map((r, i) => ({ type: 'tableRow', children: r.children.map((cell, j) => ({ type: 'tableCell', children: cellInline(cell, `${path}/children/${g}/children/${i}/children/${j}`, ctx, map) })) }))) }
    }
    if (n.type === 'footnote_ref' && gfm) return { type: 'footnoteReference', identifier: n.key }
    if (n.type === 'footnote' && gfm) return { type: 'footnoteDefinition', identifier: n.key, children: children() }
    if (['paragraph', 'strong', 'emphasis', 'block_quote', 'list_item', 'strike'].includes(n.type)) return { type: ({ block_quote: 'blockquote', list_item: 'listItem', strike: 'delete' })[n.type] ?? n.type, children: children() }
    if (n.type === 'heading') return { type: 'heading', depth: n.level, children: children() }
    if (n.type === 'code') return { type: 'inlineCode', value: n.value }
    if (n.type === 'code_block') return { type: 'code', value: n.value.replace(/\n$/, ''), ...(n.syntax ? { lang: n.syntax } : {}) }
    if (n.type === 'link' || n.type === 'image') return { type: n.type, url: n.href ?? n.src, ...(n.tooltip ? { title: n.tooltip } : {}), ...(n.type === 'link' ? { children: children() } : { alt: n.alt }) }
    if (n.type === 'list') return { type: 'list', ordered: ordered(n), start: n.marker.start ?? 1, spread: !tight(n), children: children().map(item => ({ ...item, spread: !tight(n) })) }
    if (n.type === 'hard_break' || n.type === 'thematic_break') return { type: n.type === 'hard_break' ? 'break' : 'thematicBreak' }
    return { type: 'text', value: plain(ctx.unsupported(n, path)) }
  }
  return map(root, '')
}

export function toHast(root, ctx = context('hast')) {
  const element = (tagName, children = [], properties = {}) => ({ type: 'element', tagName, children, properties })
  const properties = a => ({ ...(a?.id ? { id: a.id } : {}), ...(a?.classes ? { className: a.classes } : {}), ...Object.fromEntries(a?.keyValues ?? []) })
  const map = (n, path, inTight = false) => {
    exportFields(n, path, ctx, ['value', 'level', 'spacing', 'href', 'src', 'alt', 'tooltip', 'syntax', 'attrs', 'task', 'header', 'caption', 'columns', 'align', 'valign', 'colspan', 'rowspan', 'span', 'rowHeadColumns', 'key', 'namespace', 'width'])
    if (n.type === 'list') decimalOnly(n, path, ctx)
    const children = () => (n.children ?? []).flatMap((c, i) => map(c, `${path}/children/${i}`, n.type === 'list' ? tight(n) : inTight))
    if (n.type === 'document') return { type: 'root', children: children() }
    if (n.type === 'text') return { type: 'text', value: n.value }
    if (n.type === 'soft_break') return { type: 'text', value: '\n' }
    if (n.type === 'paragraph' && inTight && !n.attrs) return children()
    let out
    const tags = { paragraph: 'p', cell_paragraph: 'p', emphasis: 'em', strong: 'strong', strike: 'del', block_quote: 'blockquote', list_item: 'li', span: 'span', definition_list: 'dl', definition_term: 'dt', definition_description: 'dd', hard_break: 'br', thematic_break: 'hr' }
    if (n.type === 'table') {
      const elements = []
      if (n.caption) elements.push(element('caption', n.caption.children.flatMap((c, i) => map(c, `${path}/caption/children/${i}`))))
      n.columns.forEach((column, i) => exportFields(column, `${path}/columns/${i}`, ctx, ['align', 'valign', 'width']))
      if (n.columns.some(c => c.align || c.valign || c.width)) elements.push(element('colgroup', n.columns.map(c => element('col', [], { style: [c.align ? `text-align: ${c.align}` : '', c.valign ? `vertical-align: ${c.valign}` : '', c.width ? `width: ${shiftTableWidth(c.width, 2)}%` : ''].filter(Boolean).join('; ') }))))
      for (const [i, group] of n.children.entries()) {
        exportFields(group, `${path}/children/${i}`, ctx, ['attrs', 'rowHeadColumns'])
        elements.push(element({ table_head: 'thead', table_body: 'tbody', table_foot: 'tfoot' }[group.type], group.children.map((r, j) => map(r, `${path}/children/${i}/children/${j}`)), properties(group.attrs)))
      }
      out = element('table', elements)
    } else if (n.type === 'table_row') out = element('tr', n.children.flatMap((c, i) => c.span ? [] : [map(c, `${path}/children/${i}`)]))
    else if (n.type === 'table_cell') {
      const inline = n.children.length === 1 && n.children[0].type === 'cell_paragraph'
      out = element(n.header ? 'th' : 'td', (inline ? n.children[0].children : n.children).flatMap((c, i) => map(c, inline ? `${path}/children/0/children/${i}` : `${path}/children/${i}`)), { ...(n.colspan ? { colSpan: n.colspan } : {}), ...(n.rowspan ? { rowSpan: n.rowspan } : {}), ...((n.align || n.valign) ? { style: [n.align ? `text-align: ${n.align}` : '', n.valign ? `vertical-align: ${n.valign}` : ''].filter(Boolean).join('; ') } : {}) })
    }
    else if (tags[n.type]) out = element(tags[n.type], children())
    else if (n.type === 'heading') out = element(`h${n.level}`, children())
    else if (n.type === 'code') out = element('code', [{ type: 'text', value: n.value }])
    else if (n.type === 'code_block') out = element('pre', [element('code', [{ type: 'text', value: n.value }], n.syntax ? { className: [`language-${n.syntax}`] } : {})])
    else if (n.type === 'link') out = element('a', children(), { href: n.href, ...(n.tooltip ? { title: n.tooltip } : {}) })
    else if (n.type === 'image') out = element('img', [], { src: n.src, alt: n.alt, ...(n.tooltip ? { title: n.tooltip } : {}) })
    else if (n.type === 'list') out = element(ordered(n) ? 'ol' : 'ul', children(), ordered(n) && n.marker.start ? { start: n.marker.start } : {})
    else return { type: 'text', value: plain(ctx.unsupported(n, path)) }
    if (n.type === 'list_item' && checkedOf(n) !== undefined) out.children.unshift(element('input', [], { type: 'checkbox', checked: checkedOf(n), disabled: true }), { type: 'text', value: ' ' })
    const cellStyle = n.type === 'table_cell' ? out.properties.style : undefined
    const authoredStyle = n.type === 'table_cell' ? n.attrs?.keyValues?.find(([key]) => key === 'style')?.[1] : undefined
    if (n.attrs) Object.assign(out.properties, properties(n.attrs))
    if (cellStyle || authoredStyle) out.properties.style = [authoredStyle, cellStyle].filter(Boolean).join('; ')
    return out
  }
  return map(root, '')
}

export function toDjot(root, ctx = context('djot')) {
  const map = (n, path) => {
    exportFields(n, path, ctx, ['value', 'level', 'spacing', 'href', 'src', 'alt', 'syntax', 'attrs', 'task', 'key', 'namespace', 'header', 'caption', 'columns', 'align'])
    const children = () => (n.children ?? []).map((c, i) => map(c, `${path}/children/${i}`))
    let out
    if (n.type === 'document') out = { tag: 'doc', references: {}, autoReferences: {}, footnotes: Object.fromEntries(n.children.flatMap((c, i) => c.type === 'footnote' ? [[c.key, map(c, `${path}/children/${i}`)]] : [])), children: n.children.flatMap((c, i) => c.type === 'footnote' ? [] : [map(c, `${path}/children/${i}`)]) }
    else if (n.type === 'footnote') out = { tag: 'footnote', label: n.key, children: children() }
    else if (n.type === 'footnote_ref') out = { tag: 'footnote_reference', text: n.key }
    else if (n.type === 'span') out = { tag: 'span', children: children() }
    else if (n.type === 'soft_break') out = { tag: 'soft_break' }
    else if (n.type === 'table') {
      const rows = groupRows(n), header = rows[0]?.children.length && rows[0].children.every(c => c.header) ? 0 : -1
      const invalid = new Set()
      rows.forEach(row => row.children.forEach((cell, j) => { if (header < 0 ? cell.align : cell.align !== rows[0].children[j]?.align) invalid.add(j) }))
      if (n.children.filter(g => g.type === 'table_body').length > 1 || n.children.some(g => g.type === 'table_foot')) ctx.note(`${path}/children`, 'unsupported-field', 'dropped', 'Djot tables have one body and no footer.')
      const mapped = []
      for (const [g, group] of n.children.entries()) for (const [k, row] of group.children.entries()) {
        const rp = `${path}/children/${g}/children/${k}`
        row.children.forEach((cell, j) => {
          if (cell.align && invalid.has(j)) ctx.note(`${rp}/children/${j}/align`, 'unsupported-field', 'dropped', 'Djot table alignment must be uniform per column and declared by a leading header row.')
          if (cell.header !== row.children.every(c => c.header)) ctx.note(`${rp}/children/${j}/header`, 'unsupported-field', 'dropped', 'Djot header flags apply to a whole row rather than individual cells.')
        })
        mapped.push({ tag: 'row', head: row.children.every(c => c.header), children: row.children.map((cell, j) => ({ tag: 'cell', head: cell.header, align: invalid.has(j) ? 'default' : cell.align ?? 'default', children: cellInline(cell, `${rp}/children/${j}`, ctx, map) })) })
      }
      for (const [j, column] of n.columns.entries()) for (const key of ['align', 'valign', 'width']) if (column[key]) ctx.note(`${path}/columns/${j}/${key}`, 'unsupported-field', 'dropped', 'Djot tables carry alignment on cells, and no column widths.')
      const captionInline = n.caption?.children.length === 1 && n.caption.children[0].type === 'paragraph' ? n.caption.children[0].children : []
      const blockCaption = n.caption && !captionInline.length && n.caption.children.length
      if (blockCaption) ctx.note(`${path}/caption`, 'unsupported-field', 'degraded', 'Djot table captions hold inline content only; retained the readable text of the caption blocks.')
      const caption = blockCaption ? [{ tag: 'str', text: n.caption.children.map(plain).join(' ') }] : captionInline.map((c, i) => map(c, `${path}/caption/children/0/children/${i}`))
      out = { tag: 'table', children: [{ tag: 'caption', children: caption }, ...mapped] }
    }
    else if (n.type === 'definition_list') {
      const entries = []
      for (const [i, item] of n.children.entries()) {
        exportFields(item, `${path}/children/${i}`, ctx)
        if (item.type === 'definition_term') entries.push({ tag: 'definition_list_item', children: [{ tag: 'term', children: item.children.map((c, j) => map(c, `${path}/children/${i}/children/${j}`)) }] })
        else {
          const blocks = item.children.map((c, j) => map(c, `${path}/children/${i}/children/${j}`))
          if (entries.at(-1).children.length > 1) { ctx.note(`${path}/children/${i}`, 'unsupported-field', 'degraded', 'Djot source groups multiple descriptions under one term into a single body.'); entries.at(-1).children[1].children.push(...blocks) }
          else entries.at(-1).children.push({ tag: 'definition', children: blocks })
        }
      }
      out = { tag: 'definition_list', children: entries }
    }
    else if (n.type === 'list_item' && n.task) out = { tag: 'task_list_item', checkbox: checkedOf(n) ? 'checked' : 'unchecked', children: children() }
    else if (n.type === 'text') out = { tag: 'str', text: n.value }
    else if (['paragraph', 'emphasis', 'strong', 'block_quote', 'list_item'].includes(n.type)) out = { tag: ({ paragraph: 'para', emphasis: 'emph' })[n.type] ?? n.type, children: children() }
    else if (n.type === 'heading') out = { tag: 'heading', level: n.level, children: children() }
    else if (n.type === 'code') out = { tag: 'verbatim', text: n.value }
    else if (n.type === 'code_block') out = { tag: 'code_block', text: n.value, ...(n.syntax ? { lang: n.syntax } : {}) }
    else if (n.type === 'link' || n.type === 'image') out = { tag: n.type, destination: n.href ?? n.src, children: n.type === 'image' ? [{ tag: 'str', text: n.alt }] : children() }
    else if (n.type === 'list') out = { tag: n.children.some(i => i.task) ? 'task_list' : ordered(n) ? 'ordered_list' : 'bullet_list', tight: tight(n), style: ordered(n) ? `${n.marker.style}.` : '-', ...(ordered(n) ? { start: n.marker.start ?? 1 } : {}), children: children() }
    else if (n.type === 'hard_break' || n.type === 'thematic_break') out = { tag: n.type }
    else out = { tag: 'str', text: plain(ctx.unsupported(n, path)) }
    if (n.attrs && ['footnote', 'table_row', 'table_cell'].includes(n.type)) ctx.note(`${path}/attrs`, 'unsupported-field', 'dropped', 'Djot footnote, row and cell attributes are outside this export subset.')
    else if (n.attrs) out.attributes = { ...(n.attrs.id ? { id: n.attrs.id } : {}), ...(n.attrs.classes ? { class: n.attrs.classes.join(' ') } : {}), ...Object.fromEntries(n.attrs.keyValues ?? []) }
    return out
  }
  return map(root, '')
}

export function toPandoc(root, apiVersion, ctx = context('pandoc')) {
  const notes = new Map((root.children ?? []).flatMap((n, index) => n.type === 'footnote' ? [[n.key, { node: n, index }]] : []))
  const referenced = new Set(), activeNotes = new Set(), emittedRefs = new Set()
  let emittedNoteCount = 0
  const slots = n => [n.caption, ...(n.caption?.children ?? []), n.children].flat().filter(Boolean)
  const visit = n => { if (n.type === 'footnote_ref' && !referenced.has(n.key)) { referenced.add(n.key); notes.get(n.key)?.node.children.forEach(visit) } for (const child of [...(n.children ?? []), ...(n.caption ? [n.caption] : [])]) visit(child) }
  root.children.filter(n => n.type !== 'footnote').forEach(visit)
  const foreignAttr = a => [a?.id ?? '', a?.classes ?? [], a?.keyValues ?? []]
  const map = (n, path, inTight = false) => {
    exportFields(n, path, ctx, ['value', 'level', 'spacing', 'href', 'src', 'alt', 'tooltip', 'syntax', 'attrs', 'key', 'namespace', 'header', 'caption', 'columns'])
    if (n.type === 'list' && ordered(n) && !['1', 'a', 'A', 'i', 'I'].includes(n.marker.style)) ctx.note(`${path}/marker/style`, 'unsupported-field', 'dropped', 'This numbering style is outside the Pandoc export subset.')
    if (n.attrs && !['heading', 'span', 'code', 'code_block', 'link', 'image', 'table'].includes(n.type)) ctx.note(`${path}/attrs`, 'unsupported-field', 'dropped', 'This Pandoc node has no attribute slot.')
    const nestedFields = (value, p, allowed) => { for (const key of Object.keys(value)) if (!['type', 'pos', 'srcByteLength', ...allowed].includes(key)) ctx.note(`${p}/${key}`, 'unsupported-field', 'dropped', `${key} is outside the Pandoc nested-node export subset.`) }
    const children = () => (n.children ?? []).map((child, i) => map(child, `${path}/children/${i}`))
    const node = (t, c) => c === undefined ? { t } : { t, c }
    const a = foreignAttr(n.attrs)
    if (n.type === 'document') return { 'pandoc-api-version': apiVersion, meta: {}, blocks: (n.children ?? []).flatMap((child, i) => {
      const p = `${path}/children/${i}`
      if (child.type !== 'footnote') return [map(child, p)]
      nestedFields(child, p, ['key', 'namespace', 'children'])
      if (referenced.has(child.key)) return []
      ctx.note(p, 'unsupported-node', 'degraded', 'Pandoc cannot retain an unreferenced footnote definition; retained its readable text.')
      return [node('Para', [node('Str', plain(child))])]
    }) }
    if (n.type === 'text') return node('Str', n.value)
    if (n.type === 'soft_break') return node('SoftBreak')
    const inline = { emphasis: 'Emph', strong: 'Strong', strike: 'Strikeout', underline: 'Underline', superscript: 'Superscript', subscript: 'Subscript' }
    if (inline[n.type]) return node(inline[n.type], children())
    if (n.type === 'paragraph' || n.type === 'cell_paragraph') return node(inTight || n.type === 'cell_paragraph' ? 'Plain' : 'Para', children())
    if (n.type === 'heading') return node('Header', [n.level, a, children()])
    if (n.type === 'span') return node('Span', [a, children()])
    if (n.type === 'code') return node('Code', [a, n.value])
    if (n.type === 'code_block') return node('CodeBlock', [[a[0], [...(n.syntax ? [n.syntax] : []), ...a[1]], a[2]], n.value.replace(/\n$/, '')])
    if (n.type === 'link' || n.type === 'image') return node(n.type === 'link' ? 'Link' : 'Image', [a, n.type === 'link' ? children() : [node('Str', n.alt)], [n.href ?? n.src, n.tooltip ?? '']])
    if (n.type === 'hard_break' || n.type === 'thematic_break') return node(n.type === 'hard_break' ? 'LineBreak' : 'HorizontalRule')
    if (n.type === 'block_quote') return node('BlockQuote', children())
    if (n.type === 'list') {
      const items = n.children.map((item, i) => {
        nestedFields(item, `${path}/children/${i}`, ['children', 'task'])
        if (item.task) ctx.note(`${path}/children/${i}/task`, 'unsupported-field', 'dropped', 'Task flags are outside the Pandoc export subset.')
        return item.children.map((child, j) => map(child, `${path}/children/${i}/children/${j}`, tight(n)))
      })
      return node(ordered(n) ? 'OrderedList' : 'BulletList', ordered(n) ? [[n.marker.start ?? 1, node(({ a: 'LowerAlpha', A: 'UpperAlpha', i: 'LowerRoman', I: 'UpperRoman' })[n.marker.style] ?? 'Decimal'), node('Period')], items] : items)
    }
    if (n.type === 'definition_list') {
      const entries = []
      for (const [i, item] of n.children.entries()) {
        nestedFields(item, `${path}/children/${i}`, ['children'])
        const blocks = item.children.map((c, j) => map(c, `${path}/children/${i}/children/${j}`))
        if (item.type === 'definition_term') entries.push([blocks, []])
        else entries.at(-1)[1].push(blocks)
      }
      return node('DefinitionList', entries)
    }
    if (n.type === 'footnote_ref') {
      if (activeNotes.has(n.key) || !referenced.has(n.key)) { ctx.note(path, 'unsupported-node', 'degraded', 'Retained a recursive or unreachable note reference as a literal marker.'); return node('Str', `[^${n.key}]`) }
      const note = notes.get(n.key)
      if (!note) throw new Error(`Unresolved footnote: ${n.key}`)
      if (emittedRefs.has(n.key)) ctx.note(`${path}/key`, 'unsupported-field', 'degraded', 'Pandoc emits a separate note body for each reference and cannot preserve a shared key.')
      emittedRefs.add(n.key); emittedNoteCount++
      if (/^\d+$/.test(n.key) && n.key !== String(emittedNoteCount)) ctx.note(`${path}/key`, 'unsupported-field', 'degraded', 'Pandoc numbers notes in document order rather than preserving an out-of-order numeric source key.')
      if (!/^\d+$/.test(n.key)) ctx.note(`${path}/key`, 'unsupported-field', 'degraded', 'Pandoc replaces named note keys with numeric document-order keys.')
      activeNotes.add(n.key)
      const body = note.node.children.map((child, i) => map(child, `/children/${note.index}/children/${i}`))
      activeNotes.delete(n.key)
      return node('Note', body)
    }
    if (n.type === 'table') {
      const row = (r, rp, rowHeads = 0, header = false) => {
        nestedFields(r, rp, ['children', 'attrs'])
        return [foreignAttr(r.attrs), r.children.flatMap((cell, j) => {
          if (cell.span) return []
          const cp = `${rp}/children/${j}`
          if (cell.header !== (header || j < rowHeads)) ctx.note(`${cp}/header`, 'unsupported-field', 'dropped', 'Pandoc table headers must follow their head rows and leading row-header columns.')
          nestedFields(cell, cp, ['children', 'header', 'attrs', 'align', 'colspan', 'rowspan', 'valign', 'span'])
          if (cell.valign) ctx.note(`${cp}/valign`, 'unsupported-field', 'dropped', 'Pandoc cells have no vertical-alignment field.')
          return [[foreignAttr(cell.attrs), pandocAlignment(cell.align), cell.rowspan ?? 1, cell.colspan ?? 1, cell.children.map((child, k) => map(child, `${cp}/children/${k}`))]]
        })]
      }
      const columns = n.columns.map((column, i) => {
        if (column.valign) ctx.note(`${path}/columns/${i}/valign`, 'unsupported-field', 'dropped', 'Pandoc columns have no vertical-alignment field.')
        return [pandocAlignment(column.align), column.width ? node('ColWidth', column.width) : node('ColWidthDefault')]
      })
      const groups = n.children.map((group, i) => ({ group, path: `${path}/children/${i}` }))
      const head = groups.find(g => g.group.type === 'table_head'), foot = groups.find(g => g.group.type === 'table_foot')
      const bodies = groups.filter(g => g.group.type === 'table_body').map(({ group, path: gp }) => {
        let heads = 0
        while (heads < group.children.length && group.children[heads].children.every(c => c.header || c.span)) heads++
        const rh = group.rowHeadColumns ?? 0
        return [foreignAttr(group.attrs), rh, group.children.slice(0, heads).map((r, k) => row(r, `${gp}/children/${k}`, 0, true)), group.children.slice(heads).map((r, k) => row(r, `${gp}/children/${heads + k}`, rh))]
      })
      const caption = n.caption ? n.caption.children.map((child, i) => map(child, `${path}/caption/children/${i}`)) : []
      const short = n.caption?.short ? n.caption.short.map((child, i) => map(child, `${path}/caption/short/${i}`)) : null
      return node('Table', [a, [short, caption], columns, [foreignAttr(head?.group.attrs), (head?.group.children ?? []).map((r, k) => row(r, `${head.path}/children/${k}`, 0, true))], bodies, [foreignAttr(foot?.group.attrs), (foot?.group.children ?? []).map((r, k) => row(r, `${foot.path}/children/${k}`))]])
    }
    const fallback = ctx.unsupported(n, path)
    return node(['paragraph', 'span', 'text'].includes(n.type) ? 'Str' : 'Para', ['paragraph', 'span', 'text'].includes(n.type) ? plain(fallback) : [node('Str', plain(fallback))])
  }
  return map(root, '')
}

function exportRichSource(tool, root, ctx) {
  const rst = tool === 'docutils', isDjot = tool === 'djot'
  const headingStyles = new Map()
  const htmlText = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\]/g, '&#93;').replace(/\[/g, '&#91;').replace(/\\/g, '&#92;')
  const escape = s => rst ? s.replace(/[\p{P}\p{S}\\]/gu, '\\$&') : isDjot ? s.replace(/[\\*_`\[\]]/g, '\\$&') : `pass:[${htmlText(s)}]`
  const fence = (value, char, min) => char.repeat(Math.max(min - 1, ...value.split('\n').filter(l => new RegExp(`^${char}+$`).test(l)).map(l => l.length)) + 1)
  const joinBlocks = (nodes, values) => values.map((value, i) => (i ? (nodes[i - 1].type === 'list' && nodes[i].type === 'list' ? (rst ? '\n\n..\n\n' : isDjot ? '\n\n' : '\n\n//\n\n') : '\n\n') : '') + value).join('')
  const map = (n, path, listKinds = []) => {
    exportFields(n, path, ctx, ['value', 'level', 'spacing', 'href', 'syntax'])
    const children = () => (n.children ?? []).map((c, i) => map(c, `${path}/children/${i}`, listKinds))
    if (n.type === 'document') return joinBlocks(n.children, children()) + '\n'
    if (n.type === 'text') return escape(n.value)
    if (n.type === 'soft_break') return escape(' ')
    if (n.type === 'paragraph' && !n.role) return children().join('')
    const img = blockImageOf(n)
    if (img) {
      exportFields(img, `${path}/children/0`, ctx, ['src', 'alt'])
      return rst ? `.. image:: ${img.src}\n   :alt: ${img.alt}` : isDjot ? `![${escape(img.alt)}](${img.src})` : `image::${img.src}[${img.alt}]`
    }
    if (n.type === 'list_item') return joinBlocks(n.children, children())
    if (n.type === 'strong' || n.type === 'emphasis') {
      const marker = rst ? n.type === 'strong' ? '**' : '*' : isDjot ? n.type === 'strong' ? '*' : '_' : n.type === 'strong' ? '**' : '__'
      const value = marker + children().join('') + marker
      return rst ? '\\ ' + value + '\\ ' : value
    }
    if (n.type === 'code') {
      if (rst && (!n.value || /``|^\s|\s$|\n/.test(n.value))) {
        ctx.note(`${path}/value`, 'unsupported-field', 'degraded', 'This reStructuredText inline literal cannot preserve its delimiter or boundary whitespace; retained plain text.')
        return escape(n.value)
      }
      if (isDjot) return djot.renderDjot({ tag: 'doc', references: {}, autoReferences: {}, footnotes: {}, children: [{ tag: 'para', children: [{ tag: 'verbatim', text: n.value }] }] }).replace(/\n+$/, '')
      return rst ? '\\ ``' + n.value + '``\\ ' : '``' + escape(n.value) + '``'
    }
    if (isDjot && n.type === 'hard_break') return '\\\n'
    if (n.type === 'heading') {
      const value = children().join('')
      if (!rst) return (isDjot ? '#' : '=').repeat(n.level) + ' ' + value
      if (!headingStyles.has(n.level)) {
        if (n.level !== headingStyles.size + 2) ctx.note(`${path}/level`, 'unsupported-field', 'degraded', 'reStructuredText assigns levels by first-seen adornment; this heading level cannot be preserved.')
        headingStyles.set(n.level, ['=', '-', '~', '^', '"', '+'][headingStyles.size])
      }
      return value + '\n' + headingStyles.get(n.level).repeat(Math.max(3, value.length))
    }
    if (n.type === 'link') return isDjot ? '[' + children().join('') + '](' + n.href + ')' : rst ? '\\ `' + children().join('') + ' <' + n.href + '>`__\\ ' : 'link:' + n.href + '[' + children().join('') + ']'
    if (n.type === 'list') {
      if (tight(n) && !isDjot) ctx.note(`${path}/spacing`, 'list-layout-unavailable', 'degraded', 'Exported a loose list for this document model.')
      decimalOnly(n, path, ctx)
      const start = n.marker.start ?? 1
      if (rst || isDjot) return n.children.map((item, i) => {
        const marker = ordered(n) ? `${start + i}. ` : '- '
        const body = map(item, `${path}/children/${i}`, [...listKinds, ordered(n)])
        return marker + body.replace(/\n/g, '\n' + ' '.repeat(marker.length))
      }).join(tight(n) && isDjot ? '\n' : '\n\n')
      const marker = (ordered(n) ? '.' : '*').repeat(listKinds.filter(kind => kind === ordered(n)).length + 1) + ' '
      const items = n.children.map((item, i) => {
        exportFields(item, `${path}/children/${i}`, ctx)
        const parts = item.children.map((block, j) => map(block, `${path}/children/${i}/children/${j}`, [...listKinds, ordered(n)]))
        return marker + parts.join('\n+\n')
      })
      return (ordered(n) && start !== 1 ? `[start=${start}]\n` : '') + items.join('\n\n')
    }
    if (n.type === 'block_quote') {
      const value = joinBlocks(n.children, children())
      if (isDjot) return value.split('\n').map(l => '> ' + l).join('\n')
      if (rst) return '..\n\n' + value.split('\n').map(l => '    ' + l).join('\n')
      const delimiter = fence(value, '_', 4)
      return '[quote]\n' + delimiter + '\n' + value + '\n' + delimiter
    }
    if (n.type === 'code_block') {
      if (rst) return `.. code::${n.syntax ? ' ' + n.syntax : ''}\n\n` + n.value.replace(/\n$/, '').split('\n').map(l => '    ' + l).join('\n')
      const delimiter = fence(n.value, isDjot ? '`' : '-', isDjot ? 3 : 4)
      return (isDjot ? delimiter + (n.syntax ?? '') : (n.syntax ? '[source,' + n.syntax + ']\n' : '') + delimiter) + '\n' + n.value + delimiter
    }
    if (n.type === 'thematic_break') return isDjot ? '---' : rst ? '----------' : "'''"
    return escape(plain(ctx.unsupported(n, path)))
  }
  return map(root, '')
}
