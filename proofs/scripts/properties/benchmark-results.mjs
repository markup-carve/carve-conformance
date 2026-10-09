import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export function runnerDigest() {
  const files = ['scripts/scaling-check.mjs', 'scripts/scaling-worker.mjs', 'scripts/properties/scaling-cases.mjs', 'scripts/properties/benchmark-results.mjs', 'scripts/evidence-environment.mjs', 'scripts/spec-pins.mjs']
  return createHash('sha256').update(files.map(file => readFileSync(new URL('../../' + file, import.meta.url))).join('')).digest('hex')
}

export function expectedRefusal(group) {
  return group.exitCode === 0 && !group.signal && !group.workerError &&
    group.reader === 'spec' && group.mode === 'html' && group.family === 'unmatched-brackets' &&
    group.rows.at(-1)?.status === 'refused' && group.rows.at(-1)?.size === 256 &&
    group.rows.at(-1)?.error === 'inline nesting exceeds MAX_NESTING_DEPTH'
}

export function decodeWorker(result) {
  const events = [], errors = []
  for (const line of (result.stdout ?? '').split('\n').filter(Boolean)) {
    try { events.push(JSON.parse(line)) } catch { errors.push('Malformed worker output: ' + line.slice(0, 200)) }
  }
  if (result.error) errors.push(result.error.message)
  const rows = events.filter(e => e.event === 'result')
  const last = events.filter(e => e.event === 'start').at(-1)
  if (result.status !== 0 || errors.length) {
    const error = errors.join('; ') || (result.stderr ?? '').trim() || `Worker exited with ${result.status ?? result.signal}`
    rows.push({ event: 'result', size: last?.size ?? null, bytes: last?.bytes ?? null,
      status: result.error?.code === 'ETIMEDOUT' ? 'timeout' : 'error', error })
  }
  return { rows, workerError: errors.length ? errors.join('; ') : null }
}

export function fitExponent(rows) {
  const points = rows.filter(r => r.status === 'ok' && r.medianMs > 0).map(r => [Math.log(r.bytes), Math.log(r.medianMs)])
  if (points.length < 2) return null
  const mean = i => points.reduce((sum, p) => sum + p[i], 0) / points.length
  const x = mean(0), y = mean(1)
  const denominator = points.reduce((sum, p) => sum + (p[0] - x) ** 2, 0)
  if (!denominator) return null
  return points.reduce((sum, p) => sum + (p[0] - x) * (p[1] - y), 0) / denominator
}
