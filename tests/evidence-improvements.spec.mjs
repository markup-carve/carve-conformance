import {test,expect} from '@playwright/test'
import {readFileSync,existsSync} from 'node:fs'
const read = file => JSON.parse(readFileSync(new URL('../_site/'+file,import.meta.url)))
const index = read('proofs/data/index.json'), cm = read('compat/commonmark-summary.json'), generated = existsSync(new URL('../_site/compat/source-agreement-summary.json',import.meta.url)) ? read('compat/source-agreement-summary.json') : null
const findingCount = generated?.rows.filter(row=>!row.semanticAgreement || Object.values(row.results).some(r=>r.error || !r.schemaValid || !r.positions.sourceByteLengthMatches || r.positions.invalid.length)).length ?? 0

test('current ownership, proof inventory and homepage share their counts',async({page})=>{
  await page.goto('/');await expect(page.locator('#f-cases')).toHaveText(String(index.ownership.cases));await expect(page.locator('#f-theorems')).toHaveText(String(index.theorems.length+index.stackTheorems.length))
  await page.locator('#case-link').click();await expect(page.getByLabel('Case',{exact:true})).toHaveValue('list/blank/1/text')
  await page.reload();await expect(page.getByLabel('Case',{exact:true})).toHaveValue('list/blank/1/text')
  await page.goto('/proofs/#proofs');await expect(page.locator('table').first().locator('tbody tr')).toHaveCount(index.theorems.length+index.stackTheorems.length)
  await expect(page.getByText('selection_visits_bounded',{exact:true})).toBeVisible()
})
test('proofs loads only the active view and chart',async({page})=>{
  const urls=[];page.on('request',r=>urls.push(new URL(r.url()).pathname))
  await page.goto('/proofs/');await expect(page.locator('h1')).toHaveText('What the evidence says')
  expect(urls.some(u=>u.endsWith('/evidence.json')||u.endsWith('/charts/index.json'))).toBe(false)
  expect(urls.some(u=>u.includes('/reports/'))).toBe(false)
  await page.goto('/proofs/?dataset=rust&family=nested-quotes&phase=parse&metric=allocated-bytes#scaling')
  await expect(page.locator('.chart')).toHaveAttribute('src','charts/rust-nested-quotes-parse-allocated-bytes.svg')
  await page.reload();await expect(page.getByLabel('Metric',{exact:true})).toHaveValue('allocated-bytes')
})
test('current four-reader contracts and recorded-run comparisons are accessible',async({page})=>{
  await page.goto('/proofs/?dataset=ownership-current-contracts#behavior')
  await expect(page.locator('.outputs article')).toHaveCount(4)
  await page.goto('/proofs/?before=pre-prefix-refresh&after=current#history')
  await expect(page.getByLabel('Earlier behavior run')).toHaveValue('pre-prefix-refresh')
  await expect(page.locator('.result-count').last()).toContainText('observations')
})
test('matching imports with losses outside the HTML comparison can be inspected and reloaded',async({page})=>{
  const row=cm.rows.find(r=>r.honesty==='unverified-loss');test.skip(!row,'No named losses with matching HTML in this measurement')
  await page.goto(`/compat/?suite=commonmark&example=${encodeURIComponent(row.example)}&importEngine=${row.engine}&assessment=unverified-loss#commonmark`)
  const example=page.locator('#commonmark-examples>li').first()
  await expect(example.locator('summary').first()).toContainText(`Example ${row.example}`)
  await expect(example).toContainText('Diagnostic assessment: unverified-loss')
  await expect(example).toContainText(row.diagnostics[0].code)
  await page.reload();await expect(page.locator('#commonmark-examples>li').first()).toContainText(row.diagnostics[0].code)
  await expect(page.locator('#commonmark-native-totals')).toBeVisible()
})
test('all import outcomes can be filtered without loading the whole report',async({page})=>{
  const urls=[];page.on('request',r=>urls.push(new URL(r.url()).pathname))
  await page.goto('/compat/#commonmark')
  await page.getByLabel('Import outcome (CommonMark)').selectOption('declared')
  await expect(page.locator('#commonmark-count')).toContainText(`${new Set(cm.rows.filter(r=>r.status==='declared').map(r=>r.example)).size} examples (${cm.rows.filter(r=>r.status==='declared').length} engine observations)`)
  await page.getByLabel('Import outcome (CommonMark)').selectOption('not-comparable')
  await expect(page.locator('#commonmark-count')).toContainText(`${new Set(cm.rows.filter(r=>r.status==='not-comparable').map(r=>r.example)).size} examples (${cm.rows.filter(r=>r.status==='not-comparable').length} engine observations)`)
  expect(urls.some(u=>u.endsWith('/report.json')||u.endsWith('/commonmark.json')||u.endsWith('/djot.json'))).toBe(false)
})
test('adapter engine and filters survive reload',async({page})=>{
  await page.goto('/compat/');await page.locator('#engine-filter').selectOption('php');await page.locator('#tool-filter').selectOption('hast');await page.locator('#search').fill('table')
  await page.reload();await expect(page.locator('#engine-filter')).toHaveValue('php');await expect(page.locator('#tool-filter')).toHaveValue('hast');await expect(page.locator('#search')).toHaveValue('table')
})
test('generated source evidence records measured byte lengths and PHP positions',async({page})=>{
  test.skip(!generated,'Generated sources were not measured')
  await page.goto('/compat/?sourceCase=nested-quotes%2F1%2Fcrlf#source-agreement')
  await expect(page.getByLabel('Generated source case')).toHaveValue('nested-quotes/1/crlf')
  await expect(page.locator('#source-results')).toContainText(`${findingCount} sources with structural, byte-length or validation findings`)
  const row=generated.rows.find(r=>r.id==='nested-quotes/1/crlf')
  for(const engine of ['rust','php']) { const result=row.results[engine]; if(!result) continue; if(result.error) await expect(page.locator('#source-results')).toContainText(JSON.stringify(result.error)); else {if(engine==='php') expect(result.positions.positioned).toBeGreaterThan(0); await expect(page.locator('#source-results')).toContainText(`"positioned": ${result.positions.positioned}`)} }
})
test('proof navigation moves focus to the heading and skip link reaches main',async({page})=>{
  await page.goto('/proofs/');await expect(page.locator('h1')).toBeVisible()
  await page.getByRole('navigation',{name:'Evidence views'}).getByRole('link',{name:'Reader ownership'}).click()
  await expect(page.locator('h1')).toBeFocused()
  await page.locator('.skip').focus();await page.locator('.skip').press('Enter');await expect(page.locator('main')).toBeFocused()
  await page.getByLabel('Evidence profile').selectOption('historical');await expect(page.locator('.result-count').first()).toContainText('472')
})

test('skip target reloads and invalid history selections recover',async({page})=>{
  await page.goto('/proofs/#main');await expect(page.locator('h1')).toHaveText('What the evidence says')
  await page.goto('/proofs/?before=unknown&after=missing#history');await expect(page.getByLabel('Earlier behavior run')).toHaveValue('pre-prefix-refresh');await expect(page.locator('.result-count').last()).toContainText('observations')
})
test('import case links preserve all-engine filters and identify their own evidence',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copiedLink=text}}})})
  await page.goto('/compat/#commonmark')
  const rows=page.locator('#commonmark-examples>li');await rows.nth(0).locator('summary').first().click();await rows.nth(1).locator('summary').first().click()
  await rows.nth(0).getByRole('button',{name:'Copy link',exact:true}).click()
  const copied=await page.evaluate(()=>window.copiedLink);expect(new URL(copied).searchParams.get('example')).toBe(String(cm.rows[0].example))
  await page.reload();await expect(page.getByLabel('Markdown importer')).toHaveValue('')
  const queue=page.locator('#commonmark-results').getByText('Findings grouped by section and diagnostic assessment',{exact:true});await queue.click();await queue.locator('..').getByRole('button').first().click();const selection=new URL(page.url()).searchParams.get('assessment');await page.reload();await expect(page.getByLabel('Diagnostic assessment (CommonMark)')).toHaveValue(selection??'')
})
