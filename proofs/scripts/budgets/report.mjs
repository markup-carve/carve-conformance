import { readFileSync, writeFileSync } from 'node:fs'
const data = JSON.parse(readFileSync('reports/regression-budgets.json', 'utf8'))
const guards = JSON.parse(readFileSync('reports/scaling-guards.json', 'utf8'))
const families = new Set(guards.rows.map(row => row.family)).size
const workerCounts = [...new Set(data.rows.map(row => row.training.length))].join(', ')
const coverage = [...new Set(data.rows.map(row => `${row.training.length}/${row.training.length + 1}`))].join(', ')
const groups = new Map()
for (const row of data.rows) {
  const key = `${row.reader}|${row.metric}`
  const group = groups.get(key) ?? { reader: row.reader, metric: row.metric, limits: 0, exceeded: 0, observations: 0 }
  group.limits++; group.exceeded += row.holdoutExceeded; group.observations += row.holdout.length
  groups.set(key, group)
}
const table = [...groups.values()].map(row => `| ${row.reader} | ${row.metric} | ${row.limits} | ${row.exceeded} / ${row.observations} |`).join('\n')
writeFileSync('reports/regression-budgets.md', `# Scaling guards and measured regression limits

The deterministic CI gate covers ${families} shared fixture families and ${guards.rows.length} sizes. It checks
one normalization-copy pass and at most two global-regex input traversals.
Instrumented trees must equal ordinary trees. Exact recorded match lengths and regex
call counts also fail CI when they change. These counters cover selected work;
nonglobal/sticky regex scan cost, backtracking, all allocations and elapsed time
remain outside that bound. Regex input exposure records argument lengths, not
actual scans or work. The [raw counters](scaling-guards.json) retain fixture hashes and reader pins.

The [training run](${data.metadata.baselineRun.runUrl}) and separate
[holdout run](${data.metadata.holdoutRun.runUrl}) use fresh paired workers and
retain each round. GitHub artifact IDs and archive digests are recorded for
[training](history/budget-training-${data.metadata.baselineRun.runId}/artifact-provenance.json)
and [holdout](history/budget-holdout-${data.metadata.holdoutRun.runId}/artifact-provenance.json);
these archive digests are separate from extracted-file hashes. The [numerical limits](regression-budgets.json) and
[CSV](regression-budgets.csv) retain every training and holdout observation.
Parse, render, full HTML, position options and rejected direct-HTML attempts stay
separate. Sampled allocation bytes per call are not peak or retained memory.

## Holdout results

| Reader | Metric | Limit rows | Held-out observations above training maximum |
|---|---|---:|---:|
${table}

Matching CPU, runtime and available CPU count: **${data.metadata.sameHost ? 'yes' : 'no'}**.
Training CPU: ${data.metadata.baselineCpu}. Holdout CPU: ${data.metadata.holdoutCpu}.

Each limit is the maximum of ${workerCounts} fresh-worker summaries, with no multiplier.
Batches within one worker are not extra independent observations. Under exchangeable
continuous observations, that maximum has only ${coverage} marginal coverage for the next
worker. Hardware differences and scheduling can weaken comparability further.
The held-out failures remain visible; they do not raise the training limit.

Timing and sampled-allocation limits are **observation-only**. The evidence does
not support portable hard CI thresholds. Deterministic guards run on every PR;
future timing enforcement requires more independent calibration workers and a
matching measurement environment. These measurements establish no general reader
speed ranking or complete parser complexity theorem.

Implementation follow-ups remain linked in [issue #11](https://github.com/markup-carve/carve-proofs/issues/11):
[position allocations](https://github.com/markup-carve/carve-js/issues/2390),
[definition scans](https://github.com/markup-carve/carve-js/issues/2391),
[container allocations](https://github.com/markup-carve/carve-js/issues/2392), and
[paragraph and inline costs](https://github.com/markup-carve/carve-js/issues/2393).
Historical reader evidence remains in [history](history/).
`)
const fields = ['reader', 'phase', 'family', 'size', 'metric', 'htmlPath', 'sourceSha256', 'training', 'holdout', 'minimum', 'limit', 'observedRange', 'holdoutExceeded', 'enforcement']
const quote = value => `"${(Array.isArray(value) ? JSON.stringify(value) : String(value ?? '')).replaceAll('"', '""')}"`
writeFileSync('reports/regression-budgets.csv', [fields.join(','), ...data.rows.map(row => fields.map(field => quote(row[field])).join(','))].join('\n') + '\n')
