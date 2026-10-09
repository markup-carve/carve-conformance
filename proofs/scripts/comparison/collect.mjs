import { adapters, blocks, unwrap } from './adapters.mjs'
import { paragraphs, fragments, wrappers, references, prefixes, suffixes, probes } from '../../tests/comparison/fixtures.mjs'
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
export function collectComparison() {
  const rows = []
  for (const reader of Object.keys(adapters)) {
    const compare = (family, id, before, after, transform = x => x, options = {}) => {
      try {
        const left = blocks(reader, before, options), right = transform(blocks(reader, after, options), left.length)
        rows.push({ reader, family, id, before, after, outcome: equal(left, right) ? 'equal' : 'different', left, right })
      } catch (error) { rows.push({ reader, family, id, before, after, outcome: 'error', error: error.message }) }
    }
    for (const [id, forms] of Object.entries(paragraphs)) {
      const s = forms[reader]
      for (let i = 0; i < s.length; i++) if (s[i] === ' ') compare('wrapping', `${id}@${i}`, s + '\n', s.slice(0, i) + '\n' + s.slice(i + 1) + '\n')
    }
    for (const [id, forms] of Object.entries(fragments)) for (const [name, wrapper] of Object.entries(wrappers)) compare('containers', `${id}/${name}`, forms[reader], wrapper.wrap(forms[reader]), x => unwrap(x, wrapper.path))
    for (const [id, source] of Object.entries(references)) for (const variant of ['defined', 'changed', 'unrelated']) {
      const before = source + (variant === 'changed' ? '\n[ref]: /target\n' : '')
      const after = source + (variant === 'unrelated' ? '\n[other]: /other\n' : `\n[ref]: /${variant === 'changed' ? 'other' : 'target'}\n`)
      compare('locality', `${id}/${variant}`, before, after, x => x.slice(0, 1), { locality: true })
      const firstParagraph = s => { const match = adapters[reader].html(s).match(/<p(?:\s[^>]*)?>[\s\S]*?<\/p>/); if (!match) throw new Error('Missing reference paragraph'); return match[0] }
      try {
        const left = firstParagraph(before), right = firstParagraph(after)
        rows.push({ reader, family: 'resolution', id: `${id}/${variant}`, before, after, outcome: equal(left, right) ? 'equal' : 'different', left, right })
      } catch (error) { rows.push({ reader, family: 'resolution', id: `${id}/${variant}`, before, after, outcome: 'error', error: error.message }) }
    }
    for (const [id, before] of Object.entries(prefixes)) for (const [name, after] of Object.entries(suffixes)) compare('stability', `${id}/${name}`, before, before + after, (x, n) => x.slice(0, n))
    for (const [id, source] of Object.entries(probes)) rows.push({ reader, family: 'dialect-probe', id, source, html: adapters[reader].html(source) })
  }
  return rows
}
