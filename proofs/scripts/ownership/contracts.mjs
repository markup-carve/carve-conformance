import assert from 'node:assert/strict'
import { project } from './projection.mjs'

export const contractCases = [
  { id: 'wrap-prose', contract: 'eligible-wrap', before: 'alpha beta gamma\n', after: 'alpha\nbeta gamma\n', expected: 'equal' },
  { id: 'wrap-unicode', contract: 'eligible-wrap', before: 'alpha café 日本語\n', after: 'alpha café\n日本語\n', expected: 'equal' },
  { id: 'wrap-emphasis', contract: 'eligible-wrap', before: 'alpha /italic words/ omega\n', after: 'alpha /italic\nwords/ omega\n', expected: 'equal' },
  { id: 'wrap-link-label', contract: 'eligible-wrap', before: 'alpha [label words](/target) omega\n', after: 'alpha [label\nwords](/target) omega\n', expected: 'equal' },
  { id: 'wrap-list-marker', contract: 'eligible-wrap', before: 'alpha - item words\n', after: 'alpha\n- item words\n', expected: 'equal' },
  { id: 'wrap-heading', contract: 'wrap-exclusion', before: 'alpha # heading\n', after: 'alpha\n# heading\n', expected: 'different' },
  { id: 'wrap-quote', contract: 'wrap-exclusion', before: 'alpha > quoted\n', after: 'alpha\n> quoted\n', expected: 'different' },
  { id: 'wrap-code-bytes', contract: 'wrap-exclusion', before: 'alpha `code words`\n', after: 'alpha `code\nwords`\n', expected: 'different' },
  { id: 'wrap-comment', contract: 'wrap-exclusion', before: 'alpha %% hidden words\n', after: 'alpha %% hidden\nwords\n', expected: 'different' },
  { id: 'append-after-heading', expectedTail: '<ul><li>later</li></ul>', contract: 'closed-prefix', before: '- alpha\n\n# Boundary\n\n', after: '- alpha\n\n# Boundary\n\n- later\n', expected: 'equal', projection: 'prefix' },
  { id: 'append-after-code-boundary', expectedTail: '<blockquote><p>later</p></blockquote>', contract: 'closed-prefix', before: '```\npayload\n```\n\n# Boundary\n\n', after: '```\npayload\n```\n\n# Boundary\n\n> later\n', expected: 'equal', projection: 'prefix' },
  { id: 'append-list-item', contract: 'append-exclusion', before: '- alpha\n\n', after: '- alpha\n\n- later\n', expected: 'different', projection: 'prefix' },
  { id: 'attach-code-caption', contract: 'append-exclusion', before: '```\npayload\n```\n\n', after: '```\npayload\n```\n\n^ caption\n', expected: 'different', projection: 'prefix' },
  { id: 'attach-quote-caption', contract: 'append-exclusion', before: '> alpha\n\n', after: '> alpha\n\n^ caption\n', expected: 'different', projection: 'prefix' },
  { id: 'replace-link-definition', contract: 'reference-render-shape', before: '[label][ref]\n\n[ref]: /one\n', after: '[label][ref]\n\n[ref]: /two\n', expected: 'equal', projection: 'reference' },
  { id: 'replace-image-definition', contract: 'reference-render-shape', before: '![label][ref]\n\n[ref]: /one\n', after: '![label][ref]\n\n[ref]: /two\n', expected: 'equal', projection: 'reference' },
  { id: 'unrelated-definition', contract: 'reference-render-shape', before: '[label][ref]\n\n[ref]: /one\n', after: '[label][ref]\n\n[ref]: /one\n[other]: /two\n', expected: 'equal' },
]

export function referenceShape(nodes) {
  return nodes.map(node => typeof node === 'string' ? node : {
    ...node,
    attrs: Object.fromEntries(Object.entries(node.attrs).filter(([key]) =>
      !(['a', 'img'].includes(node.tag) && ['href', 'src', 'title'].includes(key)))),
    children: referenceShape(node.children),
  })
}

export function flattenHeadingSections(nodes) {
  return nodes.flatMap(node => {
    if (typeof node === 'string' || node.tag !== 'section' || !node.attrs.id || node.attrs.role) return [node]
    return flattenHeadingSections(node.children).map((child, i) => i === 0 && typeof child !== 'string' && /^h[1-6]$/.test(child.tag)
      ? { ...child, attrs: { ...child.attrs, id: node.attrs.id } } : child)
  })
}

function referenceDestination(nodes, id) {
  const found = []
  const visit = values => { for (const node of values) if (typeof node !== 'string') {
    if (['a', 'img'].includes(node.tag)) found.push(node.attrs[node.tag === 'a' ? 'href' : 'src'])
    visit(node.children)
  } }
  visit(nodes)
  assert.equal(found.length, 1, `${id}: expected one reference element`)
  return found[0]
}

export function observeContracts(readers, inputs = contractCases) {
  const rows = []
  for (const [reader, render] of Object.entries(readers)) for (const input of inputs) {
    const rawLeft = project(render(input.before)), rawRight = project(render(input.after))
    let left = rawLeft, right = rawRight
    if (input.projection === 'prefix') {
      left = flattenHeadingSections(left); right = flattenHeadingSections(right)
      if (input.expected === 'equal') {
        assert.ok(right.length > left.length, `${reader}/${input.id}: appended block disappeared`)
        assert.deepEqual(right.slice(left.length), project(input.expectedTail), `${reader}/${input.id}: appended block differs`)
      }
      right = right.slice(0, left.length)
    }
    if (input.projection === 'reference') {
      assert.equal(referenceDestination(rawLeft, input.id), '/one', `${reader}/${input.id}: original destination missing`)
      assert.equal(referenceDestination(rawRight, input.id), '/two', `${reader}/${input.id}: changed destination missing`)
      left = referenceShape(left); right = referenceShape(right)
    }
    const outcome = JSON.stringify(left) === JSON.stringify(right) ? 'equal' : 'different'
    assert.equal(outcome, input.expected, `${reader}/${input.id}: scoped contract changed`)
    rows.push({ ...input, reader, outcome, left, right, rawLeft, rawRight })
  }
  return rows
}
