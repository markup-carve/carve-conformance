import assert from 'node:assert/strict'

export function validateProofSource(source) {
  // This prototype uses explicit theorem binders instead of section variables.
  assert.doesNotMatch(source, /\b(?:Axiom|Axioms|Parameter|Parameters|Hypothesis|Hypotheses|Variable|Variables|Conjecture|Context|Extract|Extraction|Admitted|admit|Admit)\b/,
    'Local assumptions and admitted proofs are forbidden in the prototype.')
  assert.doesNotMatch(source, /Unset\s+(?:Guard|Positivity|Universe)\s+Checking/,
    'Kernel checks must remain enabled.')
  assert.doesNotMatch(source, /Print\s+Assumptions/,
    'The runner generates assumption reports; the model must not print its own.')
  // Remove nested comments before enumerating declarations.
  let code = '', depth = 0
  for (let i = 0; i < source.length; i++) {
    const pair = source.slice(i, i + 2)
    if (pair === '(*') { depth++; i++; code += ' '; continue }
    if (pair === '*)') { assert.ok(depth > 0, 'Unmatched comment closer'); depth--; i++; continue }
    if (depth === 0) code += source[i]
    else if (source[i] === '\n') code += '\n'
  }
  assert.equal(depth, 0, 'Unclosed model comment')
  const names = [...code.matchAll(/\b(?:Theorem|Lemma|Corollary|Fact|Remark|Proposition|Example)\s+([A-Za-z_][\w']*)/g)]
    .map(match => match[1])
  assert.ok(names.length > 0, 'No theorem declarations found')
  assert.equal(new Set(names).size, names.length, 'Duplicate theorem name')
  return names
}

export function validateAssumptions(output, names) {
  const reports = output.split(/^CARVE_ASSUMPTIONS:/m).slice(1)
  assert.equal(reports.length, names.length, 'Missing or duplicate theorem assumption report')
  for (const [i, report] of reports.entries()) {
    const [name, ...body] = report.trim().split('\n')
    assert.equal(name, names[i], 'Assumption report names the wrong theorem')
    assert.equal(body.join('\n').trim(), 'Closed under the global context',
      `${name}: theorem depends on assumptions or disabled kernel checks`)
  }
}

