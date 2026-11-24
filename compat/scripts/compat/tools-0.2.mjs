import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeParse from 'rehype-parse'
import rehypeStringify from 'rehype-stringify'
import * as commonmark from 'commonmark'
import * as djot from '@djot/djot'
import { load as loadAscii, getVersion as asciiVersion } from '@asciidoctor/core'
import { XMLParser } from 'fast-xml-parser'
import { cmarkTree, toolNames, nativeTools } from './tools.mjs'
import { context, document, coalesce, text, plain, parseHtml, paragraph, imageParagraph, list, listItem, codeBlock, link, image, footnote, footnoteRef, attrs, fromHast, fromMdast, fromCommonmark, fromDjot, fromDocutils, fromMd4c } from './trees-0.2.mjs'

export { toolNames, nativeTools }
const md = unified().use(remarkParse).use(remarkGfm)
const htmlWriter = unified().use(remarkRehype).use(rehypeStringify)
const hastWriter = unified().use(rehypeStringify)
const native = (command, args, input) => execFileSync(command, args, { input, encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024 })

export async function readForeign(tool, source, format) {
  const ctx = context(tool)
  let ast, html, raw, version
  if (tool === 'mdast') {
    raw = md.parse(source)
    ast = fromMdast(raw, ctx)
    html = htmlWriter.stringify(await htmlWriter.run(raw))
  } else if (tool === 'hast') {
    raw = parseHtml(source)
    ast = fromHast(raw, ctx)
    html = hastWriter.stringify(raw)
  } else if (tool === 'commonmark') {
    raw = new commonmark.Parser().parse(source)
    ast = fromCommonmark(raw, ctx)
    html = new commonmark.HtmlRenderer().render(raw)
  } else if (tool === 'cmark') {
    const command = process.env.CARVE_CMARK ?? 'cmark'
    const xml = native(command, ['--to', 'xml'], source)
    raw = new XMLParser({ preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false }).parse(xml)
    ast = fromCommonmark(cmarkTree(raw), ctx)
    html = native(command, ['--to', 'html'], source)
    version = native(command, ['--version'], '').trim()
  } else if (tool === 'djot') {
    raw = djot.parse(source)
    ast = fromDjot(raw, ctx)
    html = djot.renderHTML(raw)
    version = djot.version
  } else if (tool === 'docutils') {
    const result = JSON.parse(native(process.env.CARVE_COMPAT_PYTHON ?? 'python3', [fileURLToPath(new URL('./docutils-driver.py', import.meta.url))], source))
    raw = result.tree
    ast = fromDocutils(raw, ctx)
    const full = unified().use(rehypeParse).parse(result.html)
    const find = (n, tag) => n.tagName === tag ? n : n.children?.map(c => find(c, tag)).find(Boolean)
    const body = find(full, 'main')
    if (!body) throw new Error('Docutils did not emit a main element')
    html = hastWriter.stringify({ type: 'root', children: body.children })
    version = result.version
  } else if (tool === 'asciidoctor') {
    raw = await loadAscii(source, { safe: 'secure', attributes: { 'sectids!': '', 'experimental!': '', showtitle: '' } })
    ast = await fromAscii(raw, ctx)
    html = await raw.convert()
    version = asciiVersion()
  } else if (tool === 'pandoc') {
    const command = process.env.CARVE_PANDOC ?? 'pandoc'
    raw = JSON.parse(native(command, [format === 'pandoc-json' ? '--from=json' : '--from=markdown-smart-auto_identifiers', '--to=json'], source))
    ast = fromPandoc(raw, ctx)
    html = native(command, ['--from=json', '--to=html5', '--syntax-highlighting=none'], JSON.stringify(raw))
    version = native(command, ['--version'], '').split('\n')[0]
  } else if (tool === 'md4c') {
    const command = process.env.CARVE_MD4C_DRIVER ?? '.cache/compat/md4c-driver'
    raw = native(command, [], source).trim().split('\n').map(line => JSON.parse(line))
    ast = fromMd4c(raw, ctx)
    html = native(command, ['--html'], source)
    version = native(command, ['--version'], '').trim()
  } else throw new Error(`Unknown compatibility tool: ${tool}`)
  const packages = { mdast: 'remark-parse', hast: 'rehype-parse', commonmark: 'commonmark' }
  if (packages[tool]) version = JSON.parse(readFileSync(new URL(`../../node_modules/${packages[tool]}/package.json`, import.meta.url))).version
  ctx.note('', 'foreign-source-coordinates', 'normalized', 'Mapped tree has no Carve source positions.')
  return { ast, html, diagnostics: ctx.diagnostics, version, ...(tool === 'pandoc' ? { foreignAst: raw } : {}) }
}

async function fromAscii(root, ctx) {
  const inline = async (html, path) => {
    ctx.note(path, 'inline-via-html', 'normalized', 'Asciidoctor exposes inline content through converted HTML.')
    const fragment = { type: 'root', children: [{ type: 'element', tagName: 'p', properties: {}, children: parseHtml(html).children }] }
    return fromHast(fragment, ctx, { generated: true }).children[0].children
  }
  const map = async (n, path) => {
    const type = n.getContext()
    if (n.getId?.()) ctx.note(`${path}/id`, 'unsupported-field', 'dropped', 'AsciiDoc block identifiers are outside this adapter subset.')
    if (n.getRoles?.().length) ctx.note(`${path}/roles`, 'unsupported-field', 'dropped', 'AsciiDoc block roles are outside this adapter subset.')
    if (!['document', 'section'].includes(type) && n.getTitle?.()) ctx.note(`${path}/title`, 'unsupported-field', 'dropped', 'AsciiDoc block titles are outside this adapter subset.')
    for (const key of ['attribution', 'citetitle']) if (n.getAttribute?.(key)) ctx.note(`${path}/${key}`, 'unsupported-field', 'dropped', `${key} is outside this adapter subset.`)
    const blocks = async () => coalesce((await Promise.all(n.getBlocks().map((c, i) => map(c, `${path}/blocks/${i}`)))).flat())
    if (type === 'document') return document([
      ...(n.hasHeader() && n.getDoctitle() ? [{ type: 'heading', level: 1, children: await inline(n.getDoctitle(), '/title') }] : []),
      ...await blocks(),
    ])
    if (type === 'section') {
      ctx.note(path, 'automatic-section', 'normalized', 'Flattened AsciiDoc section structure.')
      return [{ type: 'heading', level: n.getLevel() + 1, children: await inline(await n.getTitle(), `${path}/title`) }, ...await blocks()]
    }
    if (type === 'paragraph') return imageParagraph(paragraph(await inline(await n.getContent(), path)))
    if (type === 'image') return { type: 'paragraph', role: 'image', children: [image(n.getAttribute('target'), n.getAttribute('alt') ?? '')] }
    if (type === 'quote') return { type: 'block_quote', children: await blocks() }
    if (type === 'listing' || type === 'literal') return codeBlock(n.getSource() + '\n', n.getAttribute('language'))
    if (type === 'thematic_break') return { type: 'thematic_break' }
    if (type === 'ulist' || type === 'olist') {
      ctx.note(`${path}/spacing`, 'list-layout-unavailable', 'normalized', 'AsciiDoc list rendering uses paragraph wrappers; this adapter uses loose lists.')
      const items = await Promise.all(n.getItems().map(async (item, i) => {
        if (Object.hasOwn(item.getAttributes(), 'checkbox')) ctx.note(`${path}/children/${i}/checkbox`, 'unsupported-field', 'dropped', 'AsciiDoc task state is outside this adapter subset.')
        return listItem([paragraph(await inline(await item.getText(), `${path}/children/${i}/text`)), ...await mapItem(item, `${path}/children/${i}`)])
      }))
      return list({ ordered: type === 'olist', start: type === 'olist' ? Number(n.getAttribute('start') ?? 1) : undefined, tight: false }, items)
    }
    return ctx.unsupported({ type, text: plain(parseHtml(await n.convert())) }, path, true)
  }
  const mapItem = async (n, path) => coalesce((await Promise.all(n.getBlocks().map((c, i) => map(c, `${path}/blocks/${i}`)))).flat())
  return map(root, '')
}

const readable = n => typeof n === 'string' ? n : Array.isArray(n) ? n.map(readable).join('') : n?.t === 'Str' ? n.c : n?.t === 'Space' || n?.t === 'SoftBreak' ? ' ' : readable(n?.c ?? '')
const pandocAttrs = attr => {
  const [id, classes, values] = attr ?? ['', [], []]
  const out = attrs(id || undefined, classes, values)
  return Object.keys(out).length ? out : undefined
}

export function fromPandoc(root, ctx = context('pandoc')) {
  if (!Array.isArray(root.blocks) || !Array.isArray(root['pandoc-api-version'])) throw new Error('Invalid Pandoc JSON document')
  const notes = [], noteBodies = new Set()
  const map = (n, path) => {
    const c = n.c, children = (nodes, suffix = '/c') => coalesce(nodes.flatMap((child, i) => map(child, `${path}${suffix}/${i}`)))
    let out, a
    if (n.t === 'Str') return text(c)
    if (n.t === 'Space' || n.t === 'SoftBreak') return text(' ')
    if (n.t === 'LineBreak' || n.t === 'HorizontalRule') return { type: n.t === 'LineBreak' ? 'hard_break' : 'thematic_break' }
    const inline = { Emph: 'emphasis', Strong: 'strong', Strikeout: 'strike', Underline: 'underline', Superscript: 'superscript', Subscript: 'subscript' }
    if (inline[n.t]) out = { type: inline[n.t], children: children(c) }
    else if (n.t === 'Para' || n.t === 'Plain') out = imageParagraph(paragraph(children(c)))
    else if (n.t === 'Figure') {
      const body = children(c[2], '/c/2')
      if (body.length !== 1 || body[0].role !== 'image' || ![body[0].children[0].alt, ''].includes(readable(c[1][1]).trim())) return ctx.unsupported({ type: 'figure', value: readable(c) }, path, true)
      ctx.note(path, 'implicit-figure', 'normalized', 'Read a Pandoc implicit figure as the block image paragraph.')
      return body[0]
    }
    else if (n.t === 'Header') { a = pandocAttrs(c[1]); out = { type: 'heading', level: c[0], children: children(c[2], '/c/2') } }
    else if (n.t === 'Span') { a = pandocAttrs(c[0]); out = { type: 'span', children: children(c[1], '/c/1') } }
    else if (n.t === 'Code') { a = pandocAttrs(c[0]); out = { type: 'code', value: c[1] } }
    else if (n.t === 'CodeBlock') { a = pandocAttrs([c[0][0], c[0][1].slice(1), c[0][2]]); out = codeBlock(c[1] + '\n', c[0][1][0]) }
    else if (n.t === 'Link') { a = pandocAttrs(c[0]); out = link(c[2][0], children(c[1], '/c/1'), c[2][1]) }
    else if (n.t === 'Image') { a = pandocAttrs(c[0]); out = image(c[2][0], readable(c[1]), c[2][1]) }
    else if (n.t === 'BlockQuote') out = { type: 'block_quote', children: children(c) }
    else if (n.t === 'BulletList' || n.t === 'OrderedList') {
      const ordered = n.t === 'OrderedList', items = ordered ? c[1] : c, base = ordered ? '/c/1' : '/c'
      const style = ordered ? ({ LowerAlpha: 'a', UpperAlpha: 'A', LowerRoman: 'i', UpperRoman: 'I' })[c[0][1].t] : undefined
      if (ordered && !style && !['Decimal', 'DefaultStyle'].includes(c[0][1].t)) ctx.note(`${path}/c/0/1`, 'unsupported-field', 'dropped', 'This Pandoc ordered-list numbering style is outside the adapter subset.')
      out = list({ ordered, style, start: ordered ? c[0][0] : undefined, tight: items.every(item => item[0]?.t === 'Plain') }, items.map((item, i) => {
        const mapped = children(item, `${base}/${i}`)
        if (/^[☐☒] /.test(plain(mapped[0] ?? {}))) {
          ctx.note(`${path}${base}/${i}/0/c/0`, 'unsupported-field', 'dropped', 'Pandoc stores task state as a checkbox glyph; this adapter retains the item text without the flag.')
          if (mapped[0]?.children[0]?.type === 'text') mapped[0].children[0].value = mapped[0].children[0].value.replace(/^[☐☒] /, '')
        }
        return listItem(mapped)
      }))
    } else if (n.t === 'DefinitionList') out = { type: 'definition_list', children: c.flatMap(([term, definitions], i) => [{ type: 'definition_term', children: children(term, `/c/${i}/0`) }, ...definitions.map((blocks, j) => ({ type: 'definition_description', children: children(blocks, `/c/${i}/1/${j}`) }))]) }
    else if (n.t === 'Note') {
      const signature = JSON.stringify(c)
      if (noteBodies.has(signature)) ctx.note(path, 'unsupported-field', 'degraded', 'Pandoc repeats note bodies without preserving whether their source references shared a label.')
      noteBodies.add(signature)
      const key = String(notes.length + 1), note = footnote(key, [])
      notes.push(note); note.children = children(c)
      ctx.note(path, 'footnote-label-normalization', 'normalized', 'Pandoc publishes note bodies without source labels; assigned numeric document-order keys.')
      return footnoteRef(key)
    } else return ctx.unsupported({ type: n.t, value: readable(c) }, path, ['Div', 'RawBlock', 'Table'].includes(n.t))
    if (a) out.attrs = a
    return out
  }
  if (Object.keys(root.meta ?? {}).length) ctx.note('/meta', 'unsupported-field', 'dropped', 'Pandoc document metadata is outside the Carve document subset.')
  return document([...root.blocks.flatMap((n, i) => map(n, `/blocks/${i}`)), ...notes])
}
