import assert from 'node:assert/strict'
import { availableParallelism, loadavg } from 'node:os'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

export async function settleHost({ cpus = availableParallelism(), readLoad = () => loadavg()[0], now = Date.now, sleep = setTimeout, log = console.log, timeoutMs = 180_000 } = {}) {
  assert.ok(Number.isInteger(cpus) && cpus > 0)
  const deadline = now() + timeoutMs
  let consecutive = 0
  while (true) {
    const load = readLoad()
    assert.ok(Number.isFinite(load) && load >= 0)
    log(`Waiting for runner load: ${load.toFixed(2)}; target ${(cpus * 0.75).toFixed(2)}`)
    consecutive = load <= cpus * 0.75 ? consecutive + 1 : 0
    if (consecutive === 3) return
    assert.ok(now() < deadline, 'Runner load did not settle before the deadline')
    await sleep(Math.min(10_000, deadline - now()))
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await settleHost()
