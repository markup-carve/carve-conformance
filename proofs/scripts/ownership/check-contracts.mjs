import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { parseArgs } from 'node:util'
import { readers } from './readers.mjs'
import { pins, profile, cache } from './build.mjs'
import { observeContracts, contractCases } from './contracts.mjs'

assert.equal(profile, 'current', 'Run with CARVE_OWNERSHIP_PROFILE=current')
const { values } = parseArgs({ options: { check: { type: 'string' }, output: { type: 'string' } } })
const version = readFileSync(cache + 'spec/resources/grammar.ebnf', 'utf8').match(/^\s*Version: (\d+\.\d+)$/m)?.[1]
assert.equal(version, '0.1', 'These contract expectations describe the 0.1 grammar')
const result = { pins, version, projectionVersion: 1,
  suiteSha256: createHash('sha256').update(JSON.stringify(contractCases)).digest('hex'),
  rows: observeContracts(await readers()),
}
if (values.check) assert.deepEqual(result, JSON.parse(readFileSync(values.check)), 'Current contracts changed')
if (values.output) writeFileSync(values.output, JSON.stringify(result, null, 2) + '\n')
console.log(`${result.rows.length} versioned contract observations matched, including deliberate exclusions`)
