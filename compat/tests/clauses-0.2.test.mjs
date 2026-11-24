import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const mapPath = 'resources/clauses-0.2.json'
const map = JSON.parse(readFileSync(join(root, mapPath), 'utf8'))
const skip = new Set(['node_modules', 'spec', 'dist', '_site', '.git', '.cache', '.claude', '.venv', 'test-results', 'playwright-report', 'reports'])

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* files(path)
    else if (/\.(m?js|json|md|v|php)$/.test(entry.name) && relative(root, path) !== mapPath) yield path
  }
}

test('every 0.1 clause the lane cites has a 0.2 status', () => {
  const cited = new Set()
  for (const path of files(root)) {
    for (const [id] of readFileSync(path, 'utf8').matchAll(/\bCARVE-P\d+-\d{3}\b/g)) cited.add(id)
  }
  assert.deepEqual([...cited].filter(id => !map.rules[id]).sort(), [])
})

test('each entry names 0.2 clauses, and a change names its ticket', () => {
  for (const [id, rule] of Object.entries(map.rules)) {
    assert.ok(['holds', 'changed', 'retired'].includes(rule.status), id)
    assert.ok(rule.clauses.length > 0 && rule.clauses.every(c => /^C2-[A-Z]-\d{3}$/.test(c)), id)
    if (rule.status !== 'holds') assert.match(rule.ticket, /^markup-carve\/carve-conformance#\d+$/, id)
  }
})
