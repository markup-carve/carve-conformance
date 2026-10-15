import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const packageSpec = process.env.CARVE_MCP_PACKAGE_SPEC ?? '@markup-carve/carve-mcp@latest'
const installRoot = mkdtempSync(join(tmpdir(), 'carve-published-mcp-'))
const source = '|= System |= Limit | < |\n| A | Cold | 20 |\n| ^ | Hot | 10 |\n^ Limits\n'

try {
  execFileSync('npm', ['install', '--prefix', installRoot, '--ignore-scripts', '--no-audit', '--no-fund', '--omit=dev', packageSpec, '@modelcontextprotocol/client@2.0.0'], { stdio: 'pipe' })
  const modules = join(installRoot, 'node_modules')
  const mcpRoot = join(modules, '@markup-carve', 'carve-mcp')
  const packageJson = JSON.parse(readFileSync(join(mcpRoot, 'package.json'), 'utf8'))
  const engineJson = JSON.parse(readFileSync(join(modules, '@markup-carve', 'carve', 'package.json'), 'utf8'))
  const { Client } = await import(pathToFileURL(join(modules, '@modelcontextprotocol', 'client', 'dist', 'index.mjs')).href)
  const { StdioClientTransport } = await import(pathToFileURL(join(modules, '@modelcontextprotocol', 'client', 'dist', 'stdio.mjs')).href)
  const client = new Client({ name: 'published-receipt-check', version: '1.0.0' })
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(mcpRoot, 'dist', 'index.js')], stderr: 'inherit' })
  await client.connect(transport)
  try {
    const response = await client.callTool({ name: 'carve_check_targets', arguments: { source, targets: ['html', 'markdown', 'github'] } })
    assert.notEqual(response.isError, true)
    const receipt = response.structuredContent
    assert.equal(receipt.receiptVersion, 1)
    assert.deepEqual(receipt.source, { format: 'carve', sha256: createHash('sha256').update(source, 'utf8').digest('hex') })
    assert.deepEqual(receipt.versions, { engine: engineJson.version, mcp: packageJson.version })
    assert.deepEqual(receipt.targets.map(({ target, status }) => [target, status]), [
      ['html', 'compatible'], ['markdown', 'lossy'], ['github', 'lossy'],
    ])
    for (const target of receipt.targets.filter(({ target }) => target !== 'html')) {
      assert.equal(target.lossesTruncated, false)
      assert.equal(target.lossCount, target.losses.length)
      assert.equal(target.preservation.totalDiagnostics, 3)
      assert.deepEqual(target.preservation.diagnostics.map(({ field }) => field).sort(), ['caption', 'colspan', 'rowspan'])
      assert.equal(target.preservation.complete, false)
      assert.match(target.assessmentScope.finalArtifact, /not assessed/i)
    }
    console.log(JSON.stringify({ package: packageSpec, versions: receipt.versions, statuses: receipt.targets.map(({ target, status }) => ({ target, status })) }))
  } finally {
    await client.close()
  }
} finally {
  rmSync(installRoot, { recursive: true, force: true })
}
