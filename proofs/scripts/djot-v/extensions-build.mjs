import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync } from 'node:fs'
import { root,opamArgs,output,extractionEnvironment } from './environment.mjs'
export function buildExtensions() {
  const built=extractionEnvironment()
  assert.equal(output('opam',[...opamArgs,'ocamlopt','-version']),built.ocaml)
  const build=root+'.cache/djot-v/dist/_build/default'
  const source=root+'.cache/djot_extensions.ml',binary=root+'.cache/djot-extensions'
  copyFileSync(new URL('./extensions.ml',import.meta.url),source)
  execFileSync('opam',[...opamArgs,'ocamlopt','-I',build+'/kernel/.djot_kernel.objs/byte','-I',build+'/kernel/.djot_kernel.objs/native','-I',build+'/src/.djot.objs/byte','-I',build+'/src/.djot.objs/native',build+'/kernel/djot_kernel.cmxa',build+'/src/djot.cmxa',source,'-o',binary],{cwd:root,stdio:'inherit'})
  return {binary,ocaml:built.ocaml}
}
