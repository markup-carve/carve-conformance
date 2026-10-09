import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

export const root = fileURLToPath(new URL('../../', import.meta.url))
export const cache = root + '.cache/runtime/'
const ownershipPins = JSON.parse(readFileSync(root + 'scripts/ownership/pins.json'))
export const pins = { rs: ownershipPins.rs, php: ownershipPins.php }
export const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex')
export const runnerFiles = ['scripts/ownership/pins.json', 'scripts/runtime/build.mjs', 'scripts/runtime/bench.mjs', 'scripts/runtime/php.php', 'scripts/runtime/rust/Cargo.toml', 'scripts/runtime/rust/Cargo.lock', 'scripts/runtime/rust/src/main.rs', 'scripts/properties/scaling-cases.mjs', 'scripts/properties/benchmark-results.mjs']
export const runnerDigest = () => createHash('sha256').update(JSON.stringify(runnerFiles.map(file => [file, hash(root + file)]))).digest('hex')
export const output = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, encoding: 'utf8' }).trim()
export function verifySources() {
  for (const [reader, pin] of Object.entries(pins)) {
    assert.equal(output('git', ['rev-parse', 'HEAD'], cache + reader), pin.commit)
    assert.equal(output('git', ['status', '--porcelain', '--untracked-files=normal'], cache + reader), '', `Dirty ${reader} checkout`)
  }
}
export function verifyBuild() {
  const build = JSON.parse(readFileSync(cache + 'build.json'))
  verifySources()
  assert.deepEqual(build.pins, pins, 'Rebuild after changing reader pins')
  assert.equal(build.runnerSha256, runnerDigest(), 'Rebuild after changing benchmark sources')
  assert.equal(build.binarySha256, hash(cache + 'carve-runtime'), 'Rust binary changed since build')
  return build
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(cache, { recursive: true })
  for (const [reader, pin] of Object.entries(pins)) {
    const dir = cache + reader
    if (!existsSync(dir)) { mkdirSync(dir); output('git', ['init', '-q'], dir) }
    assert.equal(output('git', ['status', '--porcelain', '--untracked-files=normal'], dir), '', `Dirty ${reader} checkout`)
    const head = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim()
    if (head !== pin.commit) {
      execFileSync('git', ['fetch', '--depth', '1', pin.repository, pin.commit], { cwd: dir, stdio: 'inherit' })
      output('git', ['checkout', '--detach', pin.commit], dir)
    }
  }
  verifySources()
  const sourceDigest = runnerDigest()
  const target = JSON.parse(output('cargo', ['metadata', '--format-version', '1', '--no-deps', '--locked', '--manifest-path', root + 'scripts/runtime/rust/Cargo.toml'])).target_directory
  execFileSync('cargo', ['build', '--release', '--locked', '--manifest-path', root + 'scripts/runtime/rust/Cargo.toml', '--target-dir', target], { stdio: 'inherit' })
  verifySources()
  assert.equal(runnerDigest(), sourceDigest, 'Benchmark sources changed during build; rebuild')
  copyFileSync(target + '/release/carve-runtime', cache + 'carve-runtime')
  writeFileSync(cache + 'build.json', JSON.stringify({ pins, rustc: output('rustc', ['--version']), cargo: output('cargo', ['--version']), profile: 'release', runnerSha256: runnerDigest(), binarySha256: hash(cache + 'carve-runtime') }, null, 2) + '\n')
}
