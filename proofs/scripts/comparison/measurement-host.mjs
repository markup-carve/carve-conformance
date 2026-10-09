import assert from 'node:assert/strict'
import { cpus, loadavg, availableParallelism } from 'node:os'

export function measurementHost() {
  const controlled = process.env.CARVE_CONTROLLED_BENCHMARK === '1'
  if (controlled) {
    assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Controlled evidence requires the dedicated workflow runner')
    assert.ok(process.env.GITHUB_RUN_ID && process.env.GITHUB_SHA)
  }
  return { controlled, availableCpus: availableParallelism(), logicalCpus: cpus().length,
    ...(controlled ? { provider: 'GitHub Actions', runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, sourceCommit: process.env.GITHUB_SHA, runUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` } : { provider: 'local/shared host' }) }
}
export function checkHostLoad() {
  const load = loadavg()
  if (process.env.CARVE_CONTROLLED_BENCHMARK === '1') {
    assert.ok(load[0] <= availableParallelism(), `Runner overloaded: one-minute load ${load[0]} exceeds ${availableParallelism()} available CPUs`)
  }
  return load
}
