import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { adapters, blocks } from './adapters.mjs'
import { scalingCases } from './scaling-cases.mjs'

export const controlFamilies = ['interior-whitespace', 'literal-brackets', 'inline-links', 'sparse-definitions', 'dense-definitions', 'long-unicode', 'unicode-paragraphs']
export const costFamilies = ['long-line', 'unclosed-code', 'many-paragraphs', 'nested-quotes', 'nested-lists', ...controlFamilies]
export function checkControls() {
  return controlFamilies.flatMap(family => scalingCases[family].sizes.map(size => {
    const source = scalingCases[family].make(size)
    const projection = blocks('carve', source)
    const html = adapters.carve.html(source).trim()
    for (const reader of ['djot', 'commonmark']) {
      if (family !== 'dense-definitions') assert.deepEqual(blocks(reader, source), projection, `${family}/${size}/${reader}: shared-syntax tree differs`)
      assert.equal(adapters[reader].html(source).trim(), html, `${family}/${size}/${reader}: HTML differs`)
    }
    return { family, size, bytes: Buffer.byteLength(source), sourceSha256: createHash('sha256').update(source).digest('hex'), treeCompared: family !== 'dense-definitions', outputSha256: createHash('sha256').update(html).digest('hex'), readers: ['carve', 'djot', 'commonmark'] }
  }))
}

export function costVariants(phase) {
  if (phase === 'parse') return ['carve', 'carve-no-positions', 'djot', 'djot-positions', 'commonmark']
  if (phase === 'html') return ['carve', 'djot', 'commonmark']
  if (phase === 'direct-html-probe') return ['carve']
  throw new Error('Unknown cost phase: ' + phase)
}
