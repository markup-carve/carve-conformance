// Carve 0.2 reference trees, built from the foreign parsers without any engine code.
import { find, html } from 'property-information'
import { coalesce, context, parseHtml, plain, text } from './trees.mjs'

export { coalesce, context, parseHtml, plain, text }
export const AST_VERSION = '2.0'

export const document = children => softBreaks({ type: 'document', astVersion: AST_VERSION, children })

// A line break inside foreign text is the soft_break node of the 0.2 tree, never a newline in text.
export function softBreaks(node) {
  if (!node || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.forEach(softBreaks)
  for (const [key, value] of Object.entries(node)) {
    if (key === 'attrs' || !Array.isArray(value)) { if (key !== 'attrs') softBreaks(value); continue }
    if (!value.some(c => c?.type === 'text' && c.value.includes('\n'))) { value.forEach(softBreaks); continue }
    const out = []
    for (const child of value) {
      if (child?.type !== 'text' || !child.value.includes('\n')) { softBreaks(child); out.push(child); continue }
      child.value.split('\n').forEach((part, i) => { if (i) out.push({ type: 'soft_break' }); if (part) out.push(text(part)) })
    }
    while (out[0]?.type === 'soft_break') out.shift()
    while (out.at(-1)?.type === 'soft_break') out.pop()
    node[key] = out
  }
  return node
}
export const paragraph = children => ({ type: 'paragraph', children })
export function list({ ordered, style, start, tight, char = '-' }, children) {
  const marker = ordered
    ? { kind: 'ordered', style: style ?? '1', delimiter: '.', ...(start !== undefined && start !== 1 ? { start } : {}) }
    : { kind: 'bullet', char }
  return { type: 'list', marker, spacing: tight ? 'tight' : 'loose', children }
}
export const listItem = (children, checked) => ({ type: 'list_item', children, ...(checked === undefined || checked === null ? {} : { task: { mark: checked ? 'x' : ' ' } }) })
export const codeBlock = (value, syntax) => ({ type: 'code_block', value, ...(syntax ? { syntax } : {}) })
export const link = (href, children, tooltip) => ({ type: 'link', href, children, ...(tooltip ? { tooltip } : {}) })
export const image = (src, alt, tooltip) => ({ type: 'image', src, alt, ...(tooltip ? { tooltip } : {}) })
export const footnote = (key, children) => ({ type: 'footnote', key, namespace: 'footnote', children })
export const footnoteRef = key => ({ type: 'footnote_ref', key, namespace: 'footnote' })

// C2-A-008: the root always carries the major and minor it was written against.
export function treeVersion(tree) {
  const root = tree?.type === 'document' ? tree : tree?.document
  return root?.astVersion
}

// Compare semantic fields; spelling, resolution results and source coordinates stay outside.
export function semantics(value, parent) {
  // A definition is reference spelling once its uses carry the resolved destination (C2-A-106).
  if (Array.isArray(value)) return coalesce(value.filter(v => v?.type !== 'link_reference_definition').map(v => semantics(v, parent)))
  if (!value || typeof value !== 'object') return value
  if (value.type === 'soft_break') return text(' ')
  if (value.type === 'text') return text(value.value.replace(/\n/g, ' '))
  const out = {}
  for (const [key, field] of Object.entries(value)) {
    if (['pos', 'srcByteLength', 'astVersion', 'stages', 'segments', 'generatedId', 'refForm'].includes(key)) continue
    if (key === 'number' && value.type === 'footnote_ref') continue
    if (['key', 'namespace'].includes(key) && value.namespace === 'link' && (value.href ?? value.src) !== undefined) continue
    if (key === 'marker' && value.type === 'list') {
      out.marker = field.kind === 'bullet' ? { kind: 'bullet' } : { kind: 'ordered', style: field.style, ...(field.start !== undefined ? { start: field.start } : {}) }
      continue
    }
    out[key] = key === 'attrs' ? structuredClone(field) : semantics(field, value)
  }
  return out
}

export const blockTypes = new Set(['paragraph', 'list', 'heading', 'block_quote', 'code_block', 'table', 'definition_list', 'div', 'thematic_break'])

export function attrs(id, classes, pairs) {
  const out = {}
  if (id !== undefined) out.id = String(id)
  if (classes?.length) out.classes = classes
  if (pairs?.length) out.keyValues = pairs
  return out
}

export function foreignAttrs(source) {
  const pairs = [], result = {}
  for (const [key, value] of Object.entries(source)) {
    if (key === 'id') result.id = value
    else if (key === 'class') result.classes = value.split(/\s+/)
    else pairs.push([key, value])
  }
  if (pairs.length) result.keyValues = pairs
  return result
}

export function fromHast(root, ctx = context('hast'), options = {}) {
  const generatedClasses = new Set(['docutils', 'arabic', 'reference', 'external', 'literal', 'simple', 'code', 'text', 'literal-block', 'highlight', 'sectionbody', 'paragraph', 'ulist', 'olist', 'listingblock', 'content', 'quoteblock', 'sect1', 'sect2', 'contains-task-list', 'task-list-item', 'task-list', 'imageblock'])
  const noteSections = new Map(), noteIds = new Map(), noteBodies = new Set()
  const walk = (n, visit) => { visit(n); n.children?.forEach(c => walk(c, visit)) }
  walk(root, n => {
    if (n.type !== 'element' || !(n.properties?.role === 'doc-endnotes' || n.properties?.dataFootnotes !== undefined)) return
    let ol; walk(n, c => { if (!ol && c.tagName === 'ol') ol = c })
    const items = ol?.children?.filter(c => c.tagName === 'li') ?? []
    noteSections.set(n, items)
    items.forEach((li, i) => { if (li.properties?.id) noteIds.set(li.properties.id, String(i + 1)); walk(li, c => noteBodies.add(c)) })
  })
  const readAttrs = (props, tag, path, generatedLang, taskItem = false) => {
    let id, classes
    const pairs = []
    for (const [key, value] of Object.entries(props)) {
      if (options.generated && options.renderer === 'carve' && tag === 'ol' && key === 'dataDelim' && value === ')' && !options.authoredKeyValues?.has('data-delim=)')) { ctx.note(`${path}/properties/dataDelim`, 'generated-html-attribute', 'normalized', 'Omitted the generated ordered-list delimiter marker.'); continue }
      if (options.generated && options.renderer === 'carve' && tag === 'li' && key === 'dataTaskState' && !options.authoredKeyValues?.has(`data-task-state=${value}`)) { ctx.note(`${path}/properties/dataTaskState`, 'generated-html-attribute', 'normalized', 'Omitted the task-state styling hook every Carve render writes.'); continue }
      if (options.generated && options.renderer === 'carve' && tag === 'li' && taskItem && ((key === 'className' && value.length === 1 && value[0] === 'task' && !options.authoredClasses?.has('task')) || (key === 'style' && value === 'list-style: none' && !options.authoredKeyValues?.has(`style=${value}`)))) { ctx.note(`${path}/properties/${key}`, 'generated-html-attribute', 'normalized', 'Omitted the task item styling every Carve render writes.'); continue }
      if (options.generated && options.renderer === 'pandoc' && key.startsWith('data') && key.length > 4) { const original = key[4].toLowerCase() + key.slice(5); if (options.authoredKeyValues?.has(`${original}=${value}`)) { pairs.push([original, String(value)]); ctx.note(`${path}/properties/${key}`, 'generated-html-attribute', 'normalized', 'Restored an authored attribute renamed by Pandoc HTML output.'); continue } }
      if (options.renderer === 'pandoc' && tag === 'ol' && key === 'type' && String(value) === '1') { ctx.note(`${path}/properties/type`, 'generated-html-attribute', 'normalized', 'Omitted the Pandoc decimal-list type attribute.'); continue }
      if ((tag === 'a' && ['href', 'title'].includes(key)) || (tag === 'img' && ['src', 'alt', 'title'].includes(key)) || (tag === 'ol' && (key === 'start' || (key === 'type' && ['1', 'a', 'A', 'i', 'I'].includes(String(value)))))) continue
      if (options.generated && key === 'className') {
        const retained = value.filter(c => (!generatedClasses.has(c) && c !== generatedLang) || options.authoredClasses?.has(c))
        if (retained.length !== value.length) ctx.note(`${path}/properties/${key}`, 'generated-html-attribute', 'normalized', 'Omitted classes added by the foreign renderer.')
        if (retained.length) classes = retained
      } else if (options.generated && ((key === 'id' && !options.authoredIds?.has(value) && (/^h[1-6]$/.test(tag) || tag === 'section')) || key === 'dataLang')) {
        ctx.note(`${path}/properties/${key}`, 'generated-html-attribute', 'normalized', `Omitted ${key} added by the foreign renderer.`)
      } else if (key === 'id') id = String(value)
      else if (key === 'className') classes = value
      else pairs.push([find(html, key).attribute, String(value)])
    }
    return attrs(id, classes, pairs)
  }
  const map = (n, path, block = false, taskContext = false) => {
    if (n.type === 'text') return text(n.value)
    if (n.type === 'root') return document(blocks(n.children, path))
    if (options.generated && n.type === 'comment' && /^\s*$/.test(n.value)) {
      ctx.note(path, 'source-boundary', 'normalized', 'Consumed an empty comment separating exported blocks.')
      return []
    }
    if (n.type !== 'element') return ctx.unsupported(n, path, block)
    const tag = n.tagName, props = n.properties ?? {}
    if (options.generated && tag === 'sup' && n.children.some(c => c.tagName === 'a' && (c.properties?.role === 'doc-noteref' || c.properties?.dataFootnoteRef !== undefined || c.properties?.className?.includes('footnote-ref')))) return coalesce(n.children.flatMap((c, i) => map(c, `${path}/children/${i}`)))
    if (options.generated && noteSections.has(n)) {
      ctx.note(path, 'generated-footnote-navigation', 'normalized', 'Reconstructed footnote bodies and omitted generated endnote navigation.')
      return noteSections.get(n).map((li, i) => footnote(String(i + 1), blocks(li.children, `${path}/footnotes/${i}`)))
    }
    if (options.generated && tag === 'a' && (props.role === 'doc-backlink' || props.dataFootnoteBackref !== undefined || (noteBodies.has(n) && props.className?.some(c => ['footnote-back', 'footnote-backref'].includes(c))))) {
      ctx.note(path, 'generated-footnote-navigation', 'normalized', 'Omitted a generated footnote backlink.'); return []
    }
    if (options.generated && tag === 'a' && (props.role === 'doc-noteref' || props.dataFootnoteRef !== undefined || props.className?.includes('footnote-ref'))) {
      const label = noteIds.get(String(props.href ?? '').replace(/^#/, ''))
      if (label) return footnoteRef(label)
      ctx.note(path, 'unsupported-field', 'dropped', 'The rendered footnote target could not be matched to an endnote body.')
    }
    if (tag === 'input' && props.type === 'checkbox' && taskContext) {
      for (const key of Object.keys(props)) if (!['type', 'checked', 'disabled', 'ariaLabel'].includes(key)) ctx.note(`${path}/properties/${key}`, 'unsupported-field', 'dropped', 'Authored checkbox-control attributes are outside this subset.')
      ctx.note(path, 'task-checkbox', 'normalized', 'Moved checkbox state to its list item.'); return []
    }
    const generatedLang = options.generated && options.renderer === 'pandoc' && tag === 'pre' ? props.className?.[0] : options.generated && tag === 'pre' && props.className?.includes('code') ? props.className.find(c => !['code', 'literal-block'].includes(c)) : undefined
    const children = () => {
      const mapped = coalesce(n.children.map((c, i) => map(c, `${path}/children/${i}`, false, taskContext || tag === 'li')))
      if (noteBodies.has(n) && n.children.at(-1)?.tagName === 'a' && mapped.at(-1)?.type === 'text') mapped.at(-1).value = mapped.at(-1).value.replace(/\s+$/, '')
      for (let i = 1; i < mapped.length; i++) if (mapped[i - 1].type === 'hard_break' && mapped[i].type === 'text') mapped[i].value = mapped[i].value.replace(/^\n/, '')
      return mapped
    }
    const nodeAttrs = readAttrs(props, tag, path, generatedLang, tag === 'li' && n.children.some(c => c.tagName === 'input' && c.properties?.type === 'checkbox'))
    let result
    if (/^h[1-6]$/.test(tag)) result = { type: 'heading', level: Number(tag[1]), children: children() }
    else if (tag === 'p') result = imageParagraph(paragraph(children()))
    else if (tag === 'figure' && options.generated && isImageFigure(n)) {
      ctx.note(path, 'generated-html-wrapper', 'normalized', 'Read a generated image figure, whose caption repeats the alternative text, as the image paragraph.')
      const img = n.children.find(c => c.tagName === 'img')
      result = { type: 'paragraph', role: 'image', children: [image(img.properties.src ?? '', img.properties.alt ?? '', img.properties.title)] }
    }
    else if (options.generated && tag === 'span' && props.className?.includes('literal')) result = { type: 'code', value: plain(n) }
    else if (tag === 'span') result = { type: 'span', children: children() }
    else if (tag === 'dl') result = { type: 'definition_list', children: blocks(n.children, path) }
    else if (tag === 'dt') result = { type: 'definition_term', children: children() }
    else if (tag === 'dd') { const hasBlocks = n.children.some(c => ['p', 'ul', 'ol', 'pre', 'blockquote', 'dl'].includes(c.tagName)); result = { type: 'definition_description', children: hasBlocks ? blocks(n.children, path) : [paragraph(children())] } }
    else if (['em', 'strong', 'del', 's', 'u', 'mark', 'sup', 'sub'].includes(tag)) {
      result = { type: ({ em: 'emphasis', del: 'strike', s: 'strike', u: 'underline', mark: 'highlight', sup: 'superscript', sub: 'subscript' })[tag] ?? tag, children: children() }
    } else if (tag === 'a') result = link(props.href ?? '', children(), props.title)
    else if (tag === 'img') result = image(props.src ?? '', props.alt ?? '', props.title)
    else if (tag === 'code') result = { type: 'code', value: plain(n) }
    else if (tag === 'pre') {
      const code = n.children.find(c => c.tagName === 'code') ?? n
      const lang = code.properties?.className?.find(c => c.startsWith('language-'))?.slice(9) ?? generatedLang
      let content = plain(code)
      if (options.generated && content && !content.endsWith('\n')) {
        ctx.note(path, 'code-terminal-newline', 'normalized', 'Added the terminal newline used by Carve code blocks.')
        content += '\n'
      }
      result = codeBlock(content, lang)
    } else if (tag === 'blockquote') result = { type: 'block_quote', children: blocks(n.children, path) }
    else if (tag === 'br') result = { type: 'hard_break' }
    else if (tag === 'hr') result = { type: 'thematic_break' }
    else if (tag === 'ul' || tag === 'ol') {
      const items = []
      for (const [i, child] of n.children.entries()) {
        if (child.tagName === 'li') items.push(map(child, `${path}/children/${items.length}`, true))
        else if (!(child.type === 'text' && /^\s*$/.test(child.value))) items.push(listItem([ctx.unsupported(child, `${path}/children/${i}`, true)]))
      }
      const tight = !n.children.some(li => li.tagName === 'li' && li.children.some(p => p.tagName === 'p'))
      result = list({ ordered: tag === 'ol', style: tag === 'ol' && ['a', 'A', 'i', 'I'].includes(props.type) ? props.type : undefined, start: tag === 'ol' ? Number(props.start ?? 1) : undefined, tight }, items)
    } else if (tag === 'li') {
      const hasBlocks = n.children.some(c => ['p', 'ul', 'ol', 'pre', 'blockquote'].includes(c.tagName))
      const inlineChildren = children()
      if (!hasBlocks) {
        if (inlineChildren[0]?.type === 'text') inlineChildren[0].value = inlineChildren[0].value.replace(/^\n/, '')
        if (inlineChildren.at(-1)?.type === 'text') inlineChildren.at(-1).value = inlineChildren.at(-1).value.replace(/\n$/, '')
      }
      const findCheckbox = node => node.children?.flatMap(c => c.tagName === 'input' && c.properties?.type === 'checkbox' ? [c] : c.tagName === 'p' ? findCheckbox(c) : []) ?? []
      const checkbox = findCheckbox(n)[0]
      const body = []
      if (hasBlocks) {
        let pending = []
        const flush = () => { const parts = coalesce(pending); pending = []; if (options.generated) { if (parts[0]?.type === 'text') parts[0].value = parts[0].value.replace(/^\s+/, ''); if (parts.at(-1)?.type === 'text') parts.at(-1).value = parts.at(-1).value.replace(/\s+$/, '') } if (parts.some(c => c.type !== 'text' || !/^[\s]*$/.test(c.value))) body.push(paragraph(parts)) }
        for (const part of inlineChildren) { if (blockTypes.has(part.type)) { flush(); body.push(part) } else pending.push(part) }
        flush()
      } else body.push(paragraph(inlineChildren))
      if (checkbox && body[0]?.children?.[0]?.type === 'text') body[0].children[0].value = body[0].children[0].value.replace(/^\n+/, '').replace(/^ /, '')
      result = listItem(body, checkbox ? !!checkbox.properties.checked : undefined)
    } else if (options.keepDivs && tag === 'div') result = { type: 'div', children: blocks(n.children, path) }
    else if (options.generated && ['div', 'section', 'main'].includes(tag)) {
      ctx.note(path, 'generated-html-wrapper', 'normalized', `Removed foreign renderer ${tag} wrapper.`)
      return blocks(n.children, path)
    } else return ctx.unsupported(n, path, block)
    if (Object.keys(nodeAttrs).length) result.attrs = nodeAttrs
    return result
  }
  const blockImage = (node, path) => {
    if (node?.type !== 'image') return node
    ctx.note(path, 'block-image-html', 'normalized', 'Read a bare block-position image as the image paragraph of C2-A-136.')
    return { type: 'paragraph', role: 'image', children: [node] }
  }
  const blocks = (nodes, path, taskContext = false) => coalesce(nodes.flatMap((n, i) => n.type === 'text' && /^\s*$/.test(n.value) ? [] : blockImage(map(n, `${path}/children/${i}`, true, taskContext), `${path}/children/${i}`)))
  return map(root, '')
}

function isImageFigure(n) {
  const elements = n.children.filter(c => c.type === 'element')
  const img = elements.find(c => c.tagName === 'img'), caption = elements.find(c => c.tagName === 'figcaption')
  return !!img && elements.length === (caption ? 2 : 1) && (!caption || plain(caption).trim() === String(img.properties.alt ?? ''))
}

// C2-A-136: a paragraph whose only content is one image is the block image role.
export function imageParagraph(node) {
  const content = node.children.filter(c => c.type !== 'text' || !/^\s*$/.test(c.value))
  if (content.length === 1 && content[0].type === 'image' && !node.attrs) return { ...node, role: 'image', children: content }
  return node
}

export function fromMdast(root, ctx = context('mdast')) {
  const definitions = new Map()
  const collect = n => { if (n.type === 'definition') definitions.set(n.identifier, n); n.children?.forEach(collect) }
  collect(root)
  const map = (n, path) => {
    const children = () => coalesce((n.children ?? []).flatMap((c, i) => map(c, `${path}/children/${i}`)))
    if (n.type === 'root') return document(children())
    if (n.type === 'definition') {
      ctx.note(path, 'reference-resolved', 'normalized', 'Resolved Markdown references to their destination.')
      return []
    }
    if (n.type === 'text') return text(n.value)
    if (n.type === 'paragraph') return imageParagraph(paragraph(children()))
    if (n.type === 'listItem') return listItem(children(), n.checked)
    if (['strong', 'emphasis', 'blockquote'].includes(n.type)) return { type: n.type === 'blockquote' ? 'block_quote' : n.type, children: children() }
    if (n.type === 'heading') return { type: 'heading', level: n.depth, children: children() }
    if (n.type === 'break' || n.type === 'thematicBreak') return { type: n.type === 'break' ? 'hard_break' : 'thematic_break' }
    if (n.type === 'inlineCode') return { type: 'code', value: n.value }
    if (n.type === 'code') {
      if (n.meta) ctx.note(`${path}/meta`, 'unsupported-field', 'dropped', 'Code metadata is outside the shared subset.')
      return codeBlock(n.value + '\n', n.lang)
    }
    if (n.type === 'list') return list({ ordered: n.ordered, start: n.ordered ? n.start : undefined, tight: !n.spread && !n.children.some(c => c.spread) }, children())
    if (['link', 'image', 'linkReference', 'imageReference'].includes(n.type)) {
      const reference = n.type.endsWith('Reference')
      const dest = reference ? definitions.get(n.identifier) : n
      if (!dest) return ctx.unsupported(n, path)
      if (reference) ctx.note(path, 'reference-resolved', 'normalized', 'Resolved Markdown reference spelling.')
      return n.type.startsWith('image') ? image(dest.url, n.alt ?? '', dest.title) : link(dest.url, children(), dest.title)
    }
    if (n.type === 'footnoteReference') return footnoteRef(n.identifier)
    if (n.type === 'footnoteDefinition') return footnote(n.identifier, children())
    if (n.type === 'delete') return { type: 'strike', children: children() }
    return ctx.unsupported(n, path, ['html', 'table', 'footnoteDefinition'].includes(n.type))
  }
  return map(root, '')
}

export function fromCommonmark(root, ctx = context('commonmark')) {
  const map = (n, path) => {
    const nodes = []
    for (let c = n.firstChild; c; c = c.next) nodes.push(c)
    const children = () => coalesce(nodes.map((c, i) => map(c, `${path}/children/${i}`)))
    if (n.type === 'document') return document(children())
    if (n.type === 'paragraph') return imageParagraph(paragraph(children()))
    if (n.type === 'item') return listItem(children())
    if (['strong', 'emph', 'block_quote'].includes(n.type)) return { type: n.type === 'emph' ? 'emphasis' : n.type, children: children() }
    if (n.type === 'heading') return { type: 'heading', level: n.level, children: children() }
    if (n.type === 'text') return text(n.literal)
    if (n.type === 'softbreak') return text(' ')
    if (n.type === 'linebreak') return { type: 'hard_break' }
    if (n.type === 'thematic_break') return { type: 'thematic_break' }
    if (n.type === 'code') return { type: 'code', value: n.literal }
    if (n.type === 'code_block') {
      const lang = n.info?.trim().split(/\s+/)[0]
      if (n.info?.trim() && n.info.trim() !== lang) ctx.note(`${path}/info`, 'unsupported-field', 'dropped', 'Code metadata is outside the shared subset.')
      return codeBlock(n.literal, lang)
    }
    if (n.type === 'link') return link(n.destination, children(), n.title)
    if (n.type === 'image') return image(n.destination, children().map(plain).join(''), n.title)
    if (n.type === 'list') return list({ ordered: n.listType === 'ordered', start: n.listStart, tight: n.listTight }, children())
    return ctx.unsupported({ type: n.type, literal: n.literal }, path, n.type === 'html_block')
  }
  return map(root, '')
}

export function fromDjot(root, ctx = context('djot')) {
  const map = (n, path) => {
    const children = () => coalesce((n.children ?? []).flatMap((c, i) => map(c, `${path}/children/${i}`)))
    let result
    if (n.tag === 'doc') return document([...children(), ...Object.entries(n.footnotes ?? {}).map(([label, note]) => footnote(label, coalesce(note.children.map((c, i) => map(c, `/footnotes/${label}/children/${i}`)))))])
    if (n.tag === 'section') {
      if (n.attributes) ctx.note(`${path}/attributes`, 'unsupported-field', 'dropped', 'Authored section attributes cannot survive section flattening.')
      ctx.note(path, 'automatic-section', 'normalized', 'Flattened Djot automatic section structure.')
      return children()
    }
    if (n.tag === 'str') result = text(n.text)
    else if (n.tag === 'para') result = paragraph(children())
    else if (['emph', 'strong', 'block_quote'].includes(n.tag)) result = { type: n.tag === 'emph' ? 'emphasis' : n.tag, children: children() }
    else if (n.tag === 'list_item') result = listItem(children())
    else if (n.tag === 'task_list_item') result = listItem(children(), n.checkbox === 'checked')
    else if (n.tag === 'span') result = { type: 'span', children: children() }
    else if (n.tag === 'footnote_reference') result = footnoteRef(n.text)
    else if (n.tag === 'definition_list') result = { type: 'definition_list', children: children() }
    else if (n.tag === 'definition_list_item') return children()
    else if (n.tag === 'term' || n.tag === 'definition') result = { type: n.tag === 'term' ? 'definition_term' : 'definition_description', children: children() }
    else if (n.tag === 'heading') result = { type: 'heading', level: n.level, children: children() }
    else if (n.tag === 'soft_break') result = text(' ')
    else if (['hard_break', 'thematic_break'].includes(n.tag)) result = { type: n.tag }
    else if (n.tag === 'verbatim') result = { type: 'code', value: n.text }
    else if (n.tag === 'code_block') result = codeBlock(n.text, n.lang)
    else if (n.tag === 'link' || n.tag === 'image') {
      const destination = n.destination ?? root.references?.[n.reference]?.destination
      if (destination === undefined) return ctx.unsupported(n, path)
      result = n.tag === 'image' ? image(destination, children().map(plain).join('')) : link(destination, children())
    } else if (['bullet_list', 'ordered_list', 'task_list'].includes(n.tag)) {
      const ordered = n.tag === 'ordered_list'
      result = list({ ordered, style: ordered ? n.style?.match(/[aAiI]/)?.[0] : undefined, start: ordered ? n.start ?? 1 : undefined, tight: n.tight }, children())
    }
    else return ctx.unsupported(n, path, ['div', 'table', 'raw_block', 'definition_list'].includes(n.tag))
    if (n.attributes) result.attrs = foreignAttrs(n.attributes)
    if (result.type === 'paragraph') result = imageParagraph(result)
    return result
  }
  return map(root, '')
}

export function fromDocutils(root, ctx = context('docutils')) {
  const map = (n, path, depth = 1) => {
    const children = () => coalesce((n.children ?? []).flatMap((c, i) => map(c, `${path}/children/${i}`, depth)))
    const a = n.attributes ?? {}
    if (n.type === 'comment') {
      if (plain(n) === '') ctx.note(path, 'source-boundary', 'normalized', 'Consumed an empty comment separating exported blocks.')
      else ctx.note(path, 'unsupported-node', 'dropped', 'Non-rendering reStructuredText comments are outside this adapter subset.')
      return []
    }
    const accepted = new Set(['ids', 'classes', 'names', 'dupnames', 'source', ...({ reference: ['name', 'refuri'], target: ['refuri', 'refid'], image: ['uri', 'alt'], bullet_list: ['bullet'], enumerated_list: ['start', 'enumtype', 'prefix', 'suffix'], literal_block: ['xml:space'] }[n.type] ?? [])])
    for (const key of Object.keys(a)) if (!accepted.has(key)) ctx.note(`${path}/attributes/${key}`, 'unsupported-field', 'dropped', `${key} is outside this adapter subset.`)
    if (a.classes?.length && !(n.type === 'literal_block' && a.classes.includes('code'))) ctx.note(`${path}/attributes/classes`, 'unsupported-field', 'dropped', 'Authored Docutils classes are outside this adapter subset.')
    if (a.ids?.length && !['section', 'target'].includes(n.type)) ctx.note(`${path}/attributes/ids`, 'unsupported-field', 'dropped', 'Docutils anchors on content nodes are outside this adapter subset.')
    if (n.type === 'document') return document(children())
    if (n.type === 'section') {
      ctx.note(path, 'automatic-section', 'normalized', 'Flattened reStructuredText section and generated identifiers.')
      return coalesce(n.children.flatMap((c, i) => map(c, `${path}/children/${i}`, depth + 1)))
    }
    if (n.type === 'target') {
      if (a.refuri) ctx.note(path, 'reference-resolved', 'normalized', 'Resolved reStructuredText reference target.')
      else ctx.note(path, 'unsupported-node', 'dropped', 'Standalone reStructuredText anchors are outside this adapter subset.')
      return []
    }
    if (n.type === 'title') return { type: 'heading', level: depth, children: children() }
    if (n.type === 'text') return text(n.value)
    if (n.type === 'paragraph') return imageParagraph(paragraph(children()))
    if (n.type === 'list_item') return listItem(children())
    if (['emphasis', 'strong', 'block_quote'].includes(n.type)) return { type: n.type, children: children() }
    if (n.type === 'literal') return { type: 'code', value: plain(n) }
    if (n.type === 'literal_block') return codeBlock(plain(n) + '\n', a.classes?.includes('code') ? a.classes.find(c => c !== 'code') : undefined)
    if (n.type === 'reference' && a.refuri) return link(a.refuri, children())
    // A standalone reStructuredText image is a block: the paragraph role of C2-A-136.
    if (n.type === 'image') return { type: 'paragraph', role: 'image', children: [image(a.uri, a.alt ?? '')] }
    if (n.type === 'transition') return { type: 'thematic_break' }
    if (n.type === 'bullet_list' || n.type === 'enumerated_list') {
      if (a.enumtype && a.enumtype !== 'arabic') ctx.note(`${path}/attributes/enumtype`, 'unsupported-field', 'dropped', 'Lettered and roman numbering styles are outside this adapter subset.')
      ctx.note(`${path}/tight`, 'list-layout-unavailable', 'normalized', 'Docutils doctrees do not encode Carve list spacing; this adapter uses loose lists.')
      return list({ ordered: n.type === 'enumerated_list', start: a.start, tight: false }, children())
    }
    return ctx.unsupported(n, path, ['note', 'warning', 'admonition', 'system_message', 'table', 'definition_list'].includes(n.type))
  }
  return map(root, '')
}

export function fromMd4c(events, ctx = context('md4c')) {
  const stack = [], blockKinds = ['document', 'block_quote', 'list', 'list', 'list_item', 'thematic_break', 'heading', 'code_block', 'raw_block', 'paragraph']
  const spanKinds = ['emphasis', 'strong', 'link', 'image', 'code']
  let root
  for (const [i, e] of events.entries()) {
    const path = `/events/${i}`
    if (e.event.startsWith('enter_')) {
      const kind = (e.event === 'enter_block' ? blockKinds : spanKinds)[e.kind] ?? 'unsupported'
      const n = { kind, children: [], event: e }
      if (e.info?.trim() !== (e.lang ?? '') && e.info !== undefined) ctx.note(`${path}/info`, 'unsupported-field', 'dropped', 'Code metadata is outside the shared subset.')
      if (stack.length) stack.at(-1).node.children.push(n)
      else if (root) throw new Error('MD4C emitted multiple roots')
      else root = n
      stack.push({ node: n, event: e, path })
    } else if (e.event.startsWith('leave_')) {
      const frame = stack.pop()
      if (!frame || frame.event.kind !== e.kind || frame.event.event.replace('enter_', 'leave_') !== e.event) throw new Error('Unbalanced MD4C events')
      const n = frame.node, ev = n.event, parts = coalesce(n.children)
      let built
      if (n.kind === 'document') built = document(parts)
      else if (n.kind === 'paragraph') built = imageParagraph(paragraph(parts))
      else if (n.kind === 'heading') built = { type: 'heading', level: ev.level, children: parts }
      else if (['block_quote', 'emphasis', 'strong'].includes(n.kind)) built = { type: n.kind, children: parts }
      else if (n.kind === 'list') built = list({ ordered: ev.kind === 3, start: ev.start, tight: ev.tight }, parts)
      else if (n.kind === 'list_item') {
        const blocks = [], inline = ['text', 'emphasis', 'strong', 'link', 'image', 'code', 'hard_break']
        for (const child of parts) {
          if (inline.includes(child.type)) { if (blocks.at(-1)?.type !== 'paragraph') blocks.push(paragraph([])); blocks.at(-1).children.push(child) }
          else blocks.push(child)
        }
        built = listItem(blocks.map(b => b.type === 'paragraph' ? imageParagraph(b) : b))
      }
      else if (n.kind === 'code') built = { type: 'code', value: parts.map(plain).join('') }
      else if (n.kind === 'code_block') built = codeBlock(parts.map(plain).join(''), ev.lang)
      else if (n.kind === 'image') built = image(decode(ev.destination), parts.map(plain).join(''), ev.title ? decode(ev.title) : undefined)
      else if (n.kind === 'link') built = link(decode(ev.destination), parts, ev.title ? decode(ev.title) : undefined)
      else if (n.kind === 'thematic_break') built = { type: 'thematic_break' }
      else built = ctx.unsupported({ type: n.kind, children: parts }, frame.path, frame.event.event === 'enter_block')
      Object.keys(n).forEach(k => delete n[k])
      Object.assign(n, built)
    } else if (e.event === 'text') {
      if (!stack.length) throw new Error('MD4C text outside a root')
      if (e.kind === 6) ctx.note(path, 'unsupported-node', 'degraded', 'Raw inline HTML is retained as text.')
      stack.at(-1).node.children.push(e.kind === 2 ? { type: 'hard_break' } : text(e.kind === 3 ? ' ' : e.kind === 1 ? '�' : e.kind === 4 ? decode(e.value) : e.value))
    } else throw new Error(`Unknown MD4C event at ${path}`)
  }
  if (!root || stack.length) throw new Error('Incomplete MD4C event stream')
  return root
}

function decode(value) { return plain(parseHtml(value.replace(/</g, '&lt;').replace(/>/g, '&gt;'))) }
