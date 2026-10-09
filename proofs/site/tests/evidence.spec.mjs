import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const evidence = JSON.parse(readFileSync('_site/data/evidence.json'));
const charts = JSON.parse(readFileSync('_site/charts/index.json'));
test('all views load without browser errors', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  for (const view of ['overview', 'ownership', 'behavior', 'scaling', 'proofs', 'history']) {
    await page.goto(`/#${view}`); await expect(page.locator('nav a[aria-current=page]')).toHaveAttribute('href', `#${view}`); await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('h1')).not.toHaveText('Evidence unavailable');
  }
  expect(errors).toEqual([]);
});
test('ownership filters reproduce recorded counts and render safe outputs', async ({ page }) => {
  await page.goto('/#ownership');
  await expect(page.locator('.result-count')).toHaveText('535 of 535 cases');
  await page.getByLabel('Fixture family').selectOption('fences');
  await expect(page.locator('.result-count')).toHaveText('42 of 535 cases');
  await page.getByLabel('Result', { exact: true }).selectOption('all');
  await expect(page.locator('.result-count')).toHaveText('42 of 535 cases');
  await expect(page.locator('iframe').first()).toHaveAttribute('sandbox', '');
  await page.getByLabel('Search case or source').fill('no-such-fixture');
  await expect(page.locator('.result-count')).toHaveText('0 of 535 cases');
});
test('language cases retain each reader and separate native views', async ({ page }) => {
  await page.goto('/#behavior');
  await page.getByLabel('Edit family', { exact: true }).selectOption('wrapping');
  await expect(page.locator('.outputs article')).toHaveCount(3);
  await page.getByLabel('Dataset').selectOption('djot-v-results');
  await expect(page.locator('.outputs article')).toHaveCount(2);
  await page.getByLabel('Dataset').selectOption('djot-differential');
  await expect(page.getByLabel('Reproducer')).toBeVisible();
});
test('chart exports and table match the selected dataset', async ({ page, request }) => {
  await page.goto('/#scaling');
  await page.getByLabel('Dataset').selectOption('native');
  await page.getByLabel('Metric', { exact: true }).selectOption('allocation');
  await expect(page.locator('.chart')).toHaveAttribute('src', /native-.*-allocation.svg/);
  for (const ext of ['SVG', 'PNG', 'CSV', 'JSON']) {
    const url = await page.getByRole('link', { name: `Download ${ext}` }).getAttribute('href');
    const response = await request.get(`/${url}`); expect(response.ok()).toBeTruthy();
  }
  await expect(page.locator('tbody')).toContainText('djot.v / OCaml');
  await expect(page.locator('tbody')).not.toContainText('commonmark');
});
test('history includes resolved disagreements and changed consensus outputs', () => {
  expect(evidence.history.before).toBe(43); expect(evidence.history.after).toBe(0);
  expect(evidence.history.changes).toHaveLength(49);
  expect(evidence.history.changes.filter(c => c.before.groups.length > 1)).toHaveLength(43);
  expect(evidence.history.changes.filter(c => c.before.groups.length === 1)).toHaveLength(6);
  expect(evidence.history.changes.every(c => c.after.groups.length === 1)).toBeTruthy();
  expect(evidence.theorems).toHaveLength(26);
});
test('exported chart values preserve source medians and missing observations', () => {
  const chart = charts.find(c => c.id === 'javascript-long-line-parse-wall');
  const group = evidence.reports['comparison-timings'].groups.find(g => g.reader === 'carve' && g.family === 'long-line' && g.mode === 'parse');
  for (const round of group.rounds) {
    expect(chart.points.filter(p => p.reader === `carve / round ${round.round + 1}`).map(p => p.value)).toEqual(round.rows.map(r => r.medianMs));
  }
  const tail = charts.filter(c => c.dataset === 'tail-change');
  expect(tail).toHaveLength(6);
  for (const chart of tail) expect(chart.metadata.after.engine).toBe('github:markup-carve/carve-js#8fe00fd672e1d9af43fe1f92ca1cc64387412990');
  const costs = JSON.parse(readFileSync('reports/current-costs.json'));
  const costChart = charts.find(c => c.id === 'current-costs-long-line-parse-wall');
  for (const point of costChart.points) {
    const [variant, round] = point.reader.split(' / round ');
    const group = costs.groups.find(g => g.family === 'long-line' && g.phase === 'parse' && g.variant === variant);
    const values = group.rounds[Number(round) - 1].samples.map(s => s.wallMs).sort((a, b) => a - b);
    expect(point.value).toBe(values[3]);
  }
  const missing = charts.filter(c => c.dataset === 'scaling').flatMap(c => c.points).filter(p => p.status !== 'ok');
  expect(missing.length).toBeGreaterThan(0); expect(missing.every(p => p.value === null)).toBeTruthy();
});
test('mobile layout fits the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const view of ['overview', 'ownership', 'scaling', 'proofs']) {
    await page.goto(`/#${view}`); await expect(page.locator('nav a[aria-current=page]')).toHaveAttribute('href', `#${view}`); await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  }
});
test('fixture HTML cannot execute scripts or load external images', async ({ page }) => {
  const poisoned = structuredClone(evidence.reports['ownership-current-results']);
  const row = poisoned.rows[0];
  row.groups = [['spec'], ['js', 'php', 'rs']];
  row.outputs.spec = '<script>parent.document.body.dataset.injected="yes"</script><img src="https://example.invalid/tracker">';
  const failures = [];
  page.on('requestfailed', r => { if (r.url().includes('example.invalid')) failures.push(r.failure().errorText); });
  await page.route('**/reports/ownership-current-results.json', route => route.fulfill({ json: poisoned }));
  await page.goto('/#ownership');
  await expect(page.locator('iframe').first()).toBeVisible();
  expect(await page.locator('body').getAttribute('data-injected')).toBeNull();
  await expect.poll(() => failures.some(error => /csp/i.test(error))).toBeTruthy();
});
test('refreshed contracts and prefix comparisons expose their scope', async ({ page }) => {
  await page.goto('/#behavior');
  await page.getByLabel('Dataset').selectOption('comparison-contracts');
  await expect(page.getByText('Contract hypotheses and scope')).toBeVisible();
  await page.getByLabel('Edit family', { exact: true }).selectOption('nested-container-payload');
  await expect(page.locator('.outputs article')).toHaveCount(3);
  await page.getByLabel('Dataset').selectOption('container-regressions');
  await page.getByLabel('Container case').selectOption({ label: 'unicode/mixed/16' });
  await expect(page.locator('pre:visible').first()).toContainText('日本語');
  await page.goto('/#scaling');
  await page.getByLabel('Dataset').selectOption('prefix-change');
  await expect(page.locator('tbody')).toContainText('before / c5df77f658');
  await expect(page.locator('tbody')).toContainText(`after / ${evidence.reports['nesting-profile'].metadata.engine.split('#')[1].slice(0, 10)}`);
});

test('nesting charts distinguish matched spans and suffix exposure', async ({ page }) => {
  await page.goto('/#scaling');
  await page.getByLabel('Dataset').selectOption('profile-js');
  await page.getByLabel('Input family', { exact: true }).selectOption('quotes');
  await page.getByLabel('API phase', { exact: true }).selectOption('parse');
  await page.getByLabel('Metric', { exact: true }).selectOption('regex-matched');
  await expect(page.locator('main')).toContainText('Successful regex match lengths');
  await page.getByLabel('Metric', { exact: true }).selectOption('suffix-input');
  await expect(page.locator('main')).toContainText('Suffix argument lengths');
});

test('remaining container tail charts expose baseline and candidate work', async ({ page }) => {
  await page.goto('/#scaling');
  await page.getByLabel('Dataset').selectOption('container-tails');
  await page.getByLabel('Input family', { exact: true }).selectOption('ordered');
  await page.getByLabel('Metric', { exact: true }).selectOption('regex-matched');
  await expect(page.locator('tbody')).toContainText('baseline /');
  await expect(page.locator('tbody')).toContainText('candidate /');
  await expect(page.locator('tbody')).toContainText('177723');
  await expect(page.locator('tbody')).toContainText('5115');
  await page.getByLabel('Input family', { exact: true }).selectOption('attributes');
  await page.getByLabel('Metric', { exact: true }).selectOption('suffix-input');
  await expect(page.locator('tbody')).toContainText('49152');
  await page.getByLabel('Metric', { exact: true }).selectOption('regex-input');
  const counts = charts.find(c => c.id === 'container-tails-attributes-parse-regex-input');
  for (const point of counts.points) await expect(page.locator('tbody')).toContainText(String(point.value));
  await page.getByLabel('Input family', { exact: true }).selectOption('long-attributes-task');
  await expect(page.locator('main')).toContainText('Candidate only.');
  await expect(page.locator('tbody')).toContainText('101281');
});

test('position-cost charts retain variants and expose run provenance', async ({ page }) => {
  await page.goto('/#scaling');
  await page.getByLabel('Dataset').selectOption('current-costs');
  await page.getByLabel('Input family', { exact: true }).selectOption('long-line');
  await page.getByLabel('API phase', { exact: true }).selectOption('parse');
  await page.getByLabel('Metric', { exact: true }).selectOption('wall');
  await expect(page.locator('tbody')).toContainText('carve-no-positions');
  await expect(page.locator('tbody')).toContainText('djot-positions');
  await expect(page.locator('main')).toContainText('does not bypass position construction');
  const chart = charts.find(c => c.id === 'current-costs-long-line-parse-wall');
  await expect(page.locator('main')).toContainText(chart.metadata.generatedAt);
  await expect(page.locator('.chart')).toHaveAttribute('src', /current-costs-long-line-parse-wall.svg/);
});

test('Rust and PHP scaling expose their own memory metrics and exports', async ({ page }) => {
  await page.goto('/#scaling');
  for (const [dataset, metric, unit] of [['rust', 'allocated-bytes', 'Requested allocation bytes / operation'], ['php', 'peak-managed-growth', 'Peak managed-memory growth (bytes / call)']]) {
    await page.getByLabel('Dataset', { exact: true }).selectOption(dataset);
    await page.getByLabel('Input family', { exact: true }).selectOption('nested-quotes');
    await page.getByLabel('API phase', { exact: true }).selectOption('parse');
    await page.getByLabel('Metric', { exact: true }).selectOption(metric);
    await expect(page.locator('.chart')).toHaveAttribute('src', `charts/${dataset}-nested-quotes-parse-${metric}.svg`);
    await expect(page.getByRole('columnheader', { name: unit, exact: true })).toBeVisible();
    await expect(page.getByText('Memory metrics differ between runtimes', { exact: false })).toBeVisible();
    const download = await page.getByRole('link', { name: 'Download JSON', exact: true }).getAttribute('href');
    const response = await page.request.get(download);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.points).toHaveLength(6);
    expect(data.points.every(p => p.status === 'ok' && p.value >= 0)).toBeTruthy();
    expect(data.metadata.pins[dataset === 'rust' ? 'rs' : 'php'].commit).toMatch(/^[0-9a-f]{40}$/);
  }
});

test('all runtime chart points preserve measured samples and units', () => {
  const report = evidence.reports['runtime-timings'];
  const fields = { wall: 'samplesMs', cpu: 'samplesCpuMs', 'allocated-bytes': 'samplesAllocatedBytes', 'allocation-calls': 'samplesAllocationCalls', 'peak-managed-growth': 'samplesPeakManagedBytes' };
  for (const [dataset, reader, count] of [['rust', 'rs', 84], ['php', 'php', 63]]) {
    const selected = charts.filter(c => c.dataset === dataset);
    expect(selected).toHaveLength(count);
    for (const chart of selected) {
      const group = report.groups.find(g => g.reader === reader && g.family === chart.family && g.mode === chart.phase);
      expect(chart.points).toHaveLength(group.rows.length);
      for (const [index, point] of chart.points.entries()) {
        const row = group.rows[index];
        const samples = [...row[fields[chart.metric]]].sort((a, b) => a - b);
        expect(point.value).toBe(samples[2]);
        expect(point.low).toBe(samples[0]);
        expect(point.high).toBe(samples[4]);
        expect(point.x).toBe(chart.xUnit === 'depth' ? row.size : row.bytes);
      }
    }
  }
});

test('paired JavaScript controls expose both rounds and exact exports', async ({ page }) => {
  await page.goto('/#scaling');
  await page.getByLabel('Dataset', { exact: true }).selectOption('javascript');
  await page.getByLabel('Input family', { exact: true }).selectOption('long-unicode');
  await page.getByLabel('API phase', { exact: true }).selectOption('parse');
  await page.getByLabel('Metric', { exact: true }).selectOption('wall');
  await expect(page.locator('tbody')).toContainText('carve / round 1');
  await expect(page.locator('tbody')).toContainText('carve / round 2');
  const chart = charts.find(c => c.id === 'javascript-long-unicode-parse-wall');
  expect(chart.points).toHaveLength(24);
  expect(new Set(chart.points.map(p => p.reader)).size).toBe(6);
  expect(chart.metadata.execution).toEqual(evidence.reports['comparison-timings'].metadata.execution);
  await expect(page.locator('a[download$=".csv"]')).toHaveAttribute('href', /javascript-long-unicode-parse-wall.csv$/);
  await page.getByLabel('Dataset', { exact: true }).selectOption('current-costs');
  await page.getByLabel('Input family', { exact: true }).selectOption('inline-links');
  await page.getByLabel('API phase', { exact: true }).selectOption('direct-html-probe');
  await page.getByLabel('Metric', { exact: true }).selectOption('wall');
  await expect(page.locator('tbody')).toContainText('carve / round 2');
  await expect(page.locator('.chart')).toHaveAttribute('src', /current-costs-inline-links-direct-html-probe-wall.svg$/);
});
