import { renderInline, REF_FRAME } from '../../spec/scripts/spec/render.mjs'

const sourceFields = new Set(['pos', 'srcByteLength', 'footnoteDefPos', 'rawRef'])

const softHtml = text => text.split(/(<code\b[^>]*>[\s\S]*?<\/code>)/g)
  .map((part, i) => i % 2 ? part : part.replaceAll('\n', ' ')).join('')

export function normalizeInlineHtml(text) {
  return softHtml(text.replace(REF_FRAME, (_, encoded) => {
    const frame = JSON.parse(encoded)
    delete frame.source
    frame.text = softHtml(frame.text)
    return '\uE000ref:' + JSON.stringify(frame) + '\uE001'
  }))
}

export function normalize(value, { referenceSyntax = false, preserveSourceFields = false } = {}) {
  if (Array.isArray(value)) {
    const result = []
    for (const original of value) {
      const node = normalize(original, { referenceSyntax, preserveSourceFields })
      const last = result.at(-1)
      if (node?.type === 'text' && last?.type === 'text' &&
          Object.keys(node).length === 2 && Object.keys(last).length === 2) last.value += node.value
      else result.push(node)
    }
    return result
  }
  if (!value || typeof value !== 'object') return value
  if (value instanceof Map) return normalize(Object.fromEntries(value), { referenceSyntax, preserveSourceFields })
  if (!preserveSourceFields && value.type === 'soft_break') return { type: 'text', value: ' ' }
  const result = {}
  for (const key of Object.keys(value).sort()) {
    if (!preserveSourceFields && sourceFields.has(key)) continue
    if (!preserveSourceFields && referenceSyntax && value.ref !== undefined && ['href', 'src', 'title'].includes(key)) continue
    if (!preserveSourceFields && value.t === 'para' && key === 'lines') {
      result.lines = [value.lines.join(' ')]
      result.inlineHtml = normalizeInlineHtml(renderInline(value.lines.join('\n')))
    }
    else result[key] = normalize(value[key], { referenceSyntax, preserveSourceFields: preserveSourceFields || key === 'attrs' })
  }
  return result
}
