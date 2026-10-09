# Scaling guards and measured regression limits

The deterministic CI gate covers 14 shared fixture families and 62 sizes. It checks
one normalization-copy pass and at most two global-regex input traversals.
Instrumented trees must equal ordinary trees. Exact recorded match lengths and regex
call counts also fail CI when they change. These counters cover selected work;
nonglobal/sticky regex scan cost, backtracking, all allocations and elapsed time
remain outside that bound. Regex input exposure records argument lengths, not
actual scans or work. The [raw counters](scaling-guards.json) retain fixture hashes and reader pins.

The [training run](https://github.com/markup-carve/carve-proofs/actions/runs/36656234254) and separate
[holdout run](https://github.com/markup-carve/carve-proofs/actions/runs/36735323958) use fresh paired workers and
retain each round. GitHub artifact IDs and archive digests are recorded for
[training](history/budget-training-36656234254/artifact-provenance.json)
and [holdout](history/budget-holdout-36735323958/artifact-provenance.json);
these archive digests are separate from extracted-file hashes. The [numerical limits](regression-budgets.json) and
[CSV](regression-budgets.csv) retain every training and holdout observation.
Parse, render, full HTML, position options and rejected direct-HTML attempts stay
separate. Sampled allocation bytes per call are not peak or retained memory.

## Holdout results

| Reader | Metric | Limit rows | Held-out observations above training maximum |
|---|---|---:|---:|
| carve | wall-ms-per-call | 186 | 34 / 372 |
| djot | wall-ms-per-call | 186 | 106 / 372 |
| commonmark | wall-ms-per-call | 186 | 185 / 372 |
| carve | profile-worker-wall-ms-per-call | 36 | 6 / 72 |
| carve | sampled-allocation-bytes-per-call | 36 | 25 / 72 |
| carve-no-positions | profile-worker-wall-ms-per-call | 12 | 3 / 24 |
| carve-no-positions | sampled-allocation-bytes-per-call | 12 | 7 / 24 |
| djot | profile-worker-wall-ms-per-call | 24 | 7 / 48 |
| djot | sampled-allocation-bytes-per-call | 24 | 14 / 48 |
| djot-positions | profile-worker-wall-ms-per-call | 12 | 0 / 24 |
| djot-positions | sampled-allocation-bytes-per-call | 12 | 7 / 24 |
| commonmark | profile-worker-wall-ms-per-call | 24 | 24 / 48 |
| commonmark | sampled-allocation-bytes-per-call | 24 | 9 / 48 |

Matching CPU, runtime and available CPU count: **no**.
Training CPU: AMD EPYC 7763 64-Core Processor. Holdout CPU: Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz.

Each limit is the maximum of 2 fresh-worker summaries, with no multiplier.
Batches within one worker are not extra independent observations. Under exchangeable
continuous observations, that maximum has only 2/3 marginal coverage for the next
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
