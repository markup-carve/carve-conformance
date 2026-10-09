import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

export const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
export function envelope(training, holdout) {
  assert.ok(training.length > 0 && holdout.length > 0)
  assert.ok([...training, ...holdout].every(value => Number.isFinite(value) && value >= 0))
  const minimum = Math.min(...training), limit = Math.max(...training)
  return { training, holdout, minimum, limit, observedRange: limit - minimum,
    holdoutExceeded: holdout.filter(value => value > limit).length,
    nextWorkerCoverageUnderExchangeability: training.length / (training.length + 1),
    enforcement: 'observation-only' }
}
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')
export function calibrate(baseline, holdout, paths) {
  for (const data of [...baseline, ...holdout]) {
    assert.equal(data.metadata.execution.controlled, true, 'Calibration requires controlled runner observations')
    assert.ok(data.metadata.execution.runId)
  }
  assert.equal(baseline[0].metadata.execution.runId, baseline[1].metadata.execution.runId)
  assert.equal(holdout[0].metadata.execution.runId, holdout[1].metadata.execution.runId)
  assert.notEqual(baseline[0].metadata.execution.runId, holdout[0].metadata.execution.runId, 'Holdout must be a separate workflow run')
  for (let index = 0; index < 2; index++) {
    assert.deepEqual(baseline[index].metadata.parsers, holdout[index].metadata.parsers)
    assert.equal(baseline[index].metadata.runnerSha256, holdout[index].metadata.runnerSha256)
  }
  const host = data => ({ cpu: data.metadata.cpu, node: data.metadata.node, cpus: data.metadata.execution.availableCpus })
  for (const run of [baseline, holdout]) assert.deepEqual(host(run[0]), host(run[1]), 'Host differs within workflow run')
  const sameHost = [...baseline, ...holdout].every(data => JSON.stringify(host(data)) === JSON.stringify(host(baseline[0])))
  const validateRounds = (group, other, timing) => {
    assert.ok(group.rounds.length > 0)
    assert.equal(group.rounds.length, other.rounds.length, 'Worker round count differs')
    const sizes = rows => rows.map(row => row.size).sort((a, b) => a - b)
    if (timing) {
      assert.equal(new Set(sizes(group.rows)).size, group.rows.length, 'Duplicate timing sizes')
      assert.deepEqual(sizes(group.rows), sizes(other.rows), 'Timing population differs')
    }
    for (const round of [...group.rounds, ...other.rounds]) {
      if (timing || Object.hasOwn(round, 'completed')) assert.equal(round.completed, true, 'Incomplete worker round')
      assert.ok(!round.workerError, 'Failed worker round')
      if (Object.hasOwn(round, 'exitCode')) assert.equal(round.exitCode, 0)
      if (timing) assert.deepEqual(sizes(round.rows), sizes(group.rows), 'Worker timing population differs')
      else {
        assert.ok(round.samples.length > 0)
        assert.ok(round.heapIterations > 0)
        assert.equal(round.size, group.size)
        assert.equal(round.bytes, group.bytes)
        assert.equal(round.htmlPath, group.htmlPath)
      }
    }
  }
  const key = (group, index) => index === 0 ? `${group.reader}/${group.mode}/${group.family}` : `${group.variant}/${group.phase}/${group.family}`
  for (let index = 0; index < 2; index++) {
    const keys = data => data.groups.map(group => key(group, index)).sort()
    assert.deepEqual(keys(baseline[index]), keys(holdout[index]), 'Holdout population differs')
    assert.equal(new Set(keys(baseline[index])).size, baseline[index].groups.length, 'Duplicate calibration groups')
  }
  const rows = []
  for (const group of baseline[0].groups) {
    const other = holdout[0].groups.find(row => row.reader === group.reader && row.mode === group.mode && row.family === group.family)
    assert.ok(other?.completed && group.completed)
    validateRounds(group, other, true)
    for (const row of group.rows) {
      const values = data => data.rounds.map(round => {
        const result = round.rows.find(value => value.size === row.size)
        assert.equal(result.bytes, row.bytes)
        assert.equal(result.sourceSha256, row.sourceSha256)
        assert.equal(result.status, 'ok')
        return median(result.samplesMs)
      })
      rows.push({ reader: group.reader, phase: group.mode, family: group.family, size: row.size,
        sourceSha256: row.sourceSha256, metric: 'wall-ms-per-call', ...envelope(values(group), values(other)) })
    }
  }
  for (const group of baseline[1].groups) {
    const other = holdout[1].groups.find(row => row.variant === group.variant && row.phase === group.phase && row.family === group.family)
    assert.ok(other)
    assert.equal(other.size, group.size)
    assert.equal(other.htmlPath, group.htmlPath)
    validateRounds(group, other, false)
    for (const round of [...group.rounds, ...other.rounds]) assert.equal(round.sourceSha256, group.rounds[0].sourceSha256)
    rows.push({ reader: group.variant, phase: group.phase, family: group.family, size: group.size,
      htmlPath: group.htmlPath, sourceSha256: group.rounds[0].sourceSha256,
      metric: 'profile-worker-wall-ms-per-call',
      ...envelope(group.rounds.map(round => median(round.samples.map(sample => sample.wallMs))),
        other.rounds.map(round => median(round.samples.map(sample => sample.wallMs)))) })
    rows.push({ reader: group.variant, phase: group.phase, family: group.family, size: group.size,
      htmlPath: group.htmlPath, sourceSha256: group.rounds[0].sourceSha256,
      metric: 'sampled-allocation-bytes-per-call',
      ...envelope(group.rounds.map(round => round.sampledAllocationBytes / round.heapIterations),
        other.rounds.map(round => round.sampledAllocationBytes / round.heapIterations)) })
  }
  return { metadata: { baselineRun: baseline[0].metadata.execution, holdoutRun: holdout[0].metadata.execution,
    sameHost, baselineCpu: baseline[0].metadata.cpu, holdoutCpu: holdout[0].metadata.cpu,
    evidence: paths.map(path => ({ path, sha256: hash(path) })) },
    method: 'Training limits are maxima of fresh-worker summaries from the earlier controlled run. A separate workflow run supplies held-out observations. Batches within a worker are not independent samples. No multiplier or host-independent timing threshold is imposed.',
    uncertainty: 'Next-worker coverage is training worker count divided by that count plus one under exchangeability. CPU/runtime differences, scheduling and sampled-allocation noise further restrict interpretation. Limits remain observation-only; deterministic scaling guards are enforced separately.', rows }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const paths = process.argv.slice(2, 6), output = process.argv[6] ?? 'reports/regression-budgets.json'
  assert.equal(paths.length, 4)
  writeFileSync(output, JSON.stringify(calibrate(paths.slice(0, 2).map(read), paths.slice(2).map(read), paths), null, 2) + '\n')
}
