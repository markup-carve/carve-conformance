import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { evidenceEnvironment } from '../evidence-environment.mjs'
const read = p => JSON.parse(readFileSync(new URL('../../' + p, import.meta.url)))
export function comparisonEnvironment() {
  const metadata = evidenceEnvironment(), project = read('package.json'), lock = read('package-lock.json'), installed = read('node_modules/.package-lock.json')
  metadata.proofEngine = metadata.engine
  metadata.engine = project.devDependencies['carve-comparison']
  metadata.installedEngine = installed.packages['node_modules/carve-comparison']?.resolved
  assert.match(metadata.engine, /^github:markup-carve\/carve-js#[0-9a-f]{40}$/, 'Comparison requires an immutable Carve commit')
  metadata.parsers = {}
  for (const name of ['@markup-carve/carve', '@djot/djot', 'commonmark']) {
    const p = `node_modules/${name === '@markup-carve/carve' ? 'carve-comparison' : name}`, entry = lock.packages[p]
    assert.ok(entry && installed.packages[p], `Missing installed ${name}`)
    for (const key of ['version', 'resolved', 'integrity']) assert.equal(installed.packages[p][key], entry[key], `${name}: installed ${key} differs`)
    if (name === '@markup-carve/carve') assert.ok(entry.resolved.endsWith('#' + metadata.engine.split('#')[1]), 'Comparison manifest and lock commits differ')
    else assert.equal(project.devDependencies[name], entry.version, `${name}: require an exact version`)
    metadata.parsers[name] = { version: entry.version, resolved: entry.resolved, ...(entry.integrity ? { integrity: entry.integrity } : {}) }
  }
  assert.equal(metadata.specDirty, false)
  return metadata
}
export function digest(files) { return createHash('sha256').update(files.map(p => readFileSync(new URL('../../' + p, import.meta.url))).join('')).digest('hex') }
export const comparisonFiles = ['scripts/comparison/adapters.mjs', 'scripts/comparison/collect.mjs', 'tests/comparison/fixtures.mjs']

export const comparisonTimingFiles = ['scripts/comparison/bench.mjs', 'scripts/comparison/worker.mjs', 'scripts/comparison/adapters.mjs', 'scripts/comparison/environment.mjs', 'scripts/evidence-environment.mjs', 'scripts/spec-pins.mjs', 'scripts/properties/scaling-cases.mjs', 'scripts/comparison/scaling-cases.mjs', 'scripts/properties/benchmark-results.mjs', 'scripts/comparison/controls.mjs', 'scripts/comparison/measurement-host.mjs']
export const costFiles = ['scripts/profiling/current-costs.mjs', 'scripts/profiling/cost-worker.mjs', 'scripts/profiling/summary.mjs', 'scripts/properties/scaling-cases.mjs', 'scripts/comparison/scaling-cases.mjs', 'scripts/comparison/environment.mjs', 'scripts/evidence-environment.mjs', 'scripts/spec-pins.mjs', 'scripts/comparison/controls.mjs', 'scripts/comparison/measurement-host.mjs']
