import assert from 'node:assert/strict'
export function validateExecution(execution) {
  assert.ok(execution && execution.controlled === true, 'Committed measurements require the controlled workflow')
  assert.equal(execution.provider,'GitHub Actions')
  assert.match(execution.runId,/^[0-9]+$/)
  assert.match(execution.sourceCommit,/^[0-9a-f]{40}$/)
  assert.equal(execution.runUrl,`https://github.com/markup-carve/carve-proofs/actions/runs/${execution.runId}`)
  assert.ok(Number.isInteger(execution.availableCpus) && execution.availableCpus > 0)
  assert.ok(Number.isInteger(execution.logicalCpus) && execution.logicalCpus >= execution.availableCpus)
}
