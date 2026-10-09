import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const [mode, ...args] = process.argv.slice(2)
assert.ok(['build', 'check', 'contracts'].includes(mode), 'Usage: node scripts/ownership/current.mjs build|check|contracts [arguments]')
const result = spawnSync(process.execPath, [fileURLToPath(new URL({ build: './build.mjs', check: './run.mjs', contracts: './check-contracts.mjs' }[mode], import.meta.url)), ...args], {
  cwd: fileURLToPath(new URL('../../', import.meta.url)),
  env: { ...process.env, CARVE_OWNERSHIP_PROFILE: 'current' }, stdio: 'inherit',
})
if (result.error) throw result.error
assert.equal(result.signal, null, 'Current ownership check was terminated')
process.exitCode = result.status
