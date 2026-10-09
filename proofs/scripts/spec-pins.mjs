import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))

export function validateSpecPins({
  project = read('package.json'),
  lock = read('package-lock.json'),
  spec = read('spec/package.json'),
  specLock = read('spec/package-lock.json'),
  installed = read('node_modules/.package-lock.json'),
} = {}) {
  for (const name of ['@markup-carve/carve', 'ohm-js']) {
    assert.equal(project.devDependencies?.[name], spec.devDependencies?.[name],
      `${name}: manifest pin differs from the spec submodule`)
    const actual = lock.packages?.[`node_modules/${name}`]
    const expected = specLock.packages?.[`node_modules/${name}`]
    assert.ok(actual && expected, `${name}: missing lockfile entry`)
    assert.equal(actual.version, expected.version, `${name}: locked version differs from the spec submodule`)
    assert.equal(actual.resolved, expected.resolved, `${name}: locked source differs from the spec submodule`)
    const present = installed.packages?.[`node_modules/${name}`]
    assert.ok(present, `${name}: missing installed dependency evidence`)
    for (const field of ['version', 'resolved', 'integrity']) {
      assert.equal(present[field], actual[field], `${name}: installed ${field} differs from the project lock`)
    }
  }
}
