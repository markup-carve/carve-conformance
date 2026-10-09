import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync, readFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs'
import { root, pin, opamArgs, output, extractionEnvironment } from './environment.mjs'
const built = extractionEnvironment()
const toolchain = {ocaml:output('opam',[...opamArgs,'ocamlopt','-version']),dune:output('opam',[...opamArgs,'dune','--version'])}
assert.equal(toolchain.ocaml,built.ocaml); assert.equal(toolchain.dune,built.dune)
const vendor = root + '.cache/djot-v'
execFileSync('opam',[...opamArgs,'dune','build','--root',vendor,'-j','2'],{cwd:root,stdio:'inherit'})
extractionEnvironment()
const names = ['hard_wrap_one_para','hard_wrap_para_then_rest','quote_uniformity','list_uniformity','prefix_determinism','no_future_line_dependence','classify_inlines_locality','iscan_str_no_reread','lazy_stack_line','list_spacing_separates','block_shape_independent']
const source = 'From DjotV Require Import Invariants Uniformity ListUniformity InlineScan Tightness BlockShape.\n' + names.map(name => `${name === 'block_shape_independent' ? 'Set Printing Implicit.\n' : ''}Check ${name}.\nPrint Assumptions ${name}.`).join('\n')+'\n'
writeFileSync(root+'.cache/CheckDjot.v',source)
const transcript = output('opam',[...opamArgs,'rocq','compile','-R',vendor+'/_build/default/theories','DjotV',root+'.cache/CheckDjot.v'])
assert.equal((transcript.match(/Closed under the global context/g)??[]).length,names.length)
assert.ok(!transcript.includes('Axioms:'))
const tmp = root+'.cache/djot-v-fresh-kernel'
rmSync(tmp,{recursive:true,force:true})
mkdirSync(tmp,{recursive:true})
for(const file of readdirSync(vendor+'/_build/default/extraction/ocaml')) {
  if(!/\.mli?$/.test(file) || /^(Fixtures|Generate)\./.test(file)) continue
  writeFileSync(tmp+'/'+file,readFileSync(vendor+'/_build/default/extraction/ocaml/'+file,'utf8').replace(/[\t ]+$/gm,''))
}
const diff = spawnSync('diff',['-ru','--exclude=dune',vendor+'/dist/kernel',tmp],{encoding:'utf8',maxBuffer:8*1024*1024})
assert.ok(diff.status===0||diff.status===1, diff.stderr)
writeFileSync(root+'reports/djot-v-extraction.diff',diff.stdout.replaceAll(vendor+'/dist/kernel','packaged/kernel').replaceAll(tmp,'fresh/kernel').replace(/\t\d{4}-[^\n]+/g,''))
const consistency = spawnSync('opam',[...opamArgs,'make','-C',vendor,'ocaml-pkg-check-current'],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024})
assert.ok(consistency.status===0 || consistency.status===2)
extractionEnvironment()
if(consistency.status!==0) assert.ok(consistency.stdout.includes('dist/kernel is stale'))
const data = {toolchain,upstreamConsistency:{command:['opam',...opamArgs,'make','-C','.cache/djot-v','ocaml-pkg-check-current'].join(' '),status:consistency.status,output:(consistency.stdout+consistency.stderr).replaceAll(root,'')},extraction:pin,rocq:output('opam',[...opamArgs,'rocq','--version']),stdlib:output('opam',['list',...(process.env.DJOT_V_OPAM_SWITCH ? ['--switch='+process.env.DJOT_V_OPAM_SWITCH] : []),'--installed','--short','--columns=name,version','rocq-stdlib']),theorems:names,closedUnderGlobalContext:names.length,source,transcript,extractionMatches:diff.status===0,extractionDiff:'djot-v-extraction.diff'}
writeFileSync(root+'reports/djot-v-proofs.json',JSON.stringify(data,null,2)+'\n')
console.log(`${names.length} theorems closed under the global context; extraction matches: ${data.extractionMatches}`)
if(!data.extractionMatches) process.exitCode=1
