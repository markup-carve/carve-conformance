import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cpus, loadavg, platform } from 'node:os'
import { depths, families, phases, source, validateContainerEvidence, containerRunnerDigest } from './container-evidence.mjs'
import { renderContainerReport } from './container-report.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
const current = { rs: option('rust'), php: option('php') }
assert.ok(current.rs && current.php, 'Provide --rust=CHECKOUT --php=CHECKOUT [--report=FILE] [--target-baseline=DIR] [--target-current=DIR]')
assert.equal(platform(), 'linux', 'The recorded clean-INI PHP command targets Linux')
const output = resolve(option('report') ?? resolve(root, 'reports/current-container-costs.json'))
assert.ok(output.endsWith('.json'), 'Report path must end with .json')
const cache = resolve(root, '.cache/current-container-costs')
mkdirSync(cache, { recursive: true })
const run = (command, args, options = {}) => execFileSync(command, args, {
  cwd: root, encoding: 'utf8', timeout: 300_000, maxBuffer: 16_000_000, ...options,
})
const git = (checkout, ...args) => run('git', ['-C', checkout, ...args]).trim()
const sha = data => createHash('sha256').update(data).digest('hex')
const pins = JSON.parse(readFileSync(resolve(root, 'scripts/ownership/pins.json')))
const paths = {}, sources = {}, binaries = {}
const fingerprint = checkout => {
  assert.equal(git(checkout, 'status', '--porcelain', '--ignore-submodules=all'), '', `Dirty checkout: ${checkout}`)
  const files = git(checkout, 'ls-files', 'src', 'Cargo.toml', 'Cargo.lock', 'composer.json').split('\n').sort()
  assert.ok(files.length > 10, 'Reader source population is unexpectedly short')
  return { commit: git(checkout, 'rev-parse', 'HEAD'), sourceSha256: sha(JSON.stringify(
    files.map(file => [file, sha(readFileSync(resolve(checkout, file)))]))), sourceFiles: files.length }
}

for (const reader of ['rs', 'php']) {
  paths[reader] = { current: resolve(current[reader]), baseline: resolve(cache, `${reader}-baseline`) }
  if (!existsSync(resolve(paths[reader].baseline, '.git'))) {
    run('git', ['clone', '--shared', '--no-checkout', paths[reader].current, paths[reader].baseline])
    run('git', ['-C', paths[reader].baseline, 'checkout', '--detach', pins[reader].commit])
  }
  assert.equal(git(paths[reader].baseline, 'rev-parse', 'HEAD'), pins[reader].commit, 'Baseline must match the historical ownership pin')
  sources[reader] = Object.fromEntries(['baseline', 'current'].map(variant => [variant, fingerprint(paths[reader][variant])]))
}

const rustFlags = ['--edition=2021', '-O']
for (const variant of ['baseline', 'current']) {
  const target = resolve(option(`target-${variant}`) ?? process.env.CARGO_TARGET_DIR ?? '/var/tmp/cargo-shared/carve-rs')
  run('cargo', ['build', '--locked', '--release', '--lib', '--manifest-path',
    resolve(paths.rs[variant], 'Cargo.toml'), '--target-dir', target], { stdio: ['ignore', 'ignore', 'inherit'] })
  binaries[variant] = resolve(cache, `rs-${variant}-worker`)
  run('rustc', [...rustFlags, resolve(root, 'scripts/runtime/container-allocation.rs'), '--extern',
    `carve=${resolve(target, 'release/libcarve.rlib')}`, '-L', `dependency=${resolve(target, 'release/deps')}`,
    '-o', binaries[variant]])
}

const phpWorker = resolve(root, 'scripts/runtime/container-worker.php')
const phpFlags = ['-n', '-d', 'extension=mbstring', '-d', 'extension=ctype']
const report = { schema: 1, generatedAt: new Date().toISOString(), sources,
  host: { platform: platform(), cpu: cpus()[0].model, logicalCpus: cpus().length, loadStart: loadavg() },
  method: 'Shared-host observations. Two fresh-process rounds, baseline/current then current/baseline. Each fixture/phase warms for 200ms and records five batches of at least 20ms. Rust counts allocation/reallocation calls and requested bytes across five separate operations; PHP records five managed-heap peaks. Rendering reuses a parsed AST, including any internal borrowed-API clone. No timing thresholds or cross-language speed ranking.',
  build: { rustc: run('rustc', ['--version']).trim(), cargo: run('cargo', ['--version']).trim(),
    workerFlags: rustFlags, libraryProfile: 'release', binarySha256: Object.fromEntries(Object.entries(binaries).map(([key, file]) => [key, sha(readFileSync(file))])) },
  runnerSha256: containerRunnerDigest(),
  roundOrder: [['baseline', 'current'], ['current', 'baseline']],
  phpFlags, phpRuntime: [], observations: [] }

for (const round of [0, 1]) for (const variant of report.roundOrder[round]) {
  const hashes = new Map()
  for (const family of families) for (const depth of depths) {
    hashes.set(`${family}/${depth}`, sha(run(binaries[variant], ['--html', family, String(depth)])))
  }
  const rustRows = run(binaries[variant], []).trim().split('\n').map(line => JSON.parse(line))
  assert.equal(rustRows.length, 18, 'Rust worker must measure all 18 fixture/phase combinations')
  for (const row of rustRows) report.observations.push({ reader: 'rs', variant, round, ...row,
    inputSha256: sha(source(row.family, row.depth)), htmlSha256: hashes.get(`${row.family}/${row.depth}`) })
  for (const family of families) for (const phase of phases) {
    const task = { mode: phase, family: family === 'quote' ? 'nested-quotes' : 'nested-lists',
      cases: depths.map(size => ({ size, source: source(family, size) })) }
    const events = run('php', [...phpFlags, phpWorker, paths.php[variant]], { input: JSON.stringify(task) })
      .trim().split('\n').map(line => JSON.parse(line))
    const runtime = events.find(event => event.event === 'runtime')
    assert.ok(runtime && runtime.opcache === false, 'PHP must use the clean INI without opcache')
    report.phpRuntime.push({ variant, round, family, phase, ...runtime })
    const rows = events.filter(event => event.event === 'result')
    assert.equal(rows.length, 3, 'PHP worker must report each requested depth')
    for (const row of rows) {
      assert.equal(row.status, 'ok', row.error)
      assert.equal(row.depth, row.size, 'PHP parsed depth must match the requested depth')
      const { size, bytes, event, status, ...samples } = row
      report.observations.push({ reader: 'php', variant, round, family, phase,
        ...samples, depth: size, inputBytes: bytes })
    }
  }
  writeFileSync(`${output}.partial`, JSON.stringify(report, null, 2) + '\n')
  console.log(`Round ${round}, ${variant}: recorded`)
}
for (const reader of ['rs', 'php']) for (const variant of ['baseline', 'current']) {
  assert.deepEqual(fingerprint(paths[reader][variant]), sources[reader][variant], 'Reader changed during measurement')
}
report.host.loadEnd = loadavg()
validateContainerEvidence(report)
writeFileSync(output, JSON.stringify(report, null, 2) + '\n')
writeFileSync(output.slice(0, -5) + '.md', renderContainerReport(report, basename(output)))
console.log(`Recorded ${report.observations.length} observations in ${output}`)
