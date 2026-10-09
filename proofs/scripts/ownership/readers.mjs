import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { cache, root, pins, jsDigest } from './build.mjs'

export const names = ['spec', 'js', 'php', 'rs']
export async function readers() {
  assert.ok(Number(process.versions.node.split('.')[0]) >= 24, 'Ownership checks require Node 24+')
  const build = JSON.parse(readFileSync(cache + 'build.json'))
  assert.deepEqual(build.pins, pins, 'Rebuild ownership readers after changing pins')
  for (const name of names) {
    const git = args => execFileSync('git', ['-C', cache + name, ...args], { encoding: 'utf8' }).trim()
    assert.equal(git(['rev-parse', 'HEAD']), pins[name].commit)
    assert.equal(git(['status', '--porcelain', '--untracked-files=normal']), '', `Dirty ${name} source`)
  }
  const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex')
  assert.equal(hash(cache + 'carve-rs'), build.rustBinarySha256, 'Rust binary changed since build')
  assert.equal(jsDigest(), build.jsModulesSha256, 'JS modules changed since build')
  const { parse } = await import(pathToFileURL(cache + 'spec/scripts/spec/layout.mjs'))
  const { renderDoc } = await import(pathToFileURL(cache + 'spec/scripts/spec/html.mjs'))
  const { carveToHtml } = await import(pathToFileURL(cache + 'js/dist/index.js'))
  const run = (cmd, args, input) => execFileSync(cmd, args, { input, encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 4 * 1024 * 1024 })
  return { spec: source => renderDoc(parse(source)), js: carveToHtml,
    php: source => run('php', [root + 'scripts/ownership/php.php', cache + 'php'], source),
    rs: source => run(cache + 'carve-rs', [], source) }
}
