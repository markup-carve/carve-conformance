import { parseFragment } from 'parse5'

const blocks = new Set(['p', 'div', 'blockquote', 'ul', 'ol', 'li', 'pre', 'section', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr'])
export function project(html) {
  function walk(node, preserve = false) {
    if (node.nodeName === '#text') return preserve ? node.value : node.value.replace(/\s+/g, ' ')
    if (node.nodeName === '#comment') return null
    const keep = preserve || node.tagName === 'pre' || node.tagName === 'code'
    const children = (node.childNodes ?? []).map(child => walk(child, keep)).filter(x => x !== null)
    const structural = !node.tagName || children.some(x => typeof x === 'object' && blocks.has(x.tag))
    const content = structural && !keep ? children.filter(x => x !== ' ') : children
    if (!keep && blocks.has(node.tagName)) {
      if (typeof content[0] === 'string') content[0] = content[0].trimStart()
      if (typeof content.at(-1) === 'string') content[content.length - 1] = content.at(-1).trimEnd()
    }
    if (!node.tagName) return content
    return { tag: node.tagName, attrs: Object.fromEntries(node.attrs.map(a => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b))), children: content }
  }
  return walk(parseFragment(html))
}
export function partition(outputs) {
  const groups = new Map()
  for (const [reader, output] of Object.entries(outputs)) {
    const key = JSON.stringify(project(output))
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(reader)
  }
  return [...groups.values()]
}
