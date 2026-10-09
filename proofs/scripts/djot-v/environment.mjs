import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { digest } from '../comparison/environment.mjs'
export const root = fileURLToPath(new URL('../../', import.meta.url))
export const pin = JSON.parse(readFileSync(new URL('./pin.json', import.meta.url)))
export const opamArgs = ['exec', ...(process.env.DJOT_V_OPAM_SWITCH ? ['--switch=' + process.env.DJOT_V_OPAM_SWITCH] : []), '--']
export const output = (bin,args,options={}) => execFileSync(bin,args,{cwd:root,encoding:'utf8',...options}).trim()
export const binaryHash = () => createHash('sha256').update(readFileSync(root+'.cache/djot-v-driver')).digest('hex')
export const driverHash = () => digest(['scripts/djot-v/driver.ml'])
export function extractionEnvironment() {
  assert.equal(output('git',['-C',root+'.cache/djot-v','rev-parse','HEAD']),pin.commit)
  assert.equal(output('git',['-C',root+'.cache/djot-v','status','--porcelain','--untracked-files=no']),'','Pinned extraction has local changes')
  const built = JSON.parse(readFileSync(root+'.cache/djot-v-build.json'))
  assert.equal(built.commit,pin.commit); assert.equal(built.driverSha256,driverHash(),'Rebuild the driver after source changes')
  assert.equal(built.binarySha256,binaryHash(),'Driver binary differs from build evidence')
  return built
}
