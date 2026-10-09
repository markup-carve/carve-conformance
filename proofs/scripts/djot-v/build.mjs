import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs'
import { root, pin, opamArgs, output, driverHash, binaryHash } from './environment.mjs'
const cache = root + '.cache/djot-v'
const run = (bin,args) => execFileSync(bin,args,{cwd:root,stdio:'inherit'})
mkdirSync(root+'.cache',{recursive:true})
if (!existsSync(cache+'/.git')) {
  mkdirSync(cache,{recursive:true}); run('git',['-C',cache,'init'])
}
if (spawnSync('git',['-C',cache,'rev-parse','--verify','HEAD'],{stdio:'ignore'}).status !== 0) {
  run('git',['-C',cache,'fetch','--depth','1',pin.repository,pin.commit])
  run('git',['-C',cache,'checkout','--detach',pin.commit])
}
assert.equal(output('git',['-C',cache,'rev-parse','HEAD']),pin.commit,'Cache uses another revision; preserve it and use a fresh cache')
assert.equal(output('git',['-C',cache,'status','--porcelain','--untracked-files=no']),'','Pinned extraction has local changes')
assert.equal(output('opam',[...opamArgs,'ocamlopt','-version']),'4.14.2','Use the recorded OCaml version')
assert.equal(output('opam',[...opamArgs,'dune','--version']),'3.23.1','Use the recorded Dune version')
const build = cache + '/dist/_build/default'
run('opam',[...opamArgs,'dune','build','--root',cache+'/dist','@all'])
copyFileSync(new URL('./driver.ml',import.meta.url), root+'.cache/djot_v_driver.ml')
run('opam',[...opamArgs,'ocamlopt','-I',build+'/kernel/.djot_kernel.objs/byte','-I',build+'/kernel/.djot_kernel.objs/native','-I',build+'/src/.djot.objs/byte','-I',build+'/src/.djot.objs/native','unix.cmxa',build+'/kernel/djot_kernel.cmxa',build+'/src/djot.cmxa',root+'.cache/djot_v_driver.ml','-o',root+'.cache/djot-v-driver'])
const metadata = { commit: pin.commit, driverSha256: driverHash(), binarySha256: binaryHash(), ocaml: output('opam',[...opamArgs,'ocamlopt','-version']), dune: output('opam',[...opamArgs,'dune','--version']) }
writeFileSync(root+'.cache/djot-v-build.json',JSON.stringify(metadata,null,2)+'\n')
console.log('Built djot.v ' + pin.commit)
