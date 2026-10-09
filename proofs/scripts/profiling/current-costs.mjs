import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync, renameSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { cpus, loadavg, platform } from 'node:os'
import { aggregateFrames } from './summary.mjs'
import { comparisonEnvironment, digest, costFiles } from '../comparison/environment.mjs'

import { costFamilies, checkControls, costVariants } from '../comparison/controls.mjs'
import { measurementHost, checkHostLoad } from '../comparison/measurement-host.mjs'

const output = process.argv[2] ?? 'reports/current-costs.json'
const metadata = { ...comparisonEnvironment(), generatedAt: new Date().toISOString(), node: process.version, platform: platform(), cpu: cpus()[0].model,
  logicalCpus: cpus().length, loadStart: loadavg(), runnerSha256: digest(costFiles), execution: measurementHost(), controls: checkControls(),
  method: 'Two fresh-worker rounds per fixture and phase, with reversed variant order in the second round. Parse, full HTML and direct-HTML eligibility attempts measured separately at the largest existing fixture per family. 500ms warmup, seven batches of at least 100ms with GC before each; separate 500ms CPU profile and 50-call heap sample at 4096 bytes, including collected objects. Position variants preserve the same reader tree after removing positions. Dedicated workflow runs are labeled in metadata; local runs remain shared-host observations. Samples are not performance thresholds.' }
const groups = []
for (const family of costFamilies) for (const phase of ['parse', 'html', 'direct-html-probe']) {
  const variants = costVariants(phase)
  const rounds = new Map(variants.map(variant => [variant, []]))
  for (const [round, order] of [variants, [...variants].reverse()].entries()) for (const variant of order) {
    checkHostLoad()
    const result = spawnSync(process.execPath, ['--expose-gc', fileURLToPath(new URL('./cost-worker.mjs', import.meta.url)), variant, family, phase], { encoding: 'utf8', timeout: 60_000, maxBuffer: 4_000_000 })
    checkHostLoad()
    if (result.status !== 0) {
      writeFileSync(output + '.partial', JSON.stringify({ metadata: { ...metadata, loadEnd: loadavg() }, groups, pendingRounds: Object.fromEntries(rounds), failedWorker: { variant, family, phase, round, order, exitCode: result.status, signal: result.signal, error: result.error?.message, stdout: result.stdout, stderr: result.stderr } }, null, 2) + '\n')
      assert.equal(result.status, 0, result.error?.message ?? result.stderr)
    }
    rounds.get(variant).push({ round, order, ...JSON.parse(result.stdout) })
    writeFileSync(output + '.partial', JSON.stringify({ metadata: { ...metadata, loadEnd: loadavg() }, groups, pendingRounds: Object.fromEntries(rounds) }, null, 2) + '\n')
    console.log(`${family}/${phase}/${variant}/round-${round}: recorded`)
  }
  for (const variant of variants) {
    const observations = rounds.get(variant), first = observations[0]
    assert.equal(first.htmlPath, observations[1].htmlPath)
    groups.push({ variant, phase, family, htmlPath: first.htmlPath, size: first.size, bytes: first.bytes, rounds: observations,
      samples: observations.flatMap(g => g.samples), cpuIterations: observations.reduce((sum, g) => sum + g.cpuIterations, 0),
      cpuSamples: aggregateFrames(observations.flatMap(g => g.cpuSamples), 'selfUs'),
      heapIterations: observations.reduce((sum, g) => sum + g.heapIterations, 0),
      sampledAllocationBytes: observations.reduce((sum, g) => sum + g.sampledAllocationBytes, 0),
      heapNodes: aggregateFrames(observations.flatMap(g => g.heapNodes), 'sampledBytes') })
  }
  writeFileSync(output + '.partial', JSON.stringify({ metadata: { ...metadata, loadEnd: loadavg() }, groups }, null, 2) + '\n')
}
renameSync(output + '.partial', output)
