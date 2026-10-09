import assert from 'node:assert/strict'
export const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
export function aggregateFrames(rows, field) {
  const totals = new Map()
  for (const row of rows) {
    const { function: fn, file, line } = row, key = JSON.stringify([fn, file, line])
    const value = totals.get(key) ?? { function: fn, file, line, [field]: 0 }
    value[field] += row[field]; totals.set(key, value)
  }
  return [...totals.values()].sort((a, b) => b[field] - a[field])
}
export const regexTotals = patterns => {
  assert.ok(patterns.every(p => !p.pattern.slice(p.pattern.lastIndexOf('/') + 1).includes('y')), 'Sticky regex calls need review: instrumentation can expand split into per-position calls')
  return patterns.reduce((sum, p) => ({ calls: sum.calls + p.calls, inputChars: sum.inputChars + p.inputChars }), { calls: 0, inputChars: 0 })
}
