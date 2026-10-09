import assert from 'node:assert/strict'
import { readFileSync,writeFileSync } from 'node:fs'
import { pin } from './environment.mjs'
import { digest, comparisonFiles } from '../comparison/environment.mjs'
const read = name => JSON.parse(readFileSync(new URL('../../reports/'+name,import.meta.url)))
const results = read('djot-v-results.json'), timings = read('djot-v-timings.json'), proofs = read('djot-v-proofs.json')
for(const data of [results.metadata,timings.metadata,proofs]) assert.deepEqual(data.extraction,pin)
assert.equal(results.metadata.suiteSha256,digest([...comparisonFiles,'scripts/djot-v/driver.ml','scripts/djot-v/check.mjs','scripts/djot-v/adapter.mjs']))
assert.equal(timings.metadata.runnerSha256,digest(['scripts/djot-v/driver.ml','scripts/djot-v/bench.mjs','scripts/djot-v/adapter.mjs','scripts/properties/scaling-cases.mjs']))
assert.ok(results.rows.every(r=>r.outcome !== 'error'))
assert.equal(results.rows.length,280); assert.equal(results.streaming.length,36); assert.equal(results.depths.length,12)
assert.ok(timings.groups.every(g=>g.completed)); assert.equal(proofs.closedUnderGlobalContext,11)
assert.deepEqual(results.metadata.build,timings.metadata.build)
for(const view of ['kernel','document']) {
 const rows=results.rows.filter(r=>r.view===view)
 assert.equal(rows.length,140)
 assert.equal(rows.filter(r=>r.family==='dialect-probe').length,5)
 const differences=family=>rows.filter(r=>r.family===family&&r.outcome==='different')
 assert.equal(rows.filter(r=>r.family==='containers').length,40)
 assert.equal(differences('resolution').length,4)
 assert.deepEqual(differences('stability').map(r=>r.id),['list/list'])
 assert.equal(differences('wrapping').length,3)
 assert.ok(differences('wrapping').every(r=>/code/i.test(r.id)))
 assert.equal(differences('containers').length,view==='kernel'?0:4)
 assert.ok(differences('containers').every(r=>r.id.startsWith('heading/')))
}
assert.equal(results.streaming.find(r=>r.id==='list/list').committed.length,0)
assert.equal(results.streaming.find(r=>r.id==='list/list').prefixFinished.length,1)
assert.equal(new Set(timings.groups.map(g=>g.family)).size,7)
assert.equal(timings.groups.length,21)
assert.equal(Math.max(...results.depths.map(r=>r.observed)),192)
assert.ok(/version 9\.2(?:\.0)?(?:\s|$)/.test(proofs.rocq)); assert.ok(proofs.stdlib.includes('9.1.0'))
assert.equal(proofs.upstreamConsistency.status,2)
assert.equal(proofs.extractionMatches,false)
assert.deepEqual(proofs.toolchain,{ocaml:results.metadata.build.ocaml,dune:results.metadata.build.dune})
const extractionDiff=readFileSync(new URL('../../reports/djot-v-extraction.diff',import.meta.url),'utf8')
for(const name of ['BinNat.ml','FMapAVL.ml']) assert.ok(extractionDiff.includes(name))
const median = xs => [...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)]
let md = `# djot.v: executable checks and theorem scope\n\nTested [djot.v ${pin.commit.slice(0,7)}](${pin.repository.replace(/\.git$/,'')}/tree/${pin.commit}), using the packaged OCaml code with its default Djot profile and positions disabled. OCaml ${timings.metadata.build.ocaml}; Dune ${timings.metadata.build.dune}.\n\n## Behavior\n\nThese are 140 observations through each of two views of the same parser, not 280 independent inputs. The shared projection folds soft breaks into spaces, removes reference definitions and flattens sections. It retains heading attributes and code bytes. Unsupported nodes fail the adapter.\n\n| Check | Raw block parser | Document API |\n|---|---:|---:|\n`
for(const [family,label] of [['wrapping','Wrapping unchanged'],['containers','Container payload unchanged'],['locality','Reference syntax unchanged'],['resolution','HTML changes after definition'],['stability','Finished prefix unchanged after append']]) {
 const count=view=>{const rows=results.rows.filter(r=>r.family===family&&r.view===view);return `${rows.filter(r=>r.outcome===(family==='resolution'?'different':'equal')).length}/${rows.length}`}
 md+=`| ${label} | ${family==='resolution'?'n/a':count('kernel')} | ${count('document')} |\n`
}
md+=`\nThe HTML resolution checks and five dialect probes always use the document API; their duplicate records across views are not independent raw-parser checks. All observations completed without adapter errors. The three wrapping differences involve code-span bytes. Reference resolution deliberately changes four HTML outputs while syntax classification stays local.\n\nAll four document-level container differences involve headings: for \`# Heading\\n\\ntail\\n\`, the automatic ID belongs to a top-level section; inside a quote or list it belongs to the heading. The shared projection drops the section wrapper but keeps the heading ID. Raw parsing passes all 40 cases. This is a stage and projection distinction, not a counterexample to raw container uniformity. See the exact trees in [the observations](djot-v-results.json).\n\nAll 36 streaming checks pass both composition and preservation of committed blocks under the adapter projection. They split prefix and suffix into lines, call \`run_lines\` on the prefix, then resume with its state. For the list/list fixture, finishing the prefix produces one list but \`run_lines\` has committed zero blocks. The finished list can grow and change tightness when another item arrives. This explains the one append difference without contradicting committed-block stability.\n\n## Formal checks and extraction boundary\n\nThe upstream Rocq project builds with Rocq 9.2 and stdlib 9.1. Each of these eleven theorems prints \`Closed under the global context\`:\n\n${proofs.theorems.map(n=>'- `'+n+'`').join('\n')}\n\nThe [compiler transcript](djot-v-proofs.json) records the full signatures. Hard wrapping requires the configuration and line conditions in the theorem; it preserves a paragraph's structure, not arbitrary inline bytes. Quote uniformity has a header condition. List uniformity requires valid markers and items in the canonical layout. Prefix stability concerns emitted blocks, not an EOF-finished tree. Inline locality concerns classification before reference resolution. Lazy continuation requires a lazy stack, a text-classified line and no underline. List spacing is proved in one direction, under the item-safety and nonblank-first-line conditions: a loose list has a separating blank. Block-shape independence requires keyed blocks to be disabled; its projection erases inline content and table captions.\n\nFresh extraction ${proofs.extractionMatches?'matches':'differs from'} the packaged kernel under this toolchain. The [complete extraction diff](djot-v-extraction.diff) records the discrepancy; the upstream \`ocaml-pkg-check-current\` command also failed (its status and output are in the proof evidence). The diff includes generated BinNat and FMapAVL modules. Fresh files have trailing whitespace removed, matching the upstream consistency command. This run does not establish why they differ or semantic inequivalence. The behavioral and timing results use the pinned packaged kernel. The theorem checks cover Rocq definitions; extraction overrides, the public API and runtime complexity are outside these checks.\n\n## Native measurements\n\n${timings.metadata.method}\n\nHost: ${timings.metadata.cpu}, ${timings.metadata.platform}/${timings.metadata.arch}. The parse phase calls \`Doc.of_string\` and includes document processing. Render calls \`Html.of_doc\` on an already parsed document; html combines both. Five batches per point; medians below use process CPU time. Host load and all wall/CPU/allocation samples are in [the raw measurements](djot-v-timings.json). All seven families completed parse, render and combined-HTML measurements. These runs do not support a cross-runtime speed ranking against earlier JavaScript runs.\n\n| Family | Phase | Size range | CPU ms, first → last | Allocation bytes, first → last |\n|---|---|---:|---:|---:|\n`
for(const g of timings.groups){const a=g.rows[0],b=g.rows.at(-1);const measure=(r,k)=>median(r.samples.map(s=>s[k]));md+=`| ${g.family} | ${g.phase} | ${a.size} → ${b.size} | ${measure(a,'cpuMs').toFixed(4)} → ${measure(b,'cpuMs').toFixed(4)} | ${Math.round(measure(a,'allocatedBytes'))} → ${Math.round(measure(b,'allocatedBytes'))} |\n`}
md+='\nSizes mean repeated words, delimiters, paragraphs or nesting depth as defined in [the fixtures](../scripts/properties/scaling-cases.mjs). All 12 nested fixtures were checked to produce their requested AST depth, up to 192.\n\n'
for(const family of ['nested-quotes','nested-lists']) {const g=timings.groups.find(g=>g.family===family&&g.phase==='parse');const a=g.rows.find(r=>r.size===64),b=g.rows.find(r=>r.size===128);const ratio=k=>median(b.samples.map(s=>s[k]))/median(a.samples.map(s=>s[k]));md+=`For ${family}, depth 64 → 128 gives ${ratio('cpuMs').toFixed(2)}× parse CPU and ${ratio('allocatedBytes').toFixed(2)}× allocation.\n\n`}
md+=`These finite ranges do not establish an asymptotic bound. They provide regression fixtures and support measuring depth separately from document length.\n\n## Reproduce\n\nRun from the repository root after \`npm ci\`, with the OCaml/Dune and Rocq versions above available through opam:\n\n\`\`\`sh\nnpm run build:djot-v\nnpm run check:djot-v -- --check reports/djot-v-results.json --output reports/djot-v-results.json\nnpm run bench:djot-v\nnpm run proof:djot-v\nnpm run report:djot-v\n\`\`\`\n\nThe proof command records its evidence and exits nonzero on extraction mismatch. CI rebuilds the packaged runtime and checks deterministic observations. Timing and the full upstream proof/extraction check are recorded local runs, not CI gates.\n`
writeFileSync(new URL('../../reports/djot-v.md',import.meta.url),md)
