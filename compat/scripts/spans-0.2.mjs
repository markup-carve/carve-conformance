// Measures the span cases of external-compat/cases.json against a carve-js 0.2 build.
// Usage: node scripts/spans-0.2.mjs <carve-js next2 checkout, built> [--check]
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const recordPath = join(root, 'resources/spans-0.2.json')
const casesPath = join(root, 'tests/external-compat/cases.json')

export const spanCaseIds = (cases) =>
  cases.filter(c => /"(?:colspan|rowspan)"|(?:col|row)span=/.test(JSON.stringify([c.ast, c.html]))).map(c => c.id)

// Each span as "<group> <group index> row <r> cell <c> <width>x<height>", positions counted within the group.
function spans(node, out = []) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const child of node) spans(child, out)
    return out
  }
  if (node.type === 'table') {
    for (const [g, group] of node.children.entries()) {
      for (const [r, row] of (group.children ?? []).entries()) {
        for (const [c, cell] of (row.children ?? []).entries()) {
          if (cell.colspan || cell.rowspan) out.push(`${group.type} ${g} row ${r} cell ${c} ${cell.colspan ?? 1}x${cell.rowspan ?? 1}`)
        }
      }
    }
  }
  for (const value of Object.values(node)) if (value && typeof value === 'object') spans(value, out)
  return out
}

function roundtrip(carve, tree) {
  const before = spans(tree)
  try {
    const after = spans(carve.parse(carve.write(tree)))
    return { spans: before, result: JSON.stringify(after) === JSON.stringify(before) ? 'same spans' : `spans changed: ${after.join(', ')}` }
  } catch (error) {
    if (!error.diagnostics) throw error
    return { spans: before, result: 'refused', diagnostics: error.diagnostics.map(d => `${d.code} ${d.path}`) }
  }
}

export async function measure(checkout) {
  const carve = await import(pathToFileURL(join(checkout, 'dist/index.js')))
  const { importDocument } = await import(pathToFileURL(join(checkout, 'dist/import.js')))
  const cases = JSON.parse(readFileSync(casesPath, 'utf8')).cases
  const measured = {}
  for (const id of spanCaseIds(cases)) {
    const c = cases.find(entry => entry.id === id)
    measured[id] = {
      tree: roundtrip(carve, carve.migrateTree(c.ast).document),
      ...(c.html ? { html: roundtrip(carve, importDocument(c.html, { from: 'html' }).document) } : {}),
    }
  }
  return measured
}

async function main([checkout, flag]) {
  assert.ok(checkout && (flag === undefined || flag === '--check'), 'Usage: node scripts/spans-0.2.mjs <carve-js checkout> [--check]')
  const record = JSON.parse(readFileSync(recordPath, 'utf8'))
  const measured = await measure(checkout)
  if (flag === '--check') {
    assert.deepEqual(measured, record.measured)
    console.log(`${Object.keys(measured).length} span cases match ${recordPath}.`)
    return
  }
  writeFileSync(recordPath, JSON.stringify({ ...record, measured }, null, 2) + '\n')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
