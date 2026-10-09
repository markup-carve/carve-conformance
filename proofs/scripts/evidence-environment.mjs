import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { validateSpecPins } from './spec-pins.mjs'

export function evidenceEnvironment() {
  validateSpecPins()
  const spec = fileURLToPath(new URL('../spec', import.meta.url))
  const git = args => execFileSync('git', ['-C', spec, ...args], { encoding: 'utf8' }).trim()
  const installed = JSON.parse(readFileSync(new URL('../node_modules/.package-lock.json', import.meta.url)))
  return {
    specCommit: git(['rev-parse', 'HEAD']),
    specDirty: git(['status', '--porcelain', '--untracked-files=normal']) !== '',
    engine: JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).devDependencies['@markup-carve/carve'],
    installedEngine: installed.packages['node_modules/@markup-carve/carve'].resolved,
  }
}
