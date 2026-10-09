import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

export const root = fileURLToPath(new URL('../../', import.meta.url))
export const profile = process.env.CARVE_OWNERSHIP_PROFILE ?? 'recorded'
assert.ok(['recorded', 'current'].includes(profile), 'Unknown ownership profile')
export const cache = root + (profile === 'current' ? '.cache/ownership-current/' : '.cache/ownership/')
export const pins = JSON.parse(readFileSync(new URL(profile === 'current' ? './current-pins.json' : './pins.json', import.meta.url)))
const run = (command, args, cwd) => execFileSync(command, args, { cwd, stdio: 'inherit' })
const output = (command, args, cwd) => execFileSync(command, args, { cwd, encoding: 'utf8' }).trim()
export const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex')

export function jsDigest() {
  const files = readdirSync(cache + 'js/dist', { recursive: true }).filter(file => file.endsWith('.js')).sort()
  return createHash('sha256').update(JSON.stringify(files.map(file => [file, hash(cache + 'js/dist/' + file)]))).digest('hex')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  assert.ok(Number(process.versions.node.split('.')[0]) >= 24, 'Ownership builds require Node 24+')
  mkdirSync(cache, { recursive: true })
  for (const [reader, pin] of Object.entries(pins)) {
    const dir = cache + reader
    if (!existsSync(dir)) {
      mkdirSync(dir)
      run('git', ['init', '-q'], dir)
    }
    assert.equal(output('git', ['status', '--porcelain', '--untracked-files=normal'], dir), '', `Dirty ${reader} checkout`)
    const head = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim()
    if (head !== pin.commit) {
      run('git', ['fetch', '--depth', '1', pin.repository, pin.commit], dir)
      run('git', ['checkout', '--detach', pin.commit], dir)
    }
    assert.equal(output('git', ['rev-parse', 'HEAD'], dir), pin.commit)
  }
  run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], cache + 'js')
  run('npm', ['run', 'build'], cache + 'js')
  const targetDir = resolve(process.env.CARGO_TARGET_DIR ?? tmpdir() + '/cargo-shared/carve-proofs')
  run('cargo', ['build', '--locked', '--bin', 'carve', '--target-dir', targetDir], cache + 'rs')
  copyFileSync(targetDir + '/debug/carve', cache + 'carve-rs')
  writeFileSync(cache + 'build.json', JSON.stringify({ pins,
    node: process.version, php: output('php', ['-r', 'echo PHP_VERSION;']),
    rustc: output('rustc', ['--version']),
    rustBinarySha256: hash(cache + 'carve-rs'),
    jsModulesSha256: jsDigest(),
  }, null, 2) + '\n')
}
