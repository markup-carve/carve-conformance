// carve-js next2 boundary. The lane never calls migrateTree: reference trees come from the adapters.
import { readFileSync } from 'node:fs'
import { decodeTree, encodeEnvelope, encodeTree, parse, render, write, writeWithDiagnostics } from '@markup-carve/carve-next2'

const json = value => typeof value === 'string' ? JSON.parse(value) : value
export const parseTree = source => json(encodeTree(parse(source)))
export const decode = tree => decodeTree(JSON.stringify(tree))
export const interchange = tree => json(encodeTree(decode(tree)))
export const envelope = tree => json(encodeEnvelope(decode(tree)))
export const writeSource = tree => { const out = write(decode(tree)); return typeof out === 'string' ? out : out.value ?? out.output }
export const writeReport = tree => { const out = writeWithDiagnostics(decode(tree)); return { source: out.source, diagnostics: out.diagnostics } }
export const renderHtml = tree => { const out = render(decode(tree)); return typeof out === 'string' ? out : out.value ?? out.html }
export const renderSource = source => { const out = render(source); return typeof out === 'string' ? out : out.value ?? out.html }

export function engineMetadata() {
  const pkg = JSON.parse(readFileSync(new URL('../../node_modules/@markup-carve/carve-next2/package.json', import.meta.url)))
  const dependency = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url))).devDependencies['@markup-carve/carve-next2']
  return { name: 'Carve JavaScript (next2)', version: pkg.version, revision: dependency.split('#')[1], dependency }
}
