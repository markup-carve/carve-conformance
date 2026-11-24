// Runs after compat:provision: a missing engine or pandoc binary fails here instead of skipping.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { parse as parseDjot, renderHTML } from '@djot/djot'
import { validateSpec, compareHtml, runCommonmarkSpec, runPandocDjotBaseline } from '../../scripts/compat/commonmark-spec.mjs'

const pins = JSON.parse(readFileSync('resources/engines.json'))

test('pinned pandoc converts spec examples for independent djot.js rendering', () => {
  const binary = process.env.CARVE_PANDOC ?? '.cache/pandoc/bin/pandoc'
  const probe = spawnSync(binary, ['--version'], {encoding:'utf8',timeout:15000})
  if (probe.error?.code === 'ENOENT') throw new Error(`Pinned pandoc ${pins.pandoc.version} is not provisioned at ${binary}; run npm run compat:provision`)
  const spec = validateSpec(), examples = [spec[0],...['Soft line breaks','Raw HTML','ATX headings'].map(section => spec.find(e => e.section === section)),spec.find(e => e.example === 520)]
  const baseline = runPandocDjotBaseline(examples)
  assert.equal(baseline.totals.failed, 0)
  assert.equal(baseline.rows.length, examples.length)
  for (const [i,row] of baseline.rows.entries()) {
    assert.equal(row.html, renderHTML(parseDjot(row.output)))
    assert.equal(row.status, compareHtml(examples[i].html, row.html).status)
  }
  assert.equal(baseline.rows[1].output, examples[1].markdown)
  assert.ok(baseline.rows[2].output.includes('=html'))
  assert.equal(baseline.rows[2].html, examples[2].html)
  assert.equal(baseline.rows[3].status, 'match')
  assert.equal(baseline.rows[4].status, 'match')
  assert.match(baseline.rows[4].html, /<p><img /)
})

test('three-engine reports agree on the example 40 names loss', () => {
  const report = runCommonmarkSpec(['javascript','php','rust'])
  for (const engine of ['javascript','php','rust']) {
    for (const example of [199,200,485,486,487,567]) assert.equal(report.rows.find(r => r.engine === engine && r.example === example).status, 'match')
  }
  for (const [engine, totals] of Object.entries(report.totals)) {
    assert.equal(Object.values(totals.honesty).reduce((a,b) => a+b, 0), totals.match + totals.mismatch + totals.declared)
    for (const [outcome, count] of Object.entries(totals.honesty)) assert.equal(count, report.rows.filter(r => r.engine === engine && r.honesty === outcome).length)
  }
  assert.ok(!report.reportDisagreements.some(r => r.example === 40))
  for (const row of report.rows.filter(r => r.example === 40)) {
    assert.equal(row.reportClass, 'names-loss', row.engine)
    assert.ok(row.diagnostics.some(d => d.code === 'structure-unspellable'), row.engine)
  }
})
