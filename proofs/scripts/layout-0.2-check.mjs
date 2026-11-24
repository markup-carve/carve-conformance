import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'carve-next2'
import { cases, engine, readingNames } from '../proofs/layout/cases-0.2.mjs'
import { cases as cases01 } from '../proofs/layout/cases.mjs'
import { validateProofSource, validateAssumptions } from './proof-validation.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (path) => readFileSync(join(root, path), 'utf8')
const verdicts = { item: 'InItem', outside: 'Outside', comment: 'InComment' }
const clausePattern = /^C2-B-\d{3}$/

// Each line below the marker line, in the alphabet of Ownership02.v.
export function classify(text) {
  const column = text.match(/^ */)[0].length
  const rest = text.slice(column)
  if (rest === '') return 'Blank'
  if (/^%{3,}$/.test(rest)) return `(CommentFence ${column})`
  if (rest.startsWith('%%')) return `(Comment ${column})`
  if (column === 0 && rest.startsWith('- ')) return 'SiblingMarker'
  if (/^(?:\*{3,}$|\|)/.test(rest)) return `(Interrupter ${column})`
  return `(Text ${column})`
}

function linesOf(entry) {
  assert.match(entry.source, /^- \S/, `${entry.name}: expected a column-zero '- ' item with text`)
  const lines = entry.source.trimEnd().split('\n').slice(1).map(classify)
  return { body: lines.slice(0, -1), follower: lines.at(-1) }
}

function validateReading(entry) {
  assert.ok(verdicts[entry.owner], `${entry.name}: unknown owner ${entry.owner}`)
  assert.ok(entry.clauses.length > 0 && entry.clauses.every(c => clausePattern.test(c)), `${entry.name}: cite C2-B clauses`)
}

export function generateChecks(source = read('proofs/layout/Ownership02.v')) {
  const names = validateProofSource(source)
  const lines = ['From Coq Require Import List.', 'Import ListNotations.', 'Require Import Ownership02.']
  for (const [i, entry] of cases.entries()) {
    validateReading(entry)
    const { body, follower } = linesOf(entry)
    lines.push(`(* ${entry.name}: ${entry.clauses.join(', ')} *)`,
      `Example trace02_${i} : owner 0 (run 0 initial [${body.join('; ')}]) ${follower} = ${verdicts[entry.owner]}.`,
      'Proof. reflexivity. Qed.')
  }
  for (const name of names) {
    lines.push(`Goal True. idtac "CARVE_ASSUMPTIONS:${name}". exact I. Qed.`, `Print Assumptions ${name}.`)
  }
  return lines.join('\n') + '\n'
}

function texts(node, out = []) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const child of node) texts(child, out)
    return out
  }
  if (node.type === 'text') out.push(node.value)
  if (node.type === 'comment') out.push(...node.value.split('\n'))
  texts(node.children, out)
  return out
}

export function observedOwner(entry, tree = parse(entry.source)) {
  const lists = tree.children.filter(block => block.type === 'list')
  assert.ok(lists.length >= 1, `${entry.name}: no top-level list`)
  const item = lists[0].children[0]
  const places = []
  if (texts(item).includes(entry.target)) places.push('item')
  for (const block of tree.children) {
    if (block.type === 'comment' && texts(block).includes(entry.target)) places.push('comment')
  }
  const elsewhere = tree.children.filter(block => block.type !== 'comment')
    .flatMap(block => block === lists[0] ? lists[0].children.slice(1) : [block])
  if (elsewhere.some(block => texts(block).includes(entry.target))) places.push('outside')
  assert.equal(places.length, 1, `${entry.name}: target found in ${places.length} places`)
  return places[0]
}

export function compareEngine(entries = cases) {
  assert.deepEqual(readingNames, cases01.map(c => c.name), 'Every 0.1 trace needs exactly one 0.2 reading.')
  assert.equal(entries.length, cases01.length, 'Reassess the trace population when changing it.')
  const changed = []
  for (const entry of entries) {
    validateReading(entry)
    assert.equal(observedOwner(entry), entry.owner, `${entry.name}: carve-js next2 changed; reassess the reading`)
    if (entry.owner !== entry.owner01) changed.push(entry.name)
  }
  return changed
}

function main(args) {
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--evidence-only'),
    'Usage: node scripts/layout-0.2-check.mjs [--evidence-only]')
  const source = read('proofs/layout/Ownership02.v')
  const names = validateProofSource(source)
  const checks = generateChecks(source)
  const changed = compareEngine()
  console.log(`Compared ${cases.length} ownership traces with carve-js ${engine.commit.slice(0, 7)}; ${changed.length} read differently from 0.1.`)
  if (args[0] === '--evidence-only') {
    console.log('Proofs NOT checked. Only reader comparisons were run.')
    return
  }
  const candidates = [['rocq', ['compile']], ['coqc', []]]
  const compiler = candidates.find(([command, prefix]) => {
    const probe = spawnSync(command, [...prefix, '--version'], { encoding: 'utf8', timeout: 10_000 })
    return !probe.error && probe.status === 0
  })
  if (!compiler) throw new Error('Rocq/Coq compiler missing. Install Rocq or Coq; no proof verification took place.')
  const dir = mkdtempSync(join(tmpdir(), 'carve-layout-02-proof-'))
  try {
    copyFileSync(join(root, 'proofs/layout/Ownership02.v'), join(dir, 'Ownership02.v'))
    writeFileSync(join(dir, 'TraceChecks02.v'), checks)
    for (const file of ['Ownership02.v', 'TraceChecks02.v']) {
      const result = spawnSync(compiler[0], [...compiler[1], '-q', file], { cwd: dir, encoding: 'utf8', timeout: 120_000 })
      process.stdout.write(result.stdout ?? '')
      process.stderr.write(result.stderr ?? '')
      if (result.error) throw new Error(`${file}: ${result.error.message}`)
      assert.equal(result.status, 0, `${file}: proof compilation failed`)
      if (file === 'TraceChecks02.v') validateAssumptions(result.stdout, names)
    }
    console.log('0.2 model theorems and trace examples checked.')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { main(process.argv.slice(2)) } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
