export function regexWork(run) {
  const exec = RegExp.prototype.exec, totals = new Map()
  RegExp.prototype.exec = function (value) {
    if (typeof value !== 'string') return Reflect.apply(exec, this, [value])
    const input = value
    const key = this.toString(), row = totals.get(key) ?? {
      pattern: key, calls: 0, inputChars: 0, successes: 0, matchedChars: 0, globalAdvance: 0,
    }
    const start = this.lastIndex
    row.calls++; row.inputChars += input.length
    totals.set(key, row)
    const match = Reflect.apply(exec, this, [input])
    if (match) { row.successes++; row.matchedChars += match[0].length }
    if (this.global && !this.sticky && typeof start === 'number') {
      const from = Math.min(input.length, Math.max(0, Math.floor(start) || 0))
      row.globalAdvance += Math.max(0, (match ? this.lastIndex : input.length) - from)
    }
    return match
  }
  try { run() } finally { RegExp.prototype.exec = exec }
  return [...totals.values()].sort((a, b) => b.inputChars - a.inputChars || a.pattern.localeCompare(b.pattern))
}

export function suffixWork(run) {
  const endsWith = String.prototype.endsWith
  const totals = { calls: 0, suffixChars: 0, successes: 0 }
  String.prototype.endsWith = function (...args) {
    const result = Reflect.apply(endsWith, this, args)
    totals.calls++
    if (typeof args[0] === 'string') totals.suffixChars += args[0].length
    if (result) totals.successes++
    return result
  }
  try { run() } finally { String.prototype.endsWith = endsWith }
  return totals
}
