import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const binary = fileURLToPath(new URL('../../.cache/djot-v-driver', import.meta.url))
export function invoke(command, source, extra = []) {
  const result = spawnSync(binary, [command, ...extra], { input: source, encoding: 'utf8', timeout: 60_000, maxBuffer: 8_000_000 })
  assert.equal(result.status, 0, result.error?.message ?? result.stderr)
  return JSON.parse(result.stdout)
}
export function extractedAdapter(view = 'document') {
  const cache = new Map()
  const observe = source => { if (!cache.has(source)) cache.set(source, invoke('observe', source)); return cache.get(source) }
  return { parse: s => observe(s)[view], html: s => invoke('html', s).html }
}
