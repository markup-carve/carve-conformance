import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { parseArgs } from 'node:util'
import { validateProofSource, validateAssumptions } from './proof-validation.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
export const stackExamples = [
  { id: 'post-blank-selects-ancestor', boundary: 'blank', column: 2, boundaryColumn: 0, claim: 'None', interrupts: 'false', expected: 'Some 0', visits: 2 },
  { id: 'comment-retains-inner', boundary: 'line_comment', column: 0, boundaryColumn: 2, claim: 'None', interrupts: 'false', expected: 'Some 1', visits: 1 },
  { id: 'heading-rejects-inner-retention', boundary: 'line_comment', column: 2, boundaryColumn: 2, claim: 'None', interrupts: 'true', expected: 'Some 0', visits: 2 },
  { id: 'stale-claim-falls-back', boundary: 'ordinary', column: 4, boundaryColumn: 0, claim: 'Some 9', interrupts: 'false', expected: 'Some 1', visits: 1 },
  { id: 'ancestor-claim-selects-ancestor', boundary: 'ordinary', column: 4, boundaryColumn: 0, claim: 'Some 0', interrupts: 'false', expected: 'Some 0', unclaimed: 'Some 1', visits: 1 },
  { id: 'explicit-prefix-beats-ancestor-claim', boundary: 'ordinary', column: 0, boundaryColumn: 0, claim: 'Some 0', interrupts: 'false', expected: 'Some 1', visits: 1, overrides: { 1: { kind: 'Quote', rule: 'QuotePrefix', input: '[Greater; Space; Text]' } } },
  { id: 'outer-prefix-overrides-inner-claim', boundary: 'ordinary', column: 4, boundaryColumn: 0, claim: 'Some 1', interrupts: 'false', expected: 'Some 0', unclaimed: 'Some 1', visits: 1, overrides: { 0: { kind: 'Quote', rule: 'QuotePrefix', input: '[Greater; Space; Text]' } } },
  { id: 'outer-prefix-overrides-inner-fallback', boundary: 'ordinary', column: 4, boundaryColumn: 0, claim: 'None', interrupts: 'false', expected: 'Some 0', unclaimed: 'Some 1', visits: 1, overrides: { 0: { kind: 'Quote', rule: 'QuotePrefix', input: '[Greater; Space; Text]' } } },
  { id: 'sibling-rejects-inner', boundary: 'ordinary', column: 2, boundaryColumn: 0, claim: 'None', interrupts: 'false', expected: 'Some 0', visits: 2, overrides: { 1: { column: 4, sibling: 'true' } } },
  { id: 'closed-inner-skipped', boundary: 'ordinary', column: 2, boundaryColumn: 0, claim: 'None', interrupts: 'false', expected: 'Some 0', visits: 2, overrides: { 1: { open: 'false', input: '[Space; Space; Text]' } } },
  { id: 'no-owner', boundary: 'ordinary', column: 0, boundaryColumn: 0, claim: 'None', interrupts: 'false', expected: 'None', visits: 2 },
  { id: 'sibling-rejects-ancestor-claim', boundary: 'ordinary', column: 4, boundaryColumn: 0, claim: 'Some 0', interrupts: 'false', expected: 'None', visits: 2, overrides: { 1: { sibling: 'true' }, 0: { sibling: 'true' } } },
  { id: 'interrupt-rejects-ancestor-claim', boundary: 'ordinary', column: 4, boundaryColumn: 0, claim: 'Some 0', interrupts: 'true', expected: 'Some 1', visits: 1 },
]

export function exampleSource() {
  let source = 'From Stdlib Require Import List.\nRequire Import Ownership StackSelection.\nImport ListNotations.\n'
  for (const [i, row] of stackExamples.entries()) {
    const make = (id, base, content) => {
      const override = row.overrides?.[id] ?? {}
      return `Candidate ${id} (Frame ${override.kind ?? 'ListItem'} ${base} ${content} ${override.open ?? 'true'} true) ${row.boundary} ${row.boundaryColumn} (${override.rule ?? 'Indent 2'}) ${override.input ?? '[Text]'} ${override.column ?? row.column} ${row.interrupts} ${override.sibling ?? 'false'}`
    }
    source += `Definition stack_${i} := [${make(1, 2, 4)}; ${make(0, 0, 2)}].\n`
    source += `Example owner_${i} : select_candidates (${row.claim}) stack_${i} = ${row.expected}.\nProof. vm_compute. reflexivity. Qed.\n`
    source += `Example scan_${i} : scan_candidates None stack_${i} = ${row.unclaimed ?? row.expected}.\nProof. vm_compute. reflexivity. Qed.\n`
    source += `Example visits_${i} : selection_visits None stack_${i} = ${row.visits}.\nProof. vm_compute. reflexivity. Qed.\n`
  }
  source += 'Example empty_stack : select_candidates None [] = None.\nProof. reflexivity. Qed.\n'
  source += 'Example empty_visits : selection_visits None [] = 0.\nProof. reflexivity. Qed.\n'
  return source
}

export function runStackProof() {
  const files = ['proofs/layout/Ownership.v', 'proofs/layout/StackSelection.v']
  const source = readFileSync(join(root, files[1]), 'utf8'), names = validateProofSource(source)
  validateProofSource(readFileSync(join(root, files[0]), 'utf8'))
  const dir = mkdtempSync(join(tmpdir(), 'carve-stack-proof-'))
  const commands = [], transcripts = []
  const run = (command, args) => {
    const result = spawnSync(command, args, { cwd: dir, encoding: 'utf8', timeout: 120000 })
    if (result.error) throw result.error
    assert.equal(result.signal, null, `${command}: terminated`)
    assert.equal(result.status, 0, `${command}: ${result.stdout}\n${result.stderr}`)
    commands.push([command, ...args]); transcripts.push((result.stdout + result.stderr).replaceAll(dir, '<temporary-directory>'))
    return result.stdout
  }
  try {
    const toolchain = { rocq: run('rocq', ['--version']).trim(), ocaml: run('ocamlopt', ['-version']).trim() }
    for (const file of files) copyFileSync(join(root, file), join(dir, file.split('/').at(-1)))
    let examples = exampleSource()
    for (const name of names) examples += `Goal True. idtac "CARVE_ASSUMPTIONS:${name}". exact I. Qed.\nPrint Assumptions ${name}.\n`
    examples += 'From Stdlib Require Import Extraction ExtrOcamlBasic ExtrOcamlNatInt.\nExtraction "stack_model.ml" select_candidates selection_visits.\n'
    writeFileSync(join(dir, 'StackExamples.v'), examples)
    for (const file of ['Ownership.v', 'StackSelection.v', 'StackExamples.v']) {
      const output = run('rocq', ['compile', '-q', '-Q', '.', '', file])
      if (file === 'StackExamples.v') validateAssumptions(output, names)
    }
    writeFileSync(join(dir, 'driver.ml'), `open Stack_model
let make id base content boundary bc column =
  { candidate_id=id; candidate_frame={kind=ListItem; base_column=base; content_column=content; container_open=true; paragraph_open=true};
    candidate_boundary=boundary; candidate_boundary_column=bc; candidate_rule=Indent 2; candidate_input=[Text];
    candidate_column=column; candidate_interrupts=false; candidate_sibling=false }
let () =
  let stack=[make 1 2 4 Blank 0 2; make 0 0 2 Blank 0 2] in
  match select_candidates None stack with
  | Some 0 when selection_visits None stack = 2 ->
      let claimed=[make 1 2 4 Ordinary 0 4; make 0 0 2 Ordinary 0 4] in
      if select_candidates (Some 0) claimed <> Some 0 || selection_visits None claimed <> 1 then
        failwith "Extracted global claim changed";
      let siblings=List.map (fun c -> { c with candidate_sibling=true }) claimed in
      if select_candidates (Some 0) siblings <> None then failwith "Extracted sibling claim changed";
      print_endline "ancestor:0 visits:2; claim:0; sibling:none"
  | _ -> failwith "Extracted candidate selection changed"
`)
    run('ocamlopt', ['stack_model.mli', 'stack_model.ml', 'driver.ml', '-o', 'stack-driver'])
    const extractedOutput = run('./stack-driver', [])
    assert.equal(extractedOutput.trim(), 'ancestor:0 visits:2; claim:0; sibling:none')
    const hash = data => createHash('sha256').update(data).digest('hex')
    return { toolchain, theoremCount: names.length, theorems: names, closedUnderGlobalContext: names.length,
      examples: stackExamples.length, extractedOutput: extractedOutput.trim(),
      sourceHashes: Object.fromEntries([...files, 'scripts/stack-proof-check.mjs', 'scripts/proof-validation.mjs'].map(file => [file, hash(readFileSync(join(root, file)))])),
      transcript: transcripts.join('\n'), commands,
    }
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { output: { type: 'string' } } })
  const evidence = runStackProof()
  if (values.output) writeFileSync(values.output, JSON.stringify(evidence, null, 2) + '\n')
  console.log(`${evidence.theoremCount} candidate-selection theorems checked; extracted helper ran`)
}
