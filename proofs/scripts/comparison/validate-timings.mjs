import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { comparisonEnvironment, comparisonTimingFiles, digest } from './environment.mjs'
import { scalingCases as comparisonScalingCases } from './scaling-cases.mjs'
import { checkControls } from './controls.mjs'
import { validateExecution } from './validate-execution.mjs'
export function validateTimings(data) {
  validateExecution(data.metadata.execution)
  const environment = comparisonEnvironment()
  assert.equal(data.metadata.engine, environment.engine)
  assert.deepEqual(data.metadata.parsers, environment.parsers)
  assert.equal(data.metadata.runnerSha256, digest(comparisonTimingFiles))
  assert.deepEqual(data.metadata.controls, checkControls())
  const expected = Object.keys(comparisonScalingCases).flatMap(f => ['parse','render','html'].flatMap(m => ['carve','djot','commonmark'].map(r => `${r}/${m}/${f}`))).sort()
  assert.deepEqual(data.groups.map(g => `${g.reader}/${g.mode}/${g.family}`).sort(),expected)
  for (const group of data.groups) {
    assert.ok(group.completed)
    assert.equal(group.rounds.length,2)
    assert.deepEqual(group.rounds.map(r => r.round),[0,1])
    assert.deepEqual(group.rows,group.rounds[0].rows)
    for (const round of group.rounds) {
      assert.ok(round.completed && !round.workerError && round.exitCode === 0 && round.signal === null)
      assert.deepEqual(round.order,round.round === 0 ? ['carve','djot','commonmark'] : ['commonmark','djot','carve'])
      assert.deepEqual(round.rows.map(r => r.size),comparisonScalingCases[group.family].sizes)
      for (const load of [round.loadStart,round.loadEnd]) assert.ok(load.length === 3 && load.every(x => Number.isFinite(x) && x >= 0))
      for (const row of round.rows) {
        const source = comparisonScalingCases[group.family].make(row.size)
        assert.equal(row.sourceSha256,createHash('sha256').update(source).digest('hex'))
        assert.equal(row.bytes,Buffer.byteLength(source))
        assert.equal(row.status,'ok')
        assert.equal(row.samplesMs.length,5); assert.equal(row.samplesCpuMs.length,5)
        assert.equal(row.batchIterations.length,5)
        assert.ok(row.batchIterations.every(n => Number.isInteger(n) && n > 0))
        assert.ok(row.samplesMs.every(x => Number.isFinite(x) && x > 0))
        assert.ok(row.samplesCpuMs.every(x => Number.isFinite(x) && x >= 0))
        const median = values => [...values].sort((a,b) => a-b)[2]
        assert.equal(row.medianMs,median(row.samplesMs)); assert.equal(row.medianCpuMs,median(row.samplesCpuMs))
      }
    }
  }
}
