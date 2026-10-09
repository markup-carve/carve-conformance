import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { parse, renderHtml } from 'carve-comparison'
import { regexWork } from '../profiling/instrument.mjs'
import { regexTotals } from '../profiling/summary.mjs'
import { wrappers } from '../../tests/comparison/fixtures.mjs'

const payloads = {
  lazy: '> first\nlazy continuation\n\nsentinel\n',
  table: '| one | two |\n| a | b |\n\nsentinel\n',
  fence: '```\n> literal\n- literal\n```\n\nsentinel\n',
  definition: '[label][ref]\n\n[ref]: /target\n\nsentinel\n',
  tabs: '- first\n\tcontinued\n\nsentinel\n',
  unicode: 'café 日本語 😀\n\nsentinel\n',
  comment: '%%%\n> hidden\n%%%\n\nsentinel\n',
  heading: '# Heading\n\nsentinel\n',
}
export function containerFixtures() {
  const fixtures = []
  for (const [family, payload] of Object.entries(payloads)) for (const depth of [1, 2, 4, 8, 16]) for (const shape of ['quotes', 'lists', 'mixed']) {
    if (shape === 'mixed' && depth === 1) continue
    let source = payload, path = []
    for (let i = 0; i < depth; i++) {
      const kind = shape === 'quotes' || (shape === 'mixed' && i % 2 === 0) ? 'quote' : 'list'
      source = wrappers[kind].wrap(source); path.unshift(kind)
    }
    fixtures.push({ id: `${family}/${shape}/${depth}`, family, shape, depth, source, payload, path })
  }
  assert.equal(new Set(fixtures.map(f => f.source)).size, fixtures.length, 'Container sources must be distinct')
  return fixtures
}
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')
export function checkPositions(ast, source) {
  const codepoints = [...source]
  let sentinelCount = 0
  function visit(value) {
    if (!value || typeof value !== 'object') return
    if (value.pos) {
      const p = value.pos
      assert.ok(Number.isInteger(p.startOffset) && Number.isInteger(p.endOffset))
      assert.ok(p.startOffset >= 0 && p.endOffset >= p.startOffset && p.endOffset <= codepoints.length, 'Position leaves the source')
      if (value.type === 'text' && value.value === 'sentinel') {
        assert.equal(codepoints.slice(p.startOffset, p.endOffset).join(''), 'sentinel', 'Leaf offsets must name the original source text')
        const start = codepoints.slice(0, p.startOffset).join('').split('\n')
        assert.equal(p.startLine, start.length)
        assert.equal(p.startColumn, [...start.at(-1)].length + 1)
        sentinelCount++
      }
    }
    for (const [key, child] of Object.entries(value)) if (key !== 'pos') {
      if (Array.isArray(child)) child.forEach(visit)
      else visit(child)
    }
  }
  visit(ast)
  assert.equal(sentinelCount, 1, 'The terminal paragraph must survive exactly once')
}
const withoutPositions = value => JSON.parse(JSON.stringify(value, (key, child) => key === 'pos' ? undefined : child))
export function payloadProjection(ast, path) {
  let nodes = ast.children.filter(node => node.type !== 'link_reference_definition')
  for (const kind of path) {
    assert.equal(nodes.length, 1, 'Expected one authored wrapper')
    const node = nodes[0]
    assert.equal(node.type, kind === 'quote' ? 'block_quote' : 'list')
    if (kind === 'list') {
      assert.equal(node.items.length, 1, 'Expected one list item')
      nodes = node.items[0].children
    } else nodes = node.children
  }
  return withoutPositions(nodes.filter(node => node.type !== 'link_reference_definition'))
}
export function collectContainerRegressions() {
  return containerFixtures().map(fixture => {
    const ast = parse(fixture.source)
    checkPositions(ast, fixture.source)
    const payload = payloadProjection(ast, fixture.path)
    assert.deepEqual(payload, payloadProjection(parse(fixture.payload), []), `${fixture.id}: wrapping changed payload structure`)
    if (fixture.family === 'definition') assert.match(renderHtml(ast), /href="\/target"[^>]*>label<\/a>/)
    let instrumented
    const work = regexTotals(regexWork(() => { instrumented = parse(fixture.source) }))
    assert.deepEqual(instrumented, ast, 'Instrumentation changed the full AST including positions')
    const html = renderHtml(ast)
    return { ...fixture, payloadProjection: payload, astSha256: hash(ast), htmlSha256: hash(html), work }
  })
}
